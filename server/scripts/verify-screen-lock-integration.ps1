# Runs only in the parent's owned disposable database, after user/role fixture helpers.
Assert-Check ($createdContainers.Contains($mysqlName) -and $createdContainers.Contains($redisName) -and
    $mysqlName -ceq "eforge-auth-mysql-$runId" -and $redisName -ceq "eforge-auth-redis-$runId") `
    'Screen lock verification requires this harness run owned containers.'
$screenLockAccount=Create-User "sl-$runId" '105'
$screenLockId=$screenLockAccount.id
$screenLockHeaders=$null
try {
    Assert-Check ((Request "/api/v1/system/users/$screenLockId/roles" 'PUT' '{"roleIds":[]}' $authorized).StatusCode -eq 204) 'Screen lock fixture role removal failed.'
    $screenLockLogin=Request '/api/v1/auth/login' 'POST' (@{username=$screenLockAccount.username;password='User12345'}|ConvertTo-Json -Compress)
    Assert-Check ($screenLockLogin.StatusCode -eq 200) 'Screen lock fixture login failed.'
    $screenLockHeaders=@{Authorization="Bearer $(($screenLockLogin.Content|ConvertFrom-Json).accessToken)"}
    # Decode only this owned JWT's locator, as in the identity/recovery fixtures; never print it.
    $screenLockPayload=([string]($screenLockLogin.Content|ConvertFrom-Json).accessToken).Split('.')[1].Replace('-','+').Replace('_','/')
    while($screenLockPayload.Length%4){$screenLockPayload+='='}
    try {$screenLockSessionId=([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($screenLockPayload))|ConvertFrom-Json).login_user_key}
    catch {throw 'Owned screen lock fixture token could not be decoded.'}
    Assert-Check ($screenLockSessionId -cmatch '^[A-Za-z0-9-]{16,64}$') 'Owned screen lock session identity is invalid.'
    $screenLockSessionKey="login_tokens:$screenLockSessionId"
    $screenLockBootstrap=(Request '/api/v1/app/bootstrap' 'GET' '' $screenLockHeaders).Content|ConvertFrom-Json
    Assert-Check ($screenLockBootstrap.user.id -eq $screenLockId -and $screenLockBootstrap.roles.Count -eq 0 -and $screenLockBootstrap.permissions.Count -eq 0) 'Screen lock fixture must have no role grants.'
    Assert-Problem (Request '/api/v1/auth/unlock-screen' 'POST' '{"password":"User12345"}') 401 'AUTHENTICATION_REQUIRED'
    Assert-Problem (Request '/api/v1/auth/unlock-screen' 'POST' '{}' $screenLockHeaders) 400 'VALIDATION_ERROR'
    $screenLockRowsBefore=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT JSON_OBJECT('id',user_id,'password',password,'status',status,'del',del_flag,'updated',update_time,'pwd_date',pwd_update_date) FROM sys_user WHERE user_id=$screenLockId;"
    Assert-Problem (Request '/api/v1/auth/unlock-screen' 'POST' '{"password":"Wrong123"}' $screenLockHeaders) 403 'SCREEN_UNLOCK_PASSWORD_MISMATCH'
    $screenLockReply=Request '/api/v1/auth/unlock-screen' 'POST' '{"password":"User12345","userId":"1","username":"admin"}' $screenLockHeaders
    Assert-Check ($screenLockReply.StatusCode -eq 204 -and [string]::IsNullOrEmpty($screenLockReply.Content) -and !$screenLockReply.Headers['Set-Cookie'] -and ($screenLockReply.Headers['Cache-Control'] -join ';') -eq 'no-store') 'No-role current-user screen verification must return empty uncached204 without a new cookie.'
    $screenLockRowsAfter=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT JSON_OBJECT('id',user_id,'password',password,'status',status,'del',del_flag,'updated',update_time,'pwd_date',pwd_update_date) FROM sys_user WHERE user_id=$screenLockId;"
    Assert-Check (($screenLockRowsBefore -join '') -ceq ($screenLockRowsAfter -join '')) 'Screen unlock must not mutate the account.'
    Assert-Problem (Request '/api/v1/system/users' 'GET' '' $screenLockHeaders) 403 'ACCESS_DENIED'
    Assert-Check ((Request "/api/v1/system/users/$screenLockId/password" 'PUT' '{"password":"Changed123"}' $authorized).StatusCode -eq 204) 'Screen lock password change fixture failed.'
    Assert-Problem (Request '/api/v1/auth/unlock-screen' 'POST' '{"password":"User12345"}' $screenLockHeaders) 403 'SCREEN_UNLOCK_PASSWORD_MISMATCH'
    Assert-Check ((Request '/api/v1/auth/unlock-screen' 'POST' '{"password":"Changed123"}' $screenLockHeaders).StatusCode -eq 204) 'Screen unlock must read the committed SQL hash, not a cached principal hash.'
    # Below the normal renewal threshold: failed authorization must not renew or rewrite this session.
    Assert-Check ([int](Invoke-Docker exec $redisName redis-cli PEXPIRE $screenLockSessionKey 900000) -eq 1) 'Could not prepare the owned screen lock session TTL.'
    $screenLockSessionBefore=(Invoke-Docker exec $redisName redis-cli --raw GET $screenLockSessionKey) -join "`n"
    Assert-Check (![string]::IsNullOrEmpty($screenLockSessionBefore)) 'Owned screen lock session must exist before SQL failure.'
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE sys_user TO sys_user_screen_lock_fault;'|Out-Null
    try {
        $screenLockTtlBefore=[long](Invoke-Docker exec $redisName redis-cli PTTL $screenLockSessionKey)
        $screenLockFault=Request '/api/v1/auth/unlock-screen' 'POST' '{"password":"Changed123"}' $screenLockHeaders
        # H01 reads sys_user in the JWT boundary before entering UnlockScreenService.
        # The service's later SQL-failure contract remains covered by UnlockScreenControllerTest.
        Assert-Problem $screenLockFault 503 'AUTHORIZATION_UNAVAILABLE'
        $screenLockProblem=$screenLockFault.Content|ConvertFrom-Json
        Assert-Check ($screenLockProblem.detail -ceq 'Current authorization could not be verified.' -and
            $screenLockProblem.instance -ceq '/api/v1/auth/unlock-screen') 'Screen lock authorization failure must use the exact safe problem contract.'
        Assert-Check (($screenLockFault.Headers['Cache-Control'] -join ';') -ceq 'no-store' -and
            !$screenLockFault.Headers['Set-Cookie']) 'Screen lock authorization failure must not be cached or create a cookie.'
        Assert-Check ($screenLockFault.Content -notmatch 'sys_user|jdbc|Changed123|SELECT|password') 'Screen lock failure leaked SQL or a credential.'
        $screenLockTtlAfter=[long](Invoke-Docker exec $redisName redis-cli PTTL $screenLockSessionKey)
        $screenLockSessionAfter=(Invoke-Docker exec $redisName redis-cli --raw GET $screenLockSessionKey) -join "`n"
        Assert-Check ($screenLockTtlAfter -gt 0 -and $screenLockTtlAfter -le $screenLockTtlBefore -and
            $screenLockSessionAfter -ceq $screenLockSessionBefore) 'SQL authorization failure must preserve the exact existing session without renewing TTL.'
    } finally {Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE sys_user_screen_lock_fault TO sys_user;'|Out-Null}
    Assert-Check ((Request '/api/v1/auth/unlock-screen' 'POST' '{"password":"Changed123"}' $screenLockHeaders).StatusCode -eq 204) 'Screen lock SQL recovery failed.'
    Assert-Check ([long](Invoke-Docker exec $redisName redis-cli PTTL $screenLockSessionKey) -gt 1200000) 'Recovered screen unlock must retain healthy-session renewal for the same JWT.'
    $screenLockLegacy=(Request '/unlockscreen' 'POST' '{"password":"Changed123"}' $screenLockHeaders).Content|ConvertFrom-Json
    Assert-Check ($screenLockLegacy.code -eq 200) 'Original authenticated unlock compatibility must remain.'
    Assert-Check ((Request '/logout' 'POST' '' $screenLockHeaders).StatusCode -eq 200) 'Screen lock fixture logout failed.'
    Assert-Problem (Request '/api/v1/auth/unlock-screen' 'POST' '{"password":"Changed123"}' $screenLockHeaders) 401 'AUTHENTICATION_REQUIRED'
    Write-Output 'Screen lock: actual no-role current-user SQL verification, malicious actor ignored, unchanged account, changed hash, wrong password without session loss, original compatibility, authorization SQL fault/privacy/session/TTL preservation, same-JWT recovery and logout invalidation passed.'
} finally {
    Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@([string]$screenLockId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned screen-lock fixture cleanup failed.'
}
