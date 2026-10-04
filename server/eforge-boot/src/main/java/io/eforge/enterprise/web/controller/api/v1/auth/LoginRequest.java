package io.eforge.enterprise.web.controller.api.v1.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;

public record LoginRequest(
        @NotBlank @Size(max = 20) String username,
        @NotBlank @Size(max = 20) @Schema(accessMode = Schema.AccessMode.WRITE_ONLY) String password,
        @Size(max = 128) String code,
        @Size(max = 128) String uuid)
{
    @Override
    public String toString()
    {
        return "LoginRequest[credentials redacted]";
    }
}
