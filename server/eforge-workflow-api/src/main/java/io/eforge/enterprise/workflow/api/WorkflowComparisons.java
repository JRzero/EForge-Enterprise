package io.eforge.enterprise.workflow.api;

import java.util.List;

/** A content comparison, not a proof that two process graphs behave equivalently. */
public interface WorkflowComparisons {
    record Version(String kind,String id,long revision,String contentDigest) { }
    record Field(String name,String before,String after,boolean changed) { }
    record Comparison(String packageId,Version baseline,Version target,List<Field> fields) {
        public Comparison {fields=List.copyOf(fields);}
    }
    /** A null target selects the current draft; both release IDs must belong to this package. */
    Comparison compare(String packageId,String baselineReleaseId,String targetReleaseId);
}
