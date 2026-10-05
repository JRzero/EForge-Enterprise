package io.eforge.enterprise.generator.service;

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
}
