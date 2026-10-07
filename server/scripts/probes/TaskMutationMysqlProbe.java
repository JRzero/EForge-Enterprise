import java.util.*;
import java.nio.file.*;
import java.lang.reflect.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import javax.sql.DataSource;
import org.quartz.*;
import org.quartz.impl.StdSchedulerFactory;
import org.springframework.context.annotation.*;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.*;
import org.mybatis.spring.*;
import org.apache.ibatis.session.SqlSessionFactory;
import io.eforge.enterprise.quartz.domain.SysJob;
import io.eforge.enterprise.quartz.mapper.SysJobMapper;
import io.eforge.enterprise.quartz.service.*;
import io.eforge.enterprise.quartz.service.impl.SysJobServiceImpl;
import io.eforge.enterprise.quartz.util.ScheduleUtils;

/** Actual isolated MySQL, MyBatis, transaction manager and RAMJobStore; no HTTP claim. */
class TaskMutationMysqlProbe {
 static int assertions;
 static String repo;
 static volatile Runnable beforeCommit=()->{},afterCommit=()->{};
 static volatile Long rejectDelete;
 static void check(boolean condition,String message){assertions++;if(!condition)throw new AssertionError(message);}
 static final class Manager extends DataSourceTransactionManager {
  Manager(DataSource source){super(source);}
  @Override protected void doCommit(DefaultTransactionStatus state){beforeCommit.run();super.doCommit(state);afterCommit.run();}
 }
 @Configuration(proxyBeanMethods=false) @EnableTransactionManagement @EnableAspectJAutoProxy(proxyTargetClass=true)
 static class Config {
  @Bean DataSource source()throws Exception{
   var source=new DriverManagerDataSource(System.getenv("EFORGE_POLICY_JDBC_URL"),"root",System.getenv("EFORGE_POLICY_JDBC_PASSWORD"));
   String schema=Files.readString(Path.of(repo,"sql/upstream/ry_20260417.sql"));
   var matcher=java.util.regex.Pattern.compile("(?is)create table sys_job\\s*\\(.*?;").matcher(schema);
   if(!matcher.find())throw new AssertionError("Missing original job schema");new JdbcTemplate(source).execute(matcher.group());return source;
  }
  @Bean JdbcTemplate jdbc(DataSource source){return new JdbcTemplate(source);}
  @Bean PlatformTransactionManager manager(DataSource source){return new Manager(source);}
  @Bean SqlSessionFactory factory(DataSource source)throws Exception{
   var factory=new SqlSessionFactoryBean();factory.setDataSource(source);factory.setTypeAliasesPackage("io.eforge.enterprise.quartz.domain");
   factory.setMapperLocations(new PathMatchingResourcePatternResolver().getResources("classpath*:mapper/quartz/SysJobMapper.xml"));return factory.getObject();
  }
  @Bean SysJobMapper mapper(SqlSessionFactory factory){return new SqlSessionTemplate(factory).getMapper(SysJobMapper.class);}
  @Bean(destroyMethod="shutdown") Scheduler scheduler()throws Exception{
   var properties=new Properties();properties.setProperty("org.quartz.scheduler.instanceName","owned-task-boundary-"+UUID.randomUUID());
   properties.setProperty("org.quartz.scheduler.skipUpdateCheck","true");properties.setProperty("org.quartz.scheduler.makeSchedulerThreadDaemon","true");
   properties.setProperty("org.quartz.threadPool.threadCount","1");properties.setProperty("org.quartz.threadPool.makeThreadsDaemons","true");
   properties.setProperty("org.quartz.jobStore.class","org.quartz.simpl.RAMJobStore");
   Scheduler actual=new StdSchedulerFactory(properties).getScheduler();
   return (Scheduler)Proxy.newProxyInstance(Scheduler.class.getClassLoader(),new Class<?>[]{Scheduler.class},(proxy,method,args)->{
    if(method.getName().equals("deleteJob")&&args[0] instanceof JobKey key&&rejectDelete!=null&&key.getName().equals("TASK_CLASS_NAME"+rejectDelete))throw new SchedulerException("Owned scheduler delete fault");
    try{return method.invoke(actual,args);}catch(InvocationTargetException failure){throw failure.getCause();}
   });
  }
  @Bean TaskMutationBoundary boundary(Scheduler scheduler,SysJobMapper mapper,PlatformTransactionManager manager){return new TaskMutationBoundary(scheduler,mapper,manager);}
  @Bean TaskMutationAspect aspect(TaskMutationBoundary boundary){return new TaskMutationAspect(boundary);}
  @Bean SysJobServiceImpl service(){return new SysJobServiceImpl();}
 }
 static SysJob row(String name,String group,String target){var row=new SysJob();row.setJobName(name);row.setJobGroup(group);row.setInvokeTarget(target);row.setCronExpression("0 0 0 1 1 ? 2099");row.setMisfirePolicy("3");row.setConcurrent("1");row.setStatus("1");row.setCreateBy("owned_actor");return row;}
 static void await(CountDownLatch latch){try{if(!latch.await(15,TimeUnit.SECONDS))throw new AssertionError("Owned commit barrier timeout");}catch(InterruptedException failure){Thread.currentThread().interrupt();throw new IllegalStateException(failure);}}
 public static void main(String[] args)throws Exception {
  repo=args[0];try(var context=new AnnotationConfigApplicationContext(Config.class)){
   var service=context.getBean(SysJobServiceImpl.class);var mapper=context.getBean(SysJobMapper.class);var boundary=context.getBean(TaskMutationBoundary.class);var scheduler=context.getBean(Scheduler.class);var jdbc=context.getBean(JdbcTemplate.class);
   var original=row("owned original","DEFAULT","ryTask.ryNoParams()");check(service.insertJob(original)==1,"Original insert failed");
   long id=original.getJobId();var key=ScheduleUtils.getJobKey(id,"DEFAULT");check("1".equals(mapper.selectJobById(id).getStatus()),"Creation was not paused");
   check(scheduler.checkExists(key),"Committed insert missing schedule");check(scheduler.getTriggerState(ScheduleUtils.getTriggerKey(id,"DEFAULT"))==Trigger.TriggerState.PAUSED,"Created trigger not paused");
   var unrelated=row("owned unrelated","SYSTEM","ryTask.ryNoParams()");service.insertJob(unrelated);var unrelatedKey=ScheduleUtils.getJobKey(unrelated.getJobId(),"SYSTEM");var unrelatedDeadline=scheduler.getTriggersOfJob(unrelatedKey).get(0).getNextFireTime();
   var invalid=row("owned invalid","DEFAULT","ryTask.ryNoParams()");invalid.setCronExpression("invalid");
   try{service.insertJob(invalid);throw new AssertionError("Invalid schedule committed");}catch(RuntimeException expected){check(expected.getCause() instanceof java.text.ParseException,"Unexpected invalid-Cron fixture failure");}
   check(invalid.getJobId()!=null&&mapper.selectJobById(invalid.getJobId())==null,"SQL insert did not roll back");check(!scheduler.checkExists(ScheduleUtils.getJobKey(invalid.getJobId(),"DEFAULT")),"Failed insert retained schedule");
   var changed=mapper.selectJobById(id);changed.setJobGroup("SYSTEM");changed.setInvokeTarget("ryTask.ryParams('committed')");changed.setStatus("0");
   var entering=new CountDownLatch(1);var release=new CountDownLatch(1);beforeCommit=()->{entering.countDown();await(release);};var executor=Executors.newFixedThreadPool(3);
   try{
    var mutation=executor.submit(()->service.updateJob(changed));await(entering);
    check("DEFAULT".equals(jdbc.queryForObject("SELECT job_group FROM sys_job WHERE job_id=?",String.class,id)),"Uncommitted group visible outside transaction");
    var admission=executor.submit(()->boundary.admit(changed,false));
    try{admission.get(150,TimeUnit.MILLISECONDS);throw new AssertionError("Execution admitted before actual commit");}catch(TimeoutException expected){assertions++;}
    release.countDown();check(mutation.get(15,TimeUnit.SECONDS)==1,"Actual update did not commit");check("SYSTEM".equals(admission.get(15,TimeUnit.SECONDS).getJobGroup()),"Admission did not use committed row");
   }finally{release.countDown();beforeCommit=()->{};executor.shutdownNow();check(executor.awaitTermination(15,TimeUnit.SECONDS),"Owned workers not stopped");}
   try{boundary.admit(original,true);throw new AssertionError("Old payload admitted");}catch(SchedulerException expected){assertions++;}
   check(!scheduler.checkExists(key)&&scheduler.checkExists(ScheduleUtils.getJobKey(id,"SYSTEM")),"Group move retained wrong key");
   var stale=row("stale","DEFAULT","ryTask.ryNoParams()");stale.setJobId(id);stale.setStatus("1");service.changeStatus(stale);
   check(!service.run(stale),"Legacy manual request with stale explicit group dispatched current schedule");
   var current=mapper.selectJobById(id);check("SYSTEM".equals(current.getJobGroup())&&"ryTask.ryParams('committed')".equals(current.getInvokeTarget())&&"3".equals(current.getMisfirePolicy()),"Stale status input overwrote current configuration");
   check(scheduler.getTriggerState(ScheduleUtils.getTriggerKey(id,"SYSTEM"))==Trigger.TriggerState.PAUSED,"Current group not paused");
   try{boundary.admit(current,false);throw new AssertionError("Paused automatic payload admitted");}catch(SchedulerException expected){assertions++;}check("1".equals(boundary.admit(current,true).getStatus()),"Paused manual admission lost");
   var deadline=scheduler.getTriggersOfJob(ScheduleUtils.getJobKey(id,"SYSTEM")).get(0).getNextFireTime();
   jdbc.execute("CREATE TRIGGER owned_delete_fault BEFORE DELETE ON sys_job FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned deletion fault'");
   try{service.deleteJobByIds(new Long[]{id,unrelated.getJobId()});throw new AssertionError("SQL failure accepted");}catch(org.springframework.dao.DataAccessException expected){assertions++;}finally{jdbc.execute("DROP TRIGGER owned_delete_fault");}
   check(mapper.selectJobById(id)!=null&&mapper.selectJobById(unrelated.getJobId())!=null,"SQL rollback lost rows");check(scheduler.getTriggersOfJob(ScheduleUtils.getJobKey(id,"SYSTEM")).get(0).getNextFireTime().equals(deadline),"SQL rollback changed deadline");
   rejectDelete=unrelated.getJobId();
   try{service.deleteJobByIds(new Long[]{id,unrelated.getJobId()});throw new AssertionError("Partial scheduler deletion accepted");}catch(SchedulerException expected){assertions++;}finally{rejectDelete=null;}
   check(mapper.selectJobById(id)!=null&&mapper.selectJobById(unrelated.getJobId())!=null,"Partial deletion committed SQL");
   check(boundary.admit(mapper.selectJobById(id),true)!=null&&boundary.admit(mapper.selectJobById(unrelated.getJobId()),true)!=null,"Affected-ID recovery failed");
   var uncertain=mapper.selectJobById(id);uncertain.setJobGroup("DEFAULT");uncertain.setInvokeTarget("ryTask.ryParams('uncertain')");afterCommit=()->{throw new TransactionSystemException("Owned post-commit response fault");};
   try{service.updateJob(uncertain);throw new AssertionError("Uncertain commit reported success");}catch(TransactionSystemException expected){assertions++;}finally{afterCommit=()->{};}
   check("DEFAULT".equals(mapper.selectJobById(id).getJobGroup()),"Actual commit fixture did not commit");
   check("ryTask.ryParams('uncertain')".equals(boundary.admit(uncertain,true).getInvokeTarget()),"Recovery did not use actual committed SQL");check(scheduler.checkExists(key)&&!scheduler.checkExists(ScheduleUtils.getJobKey(id,"SYSTEM")),"Uncertain outcome retained wrong schedule");
   check(scheduler.getTriggersOfJob(unrelatedKey).get(0).getNextFireTime().equals(unrelatedDeadline),"Unrelated task deadline changed");
   jdbc.execute("RENAME TABLE sys_job TO owned_sys_job_unavailable");
   try{boundary.admit(uncertain,true);throw new AssertionError("Actual SQL failure admitted target");}catch(SchedulerException expected){check(expected.getCause()==null&&"Task schedule is temporarily unavailable.".equals(expected.getMessage()),"SQL admission error exposed driver details");}finally{jdbc.execute("RENAME TABLE owned_sys_job_unavailable TO sys_job");}
   check(boundary.admit(uncertain,true)!=null,"SQL recovery did not admit committed configuration");
   service.deleteJobByIds(new Long[]{id});check(mapper.selectJobById(id)==null&&!scheduler.checkExists(key),"Committed deletion inconsistent");
   try{boundary.admit(uncertain,true);throw new AssertionError("Deleted payload admitted");}catch(SchedulerException expected){assertions++;}
   check(mapper.selectJobById(unrelated.getJobId())!=null&&scheduler.checkExists(unrelatedKey),"Unrelated task lost");
   System.out.println("PASS actual MySQL/MyBatis/transaction/Quartz task boundary assertions="+assertions);
  }
 }
}
