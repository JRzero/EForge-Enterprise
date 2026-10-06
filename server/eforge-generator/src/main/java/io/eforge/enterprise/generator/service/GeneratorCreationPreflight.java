package io.eforge.enterprise.generator.service;

import java.sql.*;
import java.util.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.util.GeneratorCreationAstPolicy;
import io.eforge.enterprise.generator.util.GeneratorCreationAstPolicy.PreparedTable;

/** Whole-batch read-only database preflight. DDL and metadata transactions are separate. */
public final class GeneratorCreationPreflight {
    private GeneratorCreationPreflight() {}
    public record Plan(String schema, int lowerCaseTableNames, List<PreparedTable> tables) {
        public Plan { tables = List.copyOf(tables); }
    }
    private record Context(String schema, int caseMode, String sqlMode, String engine, java.util.function.UnaryOperator<String> fold) {}
    private record Source(String name, String type, String engine) {}
    private static final Set<String> PARSER_SENSITIVE_MODES = Set.of("ANSI_QUOTES", "NO_BACKSLASH_ESCAPES", "PIPES_AS_CONCAT", "HIGH_NOT_PRECEDENCE");
    public static Plan inspect(Connection connection, String sql) {
        try {
            var context = context(connection);
            for (var mode : context.sqlMode().split(","))
                if (PARSER_SENSITIVE_MODES.contains(mode.trim().toUpperCase(Locale.ROOT)))
                    throw failure(503,"GENERATOR_CREATE_SQL_MODE_UNSUPPORTED","The database SQL mode is incompatible with safe table creation.");
            if (!GeneratorCreationAstPolicy.isLocalEngine(context.engine())) throw sourceUnsafe();
            var tables = GeneratorCreationAstPolicy.prepare(sql, context.schema(), context.caseMode(), context.fold());
            for (var table : tables) {
                if (!importable(connection, table.name())) throw failure(400,"GENERATOR_CREATE_TARGET_RESERVED","The requested target cannot be imported by the generator.");
                if (source(connection,context,table.name()) != null) throw failure(409,"GENERATOR_CREATE_TARGET_EXISTS","The requested physical target already exists.");
                try (var statement = prepare(connection,"SELECT COUNT(*) FROM gen_table WHERE table_name=?")) {
                    statement.setString(1,table.name());
                    try (var rows = statement.executeQuery()) {
                        if (!rows.next()) throw new SQLException("Missing metadata count.");
                        if (rows.getInt(1)>0) throw failure(409,"GENERATOR_TABLE_ALREADY_IMPORTED","The requested target is already imported.");
                    }
                }
            }
            var earlier = new HashSet<String>();
            var verifiedViews = new HashSet<String>();
            for (var table : tables) {
                for (var name : table.readReferences()) verifySource(connection,context,name,earlier,false,verifiedViews,new HashSet<>(),0);
                if (table.likeReference()!=null) verifySource(connection,context,table.likeReference(),earlier,true,verifiedViews,new HashSet<>(),0);
                for (var name : table.foreignKeyReferences()) {
                    if (!key(name,context).equals(key(table.name(),context)))
                        verifySource(connection,context,name,earlier,true,verifiedViews,new HashSet<>(),0);
                }
                earlier.add(key(table.name(),context));
            }
            return new Plan(context.schema(),context.caseMode(),tables);
        } catch (SQLException unavailable) {
            throw failure(503,"GENERATOR_CREATE_PREFLIGHT_UNAVAILABLE","Table creation could not inspect the database safely.");
        }
    }
    private static Context context(Connection connection) throws SQLException {
        try (var statement = prepare(connection,"SELECT DATABASE(),@@lower_case_table_names,@@session.sql_mode,@@session.default_storage_engine")) {
            try (var rows=statement.executeQuery()) {
                if (!rows.next() || rows.getString(1)==null || rows.getString(1).isBlank()) throw new SQLException("Missing selected schema.");
                int mode=rows.getInt(2);
                if (mode<0||mode>2) throw new SQLException("Unsupported identifier case mode.");
                return new Context(rows.getString(1),mode,Objects.requireNonNullElse(rows.getString(3),""),rows.getString(4),nativeFold(connection,mode));
            }
        }
    }
    private static boolean importable(Connection connection,String name) throws SQLException {
        // Match the pinned information_schema name collation, using an explicit LIKE escape.
        try (var statement=prepare(connection,"SELECT CONVERT(? USING utf8mb3) COLLATE utf8mb3_general_ci NOT LIKE 'qrtz#_%' ESCAPE '#' AND CONVERT(? USING utf8mb3) COLLATE utf8mb3_general_ci NOT LIKE 'gen#_%' ESCAPE '#'") ) {
            statement.setString(1,name); statement.setString(2,name);
            try (var rows=statement.executeQuery()) {if(!rows.next())throw new SQLException("Missing importability result.");return rows.getBoolean(1);}
        }
    }
    private static Source source(Connection connection,Context context,String name) throws SQLException {
        String comparison=context.caseMode()==0?"BINARY TABLE_NAME=?":"BINARY LOWER(CONVERT(TABLE_NAME USING utf8mb3) COLLATE utf8mb3_general_ci)=?";
        try (var statement=prepare(connection,"SELECT TABLE_NAME,TABLE_TYPE,ENGINE FROM information_schema.TABLES WHERE BINARY TABLE_SCHEMA=? AND "+comparison)) {
            statement.setString(1,context.schema()); statement.setString(2,key(name,context));
            try(var rows=statement.executeQuery()) {
                if(!rows.next())return null;
                var result=new Source(rows.getString(1),rows.getString(2),rows.getString(3));
                if(rows.next())throw new SQLException("Ambiguous physical source.");
                return result;
            }
        }
    }
    private static void verifySource(Connection connection,Context context,String name,Set<String> earlier,boolean baseRequired,
                                     Set<String> verifiedViews,Set<String> visiting,int depth) throws SQLException {
        if(earlier.contains(key(name,context)))return;
        var source=source(connection,context,name);
        if(source==null)throw failure(404,"GENERATOR_CREATE_SOURCE_NOT_FOUND","A required database source is unavailable.");
        if("BASE TABLE".equals(source.type())) {
            if(!GeneratorCreationAstPolicy.isLocalEngine(source.engine()))throw sourceUnsafe();
            return;
        }
        if(baseRequired||!"VIEW".equals(source.type()))throw sourceUnsafe();
        String identity=key(source.name(),context);
        if(verifiedViews.contains(identity))return;
        if(depth>=32||verifiedViews.size()+visiting.size()>=100||!visiting.add(identity))throw sourceUnsafe();
        try {
            String definition;
            try(var statement=prepare(connection,"SELECT VIEW_DEFINITION FROM information_schema.VIEWS WHERE BINARY TABLE_SCHEMA=? AND "+(context.caseMode()==0?"BINARY TABLE_NAME=?":"BINARY LOWER(CONVERT(TABLE_NAME USING utf8mb3) COLLATE utf8mb3_general_ci)=?"))) {
                statement.setString(1,context.schema()); statement.setString(2,key(source.name(),context));
                try(var rows=statement.executeQuery()) {
                    if(!rows.next()||(definition=rows.getString(1))==null||definition.isBlank())throw sourceUnsafe();
                }
            }
            List<PreparedTable> view;
            try {view=GeneratorCreationAstPolicy.prepare("CREATE TABLE __eforge_view_preflight AS "+definition,context.schema(),context.caseMode(),context.fold());}
            catch(ApiFailure unsafeDefinition){throw sourceUnsafe();}
            if(view.size()!=1)throw sourceUnsafe();
            for(var reference:view.get(0).readReferences()) verifySource(connection,context,reference,earlier,false,verifiedViews,visiting,depth+1);
            verifiedViews.add(identity);
        } finally {visiting.remove(identity);}
    }
    private static java.util.function.UnaryOperator<String> nativeFold(Connection connection,int mode) {
        if(mode==0)return java.util.function.UnaryOperator.identity();
        var cache=new HashMap<String,String>();
        return name -> cache.computeIfAbsent(name,value -> {
            try(var statement=prepare(connection,"SELECT LOWER(CONVERT(? USING utf8mb3) COLLATE utf8mb3_general_ci)")) {
                statement.setString(1,value);
                try(var rows=statement.executeQuery()) {
                    if(!rows.next()||rows.getString(1)==null)throw new SQLException("Missing native identifier normalization.");
                    return rows.getString(1);
                }
            } catch(SQLException unavailable){throw failure(503,"GENERATOR_CREATE_PREFLIGHT_UNAVAILABLE","Table creation could not inspect the database safely.");}
        });
    }
    private static PreparedStatement prepare(Connection connection,String sql) throws SQLException {
        var statement=connection.prepareStatement(sql);
        try {statement.setQueryTimeout(10);return statement;}
        catch(SQLException unsupportedTimeout){statement.close();throw unsupportedTimeout;}
    }
    private static String key(String name,Context context){return context.fold().apply(name);}
    private static ApiFailure sourceUnsafe(){return failure(400,"GENERATOR_CREATE_SOURCE_UNSAFE","A required database source has unsupported or unsafe behavior.");}
    private static ApiFailure failure(int status,String code,String detail){return new ApiFailure(status,code,detail);}
}