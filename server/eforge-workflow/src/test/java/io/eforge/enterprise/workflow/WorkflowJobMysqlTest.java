package io.eforge.enterprise.workflow;

import java.nio.file.*;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.workflow.api.*;
import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;

class WorkflowJobMysqlTest {
    @Test void actualBackgroundExecutorRollsBackSqlFailureAndRecoversOnlyTheHumanTask() {
        Assumptions.assumeTrue(System.getenv("EFORGE_WORKFLOW_TEST_JDBC_URL")!=null,"Requires owned MySQL fixture");
        new ApplicationContextRunner().withUserConfiguration(WorkflowEngineConfigurationTest.Database.class,WorkflowEngineConfiguration.class)
            .withPropertyValues("flowable.process.enabled=true","flowable.idm.enabled=false","flowable.eventregistry.enabled=false",
                "flowable.check-process-definitions=false","eforge.workflow.async-enabled=true","flowable.database-schema-update=false")
            .run(context->{
                assertThat(context).hasNotFailed();var source=context.getBean(DataSource.class);var jdbc=new JdbcTemplate(source);
                jdbc.execute("create table sys_user(user_id bigint primary key,status char(1),del_flag char(1))");
                jdbc.execute("create table sys_role(role_id bigint primary key,status char(1),del_flag char(1))");
                jdbc.execute("create table sys_user_role(user_id bigint,role_id bigint)");
                jdbc.update("insert into sys_user values(1,'0','0'),(2,'0','0')");jdbc.update("insert into sys_role values(2,'0','0')");jdbc.update("insert into sys_user_role values(2,2)");
                var engine=context.getBean(ProcessEngine.class);var config=(ProcessEngineConfigurationImpl)engine.getProcessEngineConfiguration();
                assertThat(config.getAsyncExecutor().isActive()).isTrue();
                // Test-only retry count: the official worker itself must exhaust retries, with no executeJob call.
                config.getJobServiceConfiguration().setAsyncExecutorNumberOfRetries(1);
                var packages=context.getBean(WorkflowPackages.class);var releases=context.getBean(WorkflowReleases.class);
                String xml=Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml")).replace("<userTask id=\"review\"","<userTask flowable:async=\"true\" id=\"review\"");
                var draft=packages.create(new WorkflowPackages.Edit("后台故障恢复","leave",new WorkflowValidation.Request(xml,List.of(new WorkflowValidation.Scenario("批准",List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd")))),"1");
                packages.validate(draft.id(),1,"1");var release=releases.publish(draft.id(),1,"1");releases.activate("leave",release.id(),0,"1");
                jdbc.execute("alter table ACT_RU_TASK add constraint workflow_owned_task_fault check (TASK_DEF_KEY_ <> 'review')");
                var leaves=context.getBean(WorkflowLeaves.class);var jobs=context.getBean(WorkflowJobs.class);
                var leave=leaves.submit(new WorkflowLeaves.Submit(UUID.randomUUID().toString(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"SQL故障"),"1");
                await().atMost(Duration.ofSeconds(45)).untilAsserted(()->assertThat(engine.getManagementService().createDeadLetterJobQuery().processInstanceId(leave.processId()).count()).isEqualTo(1));
                assertThat(engine.getTaskService().createTaskQuery().count()).isZero();
                assertThat(jdbc.queryForObject("select state from ef_workflow_leave where id=?",String.class,leave.id())).isEqualTo("PENDING");
                assertThat(jdbc.queryForObject("select count(*) from ef_workflow_leave_audit where leave_id=?",Long.class,leave.id())).isEqualTo(1);
                var failed=jobs.failed(release.id(),1,10);assertThat(failed.items()).hasSize(1);assertThat(failed.recoveryEnabled()).isTrue();
                String job=failed.items().get(0).id();var request=new WorkflowJobs.Retry(UUID.randomUUID().toString(),leave.id());
                var denied=WorkflowLeaveMysqlTest.concurrent(source,jdbc,leave.id(),()->jdbc.update("update sys_user set status='1' where user_id=1"),()->{
                    try{jobs.retry(job,request,"1");return 202;}catch(io.eforge.enterprise.common.exception.ApiFailure failure){return failure.status();}
                });
                assertThat(denied).containsExactly(403,403);jdbc.update("update sys_user set status='0' where user_id=1");
                jdbc.execute("alter table ef_workflow_job_audit add constraint workflow_owned_audit_fault check (actor_id <> 1)");
                assertThatThrownBy(()->jobs.retry(job,request,"1")).isInstanceOfSatisfying(io.eforge.enterprise.common.exception.ApiFailure.class,f->assertThat(f.status()).isEqualTo(503));
                assertThat(engine.getManagementService().createDeadLetterJobQuery().jobId(job).count()).isEqualTo(1);
                jdbc.execute("alter table ef_workflow_job_audit drop check workflow_owned_audit_fault");
                jdbc.execute("alter table ACT_RU_TASK drop check workflow_owned_task_fault");
                var concurrent=WorkflowLeaveMysqlTest.concurrent(source,jdbc,leave.id(),()->{},()->jobs.retry(job,request,"1"));
                var queued=concurrent.get(0);assertThat(concurrent.get(1)).isEqualTo(queued);assertThat(queued.status()).isEqualTo("QUEUED");
                await().atMost(Duration.ofSeconds(45)).untilAsserted(()->assertThat(engine.getTaskService().createTaskQuery().processInstanceId(leave.processId()).count()).isEqualTo(1));
                assertThat(jobs.retry(job,request,"1")).isEqualTo(queued);
                assertThat(leaves.get(leave.id(),"1").leave().status()).isEqualTo("PENDING");
                assertThat(jdbc.queryForObject("select count(*) from ef_workflow_job_audit",Long.class)).isEqualTo(1);
                var task=leaves.get(leave.id(),"2").tasks().get(0);
                leaves.claim(leave.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,task.id(),""),"2");
                assertThat(leaves.decide(leave.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),2,task.id(),"人工同意"),true,"2").status()).isEqualTo("APPROVED");
                // The actual worker has already read engine variables before it waits on the
                // role row. Revocation after that read must not use an old repeatable-read snapshot.
                var pool=java.util.concurrent.Executors.newSingleThreadExecutor();
                try(var roleLock=source.getConnection()){
                    roleLock.setAutoCommit(false);
                    try(var statement=roleLock.createStatement();var result=statement.executeQuery("select role_id from sys_role where role_id=2 for update")){assertThat(result.next()).isTrue();}
                    var racing=leaves.submit(new WorkflowLeaves.Submit(UUID.randomUUID().toString(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"撤权与撤回竞争"),"1");
                    await().atMost(Duration.ofSeconds(15)).untilAsserted(()->assertThat(jdbc.queryForObject("select count(*) from performance_schema.data_lock_waits w join performance_schema.data_locks l on l.ENGINE=w.ENGINE and l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID where l.OBJECT_SCHEMA='eforge_workflow' and l.OBJECT_NAME='sys_role' and l.LOCK_STATUS='WAITING'",Long.class)).isGreaterThan(0));
                    var cancel=new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,null,"撤回");
                    var withdrawn=pool.submit(()->{
                        try{return leaves.withdraw(racing.id(),cancel,"1");}
                        catch(io.eforge.enterprise.common.exception.ApiFailure failure){if(failure.status()!=409&&failure.status()!=503)throw failure;return leaves.withdraw(racing.id(),cancel,"1");}
                    });
                    try(var update=roleLock.createStatement()){update.executeUpdate("update sys_role set status='1' where role_id=2");}roleLock.commit();
                    assertThat(withdrawn.get(20,java.util.concurrent.TimeUnit.SECONDS).status()).isEqualTo("WITHDRAWN");
                    await().during(Duration.ofMillis(300)).atMost(Duration.ofSeconds(10)).untilAsserted(()->{
                        assertThat(engine.getTaskService().createTaskQuery().processInstanceId(racing.processId()).count()).isZero();
                        assertThat(engine.getManagementService().createJobQuery().processInstanceId(racing.processId()).count()).isZero();
                        assertThat(engine.getManagementService().createTimerJobQuery().processInstanceId(racing.processId()).count()).isZero();
                        assertThat(engine.getManagementService().createDeadLetterJobQuery().processInstanceId(racing.processId()).count()).isZero();
                    });
                }finally{pool.shutdownNow();jdbc.update("update sys_role set status='0' where role_id=2");}
            });
    }
}
