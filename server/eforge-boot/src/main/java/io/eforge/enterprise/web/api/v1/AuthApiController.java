package io.eforge.enterprise.web.api.v1;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import io.eforge.enterprise.framework.web.service.SysLoginService;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthApiController
{
    @Autowired
    private SysLoginService loginService;

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request)
    {
        String token = loginService.login(
                request.username(),
                request.password(),
                request.code(),
                request.uuid());
        return new LoginResponse(token, "Bearer");
    }
}
