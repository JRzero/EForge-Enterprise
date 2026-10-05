# Actual servlet authentication; only owned users/roles/tickets in this disposable run.
$consoleBase='/api/v1/monitor/consoles'
$consoleRole=$null;$consoleUser=$null
try {
    foreach($kind in @('druid','api-docs')) {
        Assert-Problem (Request "$consoleBase/$kind") 401 'AUTHENTICATION_REQUIRED'
        $status=Request "$consoleBase/$kind" 'GET' '' $authorized
        Assert-Check ($status.StatusCode -eq 200 -and ($status.Content|ConvertFrom-Json).enabled -eq $EnableConsoles.IsPresent) 'Console status must reflect explicit configuration.'
        if(!$EnableConsoles) {Assert-Problem (Request "$consoleBase/$kind/session" 'POST' '' $authorized) 404 'CONSOLE_DISABLED'}
    }
    $roleBody=@{name="Console-$runId";key="console-$runId";sort=9;status='0';remark='';menuLinked=$false;menuKeys=@('monitor-druid','tool-openapi')}|ConvertTo-Json -Compress
    $roleResponse=Request '/api/v1/system/roles' 'POST' $roleBody $authorized
    Assert-Check ($roleResponse.StatusCode -eq 201) 'Owned console role creation failed.';$consoleRole=$roleResponse.Content|ConvertFrom-Json
    $consoleUsername="co$runId"
    $userBody=@{user=@{username=$consoleUsername;displayName='Console validation';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 6 -Compress
    $created=Request '/api/v1/system/users' 'POST' $userBody $authorized
    Assert-Check ($created.StatusCode -eq 201) 'Owned console account creation failed.';$consoleUser=$created.Content|ConvertFrom-Json
    $userCredentials=@{username=$consoleUsername;password='User12345'}|ConvertTo-Json -Compress
    $loginResponse=Request '/api/v1/auth/login' 'POST' $userCredentials
    Assert-Check ($loginResponse.StatusCode -eq 200) 'Owned console login failed.'
    $consoleHeaders=@{Authorization="Bearer $(($loginResponse.Content|ConvertFrom-Json).accessToken)"}
    foreach($kind in @('druid','api-docs')) {
        Assert-Problem (Request "$consoleBase/$kind" 'GET' '' $consoleHeaders) 403 'ACCESS_DENIED'
        Assert-Problem (Request "$consoleBase/$kind/session" 'POST' '' $consoleHeaders) 403 'ACCESS_DENIED'
    }
    foreach($path in @('/druid/index.html','/swagger-ui/index.html','/v3/api-docs/api-v1')) {Assert-Problem (Request $path 'GET' '' $consoleHeaders) 403 'ACCESS_DENIED'}
    if($EnableConsoles) {
        Assert-Check ((Request "/api/v1/system/users/$($consoleUser.id)/roles" 'PUT' (@{roleIds=@($consoleRole.id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Console grants could not be allocated.'
        $cookies=@{}
        foreach($kind in @('druid','api-docs')) {
            $opened=Request "$consoleBase/$kind/session" 'POST' '' $consoleHeaders
            Assert-Check ($opened.StatusCode -eq 200) 'Console ticket issuance failed.'
            $entry=$opened.Content|ConvertFrom-Json
            Assert-Check ($entry.expiresInSeconds -eq 300 -and !$entry.PSObject.Properties['accessToken']) 'Console response must never contain a token.'
            $setCookie=$opened.Headers['Set-Cookie'] -join ';'
            Assert-Check ($setCookie -match 'httponly' -and $setCookie -match 'samesite=strict') 'Console cookie safety attributes missing.'
            $cookies[$kind]=@{Cookie=$setCookie.Split(';')[0];Origin="http://127.0.0.1:$AppPort"}
        }
        Assert-Check ((Request '/druid/index.html' 'GET' '' $cookies.druid).StatusCode -eq 200) 'Cookie did not authenticate the actual Druid servlet.'
        Assert-Check ((Request '/swagger-ui/index.html' 'GET' '' $cookies.'api-docs').StatusCode -eq 200) 'Cookie did not authenticate actual Swagger HTML.'
        Assert-Check ((Request '/swagger-ui/swagger-ui-bundle.js' 'GET' '' $cookies.'api-docs').StatusCode -eq 200) 'Nested Swagger assets must authenticate.'
        Assert-Check ((Request '/v3/api-docs/api-v1' 'GET' '' $cookies.'api-docs').StatusCode -eq 200) 'Swagger schema requests must authenticate.'
        try {
            Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-get'|Out-Null
            Assert-Problem (Request '/druid/index.html' 'GET' '' $cookies.druid) 503 'CONSOLE_UNAVAILABLE'
            Assert-Problem (Request '/v3/api-docs/api-v1' 'GET' '' $cookies.'api-docs') 503 'CONSOLE_UNAVAILABLE'
        } finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+get'|Out-Null}
        Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $cookies.druid) 401 'AUTHENTICATION_REQUIRED'
        Assert-Problem (Request '/druid/index.html' 'GET' '' $cookies.'api-docs') 401 'AUTHENTICATION_REQUIRED'
        $crossSite=@{Cookie=$cookies.druid.Cookie;Origin='https://untrusted.example';'Sec-Fetch-Site'='cross-site'}
        # Spring's CORS boundary can reject this before the console filter runs.
        Assert-Check ((Request '/druid/reset-all.json' 'GET' '' $crossSite).StatusCode -eq 403) 'Cross-site console mutation must be rejected.'
        Assert-Check ((Request "/api/v1/system/users/$($consoleUser.id)/roles" 'PUT' '{"roleIds":[]}' $authorized).StatusCode -eq 204) 'Console revocation failed.'
        Assert-Problem (Request '/druid/index.html' 'GET' '' $cookies.druid) 403 'ACCESS_DENIED'
        Assert-Problem (Request '/swagger-ui/index.html' 'GET' '' $cookies.'api-docs') 403 'ACCESS_DENIED'
        Assert-Check ((Request "/api/v1/system/users/$($consoleUser.id)/roles" 'PUT' (@{roleIds=@($consoleRole.id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Console grant restoration failed.'
        $expiring=Request "$consoleBase/druid/session" 'POST' '' $consoleHeaders
        Assert-Check ($expiring.StatusCode -eq 200) 'Expiry probe ticket issuance failed.'
        $expiringCookie=($expiring.Headers['Set-Cookie'] -join ';').Split(';')[0]
        $opaque=$expiringCookie.Substring($expiringCookie.IndexOf('=')+1)
        $digest=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::ASCII.GetBytes($opaque))).ToLowerInvariant()
        $ticketKey="console_tickets:DRUID:$digest"
        $uuid=(Invoke-Docker exec $redisName redis-cli get $ticketKey)|ConvertFrom-Json
        $ttlBefore=[int](Invoke-Docker exec $redisName redis-cli ttl "login_tokens:$uuid")
        $expiryHeaders=@{Cookie=$expiringCookie;Origin="http://127.0.0.1:$AppPort"}
        Assert-Check ((Request '/druid/index.html' 'GET' '' $expiryHeaders).StatusCode -eq 200) 'Fresh expiry probe ticket must authenticate.'
        $ttlAfter=[int](Invoke-Docker exec $redisName redis-cli ttl "login_tokens:$uuid")
        Assert-Check ($ttlAfter -gt 0 -and $ttlAfter -le $ttlBefore) 'Console resources must not extend the original session.'
        Invoke-Docker exec $redisName redis-cli expire $ticketKey 1|Out-Null
        Start-Sleep -Seconds 2
        Assert-Problem (Request '/druid/index.html' 'GET' '' $expiryHeaders) 401 'AUTHENTICATION_REQUIRED'
        Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $consoleHeaders).StatusCode -eq 200) 'Console ticket expiry must not revoke its underlying session.'
        Request '/logout' 'POST' '' $consoleHeaders|Out-Null
        Assert-Problem (Request '/druid/index.html' 'GET' '' $cookies.druid) 401 'AUTHENTICATION_REQUIRED'
        Assert-Problem (Request '/v3/api-docs/api-v1' 'GET' '' $cookies.'api-docs') 401 'AUTHENTICATION_REQUIRED'
    }
    Write-Output 'Consoles: canonical status/permission/defaults and owned scope checks passed; enabled runs verify actual servlet/assets/schema cookies, cross-site rejection, grant revocation and logout.'
} finally {
    if($consoleUser){Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($consoleUser.id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Console user cleanup failed.'}
    if($consoleRole){Assert-Check ((Request '/api/v1/system/roles' 'DELETE' (@{ids=@($consoleRole.id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Console role cleanup failed.'}
}
