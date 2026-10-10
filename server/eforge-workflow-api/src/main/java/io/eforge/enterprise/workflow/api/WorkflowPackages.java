package io.eforge.enterprise.workflow.api;

import java.util.List;
import java.time.Instant;

/** Versioned, engine-independent workflow package maintenance. Actor is supplied by authentication. */
public interface WorkflowPackages {
    record Edit(String name, String businessType, WorkflowValidation.Request source) { }
    record Draft(String id, String name, String businessType, long revision, String contentDigest,
        Long validatedRevision, WorkflowValidation.Request source, Instant updatedAt) { }
    record Summary(String id, String name, String businessType, long revision, Long validatedRevision, Instant updatedAt) { }
    record Page(List<Summary> items, long total) { public Page { items = List.copyOf(items); } }
    Draft create(Edit edit, String actor);
    Draft update(String id, long expectedRevision, Edit edit, String actor);
    Draft get(String id);
    Page list(int page, int pageSize);
    Draft validate(String id, long expectedRevision, String actor);
}
