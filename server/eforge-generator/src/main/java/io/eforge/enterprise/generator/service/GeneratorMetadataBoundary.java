package io.eforge.enterprise.generator.service;

import java.util.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Local SQL transaction boundary for generator metadata only; no scheduler/runtime gate. */
@Component
public class GeneratorMetadataBoundary {
    private final JdbcTemplate jdbc;
    public GeneratorMetadataBoundary(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public void lock() {
        if(!TransactionSynchronizationManager.isActualTransactionActive())
            throw new IllegalStateException("Generator metadata requires an active transaction.");
        var guards=jdbc.queryForList("SELECT guard_id FROM gen_metadata_guard WHERE guard_id=1 FOR UPDATE",Integer.class);
        if(guards.size()!=1)throw new IllegalStateException("Generator metadata boundary is unavailable.");
    }
    public void assertDeletionAllowed(Long[] ids) {
        if(ids==null||ids.length==0)throw new ApiFailure(400,"VALIDATION_ERROR","Select generator resources.");
        lock();
        var selected=new LinkedHashSet<Long>(Arrays.asList(ids));
        var marks=String.join(",",Collections.nCopies(selected.size(),"?"));
        var names=jdbc.queryForList("SELECT table_name FROM gen_table WHERE table_id IN ("+marks+")",String.class,selected.toArray());
        if(names.isEmpty())return;
        var args=new ArrayList<Object>(names);args.addAll(selected);
        var references=jdbc.queryForObject("SELECT COUNT(*) FROM gen_table WHERE sub_table_name IN ("+String.join(",",Collections.nCopies(names.size(),"?"))+") AND table_id NOT IN ("+marks+")",Integer.class,args.toArray());
        if(references==null)throw new IllegalStateException("Generator references could not be checked.");
        if(references>0)throw new ApiFailure(409,"GENERATOR_TABLE_REFERENCED","Selected metadata is referenced by another generator table.");
    }
    public void renameReferences(String previous,String replacement,String actor) {
        if(!Objects.equals(previous,replacement)) {
            lock();
            jdbc.update("UPDATE gen_table SET sub_table_name=?, update_by=?, update_time=SYSDATE() WHERE sub_table_name=?",replacement,actor,previous);
        }
    }
}
