package io.eforge.enterprise.quartz.util;

import java.lang.reflect.*;
import java.util.*;
import org.springframework.util.ClassUtils;
import io.eforge.enterprise.common.constant.Constants;
import io.eforge.enterprise.common.utils.spring.SpringUtils;

/** RuoYi's five literal argument types, with exact package boundaries and no expression evaluation. */
public final class TaskInvocationPolicy {
    private TaskInvocationPolicy() {}
    public record Argument(Object value,Class<?> type) {}
    public record Target(String owner,String method,List<Argument> arguments) {
        public Target {arguments=List.copyOf(arguments);}
        public Class<?>[] parameterTypes(){return arguments.stream().map(Argument::type).toArray(Class<?>[]::new);}
        public Object[] parameterValues(){return arguments.stream().map(Argument::value).toArray();}
    }
    private static final Set<String> OBJECT_METHODS=Set.of("getClass","wait","notify","notifyAll","equals","hashCode","toString","clone","finalize");
    public static Target parse(String text) {
        if(text==null||text.isBlank()||text.length()>500)throw invalid();
        String source=text.trim();int opening=source.indexOf('(');
        if(opening==0||(opening>0&&!source.endsWith(")")))throw invalid();
        String selector=(opening<0?source:source.substring(0,opening)).trim();int separator=selector.lastIndexOf('.');
        if(separator<1)throw invalid();String owner=selector.substring(0,separator),method=selector.substring(separator+1);
        if(!identifier(method)||OBJECT_METHODS.contains(method))throw invalid();
        // Bean names are exact Spring registry keys, not Java expressions.
        // Preserve registered aliases such as "daily-task:执行"; class forms
        // still require Java identifier segments and the exact package guard.
        if(owner.contains(".")){for(String segment:owner.split("\\.",-1))if(!identifier(segment))throw invalid();}
        else if(owner.isBlank())throw invalid();
        String values=opening<0?"":source.substring(opening+1,source.length()-1);List<Argument> arguments=new ArrayList<>();
        int start=0;char quote=0;
        for(int index=0;index<values.length();index++) {
            char value=values.charAt(index);
            if(quote!=0){
                if(value==quote){int next=index+1;while(next<values.length()&&Character.isWhitespace(values.charAt(next)))next++;
                    if(next==values.length()||values.charAt(next)==',')quote=0;}
            }
            else if(value=='\''||value=='"')quote=value;
            else if(value==','){arguments.add(argument(values.substring(start,index)));start=index+1;}
        }
        if(quote!=0)throw invalid();
        if(!values.isBlank())arguments.add(argument(values.substring(start)));
        return new Target(owner,method,arguments);
    }
    private static Argument argument(String text) {
        String value=text.trim();if(value.isEmpty())throw invalid();
        char first=value.charAt(0);
        if(first=='\''||first=='"') {
            if(value.length()<2||value.charAt(value.length()-1)!=first)throw invalid();
            String literal=value.substring(1,value.length()-1);
            return new Argument(literal,String.class);
        }
        if(value.equalsIgnoreCase("true")||value.equalsIgnoreCase("false"))return new Argument(Boolean.valueOf(value),Boolean.class);
        try {
            if(value.endsWith("L"))return new Argument(Long.valueOf(value.substring(0,value.length()-1)),Long.class);
            if(value.endsWith("D"))return new Argument(Double.valueOf(value.substring(0,value.length()-1)),Double.class);
            return new Argument(Integer.valueOf(value),Integer.class);
        } catch(NumberFormatException failure){throw invalid();}
    }
    private static boolean identifier(String value) {
        if(value.isEmpty()||!Character.isJavaIdentifierStart(value.codePointAt(0)))return false;
        for(int offset=0;offset<value.length();) {
            int code=value.codePointAt(offset);
            if(!Character.isJavaIdentifierPart(code)||Character.isIdentifierIgnorable(code))return false;
            offset+=Character.charCount(code);
        }
        return true;
    }
    private static boolean allowed(Class<?> type) {
        String name=type.getPackageName();
        for(String prefix:Constants.JOB_WHITELIST_STR)if(name.equals(prefix)||name.startsWith(prefix+"."))return true;
        return false;
    }
    private static Class<?> type(Target target) {
        try {
            Class<?> type;
            if(target.owner().contains("."))type=Class.forName(target.owner(),false,TaskInvocationPolicy.class.getClassLoader());
            else {
                type=SpringUtils.getType(target.owner(),false);
                if(type==null)throw invalid();
                type=ClassUtils.getUserClass(type);
            }
            if(!Modifier.isPublic(type.getModifiers())||!allowed(type))throw invalid();return type;
        } catch(ClassNotFoundException|LinkageError|org.springframework.beans.BeansException failure){throw invalid();}
    }
    /** Legacy creation still permits a missing business method to produce its original failure log. */
    public static boolean isAllowed(String source) {
        try{type(parse(source));return true;}catch(IllegalArgumentException failure){return false;}
    }
    /** Canonical writes validate a real public task method without constructing or invoking it. */
    public static void validate(String source) {
        Target target=parse(source);Class<?> type=type(target);
        try {
            Method method=type.getMethod(target.method(),target.parameterTypes());
            if(!allowed(method.getDeclaringClass()))throw invalid();
            if(target.owner().contains("."))type.getConstructor();
        } catch(NoSuchMethodException|SecurityException failure){throw invalid();}
    }
    public static void invoke(String source) throws Exception {
        Target target=parse(source);Class<?> type=type(target);
        Method declared=type.getMethod(target.method(),target.parameterTypes());
        if(!allowed(declared.getDeclaringClass()))throw invalid();
        Object receiver=target.owner().contains(".")?type.getConstructor().newInstance():SpringUtils.getBean(target.owner());
        receiver.getClass().getMethod(target.method(),target.parameterTypes()).invoke(receiver,target.parameterValues());
    }
    private static IllegalArgumentException invalid(){return new IllegalArgumentException("Invalid or disallowed task invocation target.");}
}
