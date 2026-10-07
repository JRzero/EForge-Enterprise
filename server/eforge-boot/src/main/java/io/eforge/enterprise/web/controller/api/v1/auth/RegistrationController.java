package io.eforge.enterprise.web.controller.api.v1.auth;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
@RestController
@RequestMapping("/api/v1/auth")
public class RegistrationController {
    private final RegistrationService registrations;
    public RegistrationController(RegistrationService registrations){this.registrations=registrations;}
    public record RegistrationStatus(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) boolean enabled) {}
    @GetMapping("/registration")
    @Operation(operationId="getRegistrationStatus",summary="Get public registration availability")
    @SecurityRequirements
    @ApiResponse(responseCode="200",description="Current registration availability")
    @ApiResponse(responseCode="503",description="Registration settings unavailable",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    public ResponseEntity<RegistrationStatus> status(){
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL,"no-store").body(new RegistrationStatus(registrations.enabled()));
    }
    @PostMapping("/register")
    @Operation(operationId="registerAccount",summary="Register an account without grants or a login session")
    @SecurityRequirements
    @ApiResponse(responseCode="201",description="Account registered; login remains separate")
    @ApiResponse(responseCode="400",description="Invalid request or captcha",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    @ApiResponse(responseCode="403",description="Registration disabled",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    @ApiResponse(responseCode="409",description="Username already exists",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    @ApiResponse(responseCode="503",description="Registration unavailable",content=@Content(mediaType="application/problem+json",schema=@Schema(implementation=ProblemDetail.class)))
    public ResponseEntity<Void> register(@Valid @RequestBody RegistrationRequest request){
        registrations.register(request);
        return ResponseEntity.status(201).header(HttpHeaders.CACHE_CONTROL,"no-store").build();
    }
}

