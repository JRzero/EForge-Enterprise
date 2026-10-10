package io.eforge.enterprise.workflow;

import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.workflow.api.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkflowPackageStoreTest {
    EmbeddedDatabase database;
    JdbcTemplate jdbc;
    WorkflowPackageStore store;
    WorkflowValidation validation;
    WorkflowPackages.Edit edit;
    @BeforeEach void setup() throws Exception {
        database = new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).build();
        jdbc = new JdbcTemplate(database);
        String ddl = Files.readString(Path.of("../../sql/workflow/04-eforge-workflow.sql"))
            .replace("ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin", "");
        jdbc.execute(ddl);
        validation = mock(WorkflowValidation.class);
        store = new WorkflowPackageStore(database, new WorkflowTransactionBoundary(new DataSourceTransactionManager(database)), validation);
        edit = new WorkflowPackages.Edit("请假审批", "leave", new WorkflowValidation.Request("<draft/>",
            List.of(new WorkflowValidation.Scenario("批准", List.of(new WorkflowValidation.Decision("review", true)), "approvedEnd"))));
    }
    @AfterEach void close() { if (database != null) database.shutdown(); }
    @Test void draftsPreserveSourceAndOptimisticWritesCannotOverwriteNewerRevision() {
        var original = store.create(edit, "1");
        assertThat(original.revision()).isEqualTo(1);
        assertThat(store.get(original.id()).source()).isEqualTo(edit.source());
        assertThat(store.list(1, 10).total()).isEqualTo(1);
        var next = store.update(original.id(), 1, new WorkflowPackages.Edit("更新名称", "leave", edit.source()), "2");
        assertThat(next.revision()).isEqualTo(2);
        assertThatThrownBy(() -> store.update(original.id(), 1, edit, "1")).isInstanceOfSatisfying(ApiFailure.class,
            failure -> assertThat(failure.status()).isEqualTo(409));
        assertThat(store.get(original.id()).name()).isEqualTo("更新名称");
        assertThat(jdbc.queryForObject("select count(*) from ef_workflow_package_audit", Long.class)).isEqualTo(2);
    }
    @Test void validationBindsCurrentRevisionAndConcurrentEditCannotInheritProof() {
        var original = store.create(edit, "1");
        when(validation.validate(any())).thenReturn(new WorkflowValidation.Result("leaveApproval", "digest", List.of()));
        assertThat(store.validate(original.id(), 1, "2").validatedRevision()).isEqualTo(1);
        assertThat(store.update(original.id(), 1, edit, "1").validatedRevision()).isNull();
        when(validation.validate(any())).thenAnswer(call -> {
            store.update(original.id(), 2, edit, "1");
            return new WorkflowValidation.Result("leaveApproval", "digest", List.of());
        });
        assertThatThrownBy(() -> store.validate(original.id(), 2, "2")).isInstanceOfSatisfying(ApiFailure.class,
            failure -> assertThat(failure.status()).isEqualTo(409));
        assertThat(store.get(original.id()).validatedRevision()).isNull();
        assertThat(store.get(original.id()).revision()).isEqualTo(3);
    }
    @Test void exhaustedVersionRemainsReadableAndValidatableButCannotOverflow() {
        var original=store.create(edit,"1");
        jdbc.update("update ef_workflow_package set revision=? where id=?",Long.MAX_VALUE-1,original.id());
        assertThat(store.update(original.id(),Long.MAX_VALUE-1,edit,"1").revision()).isEqualTo(Long.MAX_VALUE);
        when(validation.validate(any())).thenReturn(new WorkflowValidation.Result("leaveApproval","digest",List.of()));
        assertThat(store.validate(original.id(),Long.MAX_VALUE,"1").validatedRevision()).isEqualTo(Long.MAX_VALUE);
        assertThatThrownBy(() -> store.update(original.id(),Long.MAX_VALUE,edit,"1"))
            .isInstanceOfSatisfying(ApiFailure.class,failure -> assertThat(failure.code()).isEqualTo("WORKFLOW_REVISION_EXHAUSTED"));
        assertThat(store.get(original.id()).revision()).isEqualTo(Long.MAX_VALUE);
    }
    @Test void auditFailureRollsBackSourceAndValidationDoesNotRunInsideWriteTransaction() {
        var original = store.create(edit, "1");
        when(validation.validate(any())).thenAnswer(call -> {
            assertThat(org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            return new WorkflowValidation.Result("leaveApproval", "digest", List.of());
        });
        store.validate(original.id(), 1, "1");
        jdbc.execute("drop table ef_workflow_package_audit");
        assertThatThrownBy(() -> store.update(original.id(), 1, edit, "1")).isInstanceOfSatisfying(ApiFailure.class,
            failure -> assertThat(failure.status()).isEqualTo(503));
        assertThat(store.get(original.id()).revision()).isEqualTo(1);
        assertThat(store.get(original.id()).validatedRevision()).isEqualTo(1);
    }
}
