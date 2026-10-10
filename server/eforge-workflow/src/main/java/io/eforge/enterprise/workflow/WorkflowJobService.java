package io.eforge.enterprise.workflow;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.flowable.engine.ProcessEngine;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;

final class WorkflowJobService implements WorkflowJobs {
    private final JdbcTemplate jdbc;
    private final WorkflowUnitOfWork transaction;
    private final ProcessEngine engine;
    private final WorkflowTaskCandidates candidates;
    WorkflowJobService(DataSource source,WorkflowUnitOfWork transaction,ProcessEngine engine) {
        jdbc=new JdbcTemplate(source);this.transaction=transaction;this.engine=engine;candidates=new WorkflowTaskCandidates(source);
    }
    public Page failed(String releaseId,int page,int size){
        uuid(releaseId);if(page<1||page>1000000||size<1||size>100)throw invalid();
        return database(()->{
            var definitions=jdbc.queryForList("select definition_id from ef_workflow_release where id=?",String.class,releaseId);
            if(definitions.isEmpty())throw new ApiFailure(404,"WORKFLOW_RELEASE_NOT_FOUND","发布记录不存在。");
            var query=engine.getManagementService().createDeadLetterJobQuery().processDefinitionId(definitions.get(0));
            long total=query.count();var rows=query.orderByJobCreateTime().desc().orderByJobId().desc().listPage((page-1)*size,size);
            return new Page(rows.stream().map(job->{
                var leaves=jdbc.queryForList("select id from ef_workflow_leave where process_id=? and release_id=?",String.class,job.getProcessInstanceId(),releaseId);
                return new Failed(job.getId(),job.getProcessInstanceId(),releaseId,leaves.size()==1?leaves.get(0):null,job.getElementId(),job.getRetries(),job.getCreateTime().toInstant());
            }).toList(),total,engine.getProcessEngineConfiguration().isAsyncExecutorActivate());
        });
    }
    public Queued retry(String jobId,Retry command,String actor){
        if(jobId==null||!jobId.matches("[A-Za-z0-9_-]{1,64}")||command==null||actor==null||!actor.matches("[1-9][0-9]{0,18}"))throw invalid();
        uuid(command.commandId());uuid(command.leaveId());
        return database(()->{
            // Same business lock order as claim/withdraw; current authority is checked after waiting.
            var rows=jdbc.queryForList("select id from ef_workflow_leave where id=? for update",String.class,command.leaveId());
            if(rows.isEmpty())throw conflict();
            requireOperator(actor);
            var prior=jdbc.query("select * from ef_workflow_job_audit where actor_id=? and command_id=?",(rs,n)->{
                if(!command.leaveId().equals(rs.getString("leave_id"))||!jobId.equals(rs.getString("original_job_id")))throw conflict();
                return new Queued(command.commandId(),jobId,rs.getString("queued_job_id"),"QUEUED");
            },actor,command.commandId());
            if(!prior.isEmpty())return prior.get(0);
            var binding=jdbc.queryForList("select l.process_id,r.definition_id from ef_workflow_leave l join ef_workflow_release r on r.id=l.release_id where l.id=? and l.state='PENDING' and r.business_type='leave'",command.leaveId());
            if(binding.size()!=1)throw conflict();
            String process=(String)binding.get(0).get("process_id"),definition=(String)binding.get(0).get("definition_id");
            WorkflowAsyncStart.requireEnabled(engine,definition);
            var task=WorkflowAsyncStart.initialTask(engine,definition);if(task==null)throw conflict();
            if(engine.getRepositoryService().createProcessDefinitionQuery().processDefinitionId(definition).active().count()!=1)throw conflict();
            if(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(process).processDefinitionId(definition).active().count()!=1)throw conflict();
            var job=engine.getManagementService().createDeadLetterJobQuery().jobId(jobId).processInstanceId(process).processDefinitionId(definition).singleResult();
            if(job==null||!task.getId().equals(job.getElementId()))throw conflict();
            candidates.requireCurrent(task);
            // Queue only: never executeJob, which would bypass Flowable suspension checks.
            var queued=engine.getManagementService().moveDeadLetterJobToExecutableJob(jobId,3);
            jdbc.update("insert into ef_workflow_job_audit (id,leave_id,actor_id,command_id,original_job_id,queued_job_id,created_at) values (?,?,?,?,?,?,?)",
                UUID.randomUUID().toString(),command.leaveId(),actor,command.commandId(),jobId,queued.getId(),Timestamp.from(Instant.now()));
            return new Queued(command.commandId(),jobId,queued.getId(),"QUEUED");
        });
    }
    private void requireOperator(String actor){
        if(jdbc.queryForList("select user_id from sys_user where user_id=? and status='0' and del_flag='0' for update",String.class,actor).isEmpty())throw denied();
        if(actor.equals("1"))return;
        var grants=jdbc.queryForList("select m.menu_id from sys_user_role ur join sys_role r on r.role_id=ur.role_id join sys_role_menu rm on rm.role_id=r.role_id join sys_menu m on m.menu_id=rm.menu_id where ur.user_id=? and r.status='0' and r.del_flag='0' and m.status='0' and m.perms in ('workflow:operation:retry','*:*:*') limit 1 for update",String.class,actor);
        if(grants.isEmpty())throw denied();
    }
    private <T>T database(java.util.function.Supplier<T> work){try{return transaction.execute(work);}catch(RuntimeException failure){
        if(failure instanceof ApiFailure)throw failure;
        for(Throwable cause=failure;cause!=null;cause=cause.getCause()){
            if(cause instanceof DataAccessException||cause instanceof java.sql.SQLException)throw new ApiFailure(503,"WORKFLOW_STORAGE_UNAVAILABLE","工作流存储暂不可用。");
            if(cause==cause.getCause())break;
        }
        throw conflict();
    }}
    private static void uuid(String id){if(id==null||!id.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw invalid();}
    private static ApiFailure invalid(){return new ApiFailure(400,"WORKFLOW_JOB_INVALID","作业恢复参数无效。");}
    private static ApiFailure conflict(){return new ApiFailure(409,"WORKFLOW_JOB_CONFLICT","作业或申请状态已变化，请重新读取。");}
    private static ApiFailure denied(){return new ApiFailure(403,"WORKFLOW_JOB_FORBIDDEN","当前账号无权恢复工作流作业。");}
}
