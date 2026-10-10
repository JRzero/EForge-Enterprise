package io.eforge.enterprise.workflow;

import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.flowable.engine.ProcessEngine;
import org.flowable.bpmn.model.UserTask;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;

/** The leave sample owns its business state; only this adapter invokes engine task mutations. */
public final class WorkflowLeaveService implements WorkflowLeaves {
    private final JdbcTemplate jdbc;
    private final WorkflowUnitOfWork transaction;
    private final ProcessEngine engine;
    private final WorkflowTaskCandidates candidates;
    public WorkflowLeaveService(DataSource source,WorkflowUnitOfWork transaction,ProcessEngine engine){
        this.jdbc=new JdbcTemplate(source);this.transaction=transaction;this.engine=engine;this.candidates=new WorkflowTaskCandidates(source);
    }
    @Override public Leave submit(Submit request,String actor){
        if(request==null)throw invalid();identity(request.submissionId());
        if(request.startDate()==null||request.endDate()==null||request.endDate().isBefore(request.startDate())||
            request.startDate().getYear()<1970||request.endDate().getYear()>9999||request.reason()==null||request.reason().isBlank()||request.reason().length()>1000)throw invalid();
        return database(()->{
            // The unique submission key serializes retries without blocking unrelated requests.
            jdbc.update("insert into ef_workflow_leave (id,submission_id,initiator_id,start_date,end_date,reason,state,revision,created_at) values (?,?,?,?,?,?,'PENDING',1,?) on duplicate key update submission_id=submission_id",
                UUID.randomUUID().toString(),request.submissionId(),actor,request.startDate(),request.endDate(),request.reason(),Timestamp.from(Instant.now()));
            var id=jdbc.queryForObject("select id from ef_workflow_leave where initiator_id=? and submission_id=? for update",String.class,actor,request.submissionId());
            activeActor(actor);var row=read(id);
            if(!row.startDate().equals(request.startDate())||!row.endDate().equals(request.endDate())||!row.reason().equals(request.reason()))throw conflict();
            if(row.processId()!=null)return row;
            var selected=jdbc.queryForList("select release_id from ef_workflow_activation where business_type='leave'");
            if(selected.isEmpty()||selected.get(0).get("release_id")==null)throw new ApiFailure(409,"WORKFLOW_NOT_ACTIVATED","请先激活可用的请假审批流程。");
            String release=selected.get(0).get("release_id").toString();
            String definition=jdbc.queryForObject("select definition_id from ef_workflow_release where id=? and business_type='leave'",String.class,release);
            requireLeaveBinding(engine,definition);
            WorkflowAsyncStart.requireEnabled(engine,definition);
            var asyncTask=WorkflowAsyncStart.initialTask(engine,definition);
            if(asyncTask!=null)candidates.requireAvailable(asyncTask);
            var process=engine.getRuntimeService().startProcessInstanceById(definition,"leave:"+id,Map.of("businessType","leave","businessId",id,"submissionId",request.submissionId(),"initiator",actor));
            if(asyncTask==null)requireAvailableTasks(process.getId());
            else if(engine.getManagementService().createJobQuery().processInstanceId(process.getId()).count()!=1)throw binding();
            jdbc.update("update ef_workflow_leave set release_id=?,process_id=? where id=?",release,process.getId(),id);
            audit(id,new Command(request.submissionId(),1,null,""),"SUBMIT",actor,digest(request.reason(),request.startDate().toString(),request.endDate().toString()));
            return read(id);
        });
    }
    @Override public Detail get(String id,String actor){identity(id);return database(()->{
        activeActor(actor);var row=read(id);var tasks=engineTasks(row.processId());
        boolean participant=jdbc.queryForObject("select count(*) from ef_workflow_leave_audit where leave_id=? and actor_id=?",Long.class,id,actor)>0;
        if(!row.initiatorId().equals(actor)&&!participant&&tasks.stream().noneMatch(task->eligible(task,actor)))throw missing();
        return new Detail(row,tasks.stream().map(task->new Task(task.getId(),task.getTaskDefinitionKey(),task.getName(),task.getAssignee(),eligible(task,actor))).toList(),
            jdbc.query("select * from ef_workflow_leave_audit where leave_id=? order by event_order,id",(rs,n)->new Event(rs.getString("action"),rs.getString("actor_id"),rs.getString("task_id"),rs.getString("comment"),rs.getTimestamp("created_at").toInstant()),id));
    });}
    @Override public Page<Leave> mine(String actor,int page,int size){return entries(actor,page,size,false);}
    @Override public Page<Leave> handled(String actor,int page,int size){return entries(actor,page,size,true);}
    private Page<Leave> entries(String actor,int page,int size,boolean handled){
        paging(page,size);return database(()->{activeActor(actor);
            String where=handled?"exists (select 1 from ef_workflow_leave_audit a where a.leave_id=l.id and a.actor_id=? and a.action in ('APPROVE','REJECT'))":"l.initiator_id=?";
            long total=jdbc.queryForObject("select count(*) from ef_workflow_leave l where "+where,Long.class,actor);
            var ids=jdbc.queryForList("select l.id from ef_workflow_leave l where "+where+" order by l.created_at desc,l.id desc limit ? offset ?",String.class,actor,size,(page-1)*size);
            return new Page<>(ids.stream().map(this::read).toList(),total);
        });
    }
    @Override public Page<Pending> pending(String actor,int page,int size){
        paging(page,size);return database(()->{
            activeActor(actor);var groups=jdbc.queryForList("select r.role_id from sys_role r join sys_user_role ur on ur.role_id=r.role_id where ur.user_id=? and r.status='0' and r.del_flag='0'",String.class,actor).stream().map(role->"role:"+role).toList();
            var query=engine.getTaskService().createTaskQuery().active().processVariableValueEquals("businessType","leave")
                .taskCandidateOrAssigned(actor).taskCandidateGroupIn(groups.isEmpty()?List.of("role:unavailable"):groups);
            long total=query.count();var tasks=query.orderByTaskCreateTime().desc().orderByTaskId().desc().listPage((page-1)*size,size);
            return new Page<>(tasks.stream().map(task->{
                String id=jdbc.queryForObject("select id from ef_workflow_leave where process_id=?",String.class,task.getProcessInstanceId());
                boolean canHandle=eligible(task,actor);
                return new Pending(read(id),new Task(task.getId(),task.getTaskDefinitionKey(),task.getName(),task.getAssignee(),canHandle),canHandle);
            }).toList(),total);
        });
    }
    @Override public Leave claim(String id,Command command,String actor){return mutate(id,command,"CLAIM",actor);}
    @Override public Leave decide(String id,Command command,boolean approved,String actor){return mutate(id,command,approved?"APPROVE":"REJECT",actor);}
    @Override public Leave withdraw(String id,Command command,String actor){return mutate(id,command,"WITHDRAW",actor);}
    private Leave mutate(String id,Command command,String action,String actor){
        identity(id);if(command==null)throw invalid();identity(command.commandId());
        if(command.expectedRevision()<1||command.expectedRevision()==Long.MAX_VALUE||command.comment()==null||command.comment().length()>500)throw invalid();
        if(!action.equals("WITHDRAW")&&(command.taskId()==null||!command.taskId().matches("[A-Za-z0-9_-]{1,64}")))throw invalid();
        if(action.equals("WITHDRAW")&&command.taskId()!=null)throw invalid();
        String hash=digest(action,Long.toString(command.expectedRevision()),Objects.toString(command.taskId(),""),command.comment());
        return database(()->{
            var found=jdbc.queryForList("select id from ef_workflow_leave where id=? for update",String.class,id);if(found.isEmpty())throw missing();
            activeActor(actor);var row=read(id);
            var previous=jdbc.queryForList("select command_digest from ef_workflow_leave_audit where leave_id=? and actor_id=? and command_id=?",String.class,id,actor,command.commandId());
            if(!previous.isEmpty()){if(!previous.get(0).equals(hash))throw conflict();return row;}
            if(!row.status().equals("PENDING")||row.revision()!=command.expectedRevision())throw conflict();
            String state="PENDING";
            if(action.equals("WITHDRAW")){
                if(!row.initiatorId().equals(actor))throw denied();
                engine.getRuntimeService().deleteProcessInstance(row.processId(),"Initiator withdrew leave request");state="WITHDRAWN";
            }else{
                var task=engine.getTaskService().createTaskQuery().taskId(command.taskId()).processInstanceId(row.processId()).singleResult();
                if(task==null)throw conflict();if(!eligible(task,actor))throw denied();
                if(action.equals("CLAIM"))engine.getTaskService().claim(task.getId(),actor);
                else{
                    if(!actor.equals(task.getAssignee()))throw new ApiFailure(409,"WORKFLOW_CLAIM_REQUIRED","请先领取当前审批任务。");
                    engine.getTaskService().complete(task.getId(),Map.of("approved",action.equals("APPROVE")));
                    if(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(row.processId()).count()==0){
                        var ends=engine.getHistoryService().createHistoricActivityInstanceQuery().processInstanceId(row.processId()).activityType("endEvent").finished().list();
                        if(ends.size()!=1)throw binding();
                        state=switch(ends.get(0).getActivityId()){case "approvedEnd"->"APPROVED";case "rejectedEnd"->"REJECTED";default->throw binding();};
                    }else requireAvailableTasks(row.processId());
                }
            }
            if(jdbc.update("update ef_workflow_leave set state=?,revision=revision+1 where id=? and revision=?",state,id,command.expectedRevision())!=1)throw conflict();
            audit(id,command,action,actor,hash);return read(id);
        });
    }
    private List<org.flowable.task.api.Task> engineTasks(String process){return engine.getTaskService().createTaskQuery().processInstanceId(process).orderByTaskCreateTime().asc().orderByTaskId().asc().list();}
    private boolean eligible(org.flowable.task.api.Task task,String actor){
        if(task.getAssignee()!=null&&!task.getAssignee().equals(actor))return false;
        var model=engine.getRepositoryService().getBpmnModel(task.getProcessDefinitionId());
        if(!(model.getFlowElement(task.getTaskDefinitionKey()) instanceof UserTask binding))return false;
        if(actor.equals(binding.getAssignee())||binding.getCandidateUsers().contains(actor))return true;
        var groups=jdbc.queryForList("select r.role_id from sys_role r join sys_user_role ur on ur.role_id=r.role_id where ur.user_id=? and r.status='0' and r.del_flag='0'",String.class,actor);
        return groups.stream().anyMatch(role->binding.getCandidateGroups().contains("role:"+role));
    }
    private void requireAvailableTasks(String process){
        var tasks=engineTasks(process);if(tasks.isEmpty())throw binding();
        for(var task:tasks){
            var binding=(UserTask)engine.getRepositoryService().getBpmnModel(task.getProcessDefinitionId()).getFlowElement(task.getTaskDefinitionKey());
            candidates.requireAvailable(binding);
        }
    }
    static void requireLeaveBinding(ProcessEngine engine,String definition){
        var model=engine.getRepositoryService().getBpmnModel(definition);
        var ends=model.getMainProcess().findFlowElementsOfType(org.flowable.bpmn.model.EndEvent.class).stream().map(org.flowable.bpmn.model.EndEvent::getId).collect(java.util.stream.Collectors.toSet());
        if(!ends.equals(Set.of("approvedEnd","rejectedEnd")))throw binding();
    }
    private void activeActor(String actor){
        if(actor==null||!actor.matches("[1-9][0-9]{0,18}"))throw invalid();
        if(jdbc.queryForObject("select count(*) from sys_user where user_id=? and status='0' and del_flag='0'",Long.class,actor)!=1)throw denied();
    }
    private Leave read(String id){
        var rows=jdbc.query("select * from ef_workflow_leave where id=?",(rs,n)->new Leave(rs.getString("id"),rs.getString("submission_id"),rs.getString("initiator_id"),rs.getString("release_id"),rs.getString("process_id"),rs.getDate("start_date").toLocalDate(),rs.getDate("end_date").toLocalDate(),rs.getString("reason"),rs.getString("state"),rs.getLong("revision"),rs.getTimestamp("created_at").toInstant()),id);
        if(rows.isEmpty())throw missing();return rows.get(0);
    }
    private void audit(String id,Command command,String action,String actor,String hash){
        jdbc.update("insert into ef_workflow_leave_audit (id,leave_id,command_id,action,actor_id,task_id,command_digest,comment,event_order,created_at) values (?,?,?,?,?,?,?,?,?,?)",UUID.randomUUID().toString(),id,command.commandId(),action,actor,command.taskId(),hash,command.comment(),action.equals("SUBMIT")?1:command.expectedRevision()+1,Timestamp.from(Instant.now()));
    }
    private static String digest(String...values){try{
        var digest=java.security.MessageDigest.getInstance("SHA-256");for(String value:values){byte[] bytes=value.getBytes(java.nio.charset.StandardCharsets.UTF_8);digest.update(java.nio.ByteBuffer.allocate(4).putInt(bytes.length).array());digest.update(bytes);}return HexFormat.of().formatHex(digest.digest());
    }catch(java.security.NoSuchAlgorithmException failure){throw new IllegalStateException(failure);}}
    private <T>T database(java.util.function.Supplier<T> work){try{return transaction.execute(work);}catch(RuntimeException failure){
        if(failure instanceof ApiFailure)throw failure;
        for(Throwable cause=failure;cause!=null;cause=cause.getCause()){if(cause instanceof DataAccessException||cause instanceof java.sql.SQLException)throw new ApiFailure(503,"WORKFLOW_STORAGE_UNAVAILABLE","工作流存储暂不可用。");if(cause==cause.getCause())break;}
        throw new ApiFailure(409,"WORKFLOW_ACTION_FAILED","审批操作未完成，请重新读取后重试。");
    }}
    private static void identity(String id){if(id==null||!id.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw invalid();}
    private static void paging(int page,int size){if(page<1||page>1000000||size<1||size>100)throw invalid();}
    private static ApiFailure invalid(){return new ApiFailure(400,"WORKFLOW_LEAVE_INVALID","请假审批参数无效。");}
    private static ApiFailure conflict(){return new ApiFailure(409,"WORKFLOW_LEAVE_CONFLICT","审批状态或命令内容已变化，请重新读取。");}
    private static ApiFailure missing(){return new ApiFailure(404,"WORKFLOW_LEAVE_NOT_FOUND","请假申请不存在或不可访问。");}
    private static ApiFailure denied(){return new ApiFailure(403,"WORKFLOW_TASK_FORBIDDEN","当前账号无权处理此审批任务。");}
    private static ApiFailure binding(){return new ApiFailure(409,"WORKFLOW_LEAVE_BINDING","流程未满足请假审批结果绑定。");}
}
