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

class WorkflowAsyncStartTest {
    @Test void optInCreatesARealJobAndCurrentCandidatesGateTaskCreationWithoutApproving() {
        new WorkflowLeaveServiceTest().runner.run(context->{
            var jdbc=WorkflowLeaveServiceTest.prepare(context.getBean(DataSource.class));
            var engine=context.getBean(ProcessEngine.class);var packages=context.getBean(WorkflowPackages.class);var releases=context.getBean(WorkflowReleases.class);
            String xml=Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml")).replace("<userTask id=\"review\"","<userTask flowable:async=\"true\" id=\"review\"");
            var draft=packages.create(new WorkflowPackages.Edit("异步创建待办","leave",new WorkflowValidation.Request(xml,List.of(new WorkflowValidation.Scenario("批准",List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd")))),"1");
            packages.validate(draft.id(),1,"1");var release=releases.publish(draft.id(),1,"1");
            assertThatThrownBy(()->releases.activate("leave",release.id(),0,"1")).isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.code()).isEqualTo("WORKFLOW_ASYNC_DISABLED"));
            // Enable the capability flag without starting a worker: this test drives the real job
            // explicitly; a separate actual MySQL test exercises the official background executor.
            engine.getProcessEngineConfiguration().setAsyncExecutorActivate(true);
            releases.activate("leave",release.id(),0,"1");
            var leaves=context.getBean(WorkflowLeaves.class);
            var leave=leaves.submit(new WorkflowLeaves.Submit(UUID.randomUUID().toString(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"异步示例"),"1");
            assertThat(leave.status()).isEqualTo("PENDING");assertThat(leaves.get(leave.id(),"1").tasks()).isEmpty();
            var job=engine.getManagementService().createJobQuery().processInstanceId(leave.processId()).singleResult();assertThat(job).isNotNull();
            jdbc.update("update sys_role set status='1' where role_id=2");
            assertThatThrownBy(()->engine.getManagementService().executeJob(job.getId())).isInstanceOf(RuntimeException.class);
            assertThat(engine.getTaskService().createTaskQuery().processInstanceId(leave.processId()).count()).isZero();
            assertThat(jdbc.queryForObject("select state from ef_workflow_leave where id=?",String.class,leave.id())).isEqualTo("PENDING");
            var timer=engine.getManagementService().createTimerJobQuery().processInstanceId(leave.processId()).singleResult();
            assertThat(timer).isNotNull();assertThat(timer.getRetries()).isEqualTo(job.getRetries()-1);
            // A failed official execution moves the job to the retry timer table. Resume its
            // returned identity, not the now-removed executable-job identity.
            jdbc.update("update sys_role set status='0' where role_id=2");
            var retry=engine.getManagementService().moveTimerToExecutableJob(timer.getId());
            engine.getManagementService().executeJob(retry.getId());
            var task=leaves.get(leave.id(),"2").tasks().get(0);
            assertThat(leaves.get(leave.id(),"1").tasks()).hasSize(1);assertThat(engine.getManagementService().createJobQuery().count()).isZero();
            leaves.claim(leave.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,task.id(),""),"2");
            assertThat(leaves.decide(leave.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),2,task.id(),"人工批准"),true,"2").status()).isEqualTo("APPROVED");
        });
    }
}
