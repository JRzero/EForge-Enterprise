package io.eforge.enterprise.web.api.v1;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password,
        String code,
        String uuid)
{
}
