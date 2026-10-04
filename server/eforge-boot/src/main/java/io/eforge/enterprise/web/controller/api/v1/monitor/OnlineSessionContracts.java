package io.eforge.enterprise.web.controller.api.v1.monitor;

import java.time.Instant;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public final class OnlineSessionContracts
{
    private OnlineSessionContracts() {}
    public static final String SESSION_ID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
    public record OnlineSessionQuery(
            @Min(1) @Max(1000000) @Schema(defaultValue="1") Integer page,
            @Min(1) @Max(100) @Schema(defaultValue="10") Integer pageSize,
            @Size(max=128) String ip, @Size(max=50) String username) {}
    /** Opaque Redis session identifier, never the bearer JWT or cached LoginUser. */
    public record OnlineSessionResponse(@Schema(requiredMode=REQUIRED) String id,
            @Schema(requiredMode=REQUIRED) String username, String departmentName,
            String ip, String location, String browser, String operatingSystem, Instant loggedInAt)
    {
        static OnlineSessionResponse from(LoginUser session) {
            var department=session.getUser().getDept();
            return new OnlineSessionResponse(session.getToken(),session.getUsername(),department==null?null:department.getDeptName(),
                    session.getIpaddr(),session.getLoginLocation(),session.getBrowser(),session.getOs(),
                    session.getLoginTime()==null?null:Instant.ofEpochMilli(session.getLoginTime()));
        }
    }
}
