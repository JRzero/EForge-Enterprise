package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.List;
import jakarta.validation.Valid;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

/** Canonical configuration input: physical identities and audit actors are not editable fields. */
public final class GeneratorConfigurationContracts {
    private GeneratorConfigurationContracts() {}
    public enum Category {crud,tree,sub}
    public enum JavaType {Long,String,Integer,Double,BigDecimal,Date,Boolean}
    public enum QueryType {EQ,NE,GT,GTE,LT,LTE,LIKE,BETWEEN}
    public enum ControlType {input,textarea,select,radio,checkbox,datetime,imageUpload,fileUpload,editor}
    @Schema(name="GeneratorConfigurationOptions")
    public record Options(@Size(max=64) String treeCode,@Size(max=64) String treeParentCode,
        @Size(max=64) String treeName,@Pattern(regexp="0|[1-9][0-9]{0,18}") String parentMenuId,
        @NotNull Boolean generateDetail) {}
    @Schema(name="GeneratorFieldUpdate")
    public record Field(@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String id,
        @Size(max=500) String comment,@NotNull JavaType javaType,@NotBlank @Size(max=200) String javaField,
        @NotNull Boolean required,@NotNull Boolean insertable,@NotNull Boolean editable,
        @NotNull Boolean listed,@NotNull Boolean queryable,@NotNull QueryType queryType,
        @NotNull ControlType controlType,@Size(max=200) String dictionaryType,
        @NotNull @Min(0) @Max(1000000) Integer order) {}
    @Schema(name="GeneratorConfigurationUpdate")
    public record UpdateRequest(@NotBlank @Size(max=64) String name,
        @NotBlank @Size(max=500) String comment,@NotBlank @Size(max=100) String className,
        @NotNull Category category,@NotBlank @Size(max=100) String packageName,
        @NotBlank @Size(max=30) String moduleName,@NotBlank @Size(max=30) String businessName,
        @NotBlank @Size(max=50) String functionName,@NotBlank @Size(max=50) String author,
        @NotNull @Min(1) @Max(3) Integer formColumns,@NotNull @Pattern(regexp="[01]") String outputType,
        @Size(max=200) String outputPath,@Size(max=64) String subTableName,
        @Size(max=64) String subTableForeignKey,@Size(max=500) String remark,
        @NotNull @Valid Options options,@NotNull @Size(min=1,max=4096) List<@NotNull @Valid Field> columns) {}
}
