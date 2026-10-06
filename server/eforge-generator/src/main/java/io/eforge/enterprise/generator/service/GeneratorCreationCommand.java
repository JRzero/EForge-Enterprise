package io.eforge.enterprise.generator.service;

import java.sql.*;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import io.eforge.enterprise.common.exception.ApiFailure;

/** Shared original/canonical admin action. Physical DDL never joins metadata transactions. */
@Service
public class GeneratorCreationCommand {
    public enum ImportState { IMPORTED, FAILED, UNATTEMPTED }
    public record Creation(List<GeneratorCreationExecution.Outcome> physical,ImportState importState,
                           List<GeneratorCreationMetadataImport.Imported> imported) {
        public Creation {physical=List.copyOf(physical);imported=List.copyOf(imported);}
    }
    public static final class Failure extends RuntimeException {
        private final int status;private final String code;private final Creation creation;
        public Failure(int status,String code,String detail,Creation creation){super(detail);this.status=status;this.code=code;this.creation=creation;}
        public int status(){return status;} public String code(){return code;} public Creation creation(){return creation;}
    }
    private final DataSource datasource;
    private final GeneratorCreationMetadataImport metadata;
    public GeneratorCreationCommand(DataSource datasource,GeneratorCreationMetadataImport metadata){this.datasource=datasource;this.metadata=metadata;}
    @PreAuthorize("@ss.hasRole('admin')")
    @Transactional(propagation=Propagation.NOT_SUPPORTED)
    public Creation create(String sql,String template) {
        if(sql==null||sql.isBlank()||sql.length()>65_536)throw new ApiFailure(400,"GENERATOR_CREATE_SQL_INVALID","The complete table creation batch is invalid.");
        GeneratorCreationMetadataImport.validateTemplate(template);
        GeneratorCreationExecution.Result physical=null;
        try(var connection=datasource.getConnection()) {
            physical=GeneratorCreationExecution.execute(connection,sql);
        } catch(SQLException unavailable) {
            // Close failure does not revoke already acknowledged statements.
            if(physical==null)throw new ApiFailure(503,"GENERATOR_CREATE_PREFLIGHT_UNAVAILABLE","Table creation could not inspect the database safely.");
        }
        if(!physical.allCreated()) {
            var failed=physical.tables().stream().filter(t->t.state()!=GeneratorCreationExecution.State.CREATED).findFirst().orElseThrow();
            int status=failed.state()==GeneratorCreationExecution.State.UNCONFIRMED||failed.state()==GeneratorCreationExecution.State.UNATTEMPTED?503
                :failed.code().equals("GENERATOR_CREATE_TARGET_EXISTS")?409:500;
            throw new Failure(status,failed.code(),"Physical creation did not complete. Review the retained table outcomes.",new Creation(physical.tables(),ImportState.UNATTEMPTED,List.of()));
        }
        try {
            return new Creation(physical.tables(),ImportState.IMPORTED,metadata.importCreated(physical,template));
        } catch(ApiFailure failedImport) {
            throw new Failure(failedImport.status(),failedImport.code(),failedImport.getMessage(),new Creation(physical.tables(),ImportState.FAILED,List.of()));
        } catch(org.springframework.security.access.AccessDeniedException denied) {
            throw new Failure(403,"ACCESS_DENIED","Metadata import is not allowed.",new Creation(physical.tables(),ImportState.FAILED,List.of()));
        } catch(RuntimeException failedImport) {
            throw new Failure(500,"GENERATOR_IMPORT_FAILED","Created table metadata could not be saved.",new Creation(physical.tables(),ImportState.FAILED,List.of()));
        }
    }
}