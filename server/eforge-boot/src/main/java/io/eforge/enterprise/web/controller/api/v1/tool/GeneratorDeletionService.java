package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.mapper.*;
import io.eforge.enterprise.generator.service.GeneratorMetadataBoundary;

@Service
public class GeneratorDeletionService {
    private final GenTableMapper tables;
    private final GenTableColumnMapper columns;
    private final GeneratorMetadataBoundary boundary;
    public GeneratorDeletionService(GenTableMapper tables,GenTableColumnMapper columns,GeneratorMetadataBoundary boundary){this.tables=tables;this.columns=columns;this.boundary=boundary;}
    @Transactional
    public void delete(List<String> ids) {
        Long[] selected=ids.stream().map(GeneratorDeletionService::identifier).distinct().toArray(Long[]::new);
        boundary.lock();boundary.assertDeletionAllowed(selected);
        tables.deleteGenTableByIds(selected);columns.deleteGenTableColumnByIds(selected);
    }
    private static Long identifier(String id){try{long value=Long.parseLong(id);if(value>0)return value;}catch(NumberFormatException ignored){}throw new ApiFailure(400,"VALIDATION_ERROR","Invalid generator identifier.");}
}
