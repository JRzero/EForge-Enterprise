package io.eforge.enterprise.workflow;

import java.nio.file.*;
import java.util.*;
import javax.sql.DataSource;
import org.flowable.engine.ProcessEngine;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;
import io.eforge.enterprise.workflow.purchase.PurchaseService;
import static org.assertj.core.api.Assertions.*;

class PurchaseServiceTest {
    private final WorkflowLeaveServiceTest fixture=new WorkflowLeaveServiceTest();
    private WorkflowPurchases.Edit edit(){return new WorkflowPurchases.Edit("设备采购","开发需要","2",List.of(new WorkflowPurchases.ItemInput("line1","键盘","个","3","0.10")));}
    private WorkflowPurchases.Command command(long revision){return new WorkflowPurchases.Command(UUID.randomUUID().toString(),revision,"");}
    static JdbcTemplate prepare(DataSource source)throws Exception{
        var jdbc=WorkflowLeaveServiceTest.prepare(source);
        jdbc.execute(Files.readString(Path.of("../../sql/workflow/08-eforge-purchase.sql")).replace("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin",""));
        jdbc.execute("create table sys_menu(menu_id bigint primary key,status char(1),perms varchar(100));create table sys_role_menu(role_id bigint,menu_id bigint)");
        jdbc.execute("alter table sys_user add user_name varchar(30) default 'user';alter table sys_user add nick_name varchar(30) default '人员'");
        jdbc.update("insert into sys_menu values (1,'0','sample:purchase:approve')");jdbc.update("insert into sys_role_menu values (2,1)");return jdbc;
    }
    static void publish(WorkflowPackages packages,WorkflowReleases releases)throws Exception{
        String xml=Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml"))
            .replace("leaveApproval","purchaseApproval").replace("flowable:candidateGroups=\"role:2\"","flowable:assignee=\"${approver}\"");
        var draft=packages.create(new WorkflowPackages.Edit("采购审批","purchase",new WorkflowValidation.Request(xml,List.of(
            new WorkflowValidation.Scenario("批准",List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd"),
            new WorkflowValidation.Scenario("驳回",List.of(new WorkflowValidation.Decision("review",false)),"rejectedEnd")))),"1");
        packages.validate(draft.id(),1,"1");releases.activate("purchase",releases.publish(draft.id(),1,"1").id(),0,"1");
    }
    @Test void draftsArePrivateImmutableAndRetrySafe(){fixture.runner.run(context->{
        var source=context.getBean(DataSource.class);prepare(source);
        var service=new PurchaseService(source,context.getBean(WorkflowUnitOfWork.class),context.getBean(ProcessEngine.class));
        String key=UUID.randomUUID().toString();var row=service.create(key,edit(),"1");
        assertThat(row.total()).isEqualTo("0.30");assertThat(row.status()).isEqualTo("DRAFT");
        assertThat(service.create(key,edit(),"1")).isEqualTo(row);
        assertThat(service.list("mine","",1,10,"1").total()).isEqualTo(1);
        assertThat(service.list("pending","",1,10,"2").total()).isZero();
        assertThatThrownBy(()->service.get(row.id(),"2")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(404));
        assertThatThrownBy(()->service.get(row.id(),"3")).isInstanceOf(ApiFailure.class);
        var update=command(1);var changed=new WorkflowPurchases.Edit("新标题","用途","2",edit().items());
        var updated=service.update(row.id(),update,changed,"1");assertThat(updated.revision()).isEqualTo(2);
        assertThat(service.update(row.id(),update,changed,"1")).isEqualTo(updated);
        assertThatThrownBy(()->service.update(row.id(),update,edit(),"1")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(409));
        assertThatThrownBy(()->service.update(row.id(),command(1),edit(),"1")).isInstanceOf(ApiFailure.class);
        assertThat(service.get(row.id(),"1").history()).hasSize(2);
    });}
    @Test void attachmentsAreDraftOwnedBoundedAndParticipantDownloadsAreAuthorized(){fixture.runner.run(context->{
        var source=context.getBean(DataSource.class);prepare(source);
        var service=new PurchaseService(source,context.getBean(WorkflowUnitOfWork.class),context.getBean(ProcessEngine.class));
        var row=service.create(UUID.randomUUID().toString(),edit(),"1");
        byte[] pdf="%PDF-1.7\nfixture\n%%EOF".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        var attach=command(1);var changed=service.upload(row.id(),attach,"报价.pdf",pdf,"1");
        assertThat(changed.revision()).isEqualTo(2);
        assertThat(service.upload(row.id(),attach,"报价.pdf",pdf,"1")).isEqualTo(changed);
        assertThat(service.attachments(row.id(),"1")).hasSize(1);
        assertThat(service.download(row.id(),attach.commandId(),"1").content()).containsExactly(pdf);
        assertThatThrownBy(()->service.download(row.id(),attach.commandId(),"2")).isInstanceOf(ApiFailure.class);
        assertThatThrownBy(()->service.upload(row.id(),command(2),"bad.exe",pdf,"1")).isInstanceOf(ApiFailure.class);
        assertThatThrownBy(()->service.upload(row.id(),command(2),"../bad.pdf",pdf,"1")).isInstanceOf(ApiFailure.class);
        assertThatThrownBy(()->service.upload(row.id(),command(2),"bad.pdf",new byte[5*1024*1024+1],"1")).isInstanceOf(ApiFailure.class);
        for(int revision=2;revision<6;revision++)service.upload(row.id(),command(revision),"报价.pdf",pdf,"1");
        assertThatThrownBy(()->service.upload(row.id(),command(6),"报价.pdf",pdf,"1")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(409));
        service.removeAttachment(row.id(),attach.commandId(),command(6),"1");
        assertThat(service.attachments(row.id(),"1")).hasSize(4);
        publish(context.getBean(WorkflowPackages.class),context.getBean(WorkflowReleases.class));
        service.submit(row.id(),command(7),"1");
        var retained=service.attachments(row.id(),"2").get(0);
        assertThat(service.download(row.id(),retained.id(),"2").content()).containsExactly(pdf);
        assertThatThrownBy(()->service.download(row.id(),retained.id(),"3")).isInstanceOf(ApiFailure.class);
        assertThatThrownBy(()->service.removeAttachment(row.id(),retained.id(),command(8),"1")).isInstanceOf(ApiFailure.class);
    });}
    @Test void approverOptionsRequireCurrentGrantAndEscapeSearch(){fixture.runner.run(context->{
        var source=context.getBean(DataSource.class);var jdbc=prepare(source);
        var service=new PurchaseService(source,context.getBean(WorkflowUnitOfWork.class),context.getBean(ProcessEngine.class));
        assertThat(service.approvers("",1,10,"1").items()).extracting(WorkflowPurchases.Approver::id).containsExactly("2");
        assertThat(service.approvers("%",1,10,"1").total()).isZero();
        jdbc.update("delete from sys_role_menu");assertThat(service.approvers("",1,10,"1").total()).isZero();
        assertThatThrownBy(()->service.create(UUID.randomUUID().toString(),edit(),"1")).isInstanceOf(ApiFailure.class);
        assertThat(jdbc.queryForObject("select count(*) from ef_purchase",Long.class)).isZero();
    });}
    @Test void approvesRejectsWithdrawsAndIsolatesLeaveActivation(){fixture.runner.run(context->{
        var source=context.getBean(DataSource.class);prepare(source);var engine=context.getBean(ProcessEngine.class);
        var packages=context.getBean(WorkflowPackages.class);var releases=context.getBean(WorkflowReleases.class);
        WorkflowLeaveServiceTest.publish(packages,releases);String leaveRelease=releases.activation("leave").releaseId();
        publish(packages,releases);assertThat(releases.activation("leave").releaseId()).isEqualTo(leaveRelease);
        var service=new PurchaseService(source,context.getBean(WorkflowUnitOfWork.class),engine);
        for(String result:List.of("APPROVED","REJECTED","WITHDRAWN")){
            var row=service.create(UUID.randomUUID().toString(),edit(),"1");var submit=command(1);
            var pending=service.submit(row.id(),submit,"1");assertThat(service.submit(row.id(),submit,"1")).isEqualTo(pending);
            assertThat(engine.getTaskService().createTaskQuery().processInstanceId(pending.processId()).singleResult().getAssignee()).isEqualTo("2");
            assertThat(service.list("pending","",1,10,"2").total()).isEqualTo(1);
            assertThatThrownBy(()->service.decide(row.id(),command(2),true,"3")).isInstanceOf(ApiFailure.class);
            var action=command(2);
            var finished=result.equals("WITHDRAWN")?service.withdraw(row.id(),action,"1"):service.decide(row.id(),action,result.equals("APPROVED"),"2");
            assertThat(finished.status()).isEqualTo(result);
            assertThat(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(pending.processId()).count()).isZero();
            if(!result.equals("WITHDRAWN"))assertThat(service.decide(row.id(),action,result.equals("APPROVED"),"2")).isEqualTo(finished);
        }
    });}
    @Test void auditFaultRollsBackEngineAndBusinessAndRevocationPreventsDecision(){fixture.runner.run(context->{
        var source=context.getBean(DataSource.class);var jdbc=prepare(source);var engine=context.getBean(ProcessEngine.class);
        publish(context.getBean(WorkflowPackages.class),context.getBean(WorkflowReleases.class));
        var service=new PurchaseService(source,context.getBean(WorkflowUnitOfWork.class),engine);
        var row=service.create(UUID.randomUUID().toString(),edit(),"1");
        jdbc.execute("alter table ef_purchase_audit add constraint purchase_fault check (action <> 'SUBMIT')");
        var submit=command(1);
        assertThatThrownBy(()->service.submit(row.id(),submit,"1")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
        assertThat(service.get(row.id(),"1").purchase().status()).isEqualTo("DRAFT");
        assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isZero();
        jdbc.execute("alter table ef_purchase_audit drop constraint purchase_fault");service.submit(row.id(),submit,"1");
        jdbc.update("delete from sys_role_menu");
        assertThatThrownBy(()->service.decide(row.id(),command(2),true,"2")).isInstanceOf(ApiFailure.class);
        assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isEqualTo(1);
        jdbc.update("insert into sys_role_menu values (2,1)");
        jdbc.execute("alter table ef_purchase_audit add constraint purchase_decision_fault check (action <> 'APPROVE')");
        var approve=command(2);
        assertThatThrownBy(()->service.decide(row.id(),approve,true,"2")).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status()).isEqualTo(503));
        assertThat(engine.getTaskService().createTaskQuery().count()).isEqualTo(1);
        assertThat(service.get(row.id(),"1").purchase().status()).isEqualTo("PENDING");
        jdbc.execute("alter table ef_purchase_audit drop constraint purchase_decision_fault");
        assertThat(service.decide(row.id(),approve,true,"2").status()).isEqualTo("APPROVED");
    });}
}
