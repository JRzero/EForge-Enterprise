# Dot-sourced only by verify-auth-integration.ps1 against its owned disposable fixtures.
# This is a security regression: the pre-fix server must fail the final denial assertion.
# Never print JWTs, Redis session keys, credentials, raw cached users or response bodies.
Assert-Check ($createdContainers.Contains($mysqlName) -and $createdContainers.Contains($redisName) -and
    $mysqlName -ceq "eforge-auth-mysql-$runId" -and $redisName -ceq "eforge-auth-redis-$runId") `
    'Authorization recovery requires this harness run owned containers.'

function AuthorizationRecovery-SessionKey([string]$jwt) {
    $authRecoveryPayload = $jwt.Split('.')[1].Replace('-', '+').Replace('_', '/')
    while ($authRecoveryPayload.Length % 4) { $authRecoveryPayload += '=' }
    try {
        $authRecoveryClaims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($authRecoveryPayload)) | ConvertFrom-Json
    } catch { throw 'Owned authorization fixture token could not be decoded.' }
    Assert-Check ($authRecoveryClaims.login_user_key -cmatch '^[A-Za-z0-9-]{16,64}$') 'Owned fixture session identity is invalid.'
    return "login_tokens:$($authRecoveryClaims.login_user_key)"
}

function AuthorizationRecovery-Sql([string]$query) {
    return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e $query
}

function AuthorizationRecovery-AssertPage($response, [bool]$legacy, [string]$label) {
    Assert-Check ($response.StatusCode -eq 200) "$label must return HTTP 200."
    $authRecoveryPage = $response.Content | ConvertFrom-Json
    $authRecoveryRowsProperty = if ($legacy) { 'rows' } else { 'items' }
    Assert-Check ($null -ne $authRecoveryPage.PSObject.Properties[$authRecoveryRowsProperty] -and
        $null -ne $authRecoveryPage.PSObject.Properties['total'] -and (!$legacy -or $authRecoveryPage.code -eq 200)) `
        "$label must return an actual posts page, not an error envelope."
}

function AuthorizationRecovery-AssertLegacyFailure($response, [int]$status, [string]$label, [switch]$Diagnostic) {
    $authRecoveryHttpStatus = if ($status -eq 503) { 503 } else { 200 }
    Assert-Check ($response.StatusCode -eq $authRecoveryHttpStatus) "$label returned an unexpected compatibility HTTP status."
    $authRecoveryError = $response.Content | ConvertFrom-Json
    Assert-Check ($authRecoveryError.code -eq $status) "$label returned an unexpected compatibility error code."
    Assert-Check ($null -eq $authRecoveryError.PSObject.Properties['rows']) "$label must not return protected rows."
    if ($Diagnostic) {
        $authRecoveryParsedRequestId = [guid]::Empty
        Assert-Check ([guid]::TryParse([string]$authRecoveryError.requestId, [ref]$authRecoveryParsedRequestId) -and
            [string]$response.Headers['X-Request-ID'] -ceq [string]$authRecoveryError.requestId) "$label must have matching server correlation IDs."
        Assert-Check ($authRecoveryError.msg -ceq 'Current authorization could not be verified.') "$label exposed an unexpected SQL failure message."
        Assert-Check ($response.Headers['Cache-Control'] -contains 'no-store') "$label must prevent caching authorization failures."
        $diagnosticResponses.Add([pscustomobject]@{RequestId=[string]$authRecoveryError.requestId;Status=$status})
    }
}

$authRecoveryRoles = '/api/v1/system/roles'
$authRecoveryPosts = '/api/v1/system/posts'
$authRecoveryRoleBody = @{
    name = "H01-$runId"; key = "auth-recovery-$runId"; sort = 7; status = '0'
    remark = 'Owned authorization recovery fixture'; menuLinked = $true
    menuKeys = @('system', 'system-posts', 'system-post-query')
}
$authRecoveryCreatedRole = Request $authRecoveryRoles 'POST' ($authRecoveryRoleBody | ConvertTo-Json -Depth 5 -Compress) $authorized
Assert-Check ($authRecoveryCreatedRole.StatusCode -eq 201) 'Authorization recovery role creation failed.'
$authRecoveryRoleId = [string]($authRecoveryCreatedRole.Content | ConvertFrom-Json).id
Assert-Check ($authRecoveryRoleId -cmatch '^[1-9][0-9]{0,18}$') 'Authorization recovery role id must be an exact decimal string.'

$authRecoveryUsername = "ar$runId"
$authRecoveryPassword = [guid]::NewGuid().ToString('N').Substring(0, 16) + 'Aa1!'
$authRecoveryUserBody = @{
    user = @{
        username = $authRecoveryUsername; displayName = "H01-$runId"; departmentId = '103'
        email = ''; phone = ''; sex = '2'; status = '0'; remark = 'Owned authorization recovery fixture'
        roleIds = @($authRecoveryRoleId); postIds = @()
    }
    password = $authRecoveryPassword
} | ConvertTo-Json -Depth 6 -Compress
$authRecoveryCreatedUser = Request '/api/v1/system/users' 'POST' $authRecoveryUserBody $authorized
Assert-Check ($authRecoveryCreatedUser.StatusCode -eq 201) 'Authorization recovery user creation failed.'
$authRecoveryUserId = [string]($authRecoveryCreatedUser.Content | ConvertFrom-Json).id
Assert-Check ($authRecoveryUserId -cmatch '^[1-9][0-9]{0,18}$') 'Authorization recovery user id must be an exact decimal string.'

$authRecoveryGrantSql = "SELECT COUNT(*) FROM sys_role_menu rm JOIN sys_menu m ON m.menu_id=rm.menu_id WHERE rm.role_id=$authRecoveryRoleId AND m.perms='system:post:list';"
$authRecoveryIdentitySql = "SELECT COUNT(*) FROM sys_user u JOIN sys_user_role ur ON ur.user_id=u.user_id JOIN sys_role r ON r.role_id=ur.role_id WHERE u.user_id=$authRecoveryUserId AND r.role_id=$authRecoveryRoleId AND u.status='0' AND u.del_flag='0' AND r.status='0' AND r.del_flag='0';"
$authRecoveryGrantsBefore = [int](AuthorizationRecovery-Sql $authRecoveryGrantSql)
Assert-Check ($authRecoveryGrantsBefore -eq 1 -and [int](AuthorizationRecovery-Sql $authRecoveryIdentitySql) -eq 1) `
    'Owned authorization fixture must have one active assignment and one posts grant.'

$authRecoverySessions = [System.Collections.Generic.List[object]]::new()
foreach ($authRecoveryLabel in @('A', 'B')) {
    $authRecoveryLogin = Request '/api/v1/auth/login' 'POST' (@{username=$authRecoveryUsername;password=$authRecoveryPassword} | ConvertTo-Json -Compress)
    Assert-Check ($authRecoveryLogin.StatusCode -eq 200) "Authorization recovery session $authRecoveryLabel login failed."
    $authRecoveryJwt = [string]($authRecoveryLogin.Content | ConvertFrom-Json).accessToken
    $authRecoveryHeaders = @{Authorization="Bearer $authRecoveryJwt"}
    $authRecoveryKey = AuthorizationRecovery-SessionKey $authRecoveryJwt
    $authRecoveryBefore = Request $authRecoveryPosts 'GET' '' $authRecoveryHeaders
    Assert-Check ($authRecoveryBefore.StatusCode -eq 200) "Session $authRecoveryLabel must access posts before revocation."
    $authRecoveryBeforePage = $authRecoveryBefore.Content | ConvertFrom-Json
    Assert-Check ($null -ne $authRecoveryBeforePage.PSObject.Properties['items'] -and $null -ne $authRecoveryBeforePage.PSObject.Properties['total']) `
        "Session $authRecoveryLabel must receive a concrete posts page, not a successful error envelope."
    $authRecoveryTtl = [long](Invoke-Docker exec $redisName redis-cli PTTL $authRecoveryKey)
    Assert-Check ($authRecoveryTtl -gt 0) "Session $authRecoveryLabel must have a positive Redis TTL."
    $authRecoverySessions.Add([pscustomobject]@{Label=$authRecoveryLabel;Headers=$authRecoveryHeaders;Key=$authRecoveryKey;BeforeStatus=200;BeforeTtlMs=$authRecoveryTtl})
}
Assert-Check ($authRecoverySessions[0].Key -cne $authRecoverySessions[1].Key) 'The two fixture logins must be distinct Redis sessions.'
Write-Host "H01 setup: active assignment=1; posts SQL grant=$authRecoveryGrantsBefore; distinct sessions=2; before HTTP A=200/B=200."

$authRecoveryRoleBody.menuKeys = @('system')
$authRecoveryMutationStatus = $null
$authRecoveryMutationRequestId = $null
$authRecoveryAclRestored = $false
try {
    Assert-Check ((Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-keys') -ceq 'OK') 'Owned Redis KEYS restriction failed.'
    $authRecoveryKeysDenied = (Invoke-Docker exec $redisName redis-cli KEYS 'login_tokens:*') -join ''
    Assert-Check ($authRecoveryKeysDenied -match '^NOPERM') 'KEYS must actually be denied before the authorization mutation.'

    $authRecoveryMutation = Request "$authRecoveryRoles/$authRecoveryRoleId" 'PUT' ($authRecoveryRoleBody | ConvertTo-Json -Depth 5 -Compress) $authorized
    $authRecoveryMutationStatus = [int]$authRecoveryMutation.StatusCode
    Assert-Check ($authRecoveryMutationStatus -in @(204,500,503)) 'Unexpected authorization mutation response under the owned Redis fault.'
    if ($authRecoveryMutationStatus -ge 500) {
        $authRecoveryProblem = $authRecoveryMutation.Content | ConvertFrom-Json
        Assert-Problem $authRecoveryMutation $authRecoveryMutationStatus $authRecoveryProblem.code
        Assert-Check ($authRecoveryProblem.detail -notmatch '(?i)(redis|lettuce|jedis|jdbc|sql|password|NOPERM|login_tokens)') 'Mutation failure exposed storage details.'
        $authRecoveryMutationRequestId = $authRecoveryProblem.requestId
    }
    # A separate SQL connection proves committed state, rather than trusting an HTTP error.
    $authRecoveryGrantsAfter = [int](AuthorizationRecovery-Sql $authRecoveryGrantSql)
    $authRecoveryActiveAfter = [int](AuthorizationRecovery-Sql $authRecoveryIdentitySql)
    Assert-Check ($authRecoveryGrantsAfter -eq 0 -and $authRecoveryActiveAfter -eq 1) `
        'The posts grant must actually commit as removed while the account/role assignment remains active.'
    Write-Host "H01 fault: actual KEYS NOPERM; mutation HTTP=$authRecoveryMutationStatus; committed posts grant=$authRecoveryGrantsAfter; active assignment=$authRecoveryActiveAfter."
} finally {
    $authRecoveryAclRestored = (Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+keys') -ceq 'OK'
    Assert-Check $authRecoveryAclRestored 'Owned Redis KEYS permission could not be restored.'
}

# No bootstrap, getInfo, re-login or session refresher is called between revocation and these requests.
$authRecoveryResults = [System.Collections.Generic.List[object]]::new()
foreach ($authRecoverySession in $authRecoverySessions) {
    $authRecoveryAfter = Request $authRecoveryPosts 'GET' '' $authRecoverySession.Headers
    $authRecoveryReturnedItems = $null
    if ($authRecoveryAfter.StatusCode -eq 200) {
        $authRecoveryAfterPage = $authRecoveryAfter.Content | ConvertFrom-Json
        Assert-Check ($null -ne $authRecoveryAfterPage.PSObject.Properties['items'] -and $null -ne $authRecoveryAfterPage.PSObject.Properties['total']) `
            'Unexpectedly allowed request must be an actual posts page, not a successful error envelope.'
        $authRecoveryReturnedItems = @($authRecoveryAfterPage.items).Count
    } elseif ($authRecoveryAfter.StatusCode -eq 403) {
        Assert-Problem $authRecoveryAfter 403 'ACCESS_DENIED'
    }
    $authRecoveryAfterTtl = [long](Invoke-Docker exec $redisName redis-cli PTTL $authRecoverySession.Key)
    $authRecoveryExists = [int](Invoke-Docker exec $redisName redis-cli EXISTS $authRecoverySession.Key)
    $authRecoveryResults.Add([ordered]@{
        Session = $authRecoverySession.Label; BeforeHttp = $authRecoverySession.BeforeStatus; AfterHttp = [int]$authRecoveryAfter.StatusCode
        BeforeTtlMs = $authRecoverySession.BeforeTtlMs; AfterTtlMs = $authRecoveryAfterTtl; RedisExists = $authRecoveryExists
        ReturnedItems = $authRecoveryReturnedItems; Forbidden = $authRecoveryAfter.StatusCode -eq 403
    })
    Write-Host "H01 recovery: session=$($authRecoverySession.Label); posts HTTP=$($authRecoveryAfter.StatusCode); Redis exists=$authRecoveryExists; TTL ms=$authRecoveryAfterTtl."
}

$authRecoveryEvidencePath = Join-Path $logDirectory "authorization-recovery-$runId.json"
$authRecoveryEvidence = [ordered]@{
    Scenario = 'committed-role-revocation-after-redis-keys-failure'; CapturedAtUtc = [DateTime]::UtcNow.ToString('o')
    JarSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $jar).Hash; RoleId = $authRecoveryRoleId; UserId = $authRecoveryUserId
    GrantBefore = $authRecoveryGrantsBefore; GrantAfter = $authRecoveryGrantsAfter; ActiveAssignmentAfter = $authRecoveryActiveAfter
    MutationHttp = $authRecoveryMutationStatus; MutationRequestId = $authRecoveryMutationRequestId; RedisAclRestored = $authRecoveryAclRestored
    Sessions = @($authRecoveryResults.ToArray()); UnexpectedlyAllowed = @($authRecoveryResults | Where-Object AfterHttp -eq 200).Count
}
[IO.File]::WriteAllText($authRecoveryEvidencePath, ($authRecoveryEvidence | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
Write-Host "H01 safe evidence: $authRecoveryEvidencePath"
# Parent finally owns all account/role/session fixtures via its uniquely created containers.
Assert-Check (@($authRecoveryResults | Where-Object Forbidden).Count -eq 2) `
    "AUTHORIZATION_RECOVERY_RED: committed revocation must deny both original JWTs after Redis recovery; unexpectedly allowed=$($authRecoveryEvidence.UnexpectedlyAllowed)."
Write-Host 'PASS: both original JWTs are forbidden after committed revocation and actual Redis KEYS failure/recovery.'

# Keep the original red assertion above intact. The remaining matrix only runs after
# revocation is fail-closed, and records status/count/TTL/correlation data without secrets.
$authRecoveryExtended = [System.Collections.Generic.List[object]]::new()
$authRecoveryEvidence.ExtendedChecks = $authRecoveryExtended
$authRecoveryEvidence.ExtendedComplete = $false
$authRecoveryLegacyPosts = '/system/post/list'
try {
    foreach ($authRecoverySession in $authRecoverySessions) {
        $authRecoveryLegacyDenied = Request $authRecoveryLegacyPosts 'GET' '' $authRecoverySession.Headers
        AuthorizationRecovery-AssertLegacyFailure $authRecoveryLegacyDenied 403 "Revoked original session $($authRecoverySession.Label)"
        $authRecoveryExtended.Add([ordered]@{Stage='revoked-legacy';Session=$authRecoverySession.Label;Http=[int]$authRecoveryLegacyDenied.StatusCode;Code=403})
    }

    $authRecoveryRoleBody.menuKeys = @('system', 'system-posts', 'system-post-query')
    $authRecoveryRegrant = Request "$authRecoveryRoles/$authRecoveryRoleId" 'PUT' ($authRecoveryRoleBody | ConvertTo-Json -Depth 5 -Compress) $authorized
    Assert-Check ($authRecoveryRegrant.StatusCode -eq 204 -and [int](AuthorizationRecovery-Sql $authRecoveryGrantSql) -eq 1) `
        'Posts permission must be committed as granted again.'
    foreach ($authRecoverySession in $authRecoverySessions) {
        AuthorizationRecovery-AssertPage (Request $authRecoveryPosts 'GET' '' $authRecoverySession.Headers) $false "Regranted canonical session $($authRecoverySession.Label)"
        AuthorizationRecovery-AssertPage (Request $authRecoveryLegacyPosts 'GET' '' $authRecoverySession.Headers) $true "Regranted compatibility session $($authRecoverySession.Label)"
        $authRecoveryExtended.Add([ordered]@{Stage='regrant-original-jwt';Session=$authRecoverySession.Label;CanonicalHttp=200;LegacyHttp=200;LegacyCode=200;SqlGrant=1})
    }
    Write-Host 'H01 regrant: both original JWTs canonical HTTP 200 and compatibility code 200; committed SQL grant=1.'

    # Moving one table in this run's disposable schema gives a real SQL dependency
    # failure. No business rows are dropped or replaced, and finally restores it.
    Assert-Check ($runId -cmatch '^[a-f0-9]{12}$') 'Owned SQL fault table suffix is invalid.'
    $authRecoveryFaultTable = "auth_recovery_user_$runId"
    Assert-Check ([int](AuthorizationRecovery-Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='eforge_enterprise' AND table_name='$authRecoveryFaultTable';") -eq 0) `
        'Owned SQL fault destination must not already exist.'
    $authRecoveryUserRowsBefore = [long](AuthorizationRecovery-Sql 'SELECT COUNT(*) FROM sys_user;')
    foreach ($authRecoverySession in $authRecoverySessions) {
        # Below the normal renewal threshold: a fault must not silently extend TTL.
        Assert-Check ([int](Invoke-Docker exec $redisName redis-cli PEXPIRE $authRecoverySession.Key 900000) -eq 1) 'Could not prepare an owned short session TTL.'
    }
    try {
        AuthorizationRecovery-Sql "RENAME TABLE sys_user TO $authRecoveryFaultTable;" | Out-Null
        Assert-Check ([int](AuthorizationRecovery-Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='eforge_enterprise' AND table_name='sys_user';") -eq 0) `
            'The owned SQL fault must actually remove the authorization table name.'
        foreach ($authRecoverySession in $authRecoverySessions) {
            $authRecoveryFaultBeforeTtl = [long](Invoke-Docker exec $redisName redis-cli PTTL $authRecoverySession.Key)
            $authRecoverySqlFailure = Request $authRecoveryPosts 'GET' '' $authRecoverySession.Headers
            Assert-Problem $authRecoverySqlFailure 503 'AUTHORIZATION_UNAVAILABLE'
            $authRecoverySqlProblem = $authRecoverySqlFailure.Content | ConvertFrom-Json
            Assert-Check ($authRecoverySqlProblem.detail -ceq 'Current authorization could not be verified.') 'Canonical authorization SQL failure must use its fixed safe detail.'
            $authRecoveryLegacySqlFailure = Request $authRecoveryLegacyPosts 'GET' '' $authRecoverySession.Headers
            AuthorizationRecovery-AssertLegacyFailure $authRecoveryLegacySqlFailure 503 "SQL unavailable compatibility session $($authRecoverySession.Label)" -Diagnostic
            $authRecoveryLegacySqlProblem = $authRecoveryLegacySqlFailure.Content | ConvertFrom-Json
            $authRecoveryFaultAfterTtl = [long](Invoke-Docker exec $redisName redis-cli PTTL $authRecoverySession.Key)
            Assert-Check ($authRecoveryFaultAfterTtl -gt 0 -and $authRecoveryFaultAfterTtl -le $authRecoveryFaultBeforeTtl -and
                [int](Invoke-Docker exec $redisName redis-cli EXISTS $authRecoverySession.Key) -eq 1) 'SQL failure must preserve session existence without renewing TTL.'
            $authRecoveryExtended.Add([ordered]@{
                Stage='authorization-sql-unavailable';Session=$authRecoverySession.Label;CanonicalHttp=503;LegacyHttp=503;LegacyCode=503
                CanonicalRequestId=$authRecoverySqlProblem.requestId;LegacyRequestId=$authRecoveryLegacySqlProblem.requestId
                BeforeTtlMs=$authRecoveryFaultBeforeTtl;AfterTtlMs=$authRecoveryFaultAfterTtl;RedisExists=1
            })
        }
        $authRecoveryLogout = Request '/logout' 'POST' '' $authRecoverySessions[0].Headers
        Assert-Check ($authRecoveryLogout.StatusCode -eq 200 -and ($authRecoveryLogout.Content | ConvertFrom-Json).code -eq 200) `
            'Logout must succeed while authorization SQL is unavailable.'
        Assert-Check ([int](Invoke-Docker exec $redisName redis-cli EXISTS $authRecoverySessions[0].Key) -eq 0 -and
            [int](Invoke-Docker exec $redisName redis-cli EXISTS $authRecoverySessions[1].Key) -eq 1) `
            'Logout during SQL failure must delete precisely its original session and preserve the other session.'
        $authRecoveryExtended.Add([ordered]@{Stage='logout-during-sql-failure';Session='A';Http=200;Code=200;RedisExists=0;OtherRedisExists=1})
    } finally {
        $authRecoveryFaultTableExists = [int](AuthorizationRecovery-Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='eforge_enterprise' AND table_name='$authRecoveryFaultTable';")
        if ($authRecoveryFaultTableExists -eq 1) {
            Assert-Check ([int](AuthorizationRecovery-Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='eforge_enterprise' AND table_name='sys_user';") -eq 0) `
                'Refusing to overwrite another table while restoring the owned SQL fault.'
            AuthorizationRecovery-Sql "RENAME TABLE $authRecoveryFaultTable TO sys_user;" | Out-Null
        }
        Assert-Check ([long](AuthorizationRecovery-Sql 'SELECT COUNT(*) FROM sys_user;') -eq $authRecoveryUserRowsBefore) 'Restoring the owned authorization table must preserve every user row.'
        $authRecoveryEvidence.SqlTableRestored = $true
    }
    Assert-Problem (Request $authRecoveryPosts 'GET' '' $authRecoverySessions[0].Headers) 401 'AUTHENTICATION_REQUIRED'
    AuthorizationRecovery-AssertLegacyFailure (Request $authRecoveryLegacyPosts 'GET' '' $authRecoverySessions[0].Headers) 401 'Logged-out original session after SQL restoration'
    AuthorizationRecovery-AssertPage (Request $authRecoveryPosts 'GET' '' $authRecoverySessions[1].Headers) $false 'Unaffected original session after SQL restoration'
    AuthorizationRecovery-AssertPage (Request $authRecoveryLegacyPosts 'GET' '' $authRecoverySessions[1].Headers) $true 'Unaffected compatibility session after SQL restoration'
    $authRecoveryRenewedTtl = [long](Invoke-Docker exec $redisName redis-cli PTTL $authRecoverySessions[1].Key)
    Assert-Check ($authRecoveryRenewedTtl -gt 1200000) 'A healthy request must retain the existing short-session renewal behavior.'
    $authRecoveryExtended.Add([ordered]@{Stage='sql-restored';LoggedOutCanonicalHttp=401;LoggedOutLegacyCode=401;OtherCanonicalHttp=200;OtherLegacyCode=200;OtherRenewedTtlMs=$authRecoveryRenewedTtl;UserRowsPreserved=$true})
    Write-Host 'H01 SQL recovery: two canonical/legacy 503 pairs; TTL preserved; SQL-free logout A deleted only A; restored B returned real pages and renewed normally.'

    # Preserve the pre-existing inactive-account contract: the observed disabled
    # session is removed and cannot revive when the account is enabled again.
    try {
        AuthorizationRecovery-Sql "UPDATE sys_user SET status='1' WHERE user_id=$authRecoveryUserId;" | Out-Null
        Assert-Check ([int](AuthorizationRecovery-Sql "SELECT COUNT(*) FROM sys_user WHERE user_id=$authRecoveryUserId AND status='1';") -eq 1) 'Owned account disable must be committed in SQL.'
        Assert-Problem (Request $authRecoveryPosts 'GET' '' $authRecoverySessions[1].Headers) 401 'AUTHENTICATION_FAILED'
        Assert-Check ([int](Invoke-Docker exec $redisName redis-cli EXISTS $authRecoverySessions[1].Key) -eq 0) 'An observed disabled account must invalidate its original Redis session.'
        AuthorizationRecovery-AssertLegacyFailure (Request $authRecoveryLegacyPosts 'GET' '' $authRecoverySessions[1].Headers) 401 'Disabled original compatibility session'
        $authRecoveryExtended.Add([ordered]@{Stage='account-disabled';Session='B';CanonicalHttp=401;CanonicalCode='AUTHENTICATION_FAILED';LegacyCode=401;RedisExists=0})
    } finally {
        AuthorizationRecovery-Sql "UPDATE sys_user SET status='0' WHERE user_id=$authRecoveryUserId;" | Out-Null
        Assert-Check ([int](AuthorizationRecovery-Sql $authRecoveryIdentitySql) -eq 1) 'The owned account must be restored to its original active state.'
        $authRecoveryEvidence.AccountRestored = $true
    }
    Assert-Problem (Request $authRecoveryPosts 'GET' '' $authRecoverySessions[1].Headers) 401 'AUTHENTICATION_REQUIRED'
    AuthorizationRecovery-AssertLegacyFailure (Request $authRecoveryLegacyPosts 'GET' '' $authRecoverySessions[1].Headers) 401 'Re-enabled account old compatibility session'
    $authRecoveryRestoredLogin = Request '/api/v1/auth/login' 'POST' (@{username=$authRecoveryUsername;password=$authRecoveryPassword} | ConvertTo-Json -Compress)
    Assert-Check ($authRecoveryRestoredLogin.StatusCode -eq 200) 'The restored account must support a fresh login.'
    $authRecoveryRestoredJwt = [string]($authRecoveryRestoredLogin.Content | ConvertFrom-Json).accessToken
    $authRecoveryRestoredHeaders = @{Authorization="Bearer $authRecoveryRestoredJwt"}
    $authRecoveryRestoredKey = AuthorizationRecovery-SessionKey $authRecoveryRestoredJwt
    Assert-Check ($authRecoveryRestoredKey -cne $authRecoverySessions[0].Key -and $authRecoveryRestoredKey -cne $authRecoverySessions[1].Key) 'A restored account must create a new session identity.'
    AuthorizationRecovery-AssertPage (Request $authRecoveryPosts 'GET' '' $authRecoveryRestoredHeaders) $false 'Re-enabled account new canonical session'
    AuthorizationRecovery-AssertPage (Request $authRecoveryLegacyPosts 'GET' '' $authRecoveryRestoredHeaders) $true 'Re-enabled account new compatibility session'
    $authRecoveryExtended.Add([ordered]@{Stage='account-restored';OldCanonicalHttp=401;OldLegacyCode=401;NewLoginHttp=200;NewCanonicalHttp=200;NewLegacyCode=200})

    $authRecoveryDiagnosticRecords = @{}
    foreach ($authRecoveryLogLine in Get-Content -LiteralPath (Join-Path $logDirectory 'application.log')) {
        $authRecoveryJsonStart = $authRecoveryLogLine.IndexOf('{"')
        if ($authRecoveryJsonStart -lt 0 -or $authRecoveryLogLine -notmatch '"event":"api_server_error"') { continue }
        try { $authRecoveryDiagnosticRecord = $authRecoveryLogLine.Substring($authRecoveryJsonStart) | ConvertFrom-Json } catch { continue }
        $authRecoveryDiagnosticRecords[[string]$authRecoveryDiagnosticRecord.requestId] = $authRecoveryDiagnosticRecord
    }
    foreach ($authRecoveryExpectedDiagnostic in $diagnosticResponses) {
        $authRecoveryDiagnosticRecord = $authRecoveryDiagnosticRecords[$authRecoveryExpectedDiagnostic.RequestId]
        Assert-Check ($null -ne $authRecoveryDiagnosticRecord -and $authRecoveryDiagnosticRecord.status -eq $authRecoveryExpectedDiagnostic.Status) `
            'An actual authorization/storage failure is missing its safe correlated server diagnostic.'
        $authRecoveryDiagnosticJson = $authRecoveryDiagnosticRecord | ConvertTo-Json -Depth 8 -Compress
        Assert-Check ($authRecoveryDiagnosticJson -notmatch '(?i)(SELECT |FROM sys_|auth_recovery_user_|jdbc:|NOPERM|login_tokens:|Bearer |password=)') 'A server diagnostic exposed SQL, tokens or storage error text.'
    }
    $authRecoveryEvidence.CorrelatedDiagnostics = $diagnosticResponses.Count
    $authRecoveryEvidence.ExtendedComplete = $true
    Write-Host 'PASS: original-JWT regrant/compatibility, real SQL unavailability/recovery, SQL-free precise logout, disabled-account invalidation, TTL and safe correlated diagnostics.'
} finally {
    $authRecoveryEvidence.CapturedAtUtc = [DateTime]::UtcNow.ToString('o')
    [IO.File]::WriteAllText($authRecoveryEvidencePath, ($authRecoveryEvidence | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
}
