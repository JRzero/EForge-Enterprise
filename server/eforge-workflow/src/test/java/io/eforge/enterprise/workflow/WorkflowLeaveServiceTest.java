package io.eforge.enterprise.workflow;

import java.nio.file.*;
import java.time.LocalDate;
import java.util.*;
import javax.sql.DataSource;
import org.flowable.engine.ProcessEngine;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;
import static org.assertj.core.api.Assertions.*;

class WorkflowLeaveServiceTest {
    final ApplicationContextRunner runner=new ApplicationContextRunner()
        .withUserConfiguration(WorkflowEngineConfigurationTest.Database.class,WorkflowEngineConfiguration.class)
        .withPropertyValues("flowable.process.enabled=true","flowable.idm.enabled=false","flowable.eventregistry.enabled=false",
            "flowable.check-process-definitions=false","flowable.async-executor-activate=false","flowable.database-schema-update=true");
    @Test void submissionClaimDecisionAndWithdrawalUseCurrentIdentityAndIdempotency() {
        runner.run(context->{
            var jdbc=prepare(context.getBean(DataSource.class));var engine=context.getBean(ProcessEngine.class);
            var tx=context.getBean(WorkflowUnitOfWork.class);var packages=context.getBean(WorkflowPackages.class);var releases=context.getBean(WorkflowReleases.class);
            publish(packages,releases);
            var leaves=new WorkflowLeaveService(context.getBean(DataSource.class),tx,engine);
            var request=new WorkflowLeaves.Submit(UUID.randomUUID().toString(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,2),"家庭事务");
            var leave=leaves.submit(request,"1");assertThat(leaves.submit(request,"1")).isEqualTo(leave);
            assertThat(leaves.mine("1",1,10).items()).containsExactly(leave);
            assertThat(leaves.mine("3",1,10).items()).isEmpty();
            assertThat(leaves.pending("2",1,10).items()).hasSize(1).allMatch(WorkflowLeaves.Pending::canHandle);
            assertThat(leaves.pending("3",1,10).items()).isEmpty();
            assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isEqualTo(1);
            assertThatThrownBy(()->leaves.submit(new WorkflowLeaves.Submit(request.submissionId(),request.startDate(),request.endDate(),"不同内容"),"1"))
                .isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.status()).isEqualTo(409));
            assertThatThrownBy(()->leaves.get(leave.id(),"3")).isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.status()).isEqualTo(404));
            String task=leaves.get(leave.id(),"2").tasks().get(0).id();
            var claim=new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,task,"");
            var claimed=leaves.claim(leave.id(),claim,"2");assertThat(claimed.revision()).isEqualTo(2);
            assertThat(leaves.claim(leave.id(),claim,"2")).isEqualTo(claimed);
            jdbc.update("delete from sys_user_role where user_id=2");
            assertThat(leaves.get(leave.id(),"2").tasks()).hasSize(1).noneMatch(WorkflowLeaves.Task::canHandle);
            assertThat(leaves.pending("2",1,10).items()).hasSize(1).noneMatch(WorkflowLeaves.Pending::canHandle);
            var approve=new WorkflowLeaves.Command(UUID.randomUUID().toString(),2,task,"同意");
            assertThatThrownBy(()->leaves.decide(leave.id(),approve,true,"2")).isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.status()).isEqualTo(403));
            assertThat(engine.getTaskService().createTaskQuery().taskId(task).count()).isEqualTo(1);
            jdbc.update("insert into sys_user_role values (2,2)");
            assertThat(leaves.get(leave.id(),"2").tasks()).hasSize(1).allMatch(WorkflowLeaves.Task::canHandle);
            var approved=leaves.decide(leave.id(),approve,true,"2");assertThat(approved.status()).isEqualTo("APPROVED");
            assertThat(leaves.decide(leave.id(),approve,true,"2")).isEqualTo(approved);
            assertThat(leaves.handled("2",1,10).items()).containsExactly(approved);
            assertThat(leaves.handled("1",1,10).items()).isEmpty();
            assertThat(leaves.pending("2",1,10).total()).isZero();
            assertThat(leaves.get(leave.id(),"1").history()).extracting(WorkflowLeaves.Event::action).containsExactly("SUBMIT","CLAIM","APPROVE");
            var next=leaves.submit(new WorkflowLeaves.Submit(UUID.randomUUID().toString(),request.startDate(),request.endDate(),"撤回"),"1");
            var cancel=new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,null,"取消申请");
            assertThatThrownBy(()->leaves.withdraw(next.id(),cancel,"2")).isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.status()).isEqualTo(403));
            assertThat(leaves.withdraw(next.id(),cancel,"1").status()).isEqualTo("WITHDRAWN");
            assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isZero();
        });
    }
    @Test void actualEngineChangesAndBusinessRowsRollbackTogetherOnAuditFailure() {
        runner.run(context->{
            var source=context.getBean(DataSource.class);var jdbc=prepare(source);var engine=context.getBean(ProcessEngine.class);
            publish(context.getBean(WorkflowPackages.class),context.getBean(WorkflowReleases.class));
            var leaves=new WorkflowLeaveService(source,context.getBean(WorkflowUnitOfWork.class),engine);
            var request=new WorkflowLeaves.Submit(UUID.randomUUID().toString(),LocalDate.of(2026,11,1),LocalDate.of(2026,11,1),"事务验证");
            jdbc.execute("alter table ef_workflow_leave_audit rename to missing_leave_audit");
            assertThatThrownBy(()->leaves.submit(request,"1")).isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.status()).isEqualTo(503));
            assertThat(jdbc.queryForObject("select count(*) from ef_workflow_leave",Long.class)).isZero();
            assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isZero();
            jdbc.execute("alter table missing_leave_audit rename to ef_workflow_leave_audit");
            var leave=leaves.submit(request,"1");String task=leaves.get(leave.id(),"2").tasks().get(0).id();
            leaves.claim(leave.id(),new WorkflowLeaves.Command(UUID.randomUUID().toString(),1,task,""),"2");
            jdbc.execute("alter table ef_workflow_leave_audit add constraint reject_audit_fault check (action <> 'REJECT')");
            var reject=new WorkflowLeaves.Command(UUID.randomUUID().toString(),2,task,"请调整日期");
            assertThatThrownBy(()->leaves.decide(leave.id(),reject,false,"2")).isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.status()).isEqualTo(503));
            assertThat(engine.getTaskService().createTaskQuery().taskId(task).count()).isEqualTo(1);
            assertThat(jdbc.queryForObject("select state from ef_workflow_leave where id=?",String.class,leave.id())).isEqualTo("PENDING");
            jdbc.execute("alter table ef_workflow_leave_audit drop constraint reject_audit_fault");
            assertThat(leaves.decide(leave.id(),reject,false,"2").status()).isEqualTo("REJECTED");
        });
    }
    static JdbcTemplate prepare(DataSource source)throws Exception {
        var jdbc=new JdbcTemplate(source);jdbc.execute("SET MODE MySQL");
        for(String file:List.of("04-eforge-workflow.sql","05-eforge-workflow-releases.sql","06-eforge-workflow-leave.sql"))
            jdbc.execute(Files.readString(Path.of("../../sql/workflow",file)).replace("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin",""));
        jdbc.execute("create table sys_user(user_id bigint primary key,status char(1),del_flag char(1)); create table sys_role(role_id bigint primary key,status char(1),del_flag char(1)); create table sys_user_role(user_id bigint,role_id bigint)");
        jdbc.update("insert into sys_user values (1,'0','0'),(2,'0','0'),(3,'0','0')");jdbc.update("insert into sys_role values (2,'0','0')");jdbc.update("insert into sys_user_role values (2,2)");return jdbc;
    }
    static void publish(WorkflowPackages packages,WorkflowReleases releases)throws Exception {
        var draft=packages.create(new WorkflowPackages.Edit("请假审批","leave",new WorkflowValidation.Request(
            Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml")),List.of(
                new WorkflowValidation.Scenario("批准",List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd"),
                new WorkflowValidation.Scenario("拒绝",List.of(new WorkflowValidation.Decision("review",false)),"rejectedEnd")))),"1");
        packages.validate(draft.id(),1,"1");releases.activate("leave",releases.publish(draft.id(),1,"1").id(),0,"1");
    }
}
