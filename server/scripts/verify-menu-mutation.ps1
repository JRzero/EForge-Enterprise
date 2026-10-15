# Independent labeled MySQL/Redis fixtures only; no Maven/package or preview changes.
param()
$ErrorActionPreference = 'Stop'
$menuProbeRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$menuProbeReport = Join-Path $menuProbeRoot 'server/eforge-boot/target/surefire-reports/TEST-io.eforge.enterprise.web.controller.api.v1.system.AuthorizationMutationCommitTest.xml'
if (!(Test-Path -LiteralPath $menuProbeReport)) { throw 'Complete current Maven verification before the native menu probe.' }
[xml]$menuProbeXml = Get-Content -LiteralPath $menuProbeReport -Raw
$menuProbeClasspath = ($menuProbeXml.testsuite.properties.property | Where-Object name -eq 'java.class.path').value
if (!$menuProbeClasspath) { throw 'The Maven report has no resolved Java classpath.' }
$menuProbeClasspath = ($menuProbeClasspath.Split([IO.Path]::PathSeparator) | Where-Object { $_ } | ForEach-Object {
    $menuProbeEntry = $_
    if ($menuProbeEntry.StartsWith((Join-Path $menuProbeRoot 'server') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetExtension($menuProbeEntry) -eq '.jar' -and [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($menuProbeEntry)) -eq 'target') {
        $menuProbeEntry = Join-Path ([IO.Path]::GetDirectoryName($menuProbeEntry)) 'classes'
    }
    if (!(Test-Path -LiteralPath $menuProbeEntry)) { throw 'Compile current reactor dependencies before this native probe.' }
    $menuProbeEntry
}) -join [IO.Path]::PathSeparator
foreach ($menuProbeRelative in @(
    'eforge-boot/src/main/java/io/eforge/enterprise/web/controller/system/SysMenuController.java',
    'eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/MenuService.java',
    'eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/RoleService.java',
    'eforge-framework/src/main/java/io/eforge/enterprise/framework/web/service/TokenService.java',
    'eforge-framework/src/main/java/io/eforge/enterprise/framework/web/service/AuthorizationSnapshotService.java')) {
    $menuProbeSource = Join-Path $menuProbeRoot "server/$menuProbeRelative"
    $menuProbeClass = $menuProbeSource -replace '[\\/]src[\\/]main[\\/]java[\\/]', '/target/classes/' -replace '\.java$', '.class'
    if (!(Test-Path -LiteralPath $menuProbeClass) -or (Get-Item -LiteralPath $menuProbeSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $menuProbeClass).LastWriteTimeUtc) {
        throw "Compile current menu production classes first ($menuProbeRelative); this probe never builds."
    }
}
$menuProbeRun = [guid]::NewGuid().ToString('N').Substring(0,12)
$menuProbeMysql = "eforge-menu-mysql-$menuProbeRun"
$menuProbeRedis = "eforge-menu-redis-$menuProbeRun"
$menuProbePassword = [guid]::NewGuid().ToString('N')
$menuProbeOwned = [Collections.Generic.List[string]]::new()
$menuProbeSaved = @{}
foreach ($menuProbeEnv in @('EFORGE_MENU_MUTATION_JDBC_URL','EFORGE_MENU_MUTATION_JDBC_PASSWORD','EFORGE_MENU_MUTATION_REDIS_PORT','EFORGE_MENU_MUTATION_REDIS_PASSWORD')) {
    $menuProbeSaved[$menuProbeEnv] = [Environment]::GetEnvironmentVariable($menuProbeEnv, 'Process')
}
try {
    & docker run --detach --name $menuProbeMysql --label "eforge.menu-mutation-owner=$menuProbeRun" --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$menuProbePassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the owned menu MySQL fixture.' }; $menuProbeOwned.Add($menuProbeMysql)
    & docker run --detach --name $menuProbeRedis --label "eforge.menu-mutation-owner=$menuProbeRun" --publish '127.0.0.1::6379' redis:7.4-alpine redis-server --requirepass $menuProbePassword | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the owned menu Redis fixture.' }; $menuProbeOwned.Add($menuProbeRedis)
    $menuProbeReady = $false
    for ($menuProbeAttempt=0; $menuProbeAttempt -lt 60; $menuProbeAttempt++) {
        & docker exec --env "MYSQL_PWD=$menuProbePassword" $menuProbeMysql mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $menuProbeReady = $true; break }; Start-Sleep -Seconds 2
    }
    if (!$menuProbeReady) { throw 'Owned menu MySQL did not become ready.' }
    $menuProbeMysqlAddress = & docker port $menuProbeMysql 3306/tcp
    if ($LASTEXITCODE -ne 0 -or $menuProbeMysqlAddress -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected owned MySQL binding.' }
    $env:EFORGE_MENU_MUTATION_JDBC_URL = "jdbc:mysql://127.0.0.1:$($Matches[1])/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
    $menuProbeRedisAddress = & docker port $menuProbeRedis 6379/tcp
    if ($LASTEXITCODE -ne 0 -or $menuProbeRedisAddress -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected owned Redis binding.' }
    $env:EFORGE_MENU_MUTATION_REDIS_PORT = $Matches[1]
    $env:EFORGE_MENU_MUTATION_JDBC_PASSWORD = $menuProbePassword
    $env:EFORGE_MENU_MUTATION_REDIS_PASSWORD = $menuProbePassword
    & java '-Dfile.encoding=UTF-8' --class-path $menuProbeClasspath (Join-Path $PSScriptRoot 'probes/MenuMutationMysqlProbe.java') $menuProbeRoot
    if ($LASTEXITCODE -ne 0) { throw 'Actual menu transaction/permission probe failed.' }
} finally {
    foreach ($menuProbeEnv in $menuProbeSaved.Keys) { [Environment]::SetEnvironmentVariable($menuProbeEnv, $menuProbeSaved[$menuProbeEnv], 'Process') }
    foreach ($menuProbeContainer in $menuProbeOwned) {
        $menuProbeOwner = & docker inspect --format '{{ index .Config.Labels "eforge.menu-mutation-owner" }}' $menuProbeContainer 2>$null
        if ($LASTEXITCODE -eq 0 -and $menuProbeOwner -ceq $menuProbeRun) { & docker rm --force $menuProbeContainer | Out-Null }
    }
}
