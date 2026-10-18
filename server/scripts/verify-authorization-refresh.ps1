# This probe owns two unique disposable containers, random localhost ports and an ACL user.
# It never builds the repository or touches a running preview/application/database.
param()
$ErrorActionPreference = 'Stop'
$refreshRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$refreshReport = Join-Path $refreshRoot 'server/eforge-boot/target/surefire-reports/TEST-io.eforge.enterprise.web.controller.api.v1.app.BootstrapServiceTest.xml'
if (!(Test-Path -LiteralPath $refreshReport)) { throw 'Run the current Maven verification before this probe.' }
[xml]$refreshXml = Get-Content -LiteralPath $refreshReport -Raw
$refreshClasspath = ($refreshXml.testsuite.properties.property | Where-Object name -eq 'java.class.path').value
if (!$refreshClasspath) { throw 'The verification report has no resolved Java classpath.' }
$refreshClasspath = ($refreshClasspath.Split([IO.Path]::PathSeparator) | Where-Object { $_ } | ForEach-Object {
    $refreshEntry = $_
    if ($refreshEntry.StartsWith((Join-Path $refreshRoot 'server') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetExtension($refreshEntry) -eq '.jar' -and [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($refreshEntry)) -eq 'target') {
        $refreshEntry = Join-Path ([IO.Path]::GetDirectoryName($refreshEntry)) 'classes'
    }
    if (!(Test-Path -LiteralPath $refreshEntry)) { throw 'Build the current reactor before running this probe.' }
    $refreshEntry
}) -join [IO.Path]::PathSeparator
foreach ($refreshRelative in @(
    'eforge-framework/src/main/java/io/eforge/enterprise/framework/web/service/AuthorizationSnapshotService.java',
    'eforge-framework/src/main/java/io/eforge/enterprise/framework/web/service/TokenService.java',
    'eforge-framework/src/main/java/io/eforge/enterprise/framework/web/service/SessionIndexService.java',
    'eforge-framework/src/main/java/io/eforge/enterprise/framework/security/filter/JwtAuthenticationTokenFilter.java',
    'eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/RoleService.java',
    'eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/RoleSessionRefresher.java')) {
    $refreshSource = Join-Path $refreshRoot "server/$refreshRelative"
    $refreshClass = $refreshSource -replace '[\\/]src[\\/]main[\\/]java[\\/]', '/target/classes/' -replace '\.java$', '.class'
    if (!(Test-Path -LiteralPath $refreshClass) -or (Get-Item -LiteralPath $refreshSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $refreshClass).LastWriteTimeUtc) {
        throw "Authorization production source is newer than its compiled class ($refreshRelative); finish compilation before this probe."
    }
}
foreach ($refreshLua in @('write.lua','read.lua','rebuild.lua')) {
    $refreshLuaSource = Join-Path $refreshRoot "server/eforge-framework/src/main/resources/session-index/$refreshLua"
    $refreshLuaCompiled = Join-Path $refreshRoot "server/eforge-framework/target/classes/session-index/$refreshLua"
    if (!(Test-Path -LiteralPath $refreshLuaCompiled) -or
        (Get-FileHash -LiteralPath $refreshLuaSource).Hash -ne (Get-FileHash -LiteralPath $refreshLuaCompiled).Hash) {
        throw 'Session index Lua resources differ from the compiled runtime; finish compilation before this probe.'
    }
}
$refreshRun = [guid]::NewGuid().ToString('N').Substring(0,12)
$refreshMysql = "eforge-auth-refresh-mysql-$refreshRun"
$refreshRedis = "eforge-auth-refresh-redis-$refreshRun"
$refreshPassword = [guid]::NewGuid().ToString('N')
$refreshOwned = [Collections.Generic.List[string]]::new()
$refreshSaved = @{}
foreach ($refreshEnv in @('EFORGE_AUTH_REFRESH_JDBC_URL','EFORGE_AUTH_REFRESH_JDBC_PASSWORD','EFORGE_AUTH_REFRESH_REDIS_PORT','EFORGE_AUTH_REFRESH_REDIS_PASSWORD')) {
    $refreshSaved[$refreshEnv] = [Environment]::GetEnvironmentVariable($refreshEnv, 'Process')
}
try {
    & docker run --detach --name $refreshMysql --label "eforge.auth-refresh-owner=$refreshRun" --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$refreshPassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the owned MySQL fixture.' }; $refreshOwned.Add($refreshMysql)
    & docker run --detach --name $refreshRedis --label "eforge.auth-refresh-owner=$refreshRun" --publish '127.0.0.1::6379' redis:7.4-alpine | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the owned Redis fixture.' }; $refreshOwned.Add($refreshRedis)
    $refreshReady = $false
    for ($refreshAttempt = 0; $refreshAttempt -lt 60; $refreshAttempt++) {
        & docker exec --env "MYSQL_PWD=$refreshPassword" $refreshMysql mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $refreshReady = $true; break }; Start-Sleep -Seconds 2
    }
    if (!$refreshReady) { throw 'Owned MySQL did not become ready.' }
    $refreshMysqlAddress = & docker port $refreshMysql 3306/tcp
    if ($LASTEXITCODE -ne 0 -or $refreshMysqlAddress -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected owned MySQL port binding.' }
    $refreshMysqlPort = $Matches[1]
    $refreshRedisAddress = & docker port $refreshRedis 6379/tcp
    if ($LASTEXITCODE -ne 0 -or $refreshRedisAddress -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected owned Redis port binding.' }
    $env:EFORGE_AUTH_REFRESH_REDIS_PORT = $Matches[1]
    $env:EFORGE_AUTH_REFRESH_JDBC_URL = "jdbc:mysql://127.0.0.1:$refreshMysqlPort/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
    $env:EFORGE_AUTH_REFRESH_JDBC_PASSWORD = $refreshPassword
    $env:EFORGE_AUTH_REFRESH_REDIS_PASSWORD = [guid]::NewGuid().ToString('N')
    & java '-Dfile.encoding=UTF-8' --class-path $refreshClasspath (Join-Path $PSScriptRoot 'probes/AuthorizationRefreshRedisProbe.java') $refreshRoot
    if ($LASTEXITCODE -ne 0) { throw 'Actual authorization refresh/Redis ACL probe failed.' }
} finally {
    foreach ($refreshEnv in $refreshSaved.Keys) { [Environment]::SetEnvironmentVariable($refreshEnv, $refreshSaved[$refreshEnv], 'Process') }
    foreach ($refreshContainer in $refreshOwned) {
        $refreshOwner = & docker inspect --format '{{ index .Config.Labels "eforge.auth-refresh-owner" }}' $refreshContainer 2>$null
        if ($LASTEXITCODE -eq 0 -and $refreshOwner -ceq $refreshRun) { & docker rm --force $refreshContainer | Out-Null }
    }
}
