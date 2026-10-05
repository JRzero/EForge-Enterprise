package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DuplicateKeyException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.mapper.*;
import io.eforge.enterprise.generator.util.GenUtils;
import static io.eforge.enterprise.web.controller.api.v1.tool.GeneratorImportContracts.*;

/** Original attributed initializers/mappers stay inside this metadata boundary. */
@Service
public class GeneratorImportService {
    private final GenTableMapper tables;
    private final GenTableColumnMapper columns;
    public GeneratorImportService(GenTableMapper tables,GenTableColumnMapper columns) {
        this.tables=tables;this.columns=columns;
    }
    @Transactional
    public ImportResponse importTables(ImportRequest request,String actor) {
        var names=request.names();
        var unique=new HashSet<String>();
        for(var name:names) if(!unique.add(name.toLowerCase(Locale.ROOT)))
            throw new ApiFailure(400,"VALIDATION_ERROR","Duplicate import selection.");
        var available=tables.selectDbTableListByNames(names.toArray(String[]::new));
        var byName=new HashMap<String,GenTable>();
        for(var row:available)byName.put(row.getTableName(),row);
        // Validate every selected table and its live schema before the first write.
        var selected=new LinkedHashMap<GenTable,List<GenTableColumn>>();
        for(var name:names) {
            var row=byName.get(name);
            if(row==null)throw new ApiFailure(404,"GENERATOR_DATABASE_TABLE_NOT_FOUND","Selected database table is unavailable.");
            if(tables.selectGenTableByName(name)!=null)throw alreadyImported();
            var fields=columns.selectDbTableColumnsByName(name);
            if(fields==null||fields.isEmpty())throw new ApiFailure(409,"GENERATOR_SCHEMA_CHANGED","Selected database table has no available fields.");
            selected.put(row,fields);
        }
        var result=new ArrayList<ImportedTable>();
        try {
            for(var entry:selected.entrySet()) {
                var row=entry.getKey();GenUtils.initTable(row,actor);
                row.setTplWebType("eforge-react");
                if(tables.insertGenTable(row)!=1||row.getTableId()==null)throw writeFailed();
                for(var field:entry.getValue()) {
                    GenUtils.initColumnField(field,row);
                    if(columns.insertGenTableColumn(field)!=1)throw writeFailed();
                }
                result.add(new ImportedTable(row.getTableId().toString(),row.getTableName(),entry.getValue().size()));
            }
        } catch(DuplicateKeyException conflict) {throw alreadyImported();}
        return new ImportResponse(List.copyOf(result));
    }
    private static ApiFailure alreadyImported(){return new ApiFailure(409,"GENERATOR_TABLE_ALREADY_IMPORTED","Selected table is already imported.");}
    private static ApiFailure writeFailed(){return new ApiFailure(500,"GENERATOR_IMPORT_FAILED","Generator metadata could not be saved.");}
}
