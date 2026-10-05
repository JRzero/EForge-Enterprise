package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import javax.lang.model.SourceVersion;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import io.eforge.enterprise.generator.service.GeneratorMetadataBoundary;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DuplicateKeyException;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.mapper.*;
import io.eforge.enterprise.system.mapper.SysMenuMapper;
import static io.eforge.enterprise.web.controller.api.v1.tool.GeneratorConfigurationContracts.*;

@Service
public class GeneratorConfigurationService {
    private final GeneratorMetadataBoundary boundary;
    private final GenTableMapper tables;
    private final GenTableColumnMapper columns;
    private final SysMenuMapper menus;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    public GeneratorConfigurationService(GenTableMapper tables,GenTableColumnMapper columns,SysMenuMapper menus,JdbcTemplate jdbc,ObjectMapper json,GeneratorMetadataBoundary boundary) {
        this.tables=tables;this.columns=columns;this.menus=menus;this.jdbc=jdbc;this.json=json;this.boundary=boundary;
    }
    @Transactional
    public void update(String id,UpdateRequest input,String actor) {
        long tableId=identifier(id);
        javaName(input.className());
        if(Set.of("var","yield","record","sealed","permits").contains(input.className()))throw invalid();
        if(!SourceVersion.isName(input.packageName()))throw invalid();
        boundary.lock();
        var locked=jdbc.queryForList("SELECT table_id FROM gen_table WHERE table_id=? FOR UPDATE",Long.class,tableId);
        if(locked.isEmpty())throw missing();
        var table=tables.selectGenTableById(tableId);if(table==null)throw missing();
        var owned=columns.selectGenTableColumnListByTableId(tableId);
        var byId=new HashMap<Long,GenTableColumn>();for(var field:owned)byId.put(field.getColumnId(),field);
        var seen=new HashSet<Long>();var javaFields=new HashSet<String>();
        for(var field:input.columns()) {
            var fieldId=identifier(field.id());
            if(!byId.containsKey(fieldId)||!seen.add(fieldId))throw new ApiFailure(409,"GENERATOR_COLUMN_MISMATCH","Fields do not match the selected table.");
            javaName(field.javaField());if(!javaFields.add(field.javaField()))throw invalid();
        }
        if(seen.size()!=byId.size())throw new ApiFailure(409,"GENERATOR_COLUMN_MISMATCH","The complete current field set is required.");
        // Physical column names/types/keys are retained from server metadata, never request fields.
        var physicalNames=new HashSet<String>();for(var field:owned)physicalNames.add(field.getColumnName());
        var options=input.options();
        if(input.category()==Category.tree) {
            for(var field:Arrays.asList(options.treeCode(),options.treeParentCode(),options.treeName()))
                if(field==null||!physicalNames.contains(field))throw new ApiFailure(400,"GENERATOR_TREE_FIELDS_INVALID","Tree fields must belong to this table.");
        }
        if(input.category()==Category.sub) {
            var child=tables.selectGenTableByName(input.subTableName());
            if(child==null||child.getTableId().equals(tableId)||child.getColumns()==null||child.getColumns().stream().noneMatch(c->Objects.equals(c.getColumnName(),input.subTableForeignKey())))
                throw new ApiFailure(400,"GENERATOR_SUBTABLE_INVALID","A distinct imported child table and its foreign key are required.");
        }
        if(!input.name().equals(table.getTableName())) {
            var existing=tables.selectGenTableByName(input.name());if(existing!=null)throw new ApiFailure(409,"GENERATOR_TABLE_ALREADY_IMPORTED","Target table is already imported.");
            var actual=tables.selectDbTableListByNames(new String[]{input.name()});
            if(actual.stream().noneMatch(t->input.name().equals(t.getTableName())))throw new ApiFailure(404,"GENERATOR_DATABASE_TABLE_NOT_FOUND","Target database table is unavailable.");
            var actualNames=new HashSet<String>();for(var field:columns.selectDbTableColumnsByName(input.name()))actualNames.add(field.getColumnName());
            if(!actualNames.equals(physicalNames))throw new ApiFailure(409,"GENERATOR_SCHEMA_CHANGED","Target schema must match the configured fields.");
        }
        var stored=new LinkedHashMap<String,Object>();
        stored.put("treeCode",options.treeCode());stored.put("treeParentCode",options.treeParentCode());stored.put("treeName",options.treeName());stored.put("genView",options.generateDetail());
        if(options.parentMenuId()!=null) {
            long parent=parentIdentifier(options.parentMenuId());stored.put("parentMenuId",Long.toString(parent));
            if(parent!=0){var menu=menus.selectMenuById(parent);if(menu==null||"F".equals(menu.getMenuType()))throw new ApiFailure(400,"GENERATOR_MENU_INVALID","Parent menu must exist and cannot be a function.");stored.put("parentMenuName",menu.getMenuName());}
        }
        try {table.setOptions(json.writeValueAsString(stored));}catch(com.fasterxml.jackson.core.JsonProcessingException impossible){throw new IllegalStateException(impossible);}
        var previousName=table.getTableName();
        table.setTableName(input.name());table.setTableComment(input.comment());table.setClassName(input.className());table.setTplCategory(input.category().name());table.setTplWebType("eforge-react");
        table.setPackageName(input.packageName());table.setModuleName(input.moduleName());table.setBusinessName(input.businessName());table.setFunctionName(input.functionName());table.setFunctionAuthor(input.author());
        table.setFormColNum(input.formColumns());table.setGenType(input.outputType());table.setGenPath(input.outputPath()==null||input.outputPath().isBlank()?"/":input.outputPath());table.setRemark(text(input.remark()));table.setUpdateBy(actor);
        table.setSubTableName(input.category()==Category.sub?input.subTableName():"");table.setSubTableFkName(input.category()==Category.sub?input.subTableForeignKey():"");
        try {
            if(tables.updateGenTable(table)!=1)throw failed();
            boundary.renameReferences(previousName,input.name(),actor);
            for(var edit:input.columns()) {
                var field=byId.get(identifier(edit.id()));field.setColumnComment(text(edit.comment()));field.setJavaType(edit.javaType().name());field.setJavaField(edit.javaField());
                field.setIsRequired(flag(edit.required()));field.setIsInsert(flag(edit.insertable()));field.setIsEdit(flag(edit.editable()));field.setIsList(flag(edit.listed()));field.setIsQuery(flag(edit.queryable()));
                field.setQueryType(edit.queryType().name());field.setHtmlType(edit.controlType().name());field.setDictType(text(edit.dictionaryType()));field.setSort(edit.order());field.setUpdateBy(actor);
                if(columns.updateGenTableColumn(field)!=1)throw failed();
            }
        }catch(DuplicateKeyException conflict){throw new ApiFailure(409,"GENERATOR_TABLE_ALREADY_IMPORTED","Target table is already imported.");}
    }
    private static String text(String value){return value==null?"":value;}
    private static String flag(boolean value){return value?"1":"0";}
    private static void javaName(String value){if(value==null||!SourceVersion.isIdentifier(value)||SourceVersion.isKeyword(value))throw invalid();}
    private static long identifier(String value){long id=parentIdentifier(value);if(id==0)throw invalid();return id;}
    private static long parentIdentifier(String value){try {long id=Long.parseLong(value);if(id>=0)return id;}catch(NumberFormatException ignored){}throw invalid();}
    private static ApiFailure invalid(){return new ApiFailure(400,"VALIDATION_ERROR","Generator names or identifiers are invalid.");}
    private static ApiFailure missing(){return new ApiFailure(404,"GENERATOR_TABLE_NOT_FOUND","Imported table does not exist.");}
    private static ApiFailure failed(){return new ApiFailure(500,"GENERATOR_CONFIGURATION_SAVE_FAILED","Generator configuration could not be saved.");}
}
