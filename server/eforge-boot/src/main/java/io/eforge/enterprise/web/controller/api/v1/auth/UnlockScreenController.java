package io.eforge.enterprise.web.controller.api.v1.auth;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
@RestController
@PreAuthorize("isAuthenticated()")
public class UnlockScreenController {
    private final UnlockScreenService unlock;
    public UnlockScreenController(UnlockScreenService unlock){this.unlock=unlock;}
    @Operation(operationId="unlockScreen",summary="Verify the current account password before resuming its screen")
    @ApiResponse(responseCode="204",description="Current password verified")
    @ApiResponse(responseCode="400",description="Invalid request",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    @ApiResponse(responseCode="401",description="Authentication required",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    @ApiResponse(responseCode="403",description="Password rejected",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    @ApiResponse(responseCode="503",description="Temporarily unavailable",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    @PostMapping("/api/v1/auth/unlock-screen")
    public ResponseEntity<Void> unlockScreen(@Valid @RequestBody UnlockScreenRequest request){
        unlock.verifyPassword(request.password());return ResponseEntity.noContent().header(HttpHeaders.CACHE_CONTROL,"no-store").build();
    }
}
