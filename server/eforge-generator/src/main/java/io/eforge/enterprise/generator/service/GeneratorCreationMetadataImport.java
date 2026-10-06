package io.eforge.enterprise.generator.service;

import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.SecurityUtils;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.mapper.*;
import io.eforge.enterprise.generator.util.GenUtils;

/** Separate checked metadata phase; never executes or compensates physical DDL. */
@Service
public class GeneratorCreationMetadataImport {
    private final JdbcTemplate jdbc;
    private final GeneratorMetadataBoundary boundary;
    private final GenTableMapper tables;
    private final GenTableColumnMapper columns;
    private static final Set<String> TEMPLATES=Set.of("element-ui","element-plus","element-plus-typescript","eforge-react");
    public record Imported(String requestedName,String actualName,String id,int columnCount) {}
    public GeneratorCreationMetadataImport(JdbcTemplate jdbc,GeneratorMetadataBoundary boundary,GenTableMapper tables,GenTableColumnMapper columns) {
        this.jdbc=jdbc;this.boundary=boundary;this.tables=tables;this.columns=columns;
    }
    @PreAuthorize("@ss.hasRole('admin')")
    @Transactional(propagation=Propagation.REQUIRES_NEW,rollbackFor=Exception.class)
    public List<Imported> importCreated(GeneratorCreationExecution.Result physical,String template) {
        if(physical==null||!physical.allCreated()||physical.tables().size()>100)
            throw new ApiFailure(409,"GENERATOR_CREATE_IMPORT_NOT_READY","Only a fully acknowledged physical batch can be imported.");
        if(template==null||!TEMPLATES.contains(template))throw new ApiFailure(400,"VALIDATION_ERROR","Select a supported generator template.");
        String actor=SecurityUtils.getUsername();
        try {
            boundary.lock();
            int mode=Objects.requireNonNull(jdbc.queryForObject("SELECT @@lower_case_table_names",Integer.class));
            var selected=new LinkedHashMap<String,GenTable>();
            var fields=new LinkedHashMap<String,List<GenTableColumn>>();
            for(var outcome:physical.tables()) {
                String actual=mode==0?outcome.name():jdbc.queryForObject("SELECT LOWER(CONVERT(? USING utf8mb3) COLLATE utf8mb3_general_ci)",String.class,outcome.name());
                var physicalRows=jdbc.query("SELECT TABLE_NAME,TABLE_COMMENT FROM information_schema.TABLES WHERE BINARY TABLE_SCHEMA=BINARY DATABASE() AND BINARY TABLE_NAME=BINARY ? AND TABLE_TYPE='BASE TABLE'",(rs,index)->{
                    var row=new GenTable();row.setTableName(rs.getString(1));row.setTableComment(rs.getString(2));return row;
                },actual);
                if(physicalRows.size()!=1||selected.containsKey(actual))throw schemaChanged();
                var row=physicalRows.get(0);
                if(tables.selectGenTableByName(actual)!=null)throw conflict();
                var physicalFields=jdbc.query("SELECT COLUMN_NAME,COLUMN_TYPE,COLUMN_COMMENT,IS_NULLABLE,COLUMN_KEY,EXTRA,ORDINAL_POSITION FROM information_schema.COLUMNS WHERE BINARY TABLE_SCHEMA=BINARY DATABASE() AND BINARY TABLE_NAME=BINARY ? ORDER BY ORDINAL_POSITION",(rs,index)->{
                    var field=new GenTableColumn();field.setColumnName(rs.getString(1));field.setColumnType(rs.getString(2));field.setColumnComment(rs.getString(3));
                    boolean primary="PRI".equals(rs.getString(5));field.setIsPk(primary?"1":"0");field.setIsRequired("NO".equals(rs.getString(4))&&!primary?"1":"0");
                    field.setIsIncrement(rs.getString(6).contains("auto_increment")?"1":"0");field.setSort(rs.getInt(7));return field;
                },actual);
                if(physicalFields.isEmpty())throw schemaChanged();
                selected.put(actual,row);fields.put(actual,physicalFields);
            }
            var result=new ArrayList<Imported>();int requestIndex=0;
            for(var entry:selected.entrySet()) {
                var row=entry.getValue();GenUtils.initTable(row,actor);row.setTplWebType(template);
                if(tables.insertGenTable(row)!=1||row.getTableId()==null)throw writeFailed();
                for(var field:fields.get(entry.getKey())) {
                    GenUtils.initColumnField(field,row);
                    if(columns.insertGenTableColumn(field)!=1||field.getColumnId()==null)throw writeFailed();
                }
                result.add(new Imported(physical.tables().get(requestIndex++).name(),row.getTableName(),row.getTableId().toString(),fields.get(entry.getKey()).size()));
            }
            return List.copyOf(result);
        } catch(DuplicateKeyException duplicate){throw conflict();}
        catch(DataAccessException unavailable){throw writeFailed();}
    }
    private static ApiFailure schemaChanged(){return new ApiFailure(409,"GENERATOR_SCHEMA_CHANGED","Created table metadata is unavailable or changed.");}
    private static ApiFailure conflict(){return new ApiFailure(409,"GENERATOR_TABLE_ALREADY_IMPORTED","Created table metadata is already imported.");}
    private static ApiFailure writeFailed(){return new ApiFailure(500,"GENERATOR_IMPORT_FAILED","Created table metadata could not be saved.");}
}