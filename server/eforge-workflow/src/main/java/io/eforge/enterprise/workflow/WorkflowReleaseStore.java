package io.eforge.enterprise.workflow;

import java.io.StringReader;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.xml.sax.InputSource;
import org.w3c.dom.Element;
import org.flowable.engine.ProcessEngine;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;

/** Publishes an immutable, proven draft in the same transaction as the official engine deployment. */
public final class WorkflowReleaseStore implements WorkflowReleases {
    private final JdbcTemplate jdbc;
    private final WorkflowUnitOfWork transaction;
    private final WorkflowPackages packages;
    private final ProcessEngine engine;
    private final ObjectMapper json=new ObjectMapper();
    public WorkflowReleaseStore(DataSource source,WorkflowUnitOfWork transaction,WorkflowPackages packages,ProcessEngine engine) {
        this.jdbc=new JdbcTemplate(source);this.transaction=transaction;this.packages=packages;this.engine=engine;
    }
    public Release publish(String packageId,long expectedRevision,String actor) {
        if(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive())
            throw new ApiFailure(409,"WORKFLOW_PUBLICATION_TRANSACTION","请从独立的发布事务入口执行发布。");
        identity(packageId);actor(actor);if(expectedRevision<1)throw invalid();
        String resource="release-"+UUID.randomUUID()+".bpmn20.xml";
        boolean committed=false;
        try {
            var result=transaction.execute(() -> {
                var locked=jdbc.queryForList("select id from ef_workflow_package where id=? for update",String.class,packageId);
                if(locked.isEmpty())throw missing();
                // Establish the consistent read only after acquiring this package's mutation lock.
                // Returning an older publication remains valid even when the editable draft advanced.
                var prior=byVersion(packageId,expectedRevision);if(prior!=null)return prior;
                var draft=packages.get(packageId);
                if(draft.revision()!=expectedRevision)throw conflict();
                if(draft.validatedRevision()==null||draft.validatedRevision()!=expectedRevision)
                    throw new ApiFailure(409,"WORKFLOW_PROOF_REQUIRED","请先校验当前流程包版本。");
                var checked=WorkflowBpmnPolicy.validate(draft.source().bpmnXml());
                candidates(checked.xml());
                var stored=jdbc.queryForMap("select source_json,validation_json from ef_workflow_package where id=?",packageId);
                var deployment=engine.getRepositoryService().createDeployment().name(draft.name()).addString(resource,checked.xml()).deploy();
                var definition=engine.getRepositoryService().createProcessDefinitionQuery().deploymentId(deployment.getId()).singleResult();
                // The only registered business binding is leave; reject unusable outcome mapping before publication commits.
                WorkflowLeaveService.requireLeaveBinding(engine,definition.getId());
                String id=UUID.randomUUID().toString();var now=Timestamp.from(Instant.now());
                jdbc.update("insert into ef_workflow_release (id,package_id,package_revision,name,business_type,content_digest,source_json,validation_json,definition_id,deployment_id,published_by,published_at) values (?,?,?,?,?,?,?,?,?,?,?,?)",
                    id,packageId,expectedRevision,draft.name(),draft.businessType(),draft.contentDigest(),stored.get("source_json"),stored.get("validation_json"),definition.getId(),deployment.getId(),actor,now);
                audit(id,"PUBLISH",actor,null);return read(id);
            });
            committed=true;return result;
        } catch(RuntimeException failure) {throw safe(failure);}
        finally {if(!committed)evict(resource);}
    }
    public Release get(String id) {identity(id);return database(() -> read(id));}
    public Page list(String packageId,int page,int pageSize) {
        identity(packageId);if(page<1||page>1000000||pageSize<1||pageSize>100)throw invalid();
        return database(() -> new Page(jdbc.query("select * from ef_workflow_release where package_id=? order by package_revision desc limit ? offset ?",this::row,packageId,pageSize,(page-1)*pageSize),
            jdbc.queryForObject("select count(*) from ef_workflow_release where package_id=?",Long.class,packageId)));
    }
    public Activation activation(String businessType) {
        business(businessType);return database(() -> active(businessType));
    }
    public Activation activate(String businessType,String releaseId,long expectedRevision,String actor) {
        business(businessType);identity(releaseId);actor(actor);if(expectedRevision<0)throw invalid();
        if(expectedRevision==Long.MAX_VALUE)throw conflict();
        return database(() -> {
            var release=read(releaseId);if(!release.businessType().equals(businessType))throw invalid();
            WorkflowAsyncStart.requireEnabled(engine,release.processDefinitionId());
            String source=jdbc.queryForObject("select source_json from ef_workflow_release where id=?",String.class,releaseId);
            WorkflowValidation.Request request;
            try {request=json.readValue(source,WorkflowValidation.Request.class);}
            catch(Exception failure){throw new ApiFailure(500,"WORKFLOW_RELEASE_STORAGE","已发布流程内容不可读取。");}
            candidates(WorkflowBpmnPolicy.validate(request.bpmnXml()).xml());
            int changed=jdbc.update("update ef_workflow_activation set release_id=?,revision=revision+1,updated_by=?,updated_at=? where business_type=? and revision=?",
                releaseId,actor,Timestamp.from(Instant.now()),businessType,expectedRevision);
            if(changed!=1)throw conflict();
            audit(releaseId,"ACTIVATE",actor,expectedRevision+1);return active(businessType);
        });
    }
    private Release byVersion(String id,long version) {
        var rows=jdbc.query("select * from ef_workflow_release where package_id=? and package_revision=?",this::row,id,version);
        return rows.isEmpty()?null:rows.get(0);
    }
    private Release read(String id) {
        var rows=jdbc.query("select * from ef_workflow_release where id=?",this::row,id);if(rows.isEmpty())throw missing();return rows.get(0);
    }
    private Release row(java.sql.ResultSet rs,int index)throws java.sql.SQLException {
        return new Release(rs.getString("id"),rs.getString("package_id"),rs.getLong("package_revision"),rs.getString("name"),
            rs.getString("business_type"),rs.getString("content_digest"),rs.getString("definition_id"),rs.getTimestamp("published_at").toInstant());
    }
    private Activation active(String business) {
        var rows=jdbc.query("select * from ef_workflow_activation where business_type=?",(rs,index)->new Activation(rs.getString("business_type"),rs.getString("release_id"),rs.getLong("revision")),business);
        if(rows.isEmpty())throw new ApiFailure(503,"WORKFLOW_STORAGE_UNAVAILABLE","工作流配置尚未初始化。");return rows.get(0);
    }
    private void audit(String release,String action,String actor,Long revision) {
        jdbc.update("insert into ef_workflow_release_audit (id,release_id,action,actor_id,activation_revision,created_at) values (?,?,?,?,?,?)",
            UUID.randomUUID().toString(),release,action,actor,revision,Timestamp.from(Instant.now()));
    }
    private void candidates(String xml) {
        try {
            var factory=DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD,"");factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
            var tasks=factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)))
                .getElementsByTagNameNS("http://www.omg.org/spec/BPMN/20100524/MODEL","userTask");
            for(int i=0;i<tasks.getLength();i++) {
                var task=(Element)tasks.item(i);String ns="http://flowable.org/bpmn";
                String assignee=task.getAttributeNS(ns,"assignee"),users=task.getAttributeNS(ns,"candidateUsers"),groups=task.getAttributeNS(ns,"candidateGroups");
                if(assignee.equals("${approver}"))throw new ApiFailure(409,"WORKFLOW_BINDING_REQUIRED","请先配置已注册的审批人绑定。");
                if(!assignee.isEmpty())users=assignee;
                if(!users.isEmpty())for(String user:users.split(",")) {
                    if(jdbc.queryForObject("select count(*) from sys_user where user_id=? and status='0' and del_flag='0'",Long.class,user)!=1)throw unavailable();
                }
                if(!groups.isEmpty())for(String group:groups.split(",")) {
                    String role=group.substring("role:".length());
                    if(jdbc.queryForObject("select count(*) from sys_role where role_id=? and status='0' and del_flag='0'",Long.class,role)!=1)throw unavailable();
                    if(jdbc.queryForObject("select count(*) from sys_user u join sys_user_role ur on ur.user_id=u.user_id where ur.role_id=? and u.status='0' and u.del_flag='0'",Long.class,role)==0)throw unavailable();
                }
            }
        } catch(ApiFailure|DataAccessException failure){throw failure;}
        catch(Exception failure){throw invalid();}
    }
    private void evict(String resource) {
        var config=(org.flowable.engine.impl.cfg.ProcessEngineConfigurationImpl)engine.getProcessEngineConfiguration();
        for(var entry:List.copyOf(config.getProcessDefinitionCache().getAll()))if(resource.equals(entry.getProcessDefinition().getResourceName())) {
            config.getProcessDefinitionCache().remove(entry.getProcessDefinition().getId());
            config.getProcessDefinitionInfoCache().remove(entry.getProcessDefinition().getId());
        }
    }
    private <T>T database(java.util.function.Supplier<T> work){try{return transaction.execute(work);}catch(RuntimeException failure){throw safe(failure);}}
    private static RuntimeException safe(RuntimeException failure) {
        if(failure instanceof ApiFailure)return failure;
        for(Throwable cause=failure;cause!=null;cause=cause.getCause()) {
            if(cause instanceof DataAccessException||cause instanceof java.sql.SQLException)return new ApiFailure(503,"WORKFLOW_STORAGE_UNAVAILABLE","工作流存储暂不可用。");
            if(cause==cause.getCause())break;
        }
        return new ApiFailure(409,"WORKFLOW_PUBLICATION_FAILED","流程发布未完成，请重新校验后重试。");
    }
    private static void identity(String id){if(id==null||!id.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw invalid();}
    private static void actor(String actor){if(actor==null||!actor.matches("[1-9][0-9]{0,18}"))throw invalid();}
    private static void business(String business){if(!"leave".equals(business))throw invalid();}
    private static ApiFailure invalid(){return new ApiFailure(400,"WORKFLOW_RELEASE_INVALID","流程发布参数无效。");}
    private static ApiFailure missing(){return new ApiFailure(404,"WORKFLOW_RELEASE_NOT_FOUND","流程包或发布记录不存在。");}
    private static ApiFailure conflict(){return new ApiFailure(409,"WORKFLOW_RELEASE_CONFLICT","流程版本已变化，请重新读取后重试。");}
    private static ApiFailure unavailable(){return new ApiFailure(409,"WORKFLOW_CANDIDATE_UNAVAILABLE","流程中存在无有效审批人的任务。");}
}
