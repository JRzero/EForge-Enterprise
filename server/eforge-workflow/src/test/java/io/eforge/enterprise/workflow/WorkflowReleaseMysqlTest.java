package io.eforge.enterprise.workflow;

import java.nio.file.*;
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

class WorkflowReleaseMysqlTest {
    @Test void actualConcurrentPublicationActivationAndDeploymentRollback() throws Exception {
        Assumptions.assumeTrue(System.getenv("EFORGE_WORKFLOW_TEST_JDBC_URL")!=null,"Requires owned MySQL fixture");
        var edit=new WorkflowPackages.Edit("实际发布","leave",new WorkflowValidation.Request(
            Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml")),List.of(
                new WorkflowValidation.Scenario("approved",List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd"),
                new WorkflowValidation.Scenario("rejected",List.of(new WorkflowValidation.Decision("review",false)),"rejectedEnd"))));
        new ApplicationContextRunner().withUserConfiguration(WorkflowEngineConfigurationTest.Database.class,WorkflowEngineConfiguration.class)
            .withPropertyValues("flowable.process.enabled=true","flowable.idm.enabled=false","flowable.eventregistry.enabled=false",
                "flowable.check-process-definitions=false","flowable.async-executor-activate=false","flowable.database-schema-update=false")
            .run(context -> {
                assertThat(context).hasNotFailed();var source=context.getBean(DataSource.class);var jdbc=new JdbcTemplate(source);
                jdbc.execute("create table sys_user(user_id bigint primary key,status char(1),del_flag char(1))");
                jdbc.execute("create table sys_role(role_id bigint primary key,status char(1),del_flag char(1))");
                jdbc.execute("create table sys_user_role(user_id bigint,role_id bigint)");
                jdbc.update("insert into sys_user values(2,'0','0')");jdbc.update("insert into sys_role values(2,'0','0')");jdbc.update("insert into sys_user_role values(2,2)");
                var packages=context.getBean(WorkflowPackages.class);var releases=context.getBean(WorkflowReleases.class);
                var engine=context.getBean(ProcessEngine.class);var draft=packages.create(edit,"1");packages.validate(draft.id(),1,"1");
                var published=concurrent(source,jdbc,"ef_workflow_package","select id from ef_workflow_package where id=? for update",draft.id(),
                    () -> releases.publish(draft.id(),1,"1"));
                assertThat(published.get(0)).isEqualTo(published.get(1));var release=published.get(0);
                assertThat(engine.getRepositoryService().createDeploymentQuery().count()).isEqualTo(1);
                assertThat(jdbc.queryForObject("select count(*) from ef_workflow_release_audit",Long.class)).isEqualTo(1);
                var statuses=concurrent(source,jdbc,"ef_workflow_activation","select business_type from ef_workflow_activation where business_type=? for update","leave",()->{
                    try{releases.activate("leave",release.id(),0,"1");return 200;}catch(ApiFailure failure){return failure.status();}
                });
                assertThat(statuses).containsExactlyInAnyOrder(200,409);
                var old=engine.getRuntimeService().startProcessInstanceById(release.processDefinitionId());
                packages.update(draft.id(),1,edit,"1");packages.validate(draft.id(),2,"1");
                assertThat(releases.publish(draft.id(),1,"1")).isEqualTo(release);
                var config=(org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl)engine.getProcessEngineConfiguration();
                int cacheBefore=config.getProcessDefinitionCache().size();
                jdbc.execute("rename table ef_workflow_release_audit to workflow_release_fault_audit");
                try{
                    assertThatThrownBy(()->releases.publish(draft.id(),2,"1")).isInstanceOfSatisfying(ApiFailure.class,failure->assertThat(failure.status()).isEqualTo(503));
                    assertThatThrownBy(()->releases.activate("leave",release.id(),1,"1")).isInstanceOfSatisfying(ApiFailure.class,failure->assertThat(failure.status()).isEqualTo(503));
                    assertThat(releases.activation("leave").revision()).isEqualTo(1);
                }
                finally{jdbc.execute("rename table workflow_release_fault_audit to ef_workflow_release_audit");}
                assertThat(config.getProcessDefinitionCache().size()).isEqualTo(cacheBefore);
                assertThat(engine.getRepositoryService().createDeploymentQuery().count()).isEqualTo(1);
                assertThat(releases.list(draft.id(),1,10).total()).isEqualTo(1);
                var next=releases.publish(draft.id(),2,"1");
                jdbc.update("update sys_role set status='1' where role_id=2");
                assertThatThrownBy(()->releases.activate("leave",next.id(),1,"1")).isInstanceOfSatisfying(ApiFailure.class,failure->assertThat(failure.code()).isEqualTo("WORKFLOW_CANDIDATE_UNAVAILABLE"));
                assertThat(releases.activation("leave").revision()).isEqualTo(1);
                jdbc.update("update sys_role set status='0' where role_id=2");
                releases.activate("leave",next.id(),1,"1");
                assertThat(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(old.getId()).singleResult().getProcessDefinitionId()).isEqualTo(release.processDefinitionId());
                var task=engine.getTaskService().createTaskQuery().processInstanceId(old.getId()).singleResult();
                engine.getTaskService().complete(task.getId(),Map.of("approved",true));
                assertThat(engine.getHistoryService().createHistoricProcessInstanceQuery().processInstanceId(old.getId()).finished().count()).isEqualTo(1);
            });
    }
    private static <T>List<T> concurrent(DataSource source,JdbcTemplate jdbc,String table,String lockSql,String key,Callable<T> operation)throws Exception {
        var pool=Executors.newFixedThreadPool(2);
        try(var lock=source.getConnection()){
            lock.setAutoCommit(false);try(var statement=lock.prepareStatement(lockSql)){statement.setString(1,key);statement.executeQuery().close();}
            var first=pool.submit(operation);var second=pool.submit(operation);
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);boolean bothWaiting=false;
            while(System.nanoTime()<deadline){
                long waiting=jdbc.queryForObject("select count(distinct w.REQUESTING_ENGINE_TRANSACTION_ID) from performance_schema.data_lock_waits w join performance_schema.data_locks l on l.ENGINE=w.ENGINE and l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID where l.OBJECT_SCHEMA='eforge_workflow' and l.OBJECT_NAME=? and l.LOCK_STATUS='WAITING'",Long.class,table);
                if(waiting==2){bothWaiting=true;break;}Thread.sleep(50);
            }
            lock.commit();assertThat(bothWaiting).as("both actual SQL requests waited on %s",table).isTrue();
            return List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS));
        }finally{pool.shutdownNow();}
    }
}
