package io.eforge.enterprise.generator.service;

import java.util.*;
import java.util.stream.Collectors;
import com.alibaba.fastjson2.JSON;
import io.eforge.enterprise.common.constant.GenConstants;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.common.utils.StringUtils;
import io.eforge.enterprise.generator.domain.*;
import io.eforge.enterprise.generator.mapper.*;
import io.eforge.enterprise.generator.util.GenUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Schema synchronization derived from RuoYi's MIT-licensed original algorithm. */
@Service
public class GeneratorSynchronizationService {
    private final GeneratorMetadataBoundary boundary;
    private final GenTableMapper tables;
    private final GenTableColumnMapper columns;
    public GeneratorSynchronizationService(GeneratorMetadataBoundary boundary,GenTableMapper tables,GenTableColumnMapper columns){this.boundary=boundary;this.tables=tables;this.columns=columns;}
    @Transactional public void byId(String id,String actor) {
        long value;try{value=Long.parseLong(id);if(value<=0)throw new NumberFormatException();}catch(NumberFormatException invalid){throw new ApiFailure(400,"VALIDATION_ERROR","Invalid generator identifier.");}
        boundary.lock();synchronize(tables.selectGenTableById(value),actor);
    }
    @Transactional public void byName(String name,String actor) {boundary.lock();synchronize(tables.selectGenTableByName(name),actor);}
    private void synchronize(GenTable table,String actor) {
        if(table==null)throw new ApiFailure(404,"GENERATOR_TABLE_NOT_FOUND","Imported table does not exist.");
        var physical=columns.selectDbTableColumnsByName(table.getTableName());
        if(physical.isEmpty())throw new ApiFailure(409,"GENERATOR_SCHEMA_UNAVAILABLE","Physical table schema is unavailable.");
        var names=physical.stream().map(GenTableColumn::getColumnName).collect(Collectors.toSet());
        if(GenConstants.TPL_TREE.equals(table.getTplCategory())) {
            com.alibaba.fastjson2.JSONObject options;
            try{options=JSON.parseObject(table.getOptions());}catch(RuntimeException invalid){throw new ApiFailure(409,"GENERATOR_CONFIGURATION_INVALID","Stored tree configuration is invalid.");}
            for(var key:List.of(GenConstants.TREE_CODE,GenConstants.TREE_PARENT_CODE,GenConstants.TREE_NAME))
                if(options==null||!names.contains(options.getString(key)))throw referenced();
        }
        for(var parent:tables.selectGenTableAll())
            if(Objects.equals(table.getTableName(),parent.getSubTableName())&&!names.contains(parent.getSubTableFkName()))throw referenced();
        var previous=columns.selectGenTableColumnListByTableId(table.getTableId());
        var byName=previous.stream().collect(Collectors.toMap(GenTableColumn::getColumnName,field->field));
        for(var field:physical) {
            field.setIsEdit("0");field.setIsList("0");field.setIsQuery("0");field.setDictType("");
            GenUtils.initColumnField(field,table);
            var old=byName.get(field.getColumnName());
            if(old!=null) {
                field.setColumnId(old.getColumnId());
                // Preserve the original conditional query/dictionary and required/control behavior.
                if(field.isList()){field.setDictType(old.getDictType());field.setQueryType(old.getQueryType());}
                if(StringUtils.isNotEmpty(old.getIsRequired())&&!field.isPk()&&(field.isInsert()||field.isEdit())&&(field.isUsableColumn()||!field.isSuperColumn())){field.setIsRequired(old.getIsRequired());field.setHtmlType(old.getHtmlType());}
                field.setUpdateBy(actor);
                if(columns.updateGenTableColumn(field)!=1||columns.updatePhysicalIdentity(field)!=1)throw failed();
            } else {
                field.setCreateBy(actor);
                if(columns.insertGenTableColumn(field)!=1)throw failed();
            }
        }
        var removed=previous.stream().filter(field->!names.contains(field.getColumnName())).toList();
        if(!removed.isEmpty()&&columns.deleteGenTableColumns(removed)!=removed.size())throw failed();
    }
    private static ApiFailure referenced(){return new ApiFailure(409,"GENERATOR_SCHEMA_REFERENCED","Schema changes would remove a configured tree or child reference field.");}
    private static ApiFailure failed(){return new ApiFailure(500,"GENERATOR_SYNCHRONIZATION_FAILED","Generator schema could not be synchronized.");}
}
