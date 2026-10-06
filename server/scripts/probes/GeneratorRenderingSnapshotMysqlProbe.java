import java.util.*;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import javax.sql.DataSource;
import org.springframework.context.annotation.*;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.*;
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
import io.eforge.enterprise.generator.mapper.GenTableMapper;
import io.eforge.enterprise.generator.rendering.*;

class GeneratorRenderingSnapshotMysqlProbe {
 static int assertions;
 static JdbcTemplate jdbc;
 static AtomicInteger reads=new AtomicInteger();
 static volatile CountDownLatch rootRead, resumeChild;
 static void check(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
 static void login(Set<String> permissions){ org.springframework.web.context.request.RequestContextHolder.setRequestAttributes(new org.springframework.web.context.request.ServletRequestAttributes(new org.springframework.mock.web.MockHttpServletRequest()));
  var user=new SysUser();user.setUserId(2L);user.setUserName("snapshot_actor");user.setRoles(List.of());
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new LoginUser(2L,1L,user,permissions),null,List.of()));
 }
 @Configuration(proxyBeanMethods=false) @EnableTransactionManagement @EnableMethodSecurity
 static class Config {
  @Bean DataSource datasource(){return new DriverManagerDataSource(System.getenv("EFORGE_POLICY_JDBC_URL"),"root",System.getenv("EFORGE_POLICY_JDBC_PASSWORD"));}
  @Bean JdbcTemplate jdbc(DataSource source){return new JdbcTemplate(source);}
  @Bean PlatformTransactionManager tx(DataSource source){return new DataSourceTransactionManager(source);}
  @Bean SqlSessionFactory factory(DataSource source)throws Exception{
   var f=new SqlSessionFactoryBean();f.setDataSource(source);f.setTypeAliasesPackage("io.eforge.enterprise.generator.domain");
   f.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath*:mapper/generator/GenTable*.xml"));return f.getObject();
  }
  @Bean GenTableMapper tables(SqlSessionFactory factory,JdbcTemplate template){
   var actual=new SqlSessionTemplate(factory).getMapper(GenTableMapper.class);
   return (GenTableMapper)Proxy.newProxyInstance(GenTableMapper.class.getClassLoader(),new Class<?>[]{GenTableMapper.class},(proxy,method,args)->{
    if(method.getName().startsWith("select")){
     reads.incrementAndGet();
     if(!TransactionSynchronizationManager.isActualTransactionActive()||!TransactionSynchronizationManager.isCurrentTransactionReadOnly())throw new AssertionError("Mapper read outside real read-only transaction.");
     if(!"REPEATABLE-READ".equals(template.queryForObject("SELECT @@transaction_isolation",String.class)))throw new AssertionError("Wrong actual isolation.");
    }
    Object result;
    try{result=method.invoke(actual,args);}catch(InvocationTargetException wrapped){throw wrapped.getCause();}
    if(method.getName().equals("selectGenTableById")&&rootRead!=null){
     rootRead.countDown();if(!resumeChild.await(15,TimeUnit.SECONDS))throw new AssertionError("Writer did not complete between reads.");
    }
    return result;
   });
  }
  @Bean GeneratorRenderingSnapshotLoader loader(GenTableMapper tables){return new GeneratorRenderingSnapshotLoader(tables);}
  @Bean(name="ss") PermissionService permissions(){return new PermissionService();}
 }
 static void failure(Runnable operation,int status,String code){
  try{operation.run();throw new AssertionError("Expected safe failure "+code);}
  catch(ApiFailure failure){check(failure.status()==status&&failure.code().equals(code),"Unexpected metadata failure.");}
 }
 public static void main(String[] args)throws Exception{
  try(var context=new AnnotationConfigApplicationContext(Config.class)){
   jdbc=context.getBean(JdbcTemplate.class);var loader=context.getBean(GeneratorRenderingSnapshotLoader.class);
   String schema=Files.readString(Path.of(args[0],"sql/upstream/ry_20260417.sql"));
   for(String table:List.of("gen_table","gen_table_column")){
    var matcher=java.util.regex.Pattern.compile("(?is)create table "+table+"\\s*\\(.*?;").matcher(schema);
    if(!matcher.find())throw new AssertionError("Missing actual metadata baseline.");jdbc.execute(matcher.group());
   }
   long root=9007199254740995L,child=root+1,empty=root+2;
   jdbc.update("INSERT INTO gen_table(table_id,table_name,class_name,tpl_category,tpl_web_type,sub_table_name,sub_table_fk_name,options,gen_path) VALUES(?,?,?,?,?,?,?,?,?)",root,"snapshot_root","RootOld","sub","eforge-react","snapshot_child","root_id","{\"parentMenuId\":\"1\"}","/");
   jdbc.update("INSERT INTO gen_table(table_id,table_name,class_name,tpl_category,tpl_web_type) VALUES(?,?,?,?,?)",child,"snapshot_child","ChildOld","crud","element-plus");
   jdbc.update("INSERT INTO gen_table(table_id,table_name) VALUES(?,?)",empty,"snapshot_empty");
   jdbc.update("INSERT INTO gen_table_column(column_id,table_id,column_name,java_field,is_pk,is_query,query_type,dict_type,sort) VALUES(?,?,?,?,?,?,?,?,?)",root,root,"id","rootOld","1","1","EQ","original_dict",1);
   jdbc.update("INSERT INTO gen_table_column(column_id,table_id,column_name,java_field,is_pk,sort) VALUES(?,?,?,?,?,?)",child,child,"root_id","childOld","0",1);
   login(Set.of());int deniedReads=reads.get();
   try{loader.load(List.of(root));throw new AssertionError("No-role access accepted.");}catch(AccessDeniedException expected){assertions++;}
   login(Set.of("tool:gen:list","tool:gen:query"));
   try{loader.load(List.of(root));throw new AssertionError("Read-list grant accepted for output.");}catch(AccessDeniedException expected){assertions++;}
   check(reads.get()==deniedReads,"Permission denial occurred after SQL.");
   login(Set.of("tool:gen:preview"));var original=loader.load(List.of(root)).get(0);
   var working=original.legacyWorkingTable();
   check(working.getTableId()==root&&working.getSubTable().getTableId()==child,"Long IDs lost.");
   check(working.getPkColumn()==working.getColumns().get(0),"Root key alias lost.");
   check(working.getSubTable().getPkColumn()==working.getSubTable().getColumns().get(0),"Original first-column fallback lost.");
   check("original_dict".equals(working.getColumns().get(0).getDictType())&&"1".equals(working.getColumns().get(0).getIsQuery()),"Original field choices lost.");
   login(Set.of("tool:gen:code"));check(loader.load(List.of(child)).size()==1,"Code permission rejected.");
   int beforeInvalid=reads.get();
   failure(()->loader.load(null),400,"GENERATOR_SNAPSHOT_SELECTION_INVALID");
   failure(()->loader.load(List.of()),400,"GENERATOR_SNAPSHOT_SELECTION_INVALID");
   failure(()->loader.load(List.of(root,root)),400,"GENERATOR_SNAPSHOT_SELECTION_INVALID");
   failure(()->loader.load(Arrays.asList(root,null)),400,"GENERATOR_SNAPSHOT_SELECTION_INVALID");
   failure(()->loader.load(List.of(0L)),400,"GENERATOR_SNAPSHOT_SELECTION_INVALID");
   failure(()->loader.load(java.util.stream.LongStream.rangeClosed(1,101).boxed().toList()),400,"GENERATOR_SNAPSHOT_SELECTION_INVALID");
   check(reads.get()==beforeInvalid,"Invalid selection performed metadata SQL.");
   failure(()->loader.load(List.of(root,42L)),404,"GENERATOR_TABLE_NOT_FOUND");
   failure(()->loader.load(List.of(empty)),409,"GENERATOR_COLUMNS_MISSING");
   jdbc.update("UPDATE gen_table SET sub_table_name='missing_child' WHERE table_id=?",root);
   failure(()->loader.load(List.of(root)),409,"GENERATOR_SUBTABLE_NOT_FOUND");
   jdbc.update("UPDATE gen_table SET sub_table_name='snapshot_child' WHERE table_id=?",root);
   var pool=Executors.newSingleThreadExecutor();rootRead=new CountDownLatch(1);resumeChild=new CountDownLatch(1);
   try{
    var reader=pool.submit(()->{login(Set.of("tool:gen:preview"));try{return loader.load(List.of(root)).get(0);}finally{SecurityContextHolder.clearContext();org.springframework.web.context.request.RequestContextHolder.resetRequestAttributes();}});
    check(rootRead.await(15,TimeUnit.SECONDS),"Real root read not reached.");
    new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).execute(status->{
     jdbc.update("UPDATE gen_table SET class_name='RootNew' WHERE table_id=?",root);
     jdbc.update("UPDATE gen_table SET class_name='ChildNew' WHERE table_id=?",child);
     jdbc.update("UPDATE gen_table_column SET java_field='rootNew' WHERE table_id=?",root);
     jdbc.update("UPDATE gen_table_column SET java_field='childNew' WHERE table_id=?",child);return null;
    });
    resumeChild.countDown();var coherent=reader.get(15,TimeUnit.SECONDS).legacyWorkingTable();
    check("RootOld".equals(coherent.getClassName())&&"ChildOld".equals(coherent.getSubTable().getClassName()),"Concurrent commit mixed root and child versions.");
    check("rootOld".equals(coherent.getColumns().get(0).getJavaField())&&"childOld".equals(coherent.getSubTable().getColumns().get(0).getJavaField()),"Concurrent commit mixed field versions.");
   }finally{resumeChild.countDown();rootRead=null;resumeChild=null;pool.shutdownNow();}
   var latest=loader.load(List.of(root)).get(0).legacyWorkingTable();
   check("RootNew".equals(latest.getClassName())&&"ChildNew".equals(latest.getSubTable().getClassName()),"Next snapshot did not see committed metadata.");
   check("rootNew".equals(latest.getColumns().get(0).getJavaField())&&"childNew".equals(latest.getSubTable().getColumns().get(0).getJavaField()),"Next snapshot did not see committed fields.");
   check("RootOld".equals(original.legacyWorkingTable().getClassName()),"Detached original mutated with database.");
   new TransactionTemplate(context.getBean(PlatformTransactionManager.class)).execute(status->{
    jdbc.update("UPDATE gen_table SET class_name='UncommittedOuter' WHERE table_id=?",root);
    check("RootNew".equals(loader.load(List.of(root)).get(0).legacyWorkingTable().getClassName()),"Loader joined caller transaction.");
    check(TransactionSynchronizationManager.isActualTransactionActive()&&!TransactionSynchronizationManager.isCurrentTransactionReadOnly(),"Caller transaction not restored.");status.setRollbackOnly();return null;
   });
   check("RootNew".equals(jdbc.queryForObject("SELECT class_name FROM gen_table WHERE table_id=?",String.class,root)),"Outer rollback lost.");
   jdbc.execute("RENAME TABLE gen_table_column TO snapshot_unavailable_fields");
   try{
    try{loader.load(List.of(root));throw new AssertionError("Real SQL fault succeeded.");}
    catch(ApiFailure safe){check(safe.status()==503&&safe.code().equals("GENERATOR_SNAPSHOT_UNAVAILABLE")&&safe.getMessage().equals("Generator metadata cannot be read safely."),"SQL details escaped.");}
   }finally{jdbc.execute("RENAME TABLE snapshot_unavailable_fields TO gen_table_column");}
   check(loader.load(List.of(root)).size()==1,"SQL recovery failed.");
   check(jdbc.queryForObject("SELECT COUNT(*) FROM gen_table",Integer.class)==3&&jdbc.queryForObject("SELECT COUNT(*) FROM gen_table_column",Integer.class)==2,"Read-only loader changed metadata.");
   jdbc.update("UPDATE gen_table SET package_name='io.eforge.enterprise.generated',module_name='snapshot',business_name='entry',function_name='预览功能',function_author='EForge',form_col_num=2,options='{\"parentMenuId\":\"3\"}'");
   jdbc.update("UPDATE gen_table_column SET java_type='Long',column_comment='预览字段',column_type='bigint',is_increment='0',is_required='0',is_insert='1',is_edit='1',is_list='1',is_query='0',html_type='input',query_type='EQ',dict_type=''");
   var preview=new io.eforge.enterprise.generator.service.GenTableServiceImpl();
   org.springframework.test.util.ReflectionTestUtils.setField(preview,"renderingSnapshots",loader);
   login(Set.of("tool:gen:preview"));
   var files=preview.previewCode(root);
   check(files.get("vm/java/domain.java.vm").contains("class RootNew"),"Original preview did not render the actual root snapshot.");
   check(files.get("vm/java/sub-domain.java.vm").contains("class ChildNew"),"Original preview did not render actual child metadata.");
   System.out.println("PASS: "+assertions+" actual Spring/MyBatis immutable snapshot assertions; permissions, REPEATABLE_READ concurrent root/child/fields, REQUIRES_NEW, SQL privacy and recovery.");
  }finally{SecurityContextHolder.clearContext();org.springframework.web.context.request.RequestContextHolder.resetRequestAttributes();}
 }
}