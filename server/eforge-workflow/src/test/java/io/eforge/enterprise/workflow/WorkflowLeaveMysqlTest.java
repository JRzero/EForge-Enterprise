package io.eforge.enterprise.workflow;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.flowable.engine.ProcessEngine;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;
import static org.assertj.core.api.Assertions.*;

class WorkflowLeaveMysqlTest {
    @Test void actualSubmitRetriesConcurrentActionsRevocationAndRollback()throws Exception {
        Assumptions.assumeTrue(System.getenv("EFORGE_WORKFLOW_TEST_JDBC_URL")!=null,"Requires owned MySQL fixture");
        new ApplicationContextRunner().withUserConfiguration(WorkflowEngineConfigurationTest.Database.class,WorkflowEngineConfiguration.class)
            .withPropertyValues("flowable.process.enabled=true","flowable.idm.enabled=false","flowable.eventregistry.enabled=false",
                "flowable.check-process-definitions=false","flowable.async-executor-activate=false","flowable.database-schema-update=false")
            .run(context->{
                assertThat(context).hasNotFailed();var source=context.getBean(DataSource.class);var jdbc=new JdbcTemplate(source);
                jdbc.execute("create table sys_user(user_id bigint primary key,status char(1),del_flag char(1))");
                jdbc.execute("create table sys_role(role_id bigint primary key,status char(1),del_flag char(1))");
                jdbc.execute("create table sys_user_role(user_id bigint,role_id bigint)");
                jdbc.update("insert into sys_user values(1,'0','0'),(2,'0','0'),(3,'0','0')");jdbc.update("insert into sys_role values(2,'0','0')");jdbc.update("insert into sys_user_role values(2,2),(3,2)");
                WorkflowLeaveServiceTest.publish(context.getBean(WorkflowPackages.class),context.getBean(WorkflowReleases.class));
                var engine=context.getBean(ProcessEngine.class);var leaves=new WorkflowLeaveService(source,context.getBean(WorkflowUnitOfWork.class),engine);
                var request=new WorkflowLeaves.Submit(UUID.randomUUID().toString(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"双提交");
                var starters=Executors.newFixedThreadPool(2);WorkflowLeaves.Leave first;
                try{
                    var gate=new CyclicBarrier(2);
                    Callable<WorkflowLeaves.Leave> submit=()->{gate.await(10,TimeUnit.SECONDS);return leaves.submit(request,"1");};
                    var one=starters.submit(submit);var two=starters.submit(submit);
                    first=one.get(15,TimeUnit.SECONDS);assertThat(two.get(15,TimeUnit.SECONDS)).isEqualTo(first);
                }finally{starters.shutdownNow();}
                var retries=concurrent(source,jdbc,first.id(),()->{},()->leaves.submit(request,"1"));
                assertThat(retries).containsExactly(first,first);assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isEqualTo(1);
                var task=leaves.get(first.id(),"2").tasks().get(0).id();
                var packages=context.getBean(WorkflowPackages.class);var releases=context.getBean(WorkflowReleases.class);
                var oldRelease=releases.get(first.releaseId());var draft=packages.get(oldRelease.packageId());
                var changed=packages.update(draft.id(),draft.revision(),new WorkflowPackages.Edit("新审批版本",draft.businessType(),draft.source()),"1");
                packages.validate(changed.id(),changed.revision(),"1");var nextRelease=releases.publish(changed.id(),changed.revision(),"1");
                releases.activate("leave",nextRelease.id(),releases.activation("leave").revision(),"1");
                assertThat(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(first.processId()).singleResult().getProcessDefinitionId()).isEqualTo(oldRelease.processDefinitionId());
                var claims=concurrent(source,jdbc,first.id(),()->{},()->status(()->leaves.claim(first.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,task,""),"2")));
                assertThat(claims).containsExactlyInAnyOrder(200,409);
                var revoked=concurrent(source,jdbc,first.id(),()->jdbc.update("delete from sys_user_role where user_id=2"),
                    ()->status(()->leaves.decide(first.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),2,task,"同意"),true,"2")));
                assertThat(revoked).containsExactly(403,403);assertThat(engine.getTaskService().createTaskQuery().taskId(task).count()).isEqualTo(1);
                jdbc.update("insert into sys_user_role values(2,2)");
                jdbc.execute("alter table ef_workflow_leave_audit add constraint fail_reject_audit check (action <> 'REJECT')");
                var reject=new WorkflowLeaves.Command(UUID.randomUUID().toString(),2,task,"拒绝");
                assertThat(status(()->leaves.decide(first.id(),reject,false,"2"))).isEqualTo(503);
                assertThat(engine.getTaskService().createTaskQuery().taskId(task).count()).isEqualTo(1);
                assertThat(jdbc.queryForObject("select revision from ef_workflow_leave where id=?",Long.class,first.id())).isEqualTo(2);
                jdbc.execute("alter table ef_workflow_leave_audit drop check fail_reject_audit");
                var outcomes=concurrent(source,jdbc,first.id(),()->{},()->status(()->leaves.decide(first.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),2,task,"拒绝"),false,"2")));
                assertThat(outcomes).containsExactlyInAnyOrder(200,409);assertThat(leaves.get(first.id(),"1").leave().status()).isEqualTo("REJECTED");
                assertThat(jdbc.queryForObject("select count(*) from ef_workflow_leave_audit where leave_id=?",Long.class,first.id())).isEqualTo(3);
                var next=leaves.submit(new WorkflowLeaves.Submit(UUID.randomUUID().toString(),request.startDate(),request.endDate(),"新版本申请"),"1");
                assertThat(next.releaseId()).isEqualTo(nextRelease.id());
                assertThat(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(next.processId()).singleResult().getProcessDefinitionId()).isEqualTo(nextRelease.processDefinitionId());
                leaves.withdraw(next.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,null,"取消"),"1");
            });
    }
    private static int status(Runnable work){try{work.run();return 200;}catch(ApiFailure failure){return failure.status();}}
    static <T>List<T> concurrent(DataSource source,JdbcTemplate jdbc,String id,Runnable whileWaiting,Callable<T> work)throws Exception {
        var pool=Executors.newFixedThreadPool(2);
        try(var lock=source.getConnection()){
            lock.setAutoCommit(false);try(var statement=lock.prepareStatement("select id from ef_workflow_leave where id=? for update")){statement.setString(1,id);try(var result=statement.executeQuery()){assertThat(result.next()).isTrue();}}
            var first=pool.submit(work);var second=pool.submit(work);boolean waiting=false;long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(15);
            while(System.nanoTime()<deadline){
                long count=jdbc.queryForObject("select count(distinct w.REQUESTING_ENGINE_TRANSACTION_ID) from performance_schema.data_lock_waits w join performance_schema.data_locks l on l.ENGINE=w.ENGINE and l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID where l.OBJECT_SCHEMA='eforge_workflow' and l.OBJECT_NAME='ef_workflow_leave' and l.LOCK_STATUS='WAITING'",Long.class);
                if(count==2){waiting=true;break;}Thread.sleep(50);
            }
            assertThat(waiting).as("two actual leave SQL requests waiting").isTrue();whileWaiting.run();lock.commit();
            return List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS));
        }finally{pool.shutdownNow();}
    }
}
