package io.eforge.enterprise.workflow;

import java.nio.file.*;
import java.util.*;
import javax.sql.DataSource;
import org.flowable.engine.ProcessEngine;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;
import static org.assertj.core.api.Assertions.*;

class WorkflowReleaseStoreTest {
    final ApplicationContextRunner runner=new ApplicationContextRunner()
        .withUserConfiguration(WorkflowEngineConfigurationTest.Database.class,WorkflowEngineConfiguration.class)
        .withPropertyValues("flowable.process.enabled=true","flowable.idm.enabled=false","flowable.eventregistry.enabled=false",
            "flowable.check-process-definitions=false","flowable.async-executor-activate=false","flowable.database-schema-update=true");

    @Test void validatedPublicationIsImmutableIdempotentAndActivationPinsExistingInstances() {
        runner.run(context -> {
            var jdbc=prepare(context.getBean(DataSource.class));
            var engine=context.getBean(ProcessEngine.class);
            var packages=context.getBean(WorkflowPackages.class);
            var releases=new WorkflowReleaseStore(context.getBean(DataSource.class),context.getBean(WorkflowUnitOfWork.class),packages,engine);
            var edit=example(); var draft=packages.create(edit,"1");
            assertThatThrownBy(() -> releases.publish(draft.id(),1,"1")).isInstanceOfSatisfying(ApiFailure.class,
                failure -> assertThat(failure.code()).isEqualTo("WORKFLOW_PROOF_REQUIRED"));
            packages.validate(draft.id(),1,"1");
            var first=releases.publish(draft.id(),1,"1");
            assertThat(releases.publish(draft.id(),1,"2")).isEqualTo(first);
            assertThat(engine.getRepositoryService().createDeploymentQuery().count()).isEqualTo(1);
            assertThat(releases.activation("leave").releaseId()).isNull();
            assertThat(releases.activate("leave",first.id(),0,"1").revision()).isEqualTo(1);
            var old=engine.getRuntimeService().startProcessInstanceById(first.processDefinitionId());
            packages.update(draft.id(),1,new WorkflowPackages.Edit("第二版","leave",edit.source()),"1");
            assertThat(releases.publish(draft.id(),1,"2")).isEqualTo(first);
            packages.validate(draft.id(),2,"1");
            var second=releases.publish(draft.id(),2,"1");
            assertThat(second.processDefinitionId()).isNotEqualTo(first.processDefinitionId());
            assertThat(releases.activate("leave",second.id(),1,"1").revision()).isEqualTo(2);
            assertThatThrownBy(() -> releases.activate("leave",first.id(),1,"1")).isInstanceOfSatisfying(ApiFailure.class,
                failure -> assertThat(failure.status()).isEqualTo(409));
            assertThat(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(old.getId()).singleResult()
                .getProcessDefinitionId()).isEqualTo(first.processDefinitionId());
            assertThat(releases.get(first.id())).isEqualTo(first);
            assertThat(releases.list(draft.id(),1,1).items()).containsExactly(second);
            assertThat(releases.list(draft.id(),1,1).total()).isEqualTo(2);
            assertThat(jdbc.queryForObject("select count(*) from ef_workflow_release_audit",Long.class)).isEqualTo(4);
        });
    }

    @Test void failedAuditRollsBackDeploymentAndCacheAndInvalidCandidateCannotPublish() {
        runner.run(context -> {
            var dataSource=context.getBean(DataSource.class); var jdbc=prepare(dataSource);
            var packages=context.getBean(WorkflowPackages.class);var engine=context.getBean(ProcessEngine.class);
            var releases=new WorkflowReleaseStore(dataSource,context.getBean(WorkflowUnitOfWork.class),packages,engine);
            var draft=packages.create(example(),"1");packages.validate(draft.id(),1,"1");
            jdbc.update("update sys_user set status='1'");
            assertThatThrownBy(() -> releases.publish(draft.id(),1,"1")).isInstanceOfSatisfying(ApiFailure.class,
                failure -> assertThat(failure.code()).isEqualTo("WORKFLOW_CANDIDATE_UNAVAILABLE"));
            jdbc.update("update sys_user set status='0'");
            var config=(org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl)engine.getProcessEngineConfiguration();
            int cacheBefore=config.getProcessDefinitionCache().size();
            jdbc.execute("alter table ef_workflow_release_audit rename to missing_release_audit");
            assertThatThrownBy(() -> releases.publish(draft.id(),1,"1")).isInstanceOfSatisfying(ApiFailure.class,
                failure -> assertThat(failure.status()).isEqualTo(503));
            assertThat(engine.getRepositoryService().createDeploymentQuery().count()).isZero();
            assertThat(config.getProcessDefinitionCache().size()).isEqualTo(cacheBefore);
            assertThat(releases.list(draft.id(),1,10).items()).isEmpty();
            jdbc.execute("alter table missing_release_audit rename to ef_workflow_release_audit");
            assertThat(releases.publish(draft.id(),1,"1").packageRevision()).isEqualTo(1);
        });
    }

    @Test void nestedPublicationCannotLeaveRolledBackDefinitionInSharedCache() {
        runner.run(context -> {
            var source=context.getBean(DataSource.class);prepare(source);
            var packages=context.getBean(WorkflowPackages.class);var engine=context.getBean(ProcessEngine.class);
            var transaction=context.getBean(WorkflowUnitOfWork.class);
            var releases=new WorkflowReleaseStore(source,transaction,packages,engine);
            var draft=packages.create(example(),"1");packages.validate(draft.id(),1,"1");
            assertThatThrownBy(() -> transaction.execute(() -> {
                releases.publish(draft.id(),1,"1");throw new IllegalStateException("caller rollback");
            })).isInstanceOfSatisfying(ApiFailure.class,failure -> assertThat(failure.code()).isEqualTo("WORKFLOW_PUBLICATION_TRANSACTION"));
            assertThat(engine.getRepositoryService().createDeploymentQuery().count()).isZero();
            assertThat(((org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl)engine.getProcessEngineConfiguration())
                .getProcessDefinitionCache().size()).isZero();
            assertThat(releases.publish(draft.id(),1,"1")).isNotNull();
        });
    }
    @Test void validEngineGraphWithUnregisteredLeaveOutcomeCannotBePublished() {
        runner.run(context->{
            var source=context.getBean(DataSource.class);prepare(source);var packages=context.getBean(WorkflowPackages.class);
            var original=example();var request=original.source();
            var draft=packages.create(new WorkflowPackages.Edit("不匹配的结果","leave",new WorkflowValidation.Request(
                request.bpmnXml().replace("approvedEnd","unknownEnd"),request.scenarios().stream().map(scenario->new WorkflowValidation.Scenario(scenario.name(),scenario.decisions(),scenario.expectedEnd().replace("approvedEnd","unknownEnd"))).toList())),"1");
            packages.validate(draft.id(),1,"1");var engine=context.getBean(ProcessEngine.class);
            assertThatThrownBy(()->context.getBean(WorkflowReleases.class).publish(draft.id(),1,"1"))
                .isInstanceOfSatisfying(ApiFailure.class,f->assertThat(f.code()).isEqualTo("WORKFLOW_LEAVE_BINDING"));
            assertThat(engine.getRepositoryService().createDeploymentQuery().count()).isZero();
            assertThat(((org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl)engine.getProcessEngineConfiguration()).getProcessDefinitionCache().size()).isZero();
        });
    }

    private static JdbcTemplate prepare(DataSource source) throws Exception {
        var jdbc=new JdbcTemplate(source);
        for(String file:List.of("04-eforge-workflow.sql","05-eforge-workflow-releases.sql"))
            jdbc.execute(Files.readString(Path.of("../../sql/workflow",file)).replace("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin",""));
        jdbc.execute("create table sys_user(user_id bigint primary key,status char(1),del_flag char(1)); create table sys_role(role_id bigint primary key,status char(1),del_flag char(1)); create table sys_user_role(user_id bigint,role_id bigint)");
        jdbc.update("insert into sys_user values (2,'0','0')");jdbc.update("insert into sys_role values (2,'0','0')");jdbc.update("insert into sys_user_role values (2,2)");
        return jdbc;
    }
    private static WorkflowPackages.Edit example() throws Exception {
        return new WorkflowPackages.Edit("请假审批","leave",new WorkflowValidation.Request(
            Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml")),List.of(
                new WorkflowValidation.Scenario("批准",List.of(new WorkflowValidation.Decision("review",true)),"approvedEnd"),
                new WorkflowValidation.Scenario("拒绝",List.of(new WorkflowValidation.Decision("review",false)),"rejectedEnd"))));
    }
}
