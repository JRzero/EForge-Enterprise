package io.eforge.enterprise.generator.rendering;

import java.beans.Introspector;
import java.lang.reflect.Method;
import java.math.*;
import java.util.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.DateUtils;
import io.eforge.enterprise.generator.domain.*;

/**
 * Detached rendering input, not an HTTP DTO. Capture only a privately loaded,
 * transaction-consistent metadata graph; this class performs no database reads.
 * Each legacy template receives its own working graph, including original aliases.
 */
public final class GeneratorRenderingSnapshot {
    private enum Kind { TABLE, COLUMN }
    private enum DateKind { UTIL, SQL_DATE, SQL_TIME, TIMESTAMP }
    private sealed interface Value permits Scalar, Bean, Sequence, Mapping, DateValue {}
    private record Scalar(Object value) implements Value {}
    private record Bean(Kind kind, Map<String,Value> fields) implements Value {
        Bean {fields=Collections.unmodifiableMap(new LinkedHashMap<>(fields));}
    }
    private record Sequence(List<Value> items) implements Value {
        Sequence {items=List.copyOf(items);}
    }
    private record Mapping(Map<String,Value> entries) implements Value {
        Mapping {entries=Collections.unmodifiableMap(new LinkedHashMap<>(entries));}
    }
    private record DateValue(DateKind kind,long millis,int nanos) implements Value {}
    private record Property(Method read,Method write) {}
    private static final Map<Kind,Map<String,Property>> PROPERTIES=properties();
    private final Bean table;
    private final String generationDate;

    private GeneratorRenderingSnapshot(Bean table,String generationDate) {
        this.table=table;this.generationDate=generationDate;
    }
    public static GeneratorRenderingSnapshot capture(GenTable source) {
        Value value=new Capture().value(source,0);
        if(!(value instanceof Bean bean)||bean.kind()!=Kind.TABLE)throw invalid();
        return new GeneratorRenderingSnapshot(bean,DateUtils.getDate());
    }
    public String generationDate(){return generationDate;}
    /** Fresh mutable RuoYi objects stay behind the rendering migration boundary. */
    public GenTable legacyWorkingTable() {
        return (GenTable)materialize(table,new IdentityHashMap<>());
    }
    private static Map<Kind,Map<String,Property>> properties() {
        var result=new EnumMap<Kind,Map<String,Property>>(Kind.class);
        try {
            for(var kind:Kind.values()) {
                var fields=new TreeMap<String,Property>();
                Class<?> type=kind==Kind.TABLE?GenTable.class:GenTableColumn.class;
                for(var property:Introspector.getBeanInfo(type).getPropertyDescriptors()) {
                    if(property.getReadMethod()!=null&&property.getWriteMethod()!=null)
                        fields.put(property.getName(),new Property(property.getReadMethod(),property.getWriteMethod()));
                }
                result.put(kind,Collections.unmodifiableMap(fields));
            }
        } catch(java.beans.IntrospectionException failure){throw new ExceptionInInitializerError(failure);}
        return Collections.unmodifiableMap(result);
    }
    private static boolean immutable(Object value) {
        if(value==null)return true;
        Class<?> type=value.getClass();
        return type==String.class||type==Boolean.class||type==Character.class
            ||type==Byte.class||type==Short.class||type==Integer.class||type==Long.class
            ||type==Float.class||type==Double.class||type==BigInteger.class||type==BigDecimal.class;
    }
    private static final class Capture {
        private final IdentityHashMap<Object,Value> completed=new IdentityHashMap<>();
        private final Set<Object> visiting=Collections.newSetFromMap(new IdentityHashMap<>());
        private int nodes;
        Value value(Object source,int depth) {
            if(immutable(source))return new Scalar(source);
            if(visiting.contains(source))throw invalid();
            Value previous=completed.get(source);
            if(previous!=null)return previous;
            if(depth>64||++nodes>50_000)throw invalid();
            visiting.add(source);
            Value result;
            try {
                Class<?> type=source.getClass();
                if(type==GenTable.class||type==GenTableColumn.class) {
                    Kind kind=type==GenTable.class?Kind.TABLE:Kind.COLUMN;
                    var fields=new LinkedHashMap<String,Value>();
                    for(var property:PROPERTIES.get(kind).entrySet())
                        fields.put(property.getKey(),value(property.getValue().read().invoke(source),depth+1));
                    result=new Bean(kind,fields);
                } else if(source instanceof List<?> list) {
                    var items=new ArrayList<Value>();
                    for(var item:list)items.add(value(item,depth+1));
                    result=new Sequence(items);
                } else if(source instanceof Map<?,?> map) {
                    var entries=new LinkedHashMap<String,Value>();
                    for(var entry:map.entrySet()) {
                        if(!(entry.getKey() instanceof String key))throw invalid();
                        entries.put(key,value(entry.getValue(),depth+1));
                    }
                    result=new Mapping(entries);
                } else if(type==Date.class||type==java.sql.Date.class||type==java.sql.Time.class||type==java.sql.Timestamp.class) {
                    Date date=(Date)source;
                    DateKind kind=type==Date.class?DateKind.UTIL:type==java.sql.Date.class?DateKind.SQL_DATE
                        :type==java.sql.Time.class?DateKind.SQL_TIME:DateKind.TIMESTAMP;
                    result=new DateValue(kind,date.getTime(),source instanceof java.sql.Timestamp stamp?stamp.getNanos():0);
                } else throw invalid();
            } catch(ReflectiveOperationException failure){throw invalid();}
            finally {visiting.remove(source);}
            completed.put(source,result);
            return result;
        }
    }
    private static Object materialize(Value value,IdentityHashMap<Value,Object> copies) {
        if(value instanceof Scalar scalar)return scalar.value();
        Object previous=copies.get(value);if(previous!=null)return previous;
        if(value instanceof DateValue date) {
            Date copy=switch(date.kind()) {
                case UTIL -> new Date(date.millis());
                case SQL_DATE -> new java.sql.Date(date.millis());
                case SQL_TIME -> new java.sql.Time(date.millis());
                case TIMESTAMP -> {var stamp=new java.sql.Timestamp(date.millis());stamp.setNanos(date.nanos());yield stamp;}
            };
            copies.put(value,copy);return copy;
        }
        if(value instanceof Sequence list) {
            var copy=new ArrayList<Object>();copies.put(value,copy);
            for(var item:list.items())copy.add(materialize(item,copies));return copy;
        }
        if(value instanceof Mapping map) {
            var copy=new LinkedHashMap<String,Object>();copies.put(value,copy);
            map.entries().forEach((key,item)->copy.put(key,materialize(item,copies)));return copy;
        }
        Bean bean=(Bean)value;
        Object copy=bean.kind()==Kind.TABLE?new GenTable():new GenTableColumn();
        copies.put(value,copy);
        try {
            for(var field:bean.fields().entrySet())
                PROPERTIES.get(bean.kind()).get(field.getKey()).write().invoke(copy,materialize(field.getValue(),copies));
        } catch(ReflectiveOperationException failure){throw invalid();}
        return copy;
    }
    private static ApiFailure invalid() {
        return new ApiFailure(400,"GENERATOR_SNAPSHOT_INVALID","Generator metadata cannot be captured safely.");
    }
}
