package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.util.List;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class JobWriteContracts {
    private JobWriteContracts() {}
    public record JobWriteRequest(
        @NotBlank @Size(max=64) @Schema(requiredMode=REQUIRED) String name,
        @NotBlank @Size(max=64) @Schema(requiredMode=REQUIRED) String group,
        @NotBlank @Size(max=500) @Schema(requiredMode=REQUIRED) String invokeTarget,
        @NotBlank @Size(max=255) @Schema(requiredMode=REQUIRED) String cronExpression,
        @NotNull @Pattern(regexp="[0-3]") @Schema(requiredMode=REQUIRED,allowableValues={"0","1","2","3"}) String misfirePolicy,
        @NotNull @Schema(requiredMode=REQUIRED) Boolean concurrent,
        @NotNull @Pattern(regexp="[01]") @Schema(requiredMode=REQUIRED,allowableValues={"0","1"}) String status,
        @Size(max=500) String remark) {}
    public record JobStatusRequest(@NotNull @Pattern(regexp="[01]") @Schema(requiredMode=REQUIRED,allowableValues={"0","1"}) String status) {}
    public record JobDeleteRequest(@NotNull @Size(min=1,max=100) @Schema(requiredMode=REQUIRED) List<@NotBlank String> ids) {}
    public record JobCreatedResponse(@Schema(requiredMode=REQUIRED) String id) {}
}
