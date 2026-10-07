package io.eforge.enterprise.web.controller.api.v1.auth;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record UnlockScreenRequest(
    @NotBlank @Size(max=20) @JsonProperty(access=JsonProperty.Access.WRITE_ONLY)
    @Schema(accessMode=Schema.AccessMode.WRITE_ONLY) String password) {
    @Override public String toString(){return "UnlockScreenRequest[credentials redacted]";}
}
