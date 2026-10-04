# Dot-sourced after user tests by the disposable MySQL/Redis runtime fixture.
$profileAccount = Create-User "p-$runId" '105'
$profileId = $profileAccount.id
Assert-Check ((Request "/api/v1/system/users/$profileId/roles" 'PUT' '{"roleIds":[]}' $authorized).StatusCode -eq 204) 'Preparing an account without administration permissions failed.'
$profileLogin = (Request '/api/v1/auth/login' 'POST' (@{username=$profileAccount.username;password='User12345'} | ConvertTo-Json -Compress)).Content | ConvertFrom-Json
$profileHeaders = @{Authorization="Bearer $($profileLogin.accessToken)"}
Assert-Check ((((Request '/api/v1/app/bootstrap' 'GET' '' $profileHeaders).Content | ConvertFrom-Json).permissions.Count -eq 0)) 'Self-service fixture must have no administration grants.'
Assert-Problem (Request '/api/v1/me') 401 'AUTHENTICATION_REQUIRED'
$profileRead = Request '/api/v1/me' 'GET' '' $profileHeaders
$profile = $profileRead.Content | ConvertFrom-Json
Assert-Check ($profileRead.StatusCode -eq 200 -and $profile.id -eq $profileId -and $profile.departmentName -and $profile.postNames -and !$profile.PSObject.Properties['password']) 'Fresh profile must contain department/posts and exclude credentials.'
$profileBody = @{displayName='个人资料验证';email="profile-$runId@example.com";phone='13900000009';sex='1';id='1';departmentId='103';roleIds=@('1');password='forged';status='1'} | ConvertTo-Json -Compress
Assert-Check ((Request '/api/v1/me' 'PUT' $profileBody $profileHeaders).StatusCode -eq 204) 'Updating the self profile failed.'
$storedProfile = (Request "/api/v1/system/users/$profileId" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($storedProfile.user.displayName -eq '个人资料验证' -and $storedProfile.user.departmentId -eq '105' -and $storedProfile.user.status -eq '0' -and $storedProfile.roleIds.Count -eq 0 -and $storedProfile.postIds.Count -eq 1) 'Self profile update changed service-owned associations or account state.'
$legacyProfile = (Request '/system/user/profile' 'GET' '' $profileHeaders).Content | ConvertFrom-Json
Assert-Check ($legacyProfile.data.nickName -eq '个人资料验证' -and $legacyProfile.data.email -eq "profile-$runId@example.com") 'Redis-backed legacy profile must see the committed update immediately.'
Assert-Check (((Request '/api/v1/app/bootstrap' 'GET' '' $profileHeaders).Content | ConvertFrom-Json).user.displayName -eq '个人资料验证') 'Bootstrap must observe the committed profile.'
Assert-Problem (Request '/api/v1/me' 'PUT' '{"displayName":"bad","phone":"bad","email":"bad","sex":"1"}' $profileHeaders) 400 'VALIDATION_ERROR'
$collision = Create-User "pc-$runId" '103' '13900000010' "collision-$runId@example.com"
$collisionBody = @{displayName='Should not persist';email="collision-$runId@example.com";phone='13900000009';sex='1'} | ConvertTo-Json -Compress
Assert-Problem (Request '/api/v1/me' 'PUT' $collisionBody $profileHeaders) 409 'USER_EMAIL_EXISTS'
Assert-Check (((Request '/api/v1/me' 'GET' '' $profileHeaders).Content | ConvertFrom-Json).displayName -eq '个人资料验证') 'Conflict must roll back profile fields.'
Assert-Problem (Request '/api/v1/me/password' 'PUT' '{"oldPassword":"wrong","newPassword":"Changed12345"}' $profileHeaders) 400 'OLD_PASSWORD_INVALID'
Assert-Problem (Request '/api/v1/me/password' 'PUT' '{"oldPassword":"User12345","newPassword":"User12345"}' $profileHeaders) 409 'PASSWORD_UNCHANGED'
Assert-Check ((Request '/api/v1/me/password' 'PUT' '{"oldPassword":"User12345","newPassword":"Changed12345"}' $profileHeaders).StatusCode -eq 204) 'Self password change failed.'
Assert-Problem (Request '/api/v1/auth/login' 'POST' (@{username=$profileAccount.username;password='User12345'} | ConvertTo-Json -Compress)) 401 'AUTHENTICATION_FAILED'
$changedLogin = Request '/api/v1/auth/login' 'POST' (@{username=$profileAccount.username;password='Changed12345'} | ConvertTo-Json -Compress)
Assert-Check ($changedLogin.StatusCode -eq 200) 'Changed credentials must authenticate.'
$changedHeaders = @{Authorization="Bearer $(($changedLogin.Content | ConvertFrom-Json).accessToken)"}
Assert-Check ((Request '/api/v1/me' 'GET' '' $profileHeaders).StatusCode -eq 200) 'Password change retains the original current-session behavior.'
function Upload-ProfileAvatar([string]$path, [hashtable]$headers) {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort/api/v1/me/avatar" -Method POST -Form @{file=(Get-Item -LiteralPath $path)} -Headers $headers -SkipHttpErrorCheck
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    return @{StatusCode=$response.StatusCode;Headers=$response.Headers;Content=$content}
}
$imageFixture = Join-Path $repoRoot 'web/tests/fixtures/avatar.png'
$badImage = Join-Path $logDirectory 'invalid-avatar.png'
Set-Content -LiteralPath $badImage -Value '<script>not an image</script>' -Encoding utf8
Assert-Problem (Upload-ProfileAvatar $badImage $profileHeaders) 400 'AVATAR_INVALID'
$avatarFirst = Upload-ProfileAvatar $imageFixture $profileHeaders
Assert-Check ($avatarFirst.StatusCode -eq 200) 'Real image upload failed.'
$avatarFirstUrl = ($avatarFirst.Content | ConvertFrom-Json).avatarUrl
$imageResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$avatarFirstUrl" -SkipHttpErrorCheck
Assert-Check ($imageResponse.StatusCode -eq 200 -and ($imageResponse.Headers.'Content-Type' -join ';') -like 'image/png*' -and $imageResponse.Content[0] -eq 137) 'Uploaded avatar must serve an actual normalized PNG.'
$cachedAvatar = (Request '/system/user/profile' 'GET' '' $profileHeaders).Content | ConvertFrom-Json
Assert-Check ($cachedAvatar.data.avatar -eq $avatarFirstUrl) 'Committed avatar must refresh the real Redis session.'
$avatarSecond = Upload-ProfileAvatar $imageFixture $profileHeaders
Assert-Check ($avatarSecond.StatusCode -eq 200) 'Replacing the avatar failed.'
$avatarSecondUrl = ($avatarSecond.Content | ConvertFrom-Json).avatarUrl
Assert-Check ($avatarSecondUrl -ne $avatarFirstUrl -and (Request $avatarFirstUrl).StatusCode -eq 404) 'Successful replacement must remove the previous owned file.'
Assert-Check (((Request '/api/v1/me' 'GET' '' $changedHeaders).Content | ConvertFrom-Json).avatarUrl -eq $avatarSecondUrl) 'Another existing session must read the fresh database avatar.'
$passwordRaces = @(1..2 | ForEach-Object -Parallel {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$using:AppPort/api/v1/me/password" -Method PUT -Headers $using:profileHeaders -ContentType 'application/json' -Body '{"oldPassword":"Changed12345","newPassword":"Concurrent12345"}' -SkipHttpErrorCheck
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    [pscustomobject]@{Status=$response.StatusCode;Content=$content}
} -ThrottleLimit 2)
Assert-Check (@($passwordRaces | Where-Object Status -eq 204).Count -eq 1 -and @($passwordRaces | Where-Object { $_.Status -eq 400 -and ($_.Content | ConvertFrom-Json).code -eq 'OLD_PASSWORD_INVALID' }).Count -eq 1) 'Concurrent password changes must recheck the fresh hash under the canonical lock.'
$credentialAudit = Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e "SELECT COUNT(*) FROM sys_oper_log WHERE title IN ('个人密码','个人信息','用户头像') AND (oper_param LIKE '%Changed12345%' OR oper_param LIKE '%Concurrent12345%' OR json_result LIKE '%Changed12345%' OR json_result LIKE '%Concurrent12345%');"
Assert-Check ([int]$credentialAudit -eq 0) 'Self-service audit records must not contain credentials.'
Assert-Check ((Request "/api/v1/system/users/$profileId/status" 'PUT' '{"status":"1"}' $authorized).StatusCode -eq 204) 'Disabling the profile fixture failed.'
Assert-Problem (Request '/api/v1/me' 'GET' '' $changedHeaders) 401 'AUTHENTICATION_FAILED'
Assert-Problem (Request '/api/v1/me' 'GET' '' $changedHeaders) 401 'AUTHENTICATION_REQUIRED'
Assert-Check ((Request "/api/v1/system/users/$profileId/status" 'PUT' '{"status":"0"}' $authorized).StatusCode -eq 204) 'Re-enabling the fixture failed.'
Request '/logout' 'POST' '' $profileHeaders | Out-Null
Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($profileId,$collision.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Profile fixture cleanup failed.'
# Only the newly returned owned UUID filename is removed, beneath this run's log root.
$avatarFile = Join-Path $uploadDirectory ($avatarSecondUrl.Substring('/profile/'.Length))
Assert-Check ($avatarSecondUrl -match '^/profile/avatar/canonical/[0-9a-f-]+\.png$' -and [IO.Path]::GetFullPath($avatarFile).StartsWith([IO.Path]::GetFullPath($uploadDirectory)+[IO.Path]::DirectorySeparatorChar)) 'Unexpected avatar cleanup target.'
Remove-Item -LiteralPath $avatarFile
Write-Output 'Self profile, unchanged associations, uniqueness rollback, password/login, Redis refresh and actual avatar replacement verification passed.'
