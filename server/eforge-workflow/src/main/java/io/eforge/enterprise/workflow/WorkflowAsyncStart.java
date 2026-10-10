package io.eforge.enterprise.workflow;

import javax.sql.DataSource;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl;
import org.flowable.bpmn.model.UserTask;
import org.flowable.task.api.Task;
import org.flowable.common.engine.api.delegate.event.*;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Framework-owned listener only; workflow XML cannot supply listeners or executable code. */
final class WorkflowAsyncStart implements FlowableEventListener {
    private final ProcessEngineConfigurationImpl configuration;
    private final JdbcTemplate jdbc;
    private final WorkflowTaskCandidates candidates;
    WorkflowAsyncStart(ProcessEngineConfigurationImpl configuration,DataSource source){
        this.configuration=configuration;jdbc=new JdbcTemplate(source);candidates=new WorkflowTaskCandidates(source);
    }
    static UserTask initialTask(ProcessEngine engine,String definition){
        return engine.getRepositoryService().getBpmnModel(definition).getMainProcess().findFlowElementsOfType(UserTask.class)
            .stream().filter(UserTask::isAsynchronous).findFirst().orElse(null);
    }
    static void requireEnabled(ProcessEngine engine,String definition){
        if(initialTask(engine,definition)!=null&&!engine.getProcessEngineConfiguration().isAsyncExecutorActivate())
            throw new ApiFailure(409,"WORKFLOW_ASYNC_DISABLED","当前环境尚未启用异步任务创建。");
    }
    @Override public void onEvent(FlowableEvent event){
        if(event.getType()!=FlowableEngineEventType.TASK_CREATED||!(event instanceof FlowableEntityEvent entity)||!(entity.getEntity() instanceof Task task))return;
        var model=configuration.getRepositoryService().getBpmnModel(task.getProcessDefinitionId());
        if(!(model.getFlowElement(task.getTaskDefinitionKey()) instanceof UserTask binding)||!binding.isAsynchronous())return;
        var runtime=configuration.getRuntimeService();
        // Rollback-only scenario proofs have no business binding and never become visible to workers.
        if(!"leave".equals(runtime.getVariable(task.getProcessInstanceId(),"businessType")))return;
        Object id=runtime.getVariable(task.getProcessInstanceId(),"businessId");
        if(!(id instanceof String leaveId))throw unavailable();
        var rows=jdbc.queryForList("select l.id from ef_workflow_leave l join ef_workflow_release r on r.id=l.release_id where l.id=? and l.process_id=? and r.definition_id=? and l.state='PENDING' for update",String.class,leaveId,task.getProcessInstanceId(),task.getProcessDefinitionId());
        if(rows.size()!=1)throw unavailable();
        candidates.requireCurrent(binding);
    }
    private static ApiFailure unavailable(){return new ApiFailure(409,"WORKFLOW_ASYNC_BINDING","申请状态不允许创建待办。");}
    @Override public boolean isFailOnException(){return true;}
    @Override public boolean isFireOnTransactionLifecycleEvent(){return false;}
    @Override public String getOnTransaction(){return null;}
}
