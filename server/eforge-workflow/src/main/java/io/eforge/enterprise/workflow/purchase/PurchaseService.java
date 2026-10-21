package io.eforge.enterprise.workflow.purchase;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flowable.engine.ProcessEngine;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.WorkflowPurchases;
import io.eforge.enterprise.workflow.api.WorkflowUnitOfWork;

/** Sample-owned state and admission rules; business, engine and audit share one transaction. */
public final class PurchaseService implements WorkflowPurchases {
    private final JdbcTemplate jdbc;
    private final WorkflowUnitOfWork transaction;
    private final ProcessEngine engine;
    private final ObjectMapper json = new ObjectMapper();
    public PurchaseService(DataSource source, WorkflowUnitOfWork transaction, ProcessEngine engine) {
        this.jdbc=new JdbcTemplate(source); this.transaction=transaction; this.engine=engine;
    }
    private record Content(String title, String reason, String approver, PurchaseAmounts.Calculation amounts) { }
    @Override public List<Attachment> attachments(String id,String actor){identity(id);return database(()->{
        active(actor);visible(read(id),actor);
        return jdbc.query("select attachment_id,name,byte_size from ef_purchase_attachment where purchase_id=? order by attachment_id",(rs,n)->new Attachment(rs.getString("attachment_id"),rs.getString("name"),rs.getLong("byte_size")),id);
    });}
    @Override public Download download(String id,String attachmentId,String actor){identity(id);identity(attachmentId);return database(()->{
        active(actor);visible(read(id),actor);
        var rows=jdbc.query("select * from ef_purchase_attachment where purchase_id=? and attachment_id=?",(rs,n)->new Download(new Attachment(rs.getString("attachment_id"),rs.getString("name"),rs.getLong("byte_size")),rs.getBytes("content")),id,attachmentId);
        if(rows.isEmpty())throw missing();return rows.get(0);
    });}
    @Override public Purchase upload(String id,Command command,String name,byte[] content,String actor){
        identity(id);validate(command);byte[] bytes=PurchaseAttachmentContent.validate(name,content);
        String hash=digest(List.of("ATTACH",command,name,bytes));
        return database(()->{
            var row=locked(id,actor);if(!row.initiatorId().equals(actor))throw missing();
            if(replayed(id,actor,command,hash))return row;expected(row,command,"DRAFT");
            if(jdbc.queryForObject("select count(*) from ef_purchase_attachment where purchase_id=?",Long.class,id)>=5)throw new ApiFailure(409,"PURCHASE_ATTACHMENT_LIMIT","每张申请最多5个附件。");
            jdbc.update("insert into ef_purchase_attachment (purchase_id,attachment_id,name,byte_size,content) values (?,?,?,?,?)",id,command.commandId(),name,bytes.length,bytes);
            jdbc.update("update ef_purchase set revision=revision+1 where id=?",id);
            audit(id,actor,command,"ATTACH",hash,row.revision()+1);return read(id);
        });
    }
    @Override public Purchase removeAttachment(String id,String attachmentId,Command command,String actor){
        identity(id);identity(attachmentId);validate(command);String hash=digest(List.of("REMOVE_ATTACHMENT",command,attachmentId));
        return database(()->{
            var row=locked(id,actor);if(!row.initiatorId().equals(actor))throw missing();
            if(replayed(id,actor,command,hash))return row;expected(row,command,"DRAFT");
            if(jdbc.update("delete from ef_purchase_attachment where purchase_id=? and attachment_id=?",id,attachmentId)!=1)throw missing();
            jdbc.update("update ef_purchase set revision=revision+1 where id=?",id);
            audit(id,actor,command,"REMOVE_ATTACHMENT",hash,row.revision()+1);return read(id);
        });
    }
    @Override public Page<Approver> approvers(String query,int page,int size,String actor){
        if(query==null||query.length()>50||page<1||page>1000000||size<1||size>100)throw invalid();
        return database(()->{
            active(actor);
            String where="u.status='0' and u.del_flag='0' and u.user_id<>? and (u.user_id=1 or exists (select 1 from sys_user_role ur join sys_role r on r.role_id=ur.role_id join sys_role_menu rm on rm.role_id=r.role_id join sys_menu m on m.menu_id=rm.menu_id where ur.user_id=u.user_id and r.status='0' and r.del_flag='0' and m.status='0' and m.perms='sample:purchase:approve')) and (u.user_name like ? escape '!' or u.nick_name like ? escape '!')";
            String pattern="%"+query.replace("!","!!").replace("%","!%").replace("_","!_")+"%";
            long count=jdbc.queryForObject("select count(*) from sys_user u where "+where,Long.class,actor,pattern,pattern);
            var values=jdbc.query("select u.user_id,u.nick_name from sys_user u where "+where+" order by u.user_id limit ? offset ?",(rs,n)->new Approver(rs.getString("user_id"),rs.getString("nick_name")),actor,pattern,pattern,size,(page-1)*size);
            return new Page<>(values,count);
        });
    }
    @Override public Purchase create(String commandId, Edit edit, String actor) {
        identity(commandId); var content=normalize(edit,actor); String hash=digest(content);
        return database(()->{
            // Serialize the creation key before any consistent read establishes an InnoDB snapshot.
            // Identity rejection below still rolls back this uncommitted insert.
            jdbc.update("insert into ef_purchase (id,creation_command,creation_digest,initiator_id,approver_id,title,reason,total,state,revision,created_at) values (?,?,?,?,?,?,?,?,'DRAFT',1,?) on duplicate key update creation_command=creation_command",
                UUID.randomUUID().toString(),commandId,hash,actor,content.approver(),content.title(),content.reason(),content.amounts().total(),Timestamp.from(Instant.now()));
            String id=jdbc.queryForObject("select id from ef_purchase where initiator_id=? and creation_command=? for update",String.class,actor,commandId);
            active(actor); requireApprover(content.approver());
            String saved=jdbc.queryForObject("select creation_digest from ef_purchase where id=?",String.class,id);
            if(!hash.equals(saved))throw conflict();
            if(jdbc.queryForObject("select count(*) from ef_purchase_audit where purchase_id=?",Long.class,id)==0){
                saveItems(id,content); audit(id,actor,new Command(commandId,0,""),"CREATE",hash,1);
            }
            return read(id);
        });
    }
    @Override public Purchase update(String id, Command command, Edit edit, String actor) {
        identity(id); validate(command); var content=normalize(edit,actor);
        String hash=digest(List.of("UPDATE",command,content));
        return database(()->{
            var row=locked(id,actor); if(!row.initiatorId().equals(actor))throw missing();
            if(replayed(id,actor,command,hash))return row;
            expected(row,command,"DRAFT"); requireApprover(content.approver());
            jdbc.update("update ef_purchase set title=?,reason=?,approver_id=?,total=?,revision=revision+1 where id=?",
                content.title(),content.reason(),content.approver(),content.amounts().total(),id);
            jdbc.update("delete from ef_purchase_item where purchase_id=?",id); saveItems(id,content);
            audit(id,actor,command,"UPDATE",hash,row.revision()+1); return read(id);
        });
    }
    @Override public Detail get(String id,String actor) {
        identity(id);return database(()->{
            active(actor);var row=read(id);visible(row,actor);
            var items=jdbc.query("select * from ef_purchase_item where purchase_id=? order by item_order",(rs,n)->
                new Item(rs.getString("item_id"),rs.getString("name"),rs.getString("unit"),rs.getBigDecimal("quantity").toPlainString(),rs.getBigDecimal("unit_price").toPlainString(),rs.getBigDecimal("amount").toPlainString()),id);
            var history=jdbc.query("select * from ef_purchase_audit where purchase_id=? order by revision",(rs,n)->
                new Event(rs.getString("action"),rs.getString("actor_id"),rs.getString("comment"),rs.getTimestamp("created_at").toInstant()),id);
            return new Detail(row,items,history);
        });
    }
    @Override public Page<Purchase> list(String view,String status,int page,int size,String actor) {
        if(page<1||page>1000000||size<1||size>100||view==null||status==null)throw invalid();
        String where=switch(view){case "mine"->"initiator_id=?";case "pending"->"approver_id=? and state='PENDING'";case "handled"->"approver_id=? and state in ('APPROVED','REJECTED')";default->throw invalid();};
        if(!status.isEmpty()&&!Set.of("DRAFT","PENDING","APPROVED","REJECTED","WITHDRAWN").contains(status))throw invalid();
        return database(()->{
            active(actor); if(!view.equals("mine"))requireApprover(actor);
            var args=new ArrayList<Object>();args.add(actor);String filter=where;
            if(!status.isEmpty()){filter+=" and state=?";args.add(status);}
            long count=jdbc.queryForObject("select count(*) from ef_purchase where "+filter,Long.class,args.toArray());
            args.add(size);args.add((page-1)*size);
            return new Page<>(jdbc.query("select * from ef_purchase where "+filter+" order by created_at desc,id desc limit ? offset ?",PurchaseService::map,args.toArray()),count);
        });
    }
    @Override public Purchase submit(String id,Command command,String actor){return mutate(id,command,"SUBMIT",actor);}
    @Override public Purchase decide(String id,Command command,boolean approved,String actor){return mutate(id,command,approved?"APPROVE":"REJECT",actor);}
    @Override public Purchase withdraw(String id,Command command,String actor){return mutate(id,command,"WITHDRAW",actor);}
    private Purchase mutate(String id,Command command,String action,String actor){
        identity(id);validate(command);String hash=digest(List.of(action,command));
        return database(()->{
            var row=locked(id,actor);
            boolean decision=action.equals("APPROVE")||action.equals("REJECT");
            if(decision){if(!row.approverId().equals(actor))throw missing();requireApprover(actor);}
            else if(!row.initiatorId().equals(actor))throw missing();
            if(replayed(id,actor,command,hash))return row;
            expected(row,command,action.equals("SUBMIT")?"DRAFT":"PENDING");
            String next;
            if(action.equals("SUBMIT")){
                requireApprover(row.approverId());
                var releases=jdbc.queryForList("select r.id,r.definition_id from ef_workflow_activation a join ef_workflow_release r on r.id=a.release_id where a.business_type='purchase' and r.business_type='purchase'");
                if(releases.size()!=1)throw new ApiFailure(409,"PURCHASE_NOT_ACTIVATED","请先发布并激活采购审批流程。");
                String release=releases.get(0).get("id").toString(),definition=releases.get(0).get("definition_id").toString();
                PurchaseProcessBinding.require(engine,definition);
                var process=engine.getRuntimeService().startProcessInstanceById(definition,"purchase:"+id,
                    Map.of("businessType","purchase","businessId",id,"initiator",actor,"approver",row.approverId()));
                var tasks=engine.getTaskService().createTaskQuery().processInstanceId(process.getId()).list();
                if(tasks.size()!=1||!row.approverId().equals(tasks.get(0).getAssignee()))throw binding();
                jdbc.update("update ef_purchase set release_id=?,process_id=? where id=?",release,process.getId(),id);next="PENDING";
            }else if(action.equals("WITHDRAW")){
                engine.getRuntimeService().deleteProcessInstance(row.processId(),"Purchase withdrawn by initiator");next="WITHDRAWN";
            }else{
                var tasks=engine.getTaskService().createTaskQuery().processInstanceId(row.processId()).list();
                if(tasks.size()!=1||!actor.equals(tasks.get(0).getAssignee()))throw conflict();
                engine.getTaskService().complete(tasks.get(0).getId(),Map.of("approved",action.equals("APPROVE")));
                if(engine.getRuntimeService().createProcessInstanceQuery().processInstanceId(row.processId()).count()!=0)throw binding();
                var ends=engine.getHistoryService().createHistoricActivityInstanceQuery().processInstanceId(row.processId()).activityType("endEvent").finished().list();
                String expected=action.equals("APPROVE")?"approvedEnd":"rejectedEnd";
                if(ends.size()!=1||!expected.equals(ends.get(0).getActivityId()))throw binding();
                next=action.equals("APPROVE")?"APPROVED":"REJECTED";
            }
            jdbc.update("update ef_purchase set state=?,revision=revision+1 where id=?",next,id);
            audit(id,actor,command,action,hash,row.revision()+1);return read(id);
        });
    }
    private Content normalize(Edit edit,String actor){
        if(edit==null||edit.title()==null||edit.title().isBlank()||edit.title().length()>100||edit.reason()==null||edit.reason().isBlank()||edit.reason().length()>1000)throw invalid();
        actorId(edit.approverId());actorId(actor);if(actor.equals(edit.approverId())||edit.items()==null)throw invalid();
        var input=new ArrayList<PurchaseAmounts.Input>();
        if(edit.items().size()>100)throw invalid();
        for(var item:edit.items()){
            if(item==null)throw invalid();
            input.add(new PurchaseAmounts.Input(item.id(),item.name(),item.unit(),item.quantity(),item.unitPrice()));
        }
        return new Content(edit.title(),edit.reason(),edit.approverId(),PurchaseAmounts.calculate(input));
    }
    private void saveItems(String id,Content content){int index=0;for(var item:content.amounts().lines()){
        jdbc.update("insert into ef_purchase_item (purchase_id,item_id,item_order,name,unit,quantity,unit_price,amount) values (?,?,?,?,?,?,?,?)",
            id,item.id(),index++,item.name(),item.unit(),item.quantity(),item.unitPrice(),item.amount());
    }}
    private Purchase locked(String id,String actor){
        if(jdbc.queryForList("select id from ef_purchase where id=? for update",String.class,id).isEmpty())throw missing();
        active(actor);return read(id);
    }
    private Purchase read(String id){var rows=jdbc.query("select * from ef_purchase where id=?",PurchaseService::map,id);if(rows.isEmpty())throw missing();return rows.get(0);}
    private static Purchase map(ResultSet rs,int index)throws SQLException{return new Purchase(rs.getString("id"),rs.getString("initiator_id"),rs.getString("approver_id"),rs.getString("title"),rs.getString("reason"),rs.getBigDecimal("total").toPlainString(),rs.getString("state"),rs.getLong("revision"),rs.getString("process_id"),rs.getString("release_id"),rs.getTimestamp("created_at").toInstant());}
    private static void visible(Purchase row,String actor){if(!row.initiatorId().equals(actor)&&(!row.approverId().equals(actor)||row.status().equals("DRAFT")))throw missing();}
    private void active(String actor){actorId(actor);if(jdbc.queryForObject("select count(*) from sys_user where user_id=? and status='0' and del_flag='0'",Long.class,actor)!=1)throw new ApiFailure(403,"PURCHASE_ACCOUNT_DISABLED","账号不可用。");}
    private void requireApprover(String actor){
        active(actor);if(actor.equals("1"))return;
        if(jdbc.queryForObject("select count(*) from sys_user_role ur join sys_role r on r.role_id=ur.role_id join sys_role_menu rm on rm.role_id=r.role_id join sys_menu m on m.menu_id=rm.menu_id where ur.user_id=? and r.status='0' and r.del_flag='0' and m.status='0' and m.perms='sample:purchase:approve'",Long.class,actor)==0)
            throw new ApiFailure(409,"PURCHASE_APPROVER_UNAVAILABLE","指定审批人当前不可用或没有审批权限。");
    }
    private boolean replayed(String id,String actor,Command command,String hash){var found=jdbc.queryForList("select command_digest from ef_purchase_audit where purchase_id=? and actor_id=? and command_id=?",String.class,id,actor,command.commandId());if(found.isEmpty())return false;if(!found.get(0).equals(hash))throw conflict();return true;}
    private void audit(String id,String actor,Command command,String action,String hash,long revision){jdbc.update("insert into ef_purchase_audit (id,purchase_id,actor_id,command_id,command_digest,action,comment,revision,created_at) values (?,?,?,?,?,?,?,?,?)",UUID.randomUUID().toString(),id,actor,command.commandId(),hash,action,command.comment(),revision,Timestamp.from(Instant.now()));}
    private static void expected(Purchase row,Command command,String state){if(!row.status().equals(state)||row.revision()!=command.expectedRevision())throw conflict();}
    private static void validate(Command command){if(command==null)throw invalid();identity(command.commandId());if(command.expectedRevision()<1||command.expectedRevision()==Long.MAX_VALUE||command.comment()==null||command.comment().length()>500)throw invalid();}
    private static void identity(String id){if(id==null||!id.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw invalid();}
    private static void actorId(String id){if(id==null||!id.matches("[1-9][0-9]{0,18}"))throw invalid();}
    private String digest(Object value){try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(value)));}catch(Exception failure){throw invalid();}}
    private <T>T database(java.util.function.Supplier<T> work){try{return transaction.execute(work);}catch(RuntimeException failure){
        if(failure instanceof ApiFailure)throw failure;
        for(Throwable cause=failure;cause!=null;cause=cause.getCause()){if(cause instanceof DataAccessException||cause instanceof SQLException)throw new ApiFailure(503,"PURCHASE_STORAGE_UNAVAILABLE","采购存储暂不可用。");if(cause==cause.getCause())break;}
        throw new ApiFailure(409,"PURCHASE_ACTION_FAILED","采购操作未完成，请刷新后重试。");
    }}
    private static ApiFailure invalid(){return new ApiFailure(400,"PURCHASE_INVALID","采购参数无效。");}
    private static ApiFailure conflict(){return new ApiFailure(409,"PURCHASE_CONFLICT","采购状态或命令内容已变化，请刷新后重试。");}
    private static ApiFailure missing(){return new ApiFailure(404,"PURCHASE_NOT_FOUND","采购申请不存在或不可访问。");}
    private static ApiFailure binding(){return new ApiFailure(409,"PURCHASE_BINDING_INVALID","流程不符合单级采购审批规则。");}
}
