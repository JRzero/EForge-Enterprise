package io.eforge.enterprise.workflow.api;

import java.time.Instant;
import java.util.List;

/** Feature-local purchase contracts, independent of Flowable persistence entities. */
public interface WorkflowPurchases {
    record ItemInput(String id, String name, String unit, String quantity, String unitPrice) { }
    record Edit(String title, String reason, String approverId, List<ItemInput> items) { }
    record Item(String id, String name, String unit, String quantity, String unitPrice, String amount) { }
    record Purchase(String id, String initiatorId, String approverId, String title, String reason,
        String total, String status, long revision, String processId, String releaseId, Instant createdAt) { }
    record Event(String action, String actorId, String comment, Instant createdAt) { }
    record Approver(String id,String name) { }
    record Attachment(String id,String name,long size) { }
    record Download(Attachment attachment,byte[] content) {
        public Download { content=content.clone(); }
        @Override public byte[] content(){return content.clone();}
    }
    record Detail(Purchase purchase, List<Item> items, List<Event> history) {
        public Detail { items=List.copyOf(items); history=List.copyOf(history); }
    }
    record Page<T>(List<T> items, long total) { public Page { items=List.copyOf(items); } }
    record Command(String commandId, long expectedRevision, String comment) { }
    Purchase create(String commandId, Edit edit, String actor);
    Purchase update(String id, Command command, Edit edit, String actor);
    Detail get(String id, String actor);
    Page<Purchase> list(String view, String status, int page, int size, String actor);
    Purchase submit(String id, Command command, String actor);
    Purchase decide(String id, Command command, boolean approved, String actor);
    Purchase withdraw(String id, Command command, String actor);
    Page<Approver> approvers(String query,int page,int size,String actor);
    List<Attachment> attachments(String id,String actor);
    Download download(String id,String attachmentId,String actor);
    Purchase upload(String id,Command command,String name,byte[] content,String actor);
    Purchase removeAttachment(String id,String attachmentId,Command command,String actor);
}
