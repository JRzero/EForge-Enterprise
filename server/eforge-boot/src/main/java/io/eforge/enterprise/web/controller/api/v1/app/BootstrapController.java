package io.eforge.enterprise.web.controller.api.v1.app;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import io.eforge.enterprise.common.core.domain.model.LoginUser;
import io.swagger.v3.oas.annotations.Operation;

@RestController
public class BootstrapController
{
    private final BootstrapService service;

    public BootstrapController(BootstrapService service) { this.service = service; }

    @Operation(operationId = "bootstrap", summary = "Get the current user and authorized application navigation")
    @GetMapping("/api/v1/app/bootstrap")
    public ResponseEntity<BootstrapResponse> bootstrap(@AuthenticationPrincipal LoginUser session)
    {
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(service.bootstrap(session));
    }
}
