import java.sql.*;
import java.util.*;
import java.nio.file.*;
import javax.sql.DataSource;
import org.springframework.context.annotation.*;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.AccessDeniedException;
import org.mybatis.spring.*;
import org.apache.ibatis.session.SqlSessionFactory;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.core.domain.entity.*;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.eforge.enterprise.framework.web.service.PermissionService;
import io.eforge.enterprise.generator.config.GenConfig;
import io.eforge.enterprise.generator.mapper.*;
import io.eforge.enterprise.generator.service.*;

class GeneratorCreationImportMysqlProbe {
 static int assertions;
 static JdbcTemplate jdbc;
 static void check(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
 static long count(String table){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Long.class);}
 static void login(String roleKey,Set<String> permissions) {
  var user=new SysUser();user.setUserId(2L);user.setUserName("creation_actor");
  var role=new SysRole();role.setRoleKey(roleKey);user.setRoles(List.of(role));
  var principal=new LoginUser(2L,1L,user,permissions);
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal,null,List.of()));
 }
 @Configuration(proxyBeanMethods=false) @EnableTransactionManagement @EnableMethodSecurity
 static class Config {
  @Bean DataSource datasource(){return new DriverManagerDataSource(System.getenv("EFORGE_POLICY_JDBC_URL"),"root",System.getenv("EFORGE_POLICY_JDBC_PASSWORD"));}
  @Bean JdbcTemplate jdbc(DataSource datasource){return new JdbcTemplate(datasource);}
  @Bean PlatformTransactionManager tx(DataSource datasource){return new DataSourceTransactionManager(datasource);}
  @Bean SqlSessionFactory factory(DataSource datasource) throws Exception {
   var factory=new SqlSessionFactoryBean();factory.setDataSource(datasource);factory.setTypeAliasesPackage("io.eforge.enterprise.generator.domain");
   factory.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath*:mapper/generator/GenTable*.xml"));return factory.getObject();
  }
  @Bean GenTableMapper tables(SqlSessionFactory factory){return new SqlSessionTemplate(factory).getMapper(GenTableMapper.class);}
  @Bean GenTableColumnMapper columns(SqlSessionFactory factory){return new SqlSessionTemplate(factory).getMapper(GenTableColumnMapper.class);}
  @Bean GeneratorMetadataBoundary boundary(JdbcTemplate jdbc){return new GeneratorMetadataBoundary(jdbc);}
  @Bean GeneratorCreationMetadataImport importer(JdbcTemplate jdbc,GeneratorMetadataBoundary boundary,GenTableMapper tables,GenTableColumnMapper columns){return new GeneratorCreationMetadataImport(jdbc,boundary,tables,columns);}
  @Bean(name="ss") PermissionService permissions(){return new PermissionService();}
 }
 static GeneratorCreationExecution.Result create(DataSource source,String sql) throws SQLException {
  try(var connection=source.getConnection()){return GeneratorCreationExecution.execute(connection,sql);}
 }
 public static void main(String[] args) throws Exception {
  try(var context=new AnnotationConfigApplicationContext(Config.class)) {
   jdbc=context.getBean(JdbcTemplate.class);var source=context.getBean(DataSource.class);var importer=context.getBean(GeneratorCreationMetadataImport.class);
   String schema=Files.readString(Path.of(args[0],"sql/upstream/ry_20260417.sql"));
   for(String table:List.of("gen_table","gen_table_column")) {
    var matcher=java.util.regex.Pattern.compile("(?is)create table "+table+"\\s*\\(.*?;",java.util.regex.Pattern.DOTALL).matcher(schema);
    if(!matcher.find())throw new AssertionError("Missing actual baseline metadata schema.");jdbc.execute(matcher.group());
   }
   for(String migration:List.of("V024__generator_table_identity.sql","V025__generator_metadata_boundary.sql")) {
    String statements=Files.readString(Path.of(args[0],"sql/migrations",migration)).replaceAll("(?m)^--.*$","");
    for(String statement:statements.split(";"))if(!statement.isBlank())jdbc.execute(statement);
   }
   jdbc.execute("ALTER TABLE gen_table AUTO_INCREMENT=9007199254740995");
   var config=new GenConfig();config.setAuthor("EForge");config.setPackageName("io.eforge.enterprise.generated");config.setAutoRemovePre(false);config.setTablePrefix("");
   int mode=jdbc.queryForObject("SELECT @@lower_case_table_names",Integer.class);
   var physical=create(source,"CREATE TABLE ImportMix(id BIGINT PRIMARY KEY AUTO_INCREMENT,label VARCHAR(40) NOT NULL)");check(physical.allCreated(),"Physical setup failed.");
   if(mode==0)jdbc.execute("CREATE TABLE IMPORTMIX(unrelated_a INT,unrelated_b INT,unrelated_c INT)");
   login("ordinary",Set.of("tool:gen:import"));
   try{importer.importCreated(physical,"eforge-react");throw new AssertionError("Import grant bypassed admin role.");}catch(AccessDeniedException denied){assertions++;}
   check(count("gen_table")==0&&count("gen_table_column")==0,"Denied role wrote metadata.");
   login("admin",Set.of());
   var imported=importer.importCreated(physical,"eforge-react");check(imported.size()==1&&imported.get(0).columnCount()==2,"Exact owned fields conflated with case neighbour.");
   check(imported.get(0).actualName().equals(mode==0?"ImportMix":"importmix"),"Native physical name not retained.");
   check(imported.get(0).id().equals("9007199254740995"),"Long metadata ID lost precision.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM gen_table WHERE create_by='creation_actor' AND tpl_web_type='eforge-react'",Integer.class)==1,"Table actor/template lost.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM gen_table_column WHERE create_by='creation_actor'",Integer.class)==2,"Field actor lost.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM gen_table_column WHERE column_name='id' AND is_pk='1' AND is_increment='1'",Integer.class)==1,"Physical key identity lost.");
   try{importer.importCreated(physical,"eforge-react");throw new AssertionError("Existing configuration overwritten.");}catch(ApiFailure conflict){check(conflict.code().equals("GENERATOR_TABLE_ALREADY_IMPORTED"),"Wrong import conflict.");}
   var retry=create(source,"CREATE TABLE rollback_first(id INT);CREATE TABLE rollback_second(id INT)");
   long beforeTables=count("gen_table"),beforeColumns=count("gen_table_column");
   jdbc.execute("CREATE TRIGGER import_fault BEFORE INSERT ON gen_table_column FOR EACH ROW SET NEW.column_name=IF((SELECT table_name FROM gen_table WHERE table_id=NEW.table_id)='rollback_second',REPEAT('x',300),NEW.column_name)");
   try{importer.importCreated(retry,"element-plus");throw new AssertionError("SQL fault did not fail import.");}
   catch(ApiFailure failure){check(failure.code().equals("GENERATOR_IMPORT_FAILED")&&failure.getMessage().equals("Created table metadata could not be saved."),"Driver secret escaped.");}
   check(count("gen_table")==beforeTables&&count("gen_table_column")==beforeColumns,"Failed import left partial metadata.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('rollback_first','rollback_second')",Integer.class)==2,"Import rollback dropped physical tables.");
   jdbc.execute("DROP TRIGGER import_fault");var recovered=importer.importCreated(retry,"element-plus");check(recovered.size()==2,"Metadata retry failed.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM gen_table WHERE tpl_web_type='element-plus'",Integer.class)==2,"Original template selection lost.");
   var independent=create(source,"CREATE TABLE independent_created(id INT)");
   new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).execute(status->{jdbc.update("INSERT INTO independent_created VALUES(77)");importer.importCreated(independent,"element-ui");status.setRollbackOnly();return null;});
   check(jdbc.queryForObject("SELECT COUNT(*) FROM independent_created",Integer.class)==0,"Parent rollback failed.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM gen_table WHERE table_name='independent_created'",Integer.class)==1,"Independent metadata commit joined parent rollback.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM gen_table WHERE tpl_web_type='element-ui'",Integer.class)==1,"Original default template lost.");
   var notReady=new GeneratorCreationExecution.Result(List.of(new GeneratorCreationExecution.Outcome("never_created",GeneratorCreationExecution.State.UNCONFIRMED,"GENERATOR_CREATE_UNCONFIRMED")));
   try{importer.importCreated(notReady,"eforge-react");throw new AssertionError("Unconfirmed ownership imported.");}catch(ApiFailure failure){check(failure.code().equals("GENERATOR_CREATE_IMPORT_NOT_READY"),"Wrong uncertainty guard.");}
   try{importer.importCreated(independent,null);throw new AssertionError("Null template accepted.");}catch(ApiFailure failure){check(failure.code().equals("VALIDATION_ERROR"),"Null template threw unexpected failure.");}
   check(count("gen_table")==4&&count("gen_table_column")==5,"Final exact metadata counts differ.");
   var concurrent=create(source,"CREATE TABLE concurrent_created(id INT)");
   var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
   var start=new java.util.concurrent.CountDownLatch(1);
   try {
    var futures=new ArrayList<java.util.concurrent.Future<String>>();
    for(int request=0;request<2;request++) futures.add(pool.submit(()->{
     login("admin",Set.of());start.await();
     try {importer.importCreated(concurrent,"element-plus-typescript");return "success";}
     catch(ApiFailure conflict){return conflict.code();}
     finally{SecurityContextHolder.clearContext();}
    }));
    start.countDown();var outcomes=new ArrayList<String>();for(var future:futures)outcomes.add(future.get(30,java.util.concurrent.TimeUnit.SECONDS));
    check(Collections.frequency(outcomes,"success")==1&&Collections.frequency(outcomes,"GENERATOR_TABLE_ALREADY_IMPORTED")==1,"Concurrent import failed to serialize truthful ownership.");
    check(count("gen_table")==5&&count("gen_table_column")==6,"Concurrent import duplicated or lost metadata.");
    check(jdbc.queryForObject("SELECT COUNT(*) FROM gen_table WHERE table_name='concurrent_created' AND tpl_web_type='element-plus-typescript'",Integer.class)==1,"Original TypeScript template selection lost.");
   } finally {pool.shutdownNow();}
   var guardPhysical=create(source,"CREATE TABLE guard_failure_created(id INT)");
   jdbc.execute("RENAME TABLE gen_metadata_guard TO unavailable_guard");
   try {
    try{importer.importCreated(guardPhysical,"eforge-react");throw new AssertionError("Missing guard SQL unexpectedly imported.");}
    catch(ApiFailure failure){check(failure.code().equals("GENERATOR_IMPORT_FAILED")&&failure.getMessage().equals("Created table metadata could not be saved."),"Guard SQL details escaped.");}
   } finally {jdbc.execute("RENAME TABLE unavailable_guard TO gen_metadata_guard");}
   check(count("gen_table")==5&&count("gen_table_column")==6,"Guard SQL failure changed metadata.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM guard_failure_created",Integer.class)==0,"Guard failure dropped physical target.");
   System.out.println("PASS: "+assertions+" actual Spring/MyBatis creation import assertions; role, exact case/fields, long IDs, audit, checked rollback/retry and REQUIRES_NEW isolation.");
  } finally {SecurityContextHolder.clearContext();}
 }
}