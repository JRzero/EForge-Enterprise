package io.eforge.enterprise.workflow.api;

import java.time.Instant;
import java.util.List;

/** Immutable deployment references; activation selects the definition for future submissions only. */
public interface WorkflowReleases {
    record Release(String id, String packageId, long packageRevision, String name, String businessType,
        String contentDigest, String processDefinitionId, Instant publishedAt) { }
    record Activation(String businessType, String releaseId, long revision) { }
    record Page(List<Release> items,long total) {public Page {items=List.copyOf(items);}}
    Release publish(String packageId, long expectedRevision, String actor);
    Release get(String id);
    Page list(String packageId,int page,int pageSize);
    Activation activation(String businessType);
    Activation activate(String businessType, String releaseId, long expectedRevision, String actor);
}
