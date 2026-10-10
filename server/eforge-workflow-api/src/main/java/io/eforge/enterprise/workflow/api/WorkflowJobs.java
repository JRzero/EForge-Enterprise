package io.eforge.enterprise.workflow.api;

import java.time.Instant;
import java.util.List;

/** Operations return safe metadata; engine exceptions and variables are never exposed. */
public interface WorkflowJobs {
    record Failed(String id,String processId,String releaseId,String leaveId,String elementId,int retries,Instant createdAt) { }
    record Page(List<Failed> items,long total,boolean recoveryEnabled){public Page{items=List.copyOf(items);}}
    record Retry(String commandId,String leaveId) { }
    record Queued(String commandId,String originalJobId,String queuedJobId,String status) { }
    Page failed(String releaseId,int page,int size);
    Queued retry(String jobId,Retry command,String actor);
}
