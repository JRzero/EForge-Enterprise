package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.*;
import java.time.LocalDate;
import com.fasterxml.jackson.databind.*;
import com.github.pagehelper.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import io.eforge.enterprise.generator.domain.GenTable;
import io.eforge.enterprise.generator.mapper.*;
import io.eforge.enterprise.common.exception.ApiFailure;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.tool.GeneratorReadContracts.*;

/** Compatibility mapper objects never leave this canonical projection boundary. */
@Service
public class GeneratorReadService {
    private final GenTableMapper tables;
    private final GenTableColumnMapper columns;
    private final ObjectMapper json;
    public GeneratorReadService(GenTableMapper tables,GenTableColumnMapper columns,ObjectMapper json){this.tables=tables;this.columns=columns;this.json=json;}
    public PageResponse<TableSummary> list(TableQuery query) {
        var filter=filter(query);int page=page(query),size=size(query);
        try {PageHelper.startPage(page,size,order(query,false));var rows=tables.selectGenTableList(filter);
            return new PageResponse<>(rows.stream().map(TableSummary::from).toList(),new PageInfo<>(rows).getTotal(),page,size);
        } finally {PageHelper.clearPage();}
    }
    public PageResponse<DatabaseTable> database(TableQuery query) {
        var filter=filter(query);int page=page(query),size=size(query);
        try {PageHelper.startPage(page,size,order(query,true));var rows=tables.selectDbTableList(filter);
            return new PageResponse<>(rows.stream().map(DatabaseTable::from).toList(),new PageInfo<>(rows).getTotal(),page,size);
        } finally {PageHelper.clearPage();}
    }
    @Transactional(readOnly=true)
    public TableDetail detail(String id) {
        var table=require(identifier(id));
        var config=new Configuration(table.getPackageName(),table.getModuleName(),table.getBusinessName(),table.getFunctionName(),table.getFunctionAuthor(),table.getFormColNum(),table.getGenType(),table.getGenPath(),table.getSubTableName(),table.getSubTableFkName(),table.getRemark(),options(table.getOptions()));
        var choices=tables.selectGenTableAll().stream().sorted(Comparator.comparing(GenTable::getTableName).thenComparing(GenTable::getTableId))
            .map(row->new TableChoice(row.getTableId().toString(),row.getTableName(),row.getTableComment(),project(row.getColumns(),row.getTableId()))).toList();
        return new TableDetail(TableSummary.from(table),config,columns(table.getTableId()),choices);
    }
    @Transactional(readOnly=true)
    public List<ColumnResponse> columns(String id){return columns(require(identifier(id)).getTableId());}
    private List<ColumnResponse> columns(Long id){return project(columns.selectGenTableColumnListByTableId(id),id);}
    private static List<ColumnResponse> project(List<io.eforge.enterprise.generator.domain.GenTableColumn> rows,Long id) {
        if(rows==null)return List.of();
        return rows.stream().sorted(Comparator.comparing(io.eforge.enterprise.generator.domain.GenTableColumn::getSort,Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(io.eforge.enterprise.generator.domain.GenTableColumn::getColumnId,Comparator.nullsLast(Comparator.naturalOrder())))
            .map(row->ColumnResponse.from(row,id)).toList();
    }
    private GenTable require(Long id){var row=tables.selectGenTableById(id);if(row==null)throw new ApiFailure(404,"GENERATOR_TABLE_NOT_FOUND","Imported table does not exist.");return row;}
    private Options options(String raw) {
        if(raw==null||raw.isBlank())return new Options(null,null,null,null,null,false);
        try {var node=json.readTree(raw);if(!node.isObject())throw new IllegalArgumentException();
            var parent=node.get("parentMenuId");String parentId=null;
            if(parent!=null&&!parent.isNull()&&!parent.asText().isBlank()) {long value=Long.parseLong(parent.asText());if(value<0)throw new IllegalArgumentException();parentId=Long.toString(value);}
            return new Options(text(node,"treeCode"),text(node,"treeParentCode"),text(node,"treeName"),parentId,text(node,"parentMenuName"),node.path("genView").asBoolean()||"1".equals(node.path("genView").asText()));
        } catch(Exception invalid){throw new ApiFailure(500,"GENERATOR_CONFIGURATION_INVALID","Stored generator configuration is invalid.");}
    }
    private static String text(JsonNode node,String field){var value=node.get(field);return value==null||value.isNull()?null:value.asText();}
    private static Long identifier(String id){try {long value=Long.parseLong(id);if(value>0)return value;}catch(NumberFormatException|NullPointerException ignored){}throw new ApiFailure(400,"VALIDATION_ERROR","Invalid generator table identifier.");}
    private static int page(TableQuery query){return query.page()==null?1:query.page();}
    private static int size(TableQuery query){return query.pageSize()==null?10:query.pageSize();}
    static String order(TableQuery query,boolean database){String field=query.sort()==null?"create_time":switch(query.sort()){case name->"table_name";case comment->"table_comment";case createdAt->"create_time";case updatedAt->"update_time";};return field+" "+(query.direction()==null?"desc":query.direction().name())+", "+(database?"table_name":"table_id")+" asc";}
    private static GenTable filter(TableQuery query) {
        for(var date:new LocalDate[]{query.from(),query.to()})if(date!=null&&(date.getYear()<1000||date.getYear()>9999))throw new ApiFailure(400,"VALIDATION_ERROR","Date is outside SQL calendar bounds.");
        if(query.from()!=null&&query.to()!=null&&query.from().isAfter(query.to()))throw new ApiFailure(400,"VALIDATION_ERROR","Start date is after end date.");
        var filter=new GenTable();filter.setTableName(query.name());filter.setTableComment(query.comment());
        if(query.from()!=null)filter.getParams().put("beginTime",query.from().toString());if(query.to()!=null)filter.getParams().put("endTime",query.to().toString());return filter;
    }
}
