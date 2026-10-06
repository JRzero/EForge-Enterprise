package io.eforge.enterprise.web.controller.api.v1.tool;

import java.util.List;
import jakarta.validation.constraints.*;

public final class GeneratorOutputContracts {
    private GeneratorOutputContracts() {}
    public record OutputFile(String template, String path, String content) {}
    public record PreviewResponse(String tableId, String generationDate, List<OutputFile> files) {}
    public record DownloadRequest(@NotNull @Size(min=1,max=100) List<@NotBlank @Pattern(regexp="[1-9][0-9]{0,18}") String> tableIds) {}
}