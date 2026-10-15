# Actual SQL mutation/afterCommit timing; owns only one disposable MySQL container.
param()
$ErrorActionPreference = 'Stop'
$authMutationRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$authMutationReportPath = Join-Path $authMutationRoot 'server/eforge-boot/target/surefire-reports/TEST-io.eforge.enterprise.web.controller.api.v1.system.AuthorizationMutationCommitTest.xml'
if (!(Test-Path -LiteralPath $authMutationReportPath)) { throw 'Run the authorization mutation unit tests before this native probe.' }
[xml]$authMutationReport = Get-Content -LiteralPath $authMutationReportPath -Raw
$authMutationClasspath = ($authMutationReport.testsuite.properties.property | Where-Object { $_.name -eq 'java.class.path' }).value
if (!$authMutationClasspath) { throw 'The Maven report has no resolved runtime classpath.' }
$authMutationClasspath = ($authMutationClasspath.Split([IO.Path]::PathSeparator) | Where-Object { ![string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
    $authMutationEntry = $_
    if ($authMutationEntry.StartsWith((Join-Path $authMutationRoot 'server') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetExtension($authMutationEntry) -eq '.jar' -and [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($authMutationEntry)) -eq 'target') {
        $authMutationEntry = Join-Path ([IO.Path]::GetDirectoryName($authMutationEntry)) 'classes'
    }
    if (!(Test-Path -LiteralPath $authMutationEntry)) { throw 'Compile the current reactor modules before this native probe.' }
    $authMutationEntry
}) -join [IO.Path]::PathSeparator
foreach ($authMutationClassName in @('RoleService','MenuService','RoleSessionRefresher')) {
    $authMutationRelative = "io/eforge/enterprise/web/controller/api/v1/system/$authMutationClassName"
    $authMutationSource = Join-Path $authMutationRoot "server/eforge-boot/src/main/java/$authMutationRelative.java"
    $authMutationClass = Join-Path $authMutationRoot "server/eforge-boot/target/classes/$authMutationRelative.class"
    if (!(Test-Path -LiteralPath $authMutationClass) -or (Get-Item -LiteralPath $authMutationSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $authMutationClass).LastWriteTimeUtc) {
        throw 'Compile the current mutation services first; this script never builds or packages.'
    }
}
$authMutationName = 'eforge-auth-mutation-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$authMutationPassword = [guid]::NewGuid().ToString('N')
$authMutationOwned = $false
$authMutationPreviousUrl = $env:EFORGE_AUTH_MUTATION_JDBC_URL
$authMutationPreviousPassword = $env:EFORGE_AUTH_MUTATION_JDBC_PASSWORD
try {
    & docker run --detach --name $authMutationName --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$authMutationPassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create the isolated mutation database.' }
    $authMutationOwned = $true
    $authMutationReady = $false
    for ($authMutationAttempt=0; $authMutationAttempt -lt 60; $authMutationAttempt++) {
        & docker exec --env "MYSQL_PWD=$authMutationPassword" $authMutationName mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $authMutationReady = $true; break }
        Start-Sleep -Seconds 2
    }
    if (!$authMutationReady) { throw 'The isolated mutation database did not become ready.' }
    $authMutationAddress = & docker port $authMutationName 3306/tcp
    if ($LASTEXITCODE -ne 0 -or $authMutationAddress -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected mutation database port binding.' }
    $authMutationPort = $Matches[1]
    $env:EFORGE_AUTH_MUTATION_JDBC_URL = "jdbc:mysql://127.0.0.1:$authMutationPort/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
    $env:EFORGE_AUTH_MUTATION_JDBC_PASSWORD = $authMutationPassword
    & java '-Dfile.encoding=UTF-8' --class-path $authMutationClasspath (Join-Path $PSScriptRoot 'probes/AuthorizationMutationMysqlProbe.java') $authMutationRoot
    if ($LASTEXITCODE -ne 0) { throw 'Actual MySQL authorization mutation probe failed.' }
} finally {
    $env:EFORGE_AUTH_MUTATION_JDBC_URL = $authMutationPreviousUrl
    $env:EFORGE_AUTH_MUTATION_JDBC_PASSWORD = $authMutationPreviousPassword
    if ($authMutationOwned) { & docker rm --force $authMutationName | Out-Null }
}
