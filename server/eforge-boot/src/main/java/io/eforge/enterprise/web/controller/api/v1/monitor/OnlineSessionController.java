package io.eforge.enterprise.web.controller.api.v1.monitor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import io.eforge.enterprise.web.controller.api.v1.PageResponse;
import static io.eforge.enterprise.web.controller.api.v1.monitor.OnlineSessionContracts.*;

@RestController
@RequestMapping("/api/v1/monitor/online-sessions")
public class OnlineSessionController
{
    private final OnlineSessionService sessions;
    public OnlineSessionController(OnlineSessionService sessions){this.sessions=sessions;}
    @GetMapping @PreAuthorize("@ss.hasPermi('monitor:online:list')") @Operation(operationId="listOnlineSessions")
    public PageResponse<OnlineSessionResponse> list(@Valid @ModelAttribute @ParameterObject OnlineSessionQuery query){return sessions.list(query);}
    @DeleteMapping("/{id}") @PreAuthorize("@ss.hasPermi('monitor:online:forceLogout')") @Operation(operationId="revokeOnlineSession")
    @Log(title="在线用户",businessType=BusinessType.FORCE,isSaveResponseData=false)
    @ApiResponse(responseCode="204",description="Session revoked (already absent is also successful)",content=@Content)
    public ResponseEntity<Void> revoke(@PathVariable @Pattern(regexp=SESSION_ID) String id){sessions.revoke(id);return ResponseEntity.noContent().build();}
}
