package io.eforge.enterprise.workflow;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.flowable.engine.ProcessEngine;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.WorkflowUnitOfWork;
import static io.eforge.enterprise.workflow.api.WorkflowValidation.*;
import static org.assertj.core.api.Assertions.*;

class WorkflowScenarioValidationTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withUserConfiguration(WorkflowEngineConfigurationTest.Database.class, WorkflowEngineConfiguration.class)
        .withPropertyValues("flowable.process.enabled=true", "flowable.idm.enabled=false", "flowable.eventregistry.enabled=false",
            "flowable.check-process-definitions=false", "flowable.async-executor-activate=false", "flowable.database-schema-update=true");
    private String xml() throws Exception { return Files.readString(Path.of("../../workflows/leave-approval/process.bpmn20.xml")); }
    private Scenario scenario(boolean approved) { return new Scenario(approved ? "approved" : "rejected", List.of(new Decision("review", approved)), approved ? "approvedEnd" : "rejectedEnd"); }
    @Test void boundedAsyncCreationIsActuallyExecutedInsideRolledBackScenarios() throws Exception {
        String async=xml().replace("<userTask id=\"review\"","<userTask flowable:async=\"true\" id=\"review\"");
        runner.run(context->{
            var engine=context.getBean(ProcessEngine.class);
            var result=new WorkflowScenarioValidation(engine,context.getBean(WorkflowUnitOfWork.class)).validate(new Request(async,List.of(scenario(true),scenario(false))));
            assertThat(result.scenarios()).hasSize(2);assertEmpty(engine);
            assertThat(engine.getManagementService().createJobQuery().count()).isZero();
            assertThat(engine.getManagementService().createDeadLetterJobQuery().count()).isZero();
        });
    }

    @Test void actualScenariosReturnImmutableProofAndLeaveNoDeploymentRuntimeOrHistory() throws Exception {
        String xml = xml();
        runner.run(context -> {
            var engine = context.getBean(ProcessEngine.class);
            var validator = new WorkflowScenarioValidation(engine, context.getBean(WorkflowUnitOfWork.class));
            var result = validator.validate(new Request(xml, List.of(scenario(true), scenario(false))));
            assertThat(result.processKey()).isEqualTo("leaveApproval");
            assertThat(result.sha256()).isEqualTo(WorkflowBpmnPolicy.validate(xml).sha256());
            assertThat(result.scenarios()).extracting(ScenarioResult::endActivity).containsExactly("approvedEnd", "rejectedEnd");
            assertThat(result.scenarios().get(0).completedTasks()).containsExactly("review");
            assertThatThrownBy(() -> result.scenarios().clear()).isInstanceOf(UnsupportedOperationException.class);
            assertEmpty(engine);
            // A repeat validation must not reuse an uncommitted deployment from the engine cache.
            assertThat(validator.validate(new Request(xml, List.of(scenario(false)))).scenarios()).hasSize(1);
            assertEmpty(engine);
        });
    }

    @Test void wrongTaskOrOutcomeAndUnsafeSourceCannotLeaveEngineState() throws Exception {
        String xml = xml();
        runner.run(context -> {
            var engine = context.getBean(ProcessEngine.class);
            var validator = new WorkflowScenarioValidation(engine, context.getBean(WorkflowUnitOfWork.class));
            for (var scenario : List.of(new Scenario("wrong-task", List.of(new Decision("other", true)), "approvedEnd"),
                    new Scenario("wrong-end", List.of(new Decision("review", false)), "approvedEnd"),
                    new Scenario("incomplete", List.of(), "approvedEnd"))) {
                assertThatThrownBy(() -> validator.validate(new Request(xml, List.of(scenario))))
                    .isInstanceOfSatisfying(ApiFailure.class, failure -> assertThat(failure.status()).isEqualTo(400));
                assertEmpty(engine);
            }
            assertThatThrownBy(() -> validator.validate(new Request(xml.replace("userTask", "scriptTask"), List.of(scenario(true)))))
                .isInstanceOf(ApiFailure.class);
            assertEmpty(engine);
        });
    }

    @Test void validationPreservesPublishedCacheAndRejectsNestingWithoutPoisoningCaller() throws Exception {
        String xml = xml();
        runner.run(context -> {
            var engine = context.getBean(ProcessEngine.class);
            var transaction = context.getBean(WorkflowUnitOfWork.class);
            var validator = new WorkflowScenarioValidation(engine, transaction);
            var published = engine.getRepositoryService().createDeployment().addString("published.bpmn20.xml", xml).deploy();
            var definition = engine.getRepositoryService().createProcessDefinitionQuery().deploymentId(published.getId()).singleResult();
            var configuration = (org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl) engine.getProcessEngineConfiguration();
            var original = configuration.getProcessDefinitionCache().get(definition.getId());
            for (int i = 0; i < 4; i++) {
                validator.validate(new Request(xml, List.of(scenario(true), scenario(false))));
                assertThat(configuration.getProcessDefinitionCache().size()).isEqualTo(1);
                assertThat(configuration.getProcessDefinitionCache().get(definition.getId())).isSameAs(original);
            }
            String processId = transaction.execute(() -> {
                assertThatThrownBy(() -> validator.validate(new Request(xml, List.of(scenario(true)))))
                    .isInstanceOfSatisfying(ApiFailure.class, failure -> assertThat(failure.code()).isEqualTo("WORKFLOW_VALIDATION_TRANSACTION"));
                return engine.getRuntimeService().startProcessInstanceById(definition.getId()).getId();
            });
            assertThat(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(processId).count()).isEqualTo(1);
            var task = engine.getTaskService().createTaskQuery().processInstanceId(processId).singleResult();
            engine.getTaskService().complete(task.getId(), java.util.Map.of("approved", true));
            assertThat(engine.getHistoryService().createHistoricProcessInstanceQuery().processInstanceId(processId).finished().count()).isEqualTo(1);
        });
    }

    @Test void actualSqlFailureIsUnavailableAndRecoversWithoutResidualValidationState() throws Exception {
        String xml = xml();
        runner.run(context -> {
            var engine = context.getBean(ProcessEngine.class);
            var validator = new WorkflowScenarioValidation(engine, context.getBean(WorkflowUnitOfWork.class));
            var jdbc = new org.springframework.jdbc.core.JdbcTemplate(context.getBean(javax.sql.DataSource.class));
            jdbc.execute("alter table ACT_RU_TASK rename to VALIDATION_FAULT_TASK");
            try {
                assertThatThrownBy(() -> validator.validate(new Request(xml, List.of(scenario(true)))))
                    .isInstanceOfSatisfying(ApiFailure.class, failure -> {
                        assertThat(failure.status()).isEqualTo(503);
                        assertThat(failure.getMessage()).doesNotContain("ACT_", "SELECT", "VALIDATION_FAULT_TASK");
                    });
            } finally { jdbc.execute("alter table VALIDATION_FAULT_TASK rename to ACT_RU_TASK"); }
            assertEmpty(engine);
            assertThat(validator.validate(new Request(xml, List.of(scenario(true)))).scenarios()).hasSize(1);
            assertEmpty(engine);
        });
    }

    private static void assertEmpty(ProcessEngine engine) {
        var config = (org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl) engine.getProcessEngineConfiguration();
        assertThat(config.getProcessDefinitionCache().size()).isZero();
        assertThat(engine.getRepositoryService().createDeploymentQuery().count()).isZero();
        assertThat(engine.getRepositoryService().createProcessDefinitionQuery().count()).isZero();
        assertThat(engine.getRuntimeService().createProcessInstanceQuery().count()).isZero();
        assertThat(engine.getHistoryService().createHistoricProcessInstanceQuery().count()).isZero();
        assertThat(engine.getHistoryService().createHistoricTaskInstanceQuery().count()).isZero();
    }
}
