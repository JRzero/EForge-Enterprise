package io.eforge.enterprise.web.controller.api.v1.profile;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import io.swagger.v3.oas.annotations.Operation;
import io.eforge.enterprise.common.annotation.Log;
import io.eforge.enterprise.common.enums.BusinessType;
import static io.eforge.enterprise.web.controller.api.v1.profile.ProfileContracts.*;

/** Authenticated self-service only; no caller-provided account identity. */
@RestController
@RequestMapping("/api/v1/me")
public class ProfileController
{
    private final ProfileService profiles;
    public ProfileController(ProfileService profiles) { this.profiles = profiles; }
    @GetMapping @Operation(operationId = "getMyProfile")
    public ResponseEntity<ProfileResponse> get()
    { return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").body(profiles.get()); }
    @PutMapping @Operation(operationId = "updateMyProfile")
    @Log(title = "个人信息", businessType = BusinessType.UPDATE, isSaveRequestData = false, isSaveResponseData = false)
    public ResponseEntity<Void> update(@Valid @RequestBody UpdateProfileRequest request)
    { profiles.update(request); return ResponseEntity.noContent().build(); }
    @PutMapping("/password") @Operation(operationId = "changeMyPassword")
    @Log(title = "个人密码", businessType = BusinessType.UPDATE, isSaveRequestData = false, isSaveResponseData = false)
    public ResponseEntity<Void> password(@Valid @RequestBody ChangePasswordRequest request)
    { profiles.password(request); return ResponseEntity.noContent().build(); }
    @PostMapping(value = "/avatar", consumes = "multipart/form-data") @Operation(operationId = "uploadMyAvatar")
    @Log(title = "用户头像", businessType = BusinessType.UPDATE, isSaveRequestData = false, isSaveResponseData = false)
    public AvatarResponse avatar(@RequestPart MultipartFile file)
    { return profiles.avatar(file); }
}
