package io.eforge.enterprise.web.controller.api.v1.auth;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import io.swagger.v3.oas.annotations.media.Schema;
public record RegistrationRequest(
        @NotBlank @Size(min=2,max=20) String username,
        @NotBlank @Size(min=5,max=20) @Pattern(regexp="^[^<>\"'|\\\\]+$")
        @Schema(accessMode=Schema.AccessMode.WRITE_ONLY) String password,
        @NotBlank @Size(min=5,max=20) @Schema(accessMode=Schema.AccessMode.WRITE_ONLY) String confirmPassword,
        @Size(max=128) @Schema(accessMode=Schema.AccessMode.WRITE_ONLY) String code,
        @Size(max=128) @Schema(accessMode=Schema.AccessMode.WRITE_ONLY) String uuid) {}
