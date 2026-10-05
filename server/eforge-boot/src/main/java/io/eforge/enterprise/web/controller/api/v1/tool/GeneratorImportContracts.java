package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.List;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class GeneratorImportContracts {
    private GeneratorImportContracts() {}
    public record ImportRequest(@NotNull @Size(min=1,max=100)
        List<@NotBlank @Size(max=64) String> names) {}
    public record ImportedTable(@Schema(requiredMode=REQUIRED) String id,
        @Schema(requiredMode=REQUIRED) String name,int columnCount) {}
    public record ImportResponse(@Schema(requiredMode=REQUIRED) List<ImportedTable> tables) {}
}
