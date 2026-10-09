package io.eforge.enterprise.workflow;

import org.flowable.engine.ProcessEngine;
import java.util.*;
import org.springframework.dao.DataAccessException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.WorkflowValidation;
import io.eforge.enterprise.workflow.api.WorkflowUnitOfWork;

/** Runs constrained scenarios on the configured engine in an always-rolled-back transaction. */
public final class WorkflowScenarioValidation implements WorkflowValidation {
    private final ProcessEngine engine;
    private final WorkflowUnitOfWork transaction;
    public WorkflowScenarioValidation(ProcessEngine engine, WorkflowUnitOfWork transaction) {
        this.engine = engine; this.transaction = transaction;
    }
    @Override public Result validate(Request request) {
        if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive())
            throw new ApiFailure(409, "WORKFLOW_VALIDATION_TRANSACTION", "请在发布事务之前独立执行场景校验。");
        if (request == null || request.scenarios() == null || request.scenarios().isEmpty() || request.scenarios().size() > 20) throw invalid();
        var checked = WorkflowBpmnPolicy.validate(request.bpmnXml());
        var scenarios = new ArrayList<Scenario>();
        var names = new HashSet<String>();
        for (var scenario : request.scenarios()) {
            if (scenario == null || scenario.name() == null || scenario.name().isBlank() || scenario.name().length() > 64
                || !names.add(scenario.name()) || !identifier(scenario.expectedEnd()) || scenario.decisions() == null
                || scenario.decisions().isEmpty() || scenario.decisions().size() > 100) throw invalid();
            for (var decision : scenario.decisions()) if (decision == null || !identifier(decision.taskKey())) throw invalid();
            scenarios.add(new Scenario(scenario.name(), List.copyOf(scenario.decisions()), scenario.expectedEnd()));
        }
        String resourceName = "validation-" + UUID.randomUUID() + ".bpmn20.xml";
        try {
            return transaction.execute(() -> {
                var deployment = engine.getRepositoryService().createDeployment().name("validation")
                    .addString(resourceName, checked.xml()).deploy();
                var definition = engine.getRepositoryService().createProcessDefinitionQuery().deploymentId(deployment.getId()).singleResult();
                var results = new ArrayList<ScenarioResult>();
                for (var scenario : scenarios) {
                    var process = engine.getRuntimeService().startProcessInstanceById(definition.getId(), Map.of("approver", "validation"));
                    var completed = new ArrayList<String>();
                    for (var decision : scenario.decisions()) {
                        var tasks = engine.getTaskService().createTaskQuery().processInstanceId(process.getId()).list();
                        if (tasks.size() != 1 || !decision.taskKey().equals(tasks.get(0).getTaskDefinitionKey())) throw invalid();
                        engine.getTaskService().complete(tasks.get(0).getId(), Map.of("approved", decision.approved()));
                        completed.add(decision.taskKey());
                    }
                    if (engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(process.getId()).count() != 0) throw invalid();
                    var ends = engine.getHistoryService().createHistoricActivityInstanceQuery().processInstanceId(process.getId())
                        .activityType("endEvent").finished().list();
                    if (ends.size() != 1 || !scenario.expectedEnd().equals(ends.get(0).getActivityId())) throw invalid();
                    results.add(new ScenarioResult(scenario.name(), completed, ends.get(0).getActivityId()));
                }
                // An exception forces rollback even for successful validation. Nothing is published.
                throw new ValidatedRollback(new Result(checked.key(), checked.sha256(), results));
            });
        } catch (ValidatedRollback success) { return success.result; }
        catch (ApiFailure failure) { throw failure; }
        catch (RuntimeException failure) {
            for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
                if (cause instanceof DataAccessException || cause instanceof java.sql.SQLException)
                    throw new ApiFailure(503, "WORKFLOW_STORAGE_UNAVAILABLE", "工作流存储暂不可用。");
                if (cause == cause.getCause()) break;
            }
            throw invalid();
        }
        finally {
            // Flowable 7.2.0 populates its definition cache before transaction commit. Rollback does
            // not evict it. Match our unguessable resource even if deployment itself threw after caching.
            // This version-pinned adapter never clears the shared cache or other definitions.
            var configuration = (org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl) engine.getProcessEngineConfiguration();
            for (var entry : List.copyOf(configuration.getProcessDefinitionCache().getAll())) {
                var definition = entry.getProcessDefinition();
                if (resourceName.equals(definition.getResourceName())) {
                    configuration.getProcessDefinitionCache().remove(definition.getId());
                    configuration.getProcessDefinitionInfoCache().remove(definition.getId());
                }
            }
        }
    }
    private static boolean identifier(String value) { return value != null && value.matches("[A-Za-z][A-Za-z0-9_]{0,63}"); }
    private static ApiFailure invalid() { return new ApiFailure(400, "WORKFLOW_SCENARIO_FAILED", "审批场景未通过，请核对任务及预期结果。"); }
    private static final class ValidatedRollback extends RuntimeException {
        private final Result result;
        private ValidatedRollback(Result result) { super(null, null, false, false); this.result = result; }
    }
}
