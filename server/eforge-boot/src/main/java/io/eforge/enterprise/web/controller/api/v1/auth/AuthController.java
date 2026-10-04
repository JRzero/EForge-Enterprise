package io.eforge.enterprise.web.controller.api.v1.auth;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import io.eforge.enterprise.common.exception.ServiceException;
import io.eforge.enterprise.framework.web.service.SysLoginService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;

/** Canonical contract over the preserved RuoYi authentication service. */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController
{
    private final SysLoginService loginService;

    public AuthController(SysLoginService loginService)
    {
        this.loginService = loginService;
    }

    @Operation(operationId = "login", summary = "Create a Redis-backed login session")
    @SecurityRequirements
    @ApiResponse(responseCode = "200", description = "Authenticated")
    @ApiResponse(responseCode = "400", description = "Invalid request or captcha",
            content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "401", description = "Login rejected",
            content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    @ApiResponse(responseCode = "403", description = "Login blocked",
            content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request)
    {
        String token;
        try
        {
            token = loginService.login(request.username(), request.password(),
                    request.code() == null ? "" : request.code(), request.uuid() == null ? "" : request.uuid());
        }
        catch (ServiceException exception)
        {
            // Upstream wraps authentication-provider rejections in ServiceException.
            // Keep that behavior behind this boundary without exposing its message.
            throw new BadCredentialsException("Login rejected", exception);
        }
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new LoginResponse(token, "Bearer"));
    }
}
