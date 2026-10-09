package io.eforge.enterprise.workflow;

import java.util.function.Supplier;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.framework.datasource.DynamicDataSourceContextHolder;
import io.eforge.enterprise.workflow.api.WorkflowUnitOfWork;

/** Establish master routing before acquiring a connection; never split business and engine commits. */
public final class WorkflowTransactionBoundary implements WorkflowUnitOfWork {
    private final TransactionTemplate transaction;
    private final ThreadLocal<Boolean> owned = new ThreadLocal<>();

    public WorkflowTransactionBoundary(PlatformTransactionManager transactions) {
        transaction = new TransactionTemplate(transactions);
    }

    @Override public <T> T execute(Supplier<T> work) {
        String previous = DynamicDataSourceContextHolder.getDataSourceType();
        boolean nested = Boolean.TRUE.equals(owned.get());
        if ((previous != null && !previous.equals("MASTER"))
            || (TransactionSynchronizationManager.isActualTransactionActive() && !nested)) {
            throw new ApiFailure(409, "WORKFLOW_TRANSACTION_CONTEXT", "工作流操作必须从主库事务边界开始。");
        }
        DynamicDataSourceContextHolder.setDataSourceType("MASTER");
        owned.set(true);
        try { return transaction.execute(status -> work.get()); }
        finally {
            if (nested) owned.set(true); else owned.remove();
            if (previous == null) DynamicDataSourceContextHolder.clearDataSourceType();
            else DynamicDataSourceContextHolder.setDataSourceType(previous);
        }
    }
}
