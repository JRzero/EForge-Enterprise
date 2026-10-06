package io.eforge.enterprise.web.controller.api.v1.tool;

import java.time.*;
import java.util.*;
import jakarta.validation.constraints.*;
import org.springframework.format.annotation.DateTimeFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.generator.domain.*;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class GeneratorReadContracts {
    private GeneratorReadContracts() {}
    public enum Sort {name,comment,createdAt,updatedAt}
    public enum Direction {asc,desc}
    public record TableQuery(@Min(1) @Max(1000000) @Schema(defaultValue="1") Integer page,
        @Min(1) @Max(100) @Schema(defaultValue="10") Integer pageSize,
        @Size(max=64) String name,@Size(max=500) String comment,
        @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate from,
        @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate to,Sort sort,Direction direction) {}
    public record TableSummary(@Schema(requiredMode=REQUIRED) String id,String name,String comment,
        String className,String category,String webType,Instant createdAt,Instant updatedAt,String outputType) {
        static TableSummary from(GenTable row){return new TableSummary(identifierText(row.getTableId()),row.getTableName(),row.getTableComment(),row.getClassName(),row.getTplCategory(),row.getTplWebType(),instant(row.getCreateTime()),instant(row.getUpdateTime()),row.getGenType());}
    }
    public record DatabaseTable(@Schema(requiredMode=REQUIRED) String name,String comment,Instant createdAt,Instant updatedAt) {
        static DatabaseTable from(GenTable row){return new DatabaseTable(row.getTableName(),row.getTableComment(),instant(row.getCreateTime()),instant(row.getUpdateTime()));}
    }
    public record ColumnResponse(@Schema(requiredMode=REQUIRED) String id,String tableId,String name,String comment,
        String databaseType,String javaType,String javaField,boolean primaryKey,boolean autoIncrement,
        boolean required,boolean insertable,boolean editable,boolean listed,boolean queryable,
        String queryType,String controlType,String dictionaryType,Integer order) {
        static ColumnResponse from(GenTableColumn row,Long tableId){return new ColumnResponse(identifierText(row.getColumnId()),identifierText(row.getTableId()==null?tableId:row.getTableId()),row.getColumnName(),row.getColumnComment(),row.getColumnType(),row.getJavaType(),row.getJavaField(),row.isPk(),row.isIncrement(),row.isRequired(),row.isInsert(),row.isEdit(),row.isList(),row.isQuery(),row.getQueryType(),row.getHtmlType(),row.getDictType(),row.getSort());}
    }
    public record MenuChoice(@Schema(requiredMode=REQUIRED) String id,@Schema(requiredMode=REQUIRED) String parentId,@Schema(requiredMode=REQUIRED) String name,@Schema(requiredMode=REQUIRED) String kind) {}
    public record Options(String treeCode,String treeParentCode,String treeName,String parentMenuId,String parentMenuName,boolean generateDetail) {}
    public record Configuration(String packageName,String moduleName,String businessName,String functionName,String author,
        Integer formColumns,String outputType,String outputPath,String subTableName,String subTableForeignKey,String remark,
        @Schema(requiredMode=REQUIRED) Options options) {}
    public record TableChoice(@Schema(requiredMode=REQUIRED) String id,String name,String comment,
        @Schema(requiredMode=REQUIRED) List<ColumnResponse> columns) {}
    public record TableDetail(@Schema(requiredMode=REQUIRED) TableSummary table,@Schema(requiredMode=REQUIRED) Configuration configuration,
        @Schema(requiredMode=REQUIRED) List<ColumnResponse> columns,@Schema(requiredMode=REQUIRED) List<TableChoice> tables) {}
    static String identifierText(Long value){return value==null?null:value.toString();}
    static Instant instant(Date value){return value==null?null:value.toInstant();}
}
