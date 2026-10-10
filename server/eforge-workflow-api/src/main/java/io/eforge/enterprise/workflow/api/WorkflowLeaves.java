package io.eforge.enterprise.workflow.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Feature-local leave example. Engine entities and caller-supplied identity are not HTTP contracts. */
public interface WorkflowLeaves {
    record Submit(String submissionId,LocalDate startDate,LocalDate endDate,String reason) { }
    record Leave(String id,String submissionId,String initiatorId,String releaseId,String processId,
        LocalDate startDate,LocalDate endDate,String reason,String status,long revision,Instant createdAt) { }
    record Task(String id,String key,String name,String assignee,boolean canHandle) { }
    record Event(String action,String actorId,String taskId,String comment,Instant createdAt) { }
    record Detail(Leave leave,List<Task> tasks,List<Event> history) {
        public Detail {tasks=List.copyOf(tasks);history=List.copyOf(history);}
    }
    record Command(String commandId,long expectedRevision,String taskId,String comment) { }
    record Page<T>(List<T> items,long total) {public Page{items=List.copyOf(items);}}
    record Pending(Leave leave,Task task,boolean canHandle) { }
    Page<Leave> mine(String actor,int page,int pageSize);
    Page<Leave> handled(String actor,int page,int pageSize);
    Page<Pending> pending(String actor,int page,int pageSize);
    Leave submit(Submit request,String actor);
    Detail get(String id,String actor);
    Leave claim(String id,Command command,String actor);
    Leave decide(String id,Command command,boolean approved,String actor);
    Leave withdraw(String id,Command command,String actor);
}
