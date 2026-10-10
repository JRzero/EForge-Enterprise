package io.eforge.enterprise.workflow;

import javax.sql.DataSource;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;

/** One joined SELECT captures both sides without locking writers or rereading a changing draft. */
public final class WorkflowComparisonStore implements WorkflowComparisons {
    private final JdbcTemplate jdbc;
    private final WorkflowUnitOfWork transaction;
    private final ObjectMapper json=new ObjectMapper();
    public WorkflowComparisonStore(DataSource source,WorkflowUnitOfWork transaction) {
        this.jdbc=new JdbcTemplate(source);this.transaction=transaction;
    }
    public Comparison compare(String packageId,String baselineReleaseId,String targetReleaseId) {
        identity(packageId);identity(baselineReleaseId);if(targetReleaseId!=null)identity(targetReleaseId);
        try{return transaction.execute(()->{
            var rows=jdbc.query("""
                select b.id b_id,b.package_revision b_revision,b.content_digest b_digest,
                       b.name b_name,b.business_type b_business,b.source_json b_source,
                       p.id p_id,p.revision p_revision,p.content_digest p_digest,
                       p.name p_name,p.business_type p_business,p.source_json p_source,
                       t.id t_id,t.package_revision t_revision,t.content_digest t_digest,
                       t.name t_name,t.business_type t_business,t.source_json t_source
                from ef_workflow_package p
                join ef_workflow_release b on b.package_id=p.id and b.id=?
                left join ef_workflow_release t on t.package_id=p.id and t.id=?
                where p.id=?
                """,(rs,index)->{
                    if(targetReleaseId!=null&&rs.getString("t_id")==null)throw missing();
                    String prefix=targetReleaseId==null?"p_":"t_";
                    var baseline=new Version("RELEASE",rs.getString("b_id"),rs.getLong("b_revision"),rs.getString("b_digest"));
                    var target=new Version(targetReleaseId==null?"DRAFT":"RELEASE",rs.getString(prefix+"id"),rs.getLong(prefix+"revision"),rs.getString(prefix+"digest"));
                    var before=decode(rs.getString("b_source"));var after=decode(rs.getString(prefix+"source"));
                    return new Comparison(packageId,baseline,target,List.of(
                        field("name",rs.getString("b_name"),rs.getString(prefix+"name")),
                        field("businessType",rs.getString("b_business"),rs.getString(prefix+"business")),
                        field("bpmnXml",before.bpmnXml(),after.bpmnXml()),
                        field("scenarios",encode(before.scenarios()),encode(after.scenarios()))));
                },baselineReleaseId,targetReleaseId,packageId);
            if(rows.isEmpty())throw missing();return rows.get(0);
        });}catch(DataAccessException failure){throw new ApiFailure(503,"WORKFLOW_STORAGE_UNAVAILABLE","工作流存储暂不可用。");}
    }
    private WorkflowValidation.Request decode(String value){
        try{var result=json.readValue(value,WorkflowValidation.Request.class);if(result==null||result.bpmnXml()==null||result.scenarios()==null)throw new IllegalArgumentException();return result;}
        catch(Exception failure){throw new ApiFailure(500,"WORKFLOW_RELEASE_STORAGE","流程内容不可读取。");}
    }
    private String encode(Object value){try{return json.writerWithDefaultPrettyPrinter().writeValueAsString(value);}catch(Exception failure){throw new ApiFailure(500,"WORKFLOW_RELEASE_STORAGE","流程内容不可读取。");}}
    private static Field field(String name,String before,String after){return new Field(name,before,after,!Objects.equals(before,after));}
    private static void identity(String value){if(value==null||!value.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}"))throw new ApiFailure(400,"WORKFLOW_RELEASE_INVALID","流程版本参数无效。");}
    private static ApiFailure missing(){return new ApiFailure(404,"WORKFLOW_RELEASE_NOT_FOUND","流程包或发布记录不存在。");}
}
