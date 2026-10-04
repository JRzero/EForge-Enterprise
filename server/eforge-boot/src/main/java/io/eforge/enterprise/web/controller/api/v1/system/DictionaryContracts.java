package io.eforge.enterprise.web.controller.api.v1.system;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;
import io.eforge.enterprise.common.core.domain.entity.SysDictType;
import io.eforge.enterprise.common.core.domain.entity.SysDictData;

public final class DictionaryContracts
{
    private DictionaryContracts() {}
    public enum TagStyle { DEFAULT, PRIMARY, SUCCESS, INFO, WARNING, DANGER }
    public record DictionaryRequest(@NotBlank @Size(max=100) String name,
            @NotBlank @Size(max=100) @Pattern(regexp="[a-z][a-z0-9_]*") String code,
            @NotNull @Pattern(regexp="[01]") String status, @Size(max=500) String remark) {}
    public record EntryRequest(@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String dictionaryId,
            @NotBlank @Size(max=100) String label, @NotBlank @Size(max=100) String value,
            @NotNull @Min(0) @Max(2147483647) Long sort, @NotNull TagStyle style,
            @Size(max=100) @Pattern(regexp="[a-zA-Z0-9_\\- ]*") String cssClass,
            @NotNull Boolean defaultEntry, @NotNull @Pattern(regexp="[01]") String status,
            @Size(max=500) String remark) {}
    public record DeleteDictionariesRequest(@NotEmpty @Size(max=100) List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> ids) {}
    public record DeleteDictionaryEntriesRequest(@NotEmpty @Size(max=100) List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> ids) {}
    public record DictionaryResponse(@Schema(requiredMode=REQUIRED) String id,@Schema(requiredMode=REQUIRED) String name,
            @Schema(requiredMode=REQUIRED) String code,@Schema(requiredMode=REQUIRED) String status,String remark,Instant createdAt)
    {
        static DictionaryResponse from(SysDictType row) {return new DictionaryResponse(row.getDictId().toString(),row.getDictName(),row.getDictType(),row.getStatus(),row.getRemark(),row.getCreateTime()==null?null:row.getCreateTime().toInstant());}
    }
    public record DictionaryTypeOption(@Schema(requiredMode=REQUIRED) String id,@Schema(requiredMode=REQUIRED) String name,
            @Schema(requiredMode=REQUIRED) String code,@Schema(requiredMode=REQUIRED) String status) {}
    public record DictionaryEntryResponse(@Schema(requiredMode=REQUIRED) String id,@Schema(requiredMode=REQUIRED) String dictionaryId,
            @Schema(requiredMode=REQUIRED) String dictionaryCode,@Schema(requiredMode=REQUIRED) String label,@Schema(requiredMode=REQUIRED) String value,
            @Schema(requiredMode=REQUIRED) Long sort,@Schema(requiredMode=REQUIRED) TagStyle style,String cssClass,
            @Schema(requiredMode=REQUIRED) boolean defaultEntry,@Schema(requiredMode=REQUIRED) String status,String remark,Instant createdAt)
    {
        static DictionaryEntryResponse from(SysDictData row,SysDictType type) {return new DictionaryEntryResponse(row.getDictCode().toString(),type.getDictId().toString(),row.getDictType(),row.getDictLabel(),row.getDictValue(),row.getDictSort(),tagStyle(row.getListClass()),row.getCssClass(),row.getDefault(),row.getStatus(),row.getRemark(),row.getCreateTime()==null?null:row.getCreateTime().toInstant());}
    }
    public record DictionaryValueOption(@Schema(requiredMode=REQUIRED) String value,@Schema(requiredMode=REQUIRED) String label,
            @Schema(requiredMode=REQUIRED) TagStyle style,String cssClass,@Schema(requiredMode=REQUIRED) boolean defaultEntry) {}
    static TagStyle tagStyle(String value) {if(value==null || value.isBlank()) return TagStyle.DEFAULT;try{return TagStyle.valueOf(value.toUpperCase(java.util.Locale.ROOT));}catch(IllegalArgumentException failure){return TagStyle.DEFAULT;}}
}
