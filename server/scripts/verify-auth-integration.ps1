# PowerShell 7; owns only uniquely named disposable containers created by this run.
param([int]$MysqlPort = 13306, [int]$RedisPort = 16380, [int]$AppPort = 18081,
    [string]$OpenApiOutputPath = '', [switch]$VerifyWeb)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$jar = Join-Path $repoRoot 'server/eforge-boot/target/eforge-boot.jar'
if (!(Test-Path -LiteralPath $jar)) { throw 'Package the server before running integration verification.' }
$runId = [guid]::NewGuid().ToString('N').Substring(0, 12)
$mysqlName = "eforge-auth-mysql-$runId"
$redisName = "eforge-auth-redis-$runId"
$testPassword = [guid]::NewGuid().ToString('N')
$createdContainers = [System.Collections.Generic.List[string]]::new()
$previousEnv = @{}
$appProcess = $null
$logDirectory = Join-Path $repoRoot 'server/eforge-boot/target/auth-integration'
$uploadDirectory = Join-Path $logDirectory "uploads-$runId"
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

function Invoke-Docker {
    $output = & docker @args
    if ($LASTEXITCODE -ne 0) { throw 'Integration Docker command failed.' }
    return $output
}
function Assert-Check([bool]$condition, [string]$message) {
    if (!$condition) { throw $message }
}
function Request([string]$path, [string]$method = 'GET', [string]$body = '', [hashtable]$headers = @{}) {
    $requestArgs = @{ Uri = "http://127.0.0.1:$AppPort$path"; Method = $method
        Headers = $headers; SkipHttpErrorCheck = $true; TimeoutSec = 10 }
    if ($body) { $requestArgs.Body = $body; $requestArgs.ContentType = 'application/json' }
    $response = Invoke-WebRequest @requestArgs
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    return [pscustomobject]@{ StatusCode = $response.StatusCode; Headers = $response.Headers; Content = $content }
}
function Assert-Problem($response, [int]$status, [string]$code) {
    Assert-Check ($response.StatusCode -eq $status) "Expected HTTP $status."
    Assert-Check (($response.Headers['Content-Type'] -join ';') -like 'application/problem+json*') 'Expected ProblemDetail media type.'
    $payload = $response.Content | ConvertFrom-Json
    Assert-Check ($payload.status -eq $status -and $payload.code -eq $code) "Expected problem $status/$code, received $($payload.status)/$($payload.code) at $($payload.instance)."
}

try {
    Invoke-Docker run --detach --name $mysqlName --publish "127.0.0.1:${MysqlPort}:3306" `
        --env "MYSQL_ROOT_PASSWORD=$testPassword" --env MYSQL_DATABASE=eforge_enterprise `
        --env MYSQL_USER=eforge --env "MYSQL_PASSWORD=$testPassword" mysql:8.4 | Out-Null
    $createdContainers.Add($mysqlName)
    Invoke-Docker run --detach --name $redisName --publish "127.0.0.1:${RedisPort}:6379" redis:7.4-alpine | Out-Null
    $createdContainers.Add($redisName)
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        # Initialization uses a temporary socket-only server that later exits.
        # A successful TCP query proves the final server is ready for schema import.
        & docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --protocol=TCP --host '127.0.0.1' -uroot -e 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 2
    }
    Assert-Check $ready 'Test MySQL did not become ready.'
    foreach ($schema in @('ry_20260417.sql', 'quartz.sql')) {
        Get-Content -Raw -Encoding utf8 -LiteralPath (Join-Path $repoRoot "sql/upstream/$schema") |
            & docker exec -i --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -uroot eforge_enterprise
        if ($LASTEXITCODE -ne 0) { throw 'Test schema import failed.' }
    }
    foreach ($migration in Get-ChildItem -LiteralPath (Join-Path $repoRoot 'sql/migrations') -Filter '*.sql' | Sort-Object Name) {
        Get-Content -Raw -Encoding utf8 -LiteralPath $migration.FullName |
            & docker exec -i --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -uroot eforge_enterprise
        if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($migration.Name)" }
    }
    $unidentified = Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e `
        "SELECT COUNT(*) FROM sys_menu WHERE menu_key IS NULL;"
    Assert-Check ([int]$unidentified -eq 0) 'Every upstream seed must have a stable identity.'
    $prematureRoutes = Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e `
        "SELECT COUNT(*) FROM sys_menu WHERE route_id IS NOT NULL;"
    $implementedRoutes = @(Get-Content -Raw (Join-Path $repoRoot 'web/app/route-contract.json') | ConvertFrom-Json)
    Assert-Check ([int]$prematureRoutes -eq $implementedRoutes.Count) 'Only implemented React pages may have seeded route bindings.'
    $seedRoutes = Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e `
        "SELECT JSON_OBJECT('key',menu_key,'routeId',route_id,'permission',perms,'path',path) FROM sys_menu WHERE route_id IS NOT NULL ORDER BY route_id;"
    $seedPath = Join-Path $logDirectory 'seed-routes.json'
    [IO.File]::WriteAllText($seedPath, '[' + ((@($seedRoutes) -join ',').Trim()) + ']', [Text.UTF8Encoding]::new($false))
    & node (Join-Path $repoRoot 'web/scripts/verify-seeded-routes.mjs') $seedPath
    Assert-Check ($LASTEXITCODE -eq 0) 'Seeded routes must match the frontend registry and permissions.'
    $unreachable = Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e `
        "WITH RECURSIVE reached AS (SELECT menu_id FROM sys_menu WHERE parent_id=0 UNION ALL SELECT m.menu_id FROM sys_menu m JOIN reached p ON m.parent_id=p.menu_id) SELECT (SELECT COUNT(*) FROM sys_menu)-COUNT(DISTINCT menu_id) FROM reached;"
    Assert-Check ([int]$unreachable -eq 0) 'Seed hierarchy contains an orphan or disconnected cycle.'
    foreach ($invalidChange in @(
        "UPDATE sys_menu SET menu_key='system' WHERE menu_key='system-users';",
        "UPDATE sys_menu SET route_id='fake-group' WHERE menu_key='system';")) {
        & docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e $invalidChange 2>$null | Out-Null
        Assert-Check ($LASTEXITCODE -ne 0) 'Navigation schema accepted an invalid identity or group route.'
    }
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
        "UPDATE sys_config SET config_value='false' WHERE config_key='sys.account.captchaEnabled';" | Out-Null
    $tables = Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s -e `
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='eforge_enterprise';"
    Assert-Check ([int]$tables -ge 20) 'Schema initialization is incomplete.'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli ping) -eq 'PONG') 'Test Redis is unavailable.'

    $testEnv = @{
        EFORGE_DB_URL = "jdbc:mysql://127.0.0.1:$MysqlPort/eforge_enterprise?useUnicode=true&characterEncoding=utf8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
        EFORGE_DB_USERNAME = 'eforge'; EFORGE_DB_PASSWORD = $testPassword
        EFORGE_REDIS_HOST = '127.0.0.1'; EFORGE_REDIS_PORT = "$RedisPort"; EFORGE_REDIS_DATABASE = '0'; EFORGE_REDIS_PASSWORD = ''
        EFORGE_SERVER_PORT = "$AppPort"; EFORGE_TOKEN_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
        EFORGE_OPENAPI_ENABLED = 'true'; EFORGE_SWAGGER_UI_ENABLED = 'false'; EFORGE_DRUID_CONSOLE_ENABLED = 'false'
        EFORGE_PROFILE = $uploadDirectory
    }
    foreach ($key in $testEnv.Keys) {
        $previousEnv[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $testEnv[$key], 'Process')
    }
    $startArgs = @{ FilePath = 'java'; ArgumentList = @('-jar', "`"$jar`""); PassThru = $true
        RedirectStandardOutput = (Join-Path $logDirectory 'application.log')
        RedirectStandardError = (Join-Path $logDirectory 'application-error.log') }
    if ($IsWindows) { $startArgs.WindowStyle = 'Hidden' }
    $appProcess = Start-Process @startArgs
    $ready = $false
    for ($attempt = 0; $attempt -lt 90; $attempt++) {
        if ($appProcess.HasExited) { throw "Test server exited; see $logDirectory." }
        try { if ((Request '/captchaImage').StatusCode -eq 200) { $ready = $true; break } } catch { }
        Start-Sleep -Seconds 2
    }
    Assert-Check $ready "Test server did not become ready; see $logDirectory."

    Assert-Problem (Request '/api/v1/app/bootstrap') 401 'AUTHENTICATION_REQUIRED'
    $anonymousDocs = (Request '/v3/api-docs/api-v1').Content | ConvertFrom-Json
    Assert-Check ($anonymousDocs.code -eq 401 -and !$anonymousDocs.PSObject.Properties['paths']) 'OpenAPI must require authentication.'
    Assert-Problem (Request '/api/v1/auth/login' 'POST' '{}') 400 'VALIDATION_ERROR'
    Assert-Problem (Request '/api/v1/auth/login' 'POST' '{broken') 400 'VALIDATION_ERROR'
    Assert-Problem (Request '/api/v1/auth/login' 'POST' '{"username":"admin","password":"wrong-password"}') 401 'AUTHENTICATION_FAILED'
    $credentials = '{"username":"admin","password":"admin123"}'
    $response = Request '/api/v1/auth/login' 'POST' $credentials
    Assert-Check ($response.StatusCode -eq 200) 'Canonical login failed.'
    Assert-Check (($response.Headers['Cache-Control'] -join ';') -eq 'no-store') 'Login token must not be cached.'
    $login = $response.Content | ConvertFrom-Json
    Assert-Check ($login.accessToken -and $login.tokenType -eq 'Bearer') 'Unexpected login response.'
    Assert-Check (!$login.PSObject.Properties['token'] -and !$login.PSObject.Properties['code']) 'Legacy response leaked into the canonical contract.'
    $authorized = @{ Authorization = "Bearer $($login.accessToken)" }
    $info = (Request '/getInfo' 'GET' '' $authorized).Content | ConvertFrom-Json
    Assert-Check ($info.code -eq 200 -and $info.user.userName -eq 'admin' -and $info.permissions.Count -gt 0) 'Canonical session cannot authenticate legacy getInfo.'
    $sessions = @(Invoke-Docker exec $redisName redis-cli --scan --pattern 'login_tokens:*')
    Assert-Check ($sessions.Count -eq 1) 'Expected exactly one Redis login session.'
    $ttl = Invoke-Docker exec $redisName redis-cli ttl $sessions[0]
    Assert-Check ([int]$ttl -gt 0) 'Login session must expire.'
    $bootstrapResponse = Request '/api/v1/app/bootstrap' 'GET' '' $authorized
    Assert-Check ($bootstrapResponse.StatusCode -eq 200 -and ($bootstrapResponse.Headers['Cache-Control'] -join ';') -eq 'no-store') 'Bootstrap must succeed without caching.'
    $bootstrap = $bootstrapResponse.Content | ConvertFrom-Json
    Assert-Check ($bootstrap.user.id -eq '1' -and $bootstrap.user.username -eq 'admin' -and $bootstrap.roles -contains 'admin' -and $bootstrap.permissions -contains '*:*:*') 'Unexpected admin bootstrap snapshot.'
    Assert-Check (!$bootstrap.user.PSObject.Properties['password'] -and !$bootstrap.PSObject.Properties['code']) 'Bootstrap leaked internal or legacy fields.'
    Assert-Check ($bootstrap.navigation.Count -eq 3 -and $bootstrap.navigation[0].routeId -eq 'dashboard' -and $bootstrap.navigation[1].key -eq 'system' -and $bootstrap.navigation[1].children.Count -eq 5 -and $bootstrap.navigation[1].children[0].routeId -eq 'system-users' -and $bootstrap.navigation[1].children[1].routeId -eq 'system-roles' -and $bootstrap.navigation[1].children[2].routeId -eq 'system-menus' -and $bootstrap.navigation[1].children[3].routeId -eq 'system-departments' -and $bootstrap.navigation[1].children[4].routeId -eq 'system-posts' -and $bootstrap.navigation[2].type -eq 'EXTERNAL') 'Only implemented pages and explicit external links enter seeded navigation.'
    Assert-Problem (Request '/api/v1/auth/login' 'GET' '' $authorized) 405 'HTTP_405'
    $openapi = (Request '/v3/api-docs/api-v1' 'GET' '' $authorized).Content | ConvertFrom-Json -AsHashtable
    $operation = $openapi.paths['/api/v1/auth/login'].post
    Assert-Check ($operation.operationId -eq 'login' -and !$operation.security) 'Login must be public in OpenAPI.'
    Assert-Check ($openapi.components.schemas.LoginResponse.properties.accessToken -and $openapi.components.schemas.LoginRequest.properties.password.writeOnly) 'OpenAPI must describe concrete safe login DTOs.'
    Assert-Check ($openapi.paths['/api/v1/app/bootstrap'].get.operationId -eq 'bootstrap' -and $openapi.components.schemas.BootstrapResponse.properties.navigation) 'OpenAPI must describe concrete bootstrap DTOs.'
    $snapshotPath = Join-Path $logDirectory 'api-v1.json'
    [IO.File]::WriteAllText($snapshotPath, ($openapi | ConvertTo-Json -Depth 100), [Text.UTF8Encoding]::new($false))
    if ($OpenApiOutputPath) {
        & node (Join-Path $repoRoot 'web/scripts/normalize-openapi.mjs') $snapshotPath $OpenApiOutputPath
        Assert-Check ($LASTEXITCODE -eq 0) 'Canonical OpenAPI export failed.'
    }
    if ($VerifyWeb) {
        $previousBackendUrl = [Environment]::GetEnvironmentVariable('EFORGE_E2E_BACKEND_URL', 'Process')
        [Environment]::SetEnvironmentVariable('EFORGE_E2E_BACKEND_URL', "http://127.0.0.1:$AppPort", 'Process')
        Push-Location (Join-Path $repoRoot 'web')
        try {
            $npmCommand = if ($IsWindows) { 'npm.cmd' } else { 'npm' }
            & $npmCommand run test:e2e:live
            Assert-Check ($LASTEXITCODE -eq 0) 'Browser integration with real MySQL/Redis failed.'
        } finally {
            Pop-Location
            [Environment]::SetEnvironmentVariable('EFORGE_E2E_BACKEND_URL', $previousBackendUrl, 'Process')
        }
    }
    . (Join-Path $PSScriptRoot 'verify-posts-integration.ps1')
    . (Join-Path $PSScriptRoot 'verify-departments-integration.ps1')
    . (Join-Path $PSScriptRoot 'verify-users-integration.ps1')
    . (Join-Path $PSScriptRoot 'verify-profile-integration.ps1')
    . (Join-Path $PSScriptRoot 'verify-roles-integration.ps1')
    . (Join-Path $PSScriptRoot 'verify-menus-integration.ps1')
    . (Join-Path $PSScriptRoot 'verify-dictionaries-integration.ps1')
    $legacy = (Request '/login' 'POST' $credentials).Content | ConvertFrom-Json
    Assert-Check ($legacy.code -eq 200 -and $legacy.token) 'Legacy login compatibility failed.'

    # Test-only bindings exercise projection/RBAC without inventing production routes.
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
        "UPDATE sys_menu SET route_id='test-users' WHERE menu_key='system-users'; UPDATE sys_menu SET route_id='test-roles' WHERE menu_key='system-roles'; DELETE FROM sys_role_menu WHERE role_id=2 AND menu_id NOT IN (1,100,1000);" | Out-Null
    $commonLogin = (Request '/api/v1/auth/login' 'POST' '{"username":"ry","password":"admin123"}').Content | ConvertFrom-Json
    Assert-Check ([bool]$commonLogin.accessToken) 'Ordinary user login failed.'
    $commonHeaders = @{ Authorization = "Bearer $($commonLogin.accessToken)" }
    Assert-Check ((Request '/api/v1/system/dictionaries/options' 'GET' '' $commonHeaders).StatusCode -eq 200) 'Authenticated dictionary options must not require management grants.'
    $commonDictionaryValues=@((Request '/api/v1/system/dictionaries/lookup/sys_normal_disable' 'GET' '' $commonHeaders).Content | ConvertFrom-Json)
    Assert-Check ($commonDictionaryValues.Count -eq 2) 'Ordinary users must retain original dictionary consumer reads.'
    foreach ($path in @('/api/v1/system/dictionaries','/api/v1/system/dictionaries/1','/api/v1/system/dictionary-entries?dictionaryId=1','/api/v1/system/dictionary-entries/1')) { Assert-Problem (Request $path 'GET' '' $commonHeaders) 403 'ACCESS_DENIED' }
    foreach ($path in @('/api/v1/system/dictionaries/export','/api/v1/system/dictionary-entries/export?dictionaryId=1','/api/v1/system/dictionaries/cache/refresh')) { Assert-Problem (Request $path 'POST' '' $commonHeaders) 403 'ACCESS_DENIED' }
    Assert-Problem (Request '/api/v1/system/posts' 'GET' '' $commonHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/system/posts/export' 'POST' '' $commonHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/system/posts/1' 'GET' '' $commonHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/system/posts' 'POST' '{"code":"denied","name":"Denied","sort":0,"status":"0"}' $commonHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/system/posts/1' 'PUT' '{"code":"denied","name":"Denied","sort":0,"status":"0"}' $commonHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/system/posts' 'DELETE' '{"ids":["1"]}' $commonHeaders) 403 'ACCESS_DENIED'
    $common = (Request '/api/v1/app/bootstrap' 'GET' '' $commonHeaders).Content | ConvertFrom-Json
    Assert-Check ($common.user.id -eq '2' -and $common.roles -contains 'common' -and $common.permissions -contains 'system:user:list' -and $common.permissions -notcontains 'system:role:list') 'Ordinary user permission snapshot is incorrect.'
    Assert-Check ($common.navigation.Count -eq 1 -and $common.navigation[0].key -eq 'system' -and !$common.navigation[0].PSObject.Properties['routeId']) 'Groups must not bind routes.'
    Assert-Check ($common.navigation[0].children.Count -eq 1 -and $common.navigation[0].children[0].routeId -eq 'test-users') 'Navigation must include only explicitly granted routes.'
    $scopedUsers = (Request '/system/user/list' 'GET' '' $commonHeaders).Content | ConvertFrom-Json
    Assert-Check ($scopedUsers.code -eq 200 -and $scopedUsers.total -eq 1 -and $scopedUsers.rows[0].userId -eq 2) 'Refreshed roles must preserve custom-department data scope.'
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
        "UPDATE sys_menu SET visible='1' WHERE menu_key='system-users';" | Out-Null
    $hidden = (Request '/api/v1/app/bootstrap' 'GET' '' $commonHeaders).Content | ConvertFrom-Json
    Assert-Check ($hidden.navigation.Count -eq 0 -and $hidden.permissions -contains 'system:user:list') 'Visibility must filter UX without replacing backend permissions.'
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
        "UPDATE sys_menu SET visible='0' WHERE menu_key='system-users'; UPDATE sys_role SET status='1' WHERE role_id=2;" | Out-Null
    $revoked = (Request '/api/v1/app/bootstrap' 'GET' '' $commonHeaders).Content | ConvertFrom-Json
    Assert-Check ($revoked.roles.Count -eq 0 -and $revoked.permissions.Count -eq 0 -and $revoked.navigation.Count -eq 0) 'Disabled roles must revoke the bootstrap snapshot.'
    $protected = (Request '/system/user/list' 'GET' '' $commonHeaders).Content | ConvertFrom-Json
    Assert-Check ($protected.code -eq 403) 'Refreshed Redis permissions must enforce backend revocation.'
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
        "UPDATE sys_role SET status='0',del_flag='2' WHERE role_id=2;" | Out-Null
    $deletedRole = (Request '/api/v1/app/bootstrap' 'GET' '' $commonHeaders).Content | ConvertFrom-Json
    Assert-Check ($deletedRole.permissions.Count -eq 0 -and $deletedRole.navigation.Count -eq 0) 'Deleted roles must not grant navigation or permissions.'
    $legacyAfterRevocation = (Request '/getInfo' 'GET' '' $commonHeaders).Content | ConvertFrom-Json
    Assert-Check ($legacyAfterRevocation.permissions.Count -eq 0) 'Legacy getInfo must not regrant permissions from a deleted role.'
    $stillDenied = (Request '/system/user/list' 'GET' '' $commonHeaders).Content | ConvertFrom-Json
    Assert-Check ($stillDenied.code -eq 403) 'Legacy compatibility must preserve revoked backend permissions.'
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
        "UPDATE sys_user SET status='1' WHERE user_id=2;" | Out-Null
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $commonHeaders) 401 'AUTHENTICATION_FAILED'
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $commonHeaders) 401 'AUTHENTICATION_REQUIRED'

    # Exercise preserved captcha behavior using a deterministic disposable Redis challenge.
    Invoke-Docker exec $redisName redis-cli set 'sys_config:sys.account.captchaEnabled' '"true"' | Out-Null
    Assert-Problem (Request '/api/v1/auth/login' 'POST' $credentials) 400 'CAPTCHA_INVALID'
    Invoke-Docker exec $redisName redis-cli set 'captcha_codes:integration-challenge' '"42"' EX 120 | Out-Null
    $withCaptcha = '{"username":"admin","password":"admin123","code":"42","uuid":"integration-challenge"}'
    Assert-Check ((Request '/api/v1/auth/login' 'POST' $withCaptcha).StatusCode -eq 200) 'Valid captcha login failed.'
    Assert-Problem (Request '/api/v1/auth/login' 'POST' $withCaptcha) 400 'CAPTCHA_INVALID'
    Write-Output 'PASS: navigation migration/constraints, admin and ordinary-user bootstrap, hidden/unauthorized nodes, role revocation, account invalidation, MySQL login, Redis TTL, captcha replay and OpenAPI.'
}
finally {
    if ($appProcess -and !$appProcess.HasExited) { Stop-Process -Id $appProcess.Id -Force }
    foreach ($key in $previousEnv.Keys) { [Environment]::SetEnvironmentVariable($key, $previousEnv[$key], 'Process') }
    foreach ($container in $createdContainers) { & docker rm --force --volumes $container | Out-Null }
    if (Test-Path -LiteralPath $uploadDirectory) {
        $resolvedUpload = [IO.Path]::GetFullPath($uploadDirectory)
        $resolvedLog = [IO.Path]::GetFullPath($logDirectory)
        Assert-Check ($resolvedUpload.StartsWith($resolvedLog + [IO.Path]::DirectorySeparatorChar) -and [IO.Path]::GetFileName($resolvedUpload) -eq "uploads-$runId") 'Unsafe owned upload cleanup target.'
        Remove-Item -LiteralPath $resolvedUpload -Recurse -Force
    }
}
