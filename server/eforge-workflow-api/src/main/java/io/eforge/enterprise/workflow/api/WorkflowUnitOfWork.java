package io.eforge.enterprise.workflow.api;

import java.util.function.Supplier;

/** Business writes and workflow commands must both execute inside this boundary. */
public interface WorkflowUnitOfWork {
    /** Starts one master transaction. Unrelated pre-existing transactions are rejected, never silently suspended. */
    <T> T execute(Supplier<T> work);
}
