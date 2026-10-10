package io.eforge.enterprise.workflow;

import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;
import javax.sql.DataSource;
import org.flowable.engine.ProcessEngine;
import org.junit.jupiter.api.Test;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;
import static org.assertj.core.api.Assertions.*;

class WorkflowJobServiceTest {
    @Test void realDeadLetterRetryIsAuditedIdempotentAndNeverApproves() {
        new WorkflowLeaveServiceTest().runner.run(context->{
            var source=context.getBean(DataSource.class);var jdbc=WorkflowLeaveServiceTest.prepare(source);
            jdbc.execute(Files.readString(Path.of("../../sql/workflow/07-eforge-workflow-job-audit.sql")));
            jdbc.execute("create table sys_menu(menu_id bigint primary key,perms varchar(100),status char(1)); create table sys_role_menu(role_id bigint,menu_id bigint)");
            jdbc.update("insert into sys_menu values(1,'workflow:operation:retry','0')");jdbc.update("insert into sys_role_menu values(2,1)");
            var engine=context.getBean(ProcessEngine.class);var management=engine.getManagementService();
            var packages=context.getBean(WorkflowPackages.class);var releases=context.getBean(WorkflowReleases.class);
            String xml=Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml")).replace("<userTask id=\"review\"","<userTask flowable:async=\"true\" id=\"review\"");
            var draft=packages.create(new WorkflowPackages.Edit("异步审批","leave",new WorkflowValidation.Request(xml,List.of(new WorkflowValidation.Scenario("批准",List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd")))),"1");
            packages.validate(draft.id(),1,"1");var release=releases.publish(draft.id(),1,"1");
            engine.getProcessEngineConfiguration().setAsyncExecutorActivate(true);releases.activate("leave",release.id(),0,"1");
            var leaves=context.getBean(WorkflowLeaves.class);
            var leave=leaves.submit(new WorkflowLeaves.Submit(UUID.randomUUID().toString(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"失败恢复"),"1");
            // Real engine execution fails under current role withdrawal and exhausts official retries.
            jdbc.update("update sys_role set status='1' where role_id=2");
            for(int attempt=0;attempt<3;attempt++){
                var job=management.createJobQuery().processInstanceId(leave.processId()).singleResult();
                assertThatThrownBy(()->management.executeJob(job.getId())).isInstanceOf(RuntimeException.class);
                if(attempt<2)management.moveTimerToExecutableJob(management.createTimerJobQuery().processInstanceId(leave.processId()).singleResult().getId());
            }
            var dead=management.createDeadLetterJobQuery().processInstanceId(leave.processId()).singleResult();assertThat(dead).isNotNull();
            var jobs=new WorkflowJobService(source,context.getBean(WorkflowUnitOfWork.class),engine);
            assertThat(jobs.failed(release.id(),1,10).items()).extracting(WorkflowJobs.Failed::id).containsExactly(dead.getId());
            var command=new WorkflowJobs.Retry(UUID.randomUUID().toString(),leave.id());
            assertCode(()->jobs.retry(dead.getId(),command,"2"),"WORKFLOW_JOB_FORBIDDEN");
            jdbc.update("update sys_role set status='0' where role_id=2");
            engine.getRepositoryService().suspendProcessDefinitionById(release.processDefinitionId(),false,null);
            assertThat(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(leave.processId()).active().count()).isEqualTo(1);
            assertCode(()->jobs.retry(dead.getId(),command,"2"),"WORKFLOW_JOB_CONFLICT");
            assertThat(management.createDeadLetterJobQuery().jobId(dead.getId()).count()).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from ef_workflow_job_audit",Long.class)).isZero();
            engine.getRepositoryService().activateProcessDefinitionById(release.processDefinitionId(),false,null);
            engine.getRuntimeService().suspendProcessInstanceById(leave.processId());
            assertCode(()->jobs.retry(dead.getId(),command,"2"),"WORKFLOW_JOB_CONFLICT");
            engine.getRuntimeService().activateProcessInstanceById(leave.processId());
            jdbc.execute("alter table ef_workflow_job_audit add constraint audit_fault check (actor_id <> 2)");
            assertCode(()->jobs.retry(dead.getId(),command,"2"),"WORKFLOW_STORAGE_UNAVAILABLE");
            assertThat(management.createDeadLetterJobQuery().jobId(dead.getId()).count()).isEqualTo(1);
            assertThat(management.createJobQuery().processInstanceId(leave.processId()).count()).isZero();
            jdbc.execute("alter table ef_workflow_job_audit drop constraint audit_fault");
            var queued=jobs.retry(dead.getId(),command,"2");assertThat(queued.status()).isEqualTo("QUEUED");
            assertThat(jobs.retry(dead.getId(),command,"2")).isEqualTo(queued);
            assertCode(()->jobs.retry(dead.getId(),new WorkflowJobs.Retry(UUID.randomUUID().toString(),leave.id()),"2"),"WORKFLOW_JOB_CONFLICT");
            assertThat(engine.getTaskService().createTaskQuery().count()).isZero();
            management.executeJob(queued.queuedJobId());
            assertThat(engine.getTaskService().createTaskQuery().count()).isEqualTo(1);
            assertThat(leaves.get(leave.id(),"1").leave().status()).isEqualTo("PENDING");
            assertThat(jdbc.queryForObject("select count(*) from ef_workflow_job_audit",Long.class)).isEqualTo(1);
            assertThat(jobs.retry(dead.getId(),command,"2")).isEqualTo(queued);
            jdbc.update("delete from sys_role_menu");assertCode(()->jobs.retry(dead.getId(),command,"2"),"WORKFLOW_JOB_FORBIDDEN");
        });
    }
    private static void assertCode(Runnable action,String code){assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.code()).isEqualTo(code));}
}
