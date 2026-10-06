import java.sql.*;
import java.util.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.service.GeneratorCreationPreflight;
class GeneratorCreationPreflightMysqlProbe {
 static Object delegate(Object target,java.lang.reflect.Method method,Object[] arguments) throws Throwable {
  try{return method.invoke(target,arguments);}catch(java.lang.reflect.InvocationTargetException failure){throw failure.getCause();}
 }
 static Connection db;
 static int assertions;
 static GeneratorCreationPreflight.Plan inspect(String sql) {return GeneratorCreationPreflight.inspect(db,sql);}
 static void execute(String sql) throws SQLException {try(var statement=db.createStatement()){statement.execute(sql);}}
 static void check(boolean condition,String message){assertions++;if(!condition)throw new AssertionError(message);}
 static void refuses(String sql,int status,String code) {
  try {inspect(sql);throw new AssertionError("Expected preflight refusal: "+code);}
  catch(ApiFailure failure){check(failure.status()==status&&failure.code().equals(code),"Wrong safe failure code.");check(!failure.getMessage().contains("private")&&!failure.getMessage().contains("password"),"Private database error escaped.");}
 }
 static void absent(String name) throws SQLException {
  try(var statement=db.prepareStatement("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?")) {
   statement.setString(1,name);try(var rows=statement.executeQuery()){rows.next();check(rows.getInt(1)==0,"Read-only preflight created a target.");}
  }
 }
 public static void main(String[] args) throws Exception {
  String url=System.getenv("EFORGE_POLICY_JDBC_URL"),password=System.getenv("EFORGE_POLICY_JDBC_PASSWORD");
  try(var connection=DriverManager.getConnection(url,"root",password)) {
   db=connection;
   execute("CREATE TABLE gen_table(table_name VARCHAR(64) COLLATE utf8mb4_general_ci UNIQUE)");
   execute("INSERT INTO gen_table VALUES('metadata_only')");
   execute("CREATE TABLE owned_source(id INT PRIMARY KEY,name VARCHAR(32))");
   execute("INSERT INTO owned_source VALUES(1,'retained')");
   execute("CREATE TABLE q(id INT)");execute("INSERT INTO q VALUES(7)");
   execute("CREATE VIEW safe_view AS SELECT id FROM owned_source");
   execute("CREATE VIEW nested_view AS SELECT id FROM safe_view");
   execute("CREATE VIEW unsafe_view AS SELECT SLEEP(0) AS value");
   execute("CREATE DATABASE private_schema");execute("CREATE TABLE private_schema.private_source(id INT)");
   execute("CREATE VIEW foreign_view AS SELECT id FROM private_schema.private_source");
   execute("CREATE TABLE `g\u00e9n_reserved`(id INT)");
   var plan=inspect("CREATE TABLE fresh(id INT);CREATE TABLE second_copy LIKE owned_source");
   check(plan.tables().size()==2,"Valid batch not retained.");
   try {plan.tables().clear();throw new AssertionError("Mutable plan.");}catch(UnsupportedOperationException expected){assertions++;}
   absent("fresh");absent("second_copy");
   check(inspect("CREATE TABLE parent(id INT PRIMARY KEY);CREATE TABLE child(id INT,p INT,FOREIGN KEY(p) REFERENCES parent(id));CREATE TABLE self_fk(id INT PRIMARY KEY,p INT,FOREIGN KEY(p) REFERENCES self_fk(id))").tables().size()==3,"Planned parents/self foreign keys refused.");
   check(inspect("CREATE TABLE scoped AS WITH q AS (SELECT id FROM owned_source) SELECT id FROM q").tables().size()==1,"CTE alias demanded as a physical table.");
   check(inspect("CREATE TABLE view_copy AS SELECT id FROM nested_view").tables().size()==1,"Safe view chain refused.");
   refuses("CREATE TABLE fresh(id INT);CREATE TABLE later LIKE missing_source",404,"GENERATOR_CREATE_SOURCE_NOT_FOUND");absent("fresh");
   refuses("CREATE TABLE first_copy LIKE last_copy;CREATE TABLE last_copy(id INT)",404,"GENERATOR_CREATE_SOURCE_NOT_FOUND");absent("first_copy");
   refuses("CREATE TABLE self_read AS SELECT * FROM self_read",404,"GENERATOR_CREATE_SOURCE_NOT_FOUND");
   refuses("CREATE TABLE owned_source(id INT)",409,"GENERATOR_CREATE_TARGET_EXISTS");
   refuses("CREATE TABLE IF NOT EXISTS owned_source(id INT)",409,"GENERATOR_CREATE_TARGET_EXISTS");
   refuses("CREATE TABLE metadata_only(id INT)",409,"GENERATOR_TABLE_ALREADY_IMPORTED");
   for(String name:List.of("gen_reserved","qrtz_reserved","g\u00e9n_missing")) refuses("CREATE TABLE `"+name+"`(id INT)",400,"GENERATOR_CREATE_TARGET_RESERVED");
   refuses("CREATE TABLE fresh(id INT);CREATE TABLE bad_copy AS SELECT * FROM unsafe_view",400,"GENERATOR_CREATE_SOURCE_UNSAFE");absent("fresh");
   refuses("CREATE TABLE bad_copy AS SELECT * FROM foreign_view",400,"GENERATOR_CREATE_SOURCE_UNSAFE");
   refuses("CREATE TABLE bad_copy LIKE safe_view",400,"GENERATOR_CREATE_SOURCE_UNSAFE");
   refuses("CREATE TABLE bad_fk(id INT,p INT,FOREIGN KEY(p) REFERENCES safe_view(id))",400,"GENERATOR_CREATE_SOURCE_UNSAFE");
   int caseMode;
   try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT @@lower_case_table_names")){rows.next();caseMode=rows.getInt(1);}
   String upperSource="CREATE TABLE upper_copy LIKE EFORGE_ENTERPRISE.OWNED_SOURCE";
   if(caseMode==0) refuses(upperSource,400,"GENERATOR_CREATE_SQL_INVALID");
   else check(inspect(upperSource).tables().size()==1,"Native case-insensitive schema/source refused.");
   refuses("CREATE TABLE foreign_copy LIKE PRIVATE_SCHEMA.private_source",400,"GENERATOR_CREATE_SQL_INVALID");
   var nested=inspect("CREATE TABLE outer_binding AS WITH q AS (SELECT id FROM owned_source) SELECT id FROM (WITH q AS (SELECT id FROM q) SELECT id FROM q) inner_binding").tables().get(0);
   check(nested.readReferences().equals(Set.of("owned_source")),"Nested nonrecursive self lost outer CTE binding.");
   execute(nested.sql());
   try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT id FROM outer_binding")){check(rows.next()&&rows.getInt(1)==1&&!rows.next(),"Native outer CTE binding differs from preflight.");}
   var unicode=inspect("CREATE TABLE unicode_binding AS WITH `\u4e2d\u6587` AS (SELECT id FROM owned_source) SELECT id FROM `\u4e2d\u6587`").tables().get(0);
   check(unicode.readReferences().equals(Set.of("owned_source")),"Quoted Unicode CTE treated as physical source.");
   execute(unicode.sql());
   try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT id FROM unicode_binding")){check(rows.next()&&rows.getInt(1)==1&&!rows.next(),"Unicode CTE output changed.");}
   absent("upper_copy");absent("foreign_copy");
   int unicodeIndex=0;
   for(String[] names:List.of(new String[]{"\u0130","I"},new String[]{"\u0131","I"},new String[]{"I","\u0131"})) {
    String query="WITH `"+names[0]+"` AS (SELECT id FROM owned_source) SELECT id FROM `"+names[1]+"`";
    boolean nativeBinding;
    try(var statement=db.createStatement();var rows=statement.executeQuery(query)) {nativeBinding=rows.next()&&rows.getInt(1)==1&&!rows.next();}
    catch(SQLException missingNativeSource) {if(missingNativeSource.getErrorCode()!=1146)throw missingNativeSource;nativeBinding=false;}
    String candidate="CREATE TABLE unicode_case_"+(unicodeIndex++)+" AS "+query;
    if(nativeBinding) check(inspect(candidate).tables().get(0).readReferences().equals(Set.of("owned_source")),"Unicode CTE folding differs from native binding.");
    else refuses(candidate,404,"GENERATOR_CREATE_SOURCE_NOT_FOUND");
   }
   var physical=io.eforge.enterprise.generator.service.GeneratorCreationExecution.execute(db,"CREATE TABLE phase_first(id INT);CREATE TABLE phase_fail(v VARCHAR(70000));CREATE TABLE phase_last(id INT)");
   check(physical.tables().stream().map(t->t.state().name()).toList().equals(List.of("CREATED","FAILED","UNATTEMPTED")),"Partial DDL acknowledgement states lost.");
   check(!physical.allCreated(),"Partial creation presented as complete.");
   absent("phase_fail");absent("phase_last");
   execute("INSERT INTO phase_first VALUES(41)");
   try {io.eforge.enterprise.generator.service.GeneratorCreationExecution.execute(db,"CREATE TABLE phase_first(id INT)");throw new AssertionError("Existing target incorrectly owned on retry.");}
   catch(ApiFailure conflict){check(conflict.code().equals("GENERATOR_CREATE_TARGET_EXISTS"),"Wrong ownership conflict on retry.");}
   try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT id FROM phase_first")){check(rows.next()&&rows.getInt(1)==41&&!rows.next(),"Partial DDL/retry erased business data.");}
   var completed=io.eforge.enterprise.generator.service.GeneratorCreationExecution.execute(db,"CREATE TABLE phase_retry(id INT);CREATE TABLE phase_child LIKE phase_retry");
   check(completed.allCreated()&&completed.tables().size()==2,"Successful physical batch failed.");
   try{completed.tables().clear();throw new AssertionError("Mutable physical outcomes.");}catch(UnsupportedOperationException immutable){assertions++;}
   try{io.eforge.enterprise.generator.service.GeneratorCreationExecution.execute(db,"CREATE TABLE mixed_first(id INT);DROP TABLE owned_source");throw new AssertionError("Mixed batch executed.");}
   catch(ApiFailure invalid){check(invalid.code().equals("GENERATOR_CREATE_SQL_INVALID"),"Wrong mixed batch refusal.");}
   absent("mixed_first");
   db.setAutoCommit(false);
   try{io.eforge.enterprise.generator.service.GeneratorCreationExecution.execute(db,"CREATE TABLE transactional_first(id INT)");throw new AssertionError("DDL joined caller transaction.");}
   catch(ApiFailure invalid){check(invalid.code().equals("GENERATOR_CREATE_CONNECTION_INVALID"),"Wrong transaction boundary refusal.");}
   finally{db.setAutoCommit(true);}
   absent("transactional_first");
   Connection lostAck=(Connection)java.lang.reflect.Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class[]{Connection.class},(proxy,method,arguments)->{
    Object result=delegate(connection,method,arguments);
    if(method.getName().equals("createStatement")) {
     Statement original=(Statement)result;
     return java.lang.reflect.Proxy.newProxyInstance(Statement.class.getClassLoader(),new Class[]{Statement.class},(statementProxy,statementMethod,statementArguments)->{
      Object statementResult=delegate(original,statementMethod,statementArguments);
      if(statementMethod.getName().equals("execute"))throw new SQLTransientConnectionException("private lost acknowledgement","08006");
      return statementResult;
     });
    }
    return result;
   });
   var uncertain=io.eforge.enterprise.generator.service.GeneratorCreationExecution.execute(lostAck,"CREATE TABLE lost_ack(id INT);CREATE TABLE lost_following(id INT)");
   check(uncertain.tables().stream().map(t->t.state().name()).toList().equals(List.of("UNCONFIRMED","UNATTEMPTED")),"Lost acknowledgement claimed physical failure or ownership.");
   try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT COUNT(*) FROM lost_ack")){check(rows.next()&&rows.getInt(1)==0,"Unconfirmed acknowledged-loss fixture was dropped.");}
   absent("lost_following");
   try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT COUNT(*) FROM gen_table")){check(rows.next()&&rows.getInt(1)==1,"Physical phase changed generator metadata.");}
   try(var competitor=DriverManager.getConnection(url,"root",password)) {
    Connection race=(Connection)java.lang.reflect.Proxy.newProxyInstance(Connection.class.getClassLoader(),new Class[]{Connection.class},(proxy,method,arguments)->{
     Object result=delegate(connection,method,arguments);
     if(method.getName().equals("createStatement")) {
      try(var competing=competitor.createStatement()){competing.execute("CREATE TABLE race_target(id INT)");competing.execute("INSERT INTO race_target VALUES(91)");}
     }
     return result;
    });
    var raced=io.eforge.enterprise.generator.service.GeneratorCreationExecution.execute(race,"CREATE TABLE IF NOT EXISTS race_target(id INT);CREATE TABLE race_following(id INT)");
    check(raced.tables().get(0).state().name().equals("FAILED")&&raced.tables().get(0).code().equals("GENERATOR_CREATE_TARGET_EXISTS"),"Concurrent IF NOT EXISTS claimed another request's ownership.");
    check(raced.tables().get(1).state().name().equals("UNATTEMPTED"),"Continued DDL after ownership race.");
    try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT id FROM race_target")){check(rows.next()&&rows.getInt(1)==91&&!rows.next(),"Competing owner's row was changed.");}
    absent("race_following");
   }
   String originalMode;
   try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT @@session.sql_mode")){rows.next();originalMode=rows.getString(1);}
   for(String mode:List.of("NO_BACKSLASH_ESCAPES","ANSI_QUOTES","PIPES_AS_CONCAT","HIGH_NOT_PRECEDENCE")) {
    try(var statement=db.prepareStatement("SET SESSION sql_mode=?")){statement.setString(1,originalMode+","+mode);statement.execute();}
    refuses("CREATE TABLE mode_guard(id INT)",503,"GENERATOR_CREATE_SQL_MODE_UNSUPPORTED");absent("mode_guard");
   }
   try(var statement=db.prepareStatement("SET SESSION sql_mode=?")){statement.setString(1,originalMode);statement.execute();}
   try(var statement=db.prepareStatement("CREATE USER 'probe_denied'@'%' IDENTIFIED BY ?")){statement.setString(1,password);statement.execute();}
   execute("GRANT SELECT ON eforge_enterprise.owned_source TO 'probe_denied'@'%'");
   try(var denied=DriverManager.getConnection(url,"probe_denied",password)) {
    db=denied;refuses("CREATE TABLE fault_guard(id INT)",503,"GENERATOR_CREATE_PREFLIGHT_UNAVAILABLE");db=connection;
   }
   absent("fault_guard");
   try(var statement=db.createStatement();var rows=statement.executeQuery("SELECT id,name FROM owned_source")){check(rows.next()&&rows.getInt(1)==1&&rows.getString(2).equals("retained")&&!rows.next(),"Original data changed.");}
   System.out.println("PASS: "+assertions+" actual JDBC preflight/physical-phase assertions; scopes/sources/metadata, partial DDL, lost acknowledgement, ownership race and retained rows.");
  }
 }
}