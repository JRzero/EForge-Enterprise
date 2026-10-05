package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import io.eforge.enterprise.generator.service.GeneratorMetadataBoundary;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class GeneratorMetadataBoundaryTest {
    @Test void refusesAutocommitBeforeSql() {
        var jdbc=mock(JdbcTemplate.class);
        assertThrows(IllegalStateException.class,()->new GeneratorMetadataBoundary(jdbc).lock());
        verifyNoInteractions(jdbc);
    }
    @Test void referenceHelpersCannotRunWithoutTransaction() {
        var jdbc=mock(JdbcTemplate.class);var boundary=new GeneratorMetadataBoundary(jdbc);
        assertThrows(IllegalStateException.class,()->boundary.assertDeletionAllowed(new Long[]{1L}));
        assertThrows(IllegalStateException.class,()->boundary.renameReferences("a","b","editor"));
        verifyNoInteractions(jdbc);
    }
    @Test void missingGuardFailsClosedInsideTransaction() {
        var jdbc=mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString(),eq(Integer.class))).thenReturn(List.of());
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {assertThrows(IllegalStateException.class,()->new GeneratorMetadataBoundary(jdbc).lock());}
        finally {TransactionSynchronizationManager.setActualTransactionActive(false);}
    }
}
