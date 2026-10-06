package io.eforge.enterprise.generator.rendering;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.*;
import org.springframework.dao.DataAccessException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.domain.GenTable;
import io.eforge.enterprise.generator.mapper.GenTableMapper;

/** Short consistent metadata read. Rendering and filesystem work run after this transaction. */
@Service
public class GeneratorRenderingSnapshotLoader {
    private final GenTableMapper tables;
    public GeneratorRenderingSnapshotLoader(GenTableMapper tables){this.tables=tables;}

    @PreAuthorize("@ss.hasAnyPermi('tool:gen:preview,tool:gen:code')")
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ,propagation=Propagation.REQUIRES_NEW)
    public List<GeneratorRenderingSnapshot> load(List<Long> ids) {
        if(ids==null||ids.isEmpty()||ids.size()>100||ids.stream().anyMatch(id->id==null||id<=0)
            ||new HashSet<>(ids).size()!=ids.size())
            throw new ApiFailure(400,"GENERATOR_SNAPSHOT_SELECTION_INVALID","Select distinct valid generator configurations.");
        try {
            var snapshots=new ArrayList<GeneratorRenderingSnapshot>();
            for(Long id:ids) {
                GenTable table=tables.selectGenTableById(id);
                if(table==null)throw new ApiFailure(404,"GENERATOR_TABLE_NOT_FOUND","The generator configuration does not exist.");
                attachKey(table);
                if(table.getSubTableName()!=null&&!table.getSubTableName().isBlank()) {
                    GenTable child=tables.selectGenTableByName(table.getSubTableName());
                    if(child==null)throw new ApiFailure(409,"GENERATOR_SUBTABLE_NOT_FOUND","An associated generator configuration is missing.");
                    attachKey(child);table.setSubTable(child);
                }
                snapshots.add(GeneratorRenderingSnapshot.capture(table));
            }
            return List.copyOf(snapshots);
        } catch(DataAccessException unavailable) {
            throw new ApiFailure(503,"GENERATOR_SNAPSHOT_UNAVAILABLE","Generator metadata cannot be read safely.");
        }
    }
    private void attachKey(GenTable table) {
        // The legacy LEFT JOIN maps table_id into an otherwise empty child row.
        // Keep only actual persisted fields before selecting the original key.
        if(table.getColumns()!=null) table.setColumns(table.getColumns().stream().filter(column->column.getColumnId()!=null).toList());
        if(table.getColumns()==null||table.getColumns().isEmpty())
            throw new ApiFailure(409,"GENERATOR_COLUMNS_MISSING","The generator configuration has no fields.");
        // Preserve the original explicit-key choice and first-column fallback.
        table.setPkColumn(table.getColumns().stream().filter(column->column.isPk()).findFirst().orElse(table.getColumns().get(0)));
    }
}
