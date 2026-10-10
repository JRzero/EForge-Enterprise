package io.eforge.enterprise.workflow;

import javax.sql.DataSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.eforge.enterprise.workflow.api.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

/** Stores editable packages separately from immutable engine deployments. */
public final class WorkflowPackageStore implements WorkflowPackages {
    private final JdbcTemplate jdbc;
    private final WorkflowUnitOfWork transaction;
    private final WorkflowValidation validation;
    private final ObjectMapper json = new ObjectMapper();
    public WorkflowPackageStore(DataSource dataSource, WorkflowUnitOfWork transaction, WorkflowValidation validation) {
        this.jdbc = new JdbcTemplate(dataSource); this.transaction = transaction; this.validation = validation;
    }
    public Draft create(Edit edit, String actor) {
        actor(actor); var content = normalize(edit);
        return database(() -> transaction.execute(() -> {
            String id = UUID.randomUUID().toString(); var now = Timestamp.from(Instant.now());
            jdbc.update("insert into ef_workflow_package (id,name,business_type,revision,source_json,content_digest,created_by,updated_by,created_at,updated_at) values (?,?,?,1,?,?,?,?,?,?)",
                id, content.edit().name(), content.edit().businessType(), content.source(), content.digest(), actor, actor, now, now);
            audit(id, 1, "CREATE", actor, content.digest());
            return read(id);
        }));
    }
    public Draft update(String id, long expectedRevision, Edit edit, String actor) {
        identity(id); revision(expectedRevision); actor(actor); var content = normalize(edit);
        if (expectedRevision == Long.MAX_VALUE) throw new ApiFailure(409, "WORKFLOW_REVISION_EXHAUSTED", "流程包版本已达到上限，请创建新的流程包。");
        return database(() -> transaction.execute(() -> {
            int changed = jdbc.update("update ef_workflow_package set name=?,business_type=?,revision=revision+1,source_json=?,content_digest=?,validated_revision=null,validation_json=null,updated_by=?,updated_at=? where id=? and revision=?",
                content.edit().name(), content.edit().businessType(), content.source(), content.digest(), actor, Timestamp.from(Instant.now()), id, expectedRevision);
            if (changed != 1) throw conflict();
            audit(id, expectedRevision + 1, "UPDATE", actor, content.digest());
            return read(id);
        }));
    }
    public Draft get(String id) { identity(id); return database(() -> transaction.execute(() -> read(id))); }
    public Page list(int page, int pageSize) {
        if (page < 1 || page > 1000000 || pageSize < 1 || pageSize > 100) throw invalid();
        return database(() -> transaction.execute(() -> new Page(jdbc.query(
            "select id,name,business_type,revision,validated_revision,updated_at from ef_workflow_package order by updated_at desc,id limit ? offset ?",
            (rs, index) -> new Summary(rs.getString("id"), rs.getString("name"), rs.getString("business_type"), rs.getLong("revision"),
                nullableLong(rs, "validated_revision"), rs.getTimestamp("updated_at").toInstant()), pageSize, (page - 1) * pageSize),
            jdbc.queryForObject("select count(*) from ef_workflow_package", Long.class))));
    }
    public Draft validate(String id, long expectedRevision, String actor) {
        identity(id); revision(expectedRevision); actor(actor);
        // Validate an immutable read outside any publication/write transaction, then compare revision.
        var draft = get(id);
        if (draft.revision() != expectedRevision) throw conflict();
        var proof = validation.validate(draft.source());
        String encoded;
        try { encoded = json.writeValueAsString(proof); }
        catch (Exception failure) { throw new ApiFailure(500, "WORKFLOW_PROOF_ENCODING", "无法保存流程校验结果。"); }
        return database(() -> transaction.execute(() -> {
            int changed = jdbc.update("update ef_workflow_package set validated_revision=?,validation_json=?,updated_by=?,updated_at=? where id=? and revision=? and content_digest=?",
                expectedRevision, encoded, actor, Timestamp.from(Instant.now()), id, expectedRevision, draft.contentDigest());
            if (changed != 1) throw conflict();
            audit(id, expectedRevision, "VALIDATE", actor, draft.contentDigest());
            return read(id);
        }));
    }
    private Draft read(String id) {
        var rows = jdbc.query("select * from ef_workflow_package where id=?", (rs, index) -> {
            WorkflowValidation.Request source;
            try { source = json.readValue(rs.getString("source_json"), WorkflowValidation.Request.class); }
            catch (Exception failure) { throw new ApiFailure(500, "WORKFLOW_PACKAGE_STORAGE", "流程包内容不可读取。"); }
            return new Draft(rs.getString("id"), rs.getString("name"), rs.getString("business_type"), rs.getLong("revision"),
                rs.getString("content_digest"), nullableLong(rs, "validated_revision"), source, rs.getTimestamp("updated_at").toInstant());
        }, id);
        if (rows.isEmpty()) throw new ApiFailure(404, "WORKFLOW_PACKAGE_NOT_FOUND", "流程包不存在。");
        return rows.get(0);
    }
    private void audit(String id, long revision, String action, String actor, String digest) {
        jdbc.update("insert into ef_workflow_package_audit (id,package_id,revision,action,actor_id,content_digest,created_at) values (?,?,?,?,?,?,?)",
            UUID.randomUUID().toString(), id, revision, action, actor, digest, Timestamp.from(Instant.now()));
    }
    private record Content(Edit edit, String source, String digest) { }
    private Content normalize(Edit input) {
        try {
            // Snapshot mutable caller collections before validating and hashing exactly what is persisted.
            String serialized = json.writeValueAsString(input);
            if (serialized.length() > 1048576) throw invalid();
            Edit edit = json.readValue(serialized, Edit.class);
            if (edit == null || edit.name() == null || edit.name().isBlank() || edit.name().length() > 128
                || !"leave".equals(edit.businessType()) || edit.source() == null || edit.source().bpmnXml() == null
                || edit.source().bpmnXml().isBlank() || edit.source().bpmnXml().length() > 262144 || edit.source().scenarios() == null
                || edit.source().scenarios().size() > 20) throw invalid();
            for (var scenario : edit.source().scenarios()) {
                if (scenario == null || scenario.name() == null || scenario.name().length() > 64 || scenario.expectedEnd() == null
                    || scenario.expectedEnd().length() > 64 || scenario.decisions() == null || scenario.decisions().size() > 100) throw invalid();
                for (var decision : scenario.decisions()) if (decision == null || decision.taskKey() == null || decision.taskKey().length() > 64) throw invalid();
            }
            return new Content(edit, json.writeValueAsString(edit.source()), HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(serialized.getBytes(StandardCharsets.UTF_8))));
        } catch (ApiFailure failure) { throw failure; }
        catch (Exception failure) { throw invalid(); }
    }
    private static Long nullableLong(ResultSet rs, String name) throws SQLException { long value = rs.getLong(name); return rs.wasNull() ? null : value; }
    private static void identity(String id) { if (id == null || !id.matches("[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}")) throw invalid(); }
    private static void actor(String actor) { if (actor == null || !actor.matches("[1-9][0-9]{0,18}")) throw invalid(); }
    private static void revision(long revision) { if (revision < 1) throw invalid(); }
    private static ApiFailure invalid() { return new ApiFailure(400, "WORKFLOW_PACKAGE_INVALID", "流程包参数无效。"); }
    private static ApiFailure conflict() { return new ApiFailure(409, "WORKFLOW_PACKAGE_CONFLICT", "流程包已被修改，请重新读取后重试。"); }
    private static <T> T database(Supplier<T> operation) {
        try { return operation.get(); }
        catch (DataAccessException failure) { throw new ApiFailure(503, "WORKFLOW_STORAGE_UNAVAILABLE", "工作流存储暂不可用。"); }
    }
}
