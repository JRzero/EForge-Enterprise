package io.eforge.enterprise.workflow;

import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import org.springframework.transaction.UnexpectedRollbackException;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.datasource.DynamicDataSourceContextHolder;
import static org.assertj.core.api.Assertions.*;

class WorkflowTransactionBoundaryTest {
    @Test void rejectsSlaveAndUnrelatedTransactionsBeforeRunningBusinessWork() {
        var database = new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).build();
        try {
            var transactions = new DataSourceTransactionManager(database);
            var boundary = new WorkflowTransactionBoundary(transactions);
            var invoked = new AtomicBoolean();
            DynamicDataSourceContextHolder.setDataSourceType("SLAVE");
            assertThatThrownBy(() -> boundary.execute(() -> invoked.getAndSet(true))).isInstanceOf(ApiFailure.class);
            assertThat(DynamicDataSourceContextHolder.getDataSourceType()).isEqualTo("SLAVE");
            DynamicDataSourceContextHolder.clearDataSourceType();
            new TransactionTemplate(transactions).executeWithoutResult(status ->
                assertThatThrownBy(() -> boundary.execute(() -> invoked.getAndSet(true))).isInstanceOf(ApiFailure.class));
            assertThat(invoked).isFalse();
        } finally { DynamicDataSourceContextHolder.clearDataSourceType(); database.shutdown(); }
    }

    @Test void nestedFailureMarksWholeBusinessTransactionRollbackOnlyAndRestoresRouting() {
        var database = new EmbeddedDatabaseBuilder().generateUniqueName(true).setType(EmbeddedDatabaseType.H2).build();
        try {
            var jdbc = new JdbcTemplate(database);
            jdbc.execute("create table probe (id int)");
            var boundary = new WorkflowTransactionBoundary(new DataSourceTransactionManager(database));
            assertThatThrownBy(() -> boundary.execute(() -> {
                jdbc.update("insert into probe values (1)");
                assertThat(DynamicDataSourceContextHolder.getDataSourceType()).isEqualTo("MASTER");
                try { boundary.execute(() -> { throw new IllegalStateException("nested failure"); }); }
                catch (IllegalStateException expected) { /* A caller catching an error must not commit partial work. */ }
                return null;
            })).isInstanceOf(UnexpectedRollbackException.class);
            assertThat(jdbc.queryForObject("select count(*) from probe", Long.class)).isZero();
            assertThat(DynamicDataSourceContextHolder.getDataSourceType()).isNull();
            boundary.execute(() -> { jdbc.update("insert into probe values (2)"); return null; });
            assertThat(jdbc.queryForObject("select count(*) from probe", Long.class)).isEqualTo(1);
        } finally { DynamicDataSourceContextHolder.clearDataSourceType(); database.shutdown(); }
    }
}
