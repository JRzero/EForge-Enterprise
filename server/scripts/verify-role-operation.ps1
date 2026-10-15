# Actual legacy role operation storage/transaction boundary. Owns one random-port MySQL container.
param()
$ErrorActionPreference = 'Stop'
$roleOperationRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$roleOperationReportPath = Join-Path $roleOperationRoot 'server/eforge-boot/target/surefire-reports/TEST-io.eforge.enterprise.web.controller.system.LegacyRoleOperationBoundaryTest.xml'
if (!(Test-Path -LiteralPath $roleOperationReportPath)) { throw 'Run LegacyRoleOperationBoundaryTest before this native probe.' }
[xml]$roleOperationReport = Get-Content -LiteralPath $roleOperationReportPath -Raw
if ([int]$roleOperationReport.testsuite.failures -ne 0 -or [int]$roleOperationReport.testsuite.errors -ne 0) { throw 'The role boundary unit tests must be green before this native probe.' }
$roleOperationClasspath = ($roleOperationReport.testsuite.properties.property | Where-Object { $_.name -eq 'java.class.path' }).value
if (!$roleOperationClasspath) { throw 'The Maven report has no resolved runtime classpath.' }
$roleOperationClasspath = ($roleOperationClasspath.Split([IO.Path]::PathSeparator) | Where-Object { ![string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
    $roleOperationEntry = $_
    if ($roleOperationEntry.StartsWith((Join-Path $roleOperationRoot 'server') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetExtension($roleOperationEntry) -eq '.jar' -and [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($roleOperationEntry)) -eq 'target') {
        $roleOperationEntry = Join-Path ([IO.Path]::GetDirectoryName($roleOperationEntry)) 'classes'
    }
    if (!(Test-Path -LiteralPath $roleOperationEntry)) { throw 'Compile the current reactor modules before this native probe.' }
    $roleOperationEntry
}) -join [IO.Path]::PathSeparator
foreach ($roleOperationRelative in @('api/v1/system/RoleService','api/v1/system/RoleSessionRefresher','system/SysRoleController')) {
    $roleOperationSource = Join-Path $roleOperationRoot "server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/$roleOperationRelative.java"
    $roleOperationClass = Join-Path $roleOperationRoot "server/eforge-boot/target/classes/io/eforge/enterprise/web/controller/$roleOperationRelative.class"
    if (!(Test-Path -LiteralPath $roleOperationClass) -or (Get-Item -LiteralPath $roleOperationSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $roleOperationClass).LastWriteTimeUtc) {
        throw 'Compile the current role controller/services first; this script never builds or packages.'
    }
}
$roleOperationName = 'eforge-role-operation-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$roleOperationPassword = [guid]::NewGuid().ToString('N')
$roleOperationOwned = $false
$roleOperationPreviousUrl = $env:EFORGE_ROLE_OPERATION_JDBC_URL
$roleOperationPreviousPassword = $env:EFORGE_ROLE_OPERATION_JDBC_PASSWORD
try {
    & docker run --detach --name $roleOperationName --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$roleOperationPassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create the isolated role-operation database.' }
    $roleOperationOwned = $true
    $roleOperationReady = $false
    for ($roleOperationAttempt=0; $roleOperationAttempt -lt 60; $roleOperationAttempt++) {
        & docker exec --env "MYSQL_PWD=$roleOperationPassword" $roleOperationName mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $roleOperationReady = $true; break }
        Start-Sleep -Seconds 2
    }
    if (!$roleOperationReady) { throw 'The isolated role-operation database did not become ready.' }
    $roleOperationAddress = & docker port $roleOperationName 3306/tcp
    if ($LASTEXITCODE -ne 0 -or $roleOperationAddress -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected role-operation database port binding.' }
    $roleOperationPort = $Matches[1]
    $env:EFORGE_ROLE_OPERATION_JDBC_URL = "jdbc:mysql://127.0.0.1:$roleOperationPort/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
    $env:EFORGE_ROLE_OPERATION_JDBC_PASSWORD = $roleOperationPassword
    & java '-Dfile.encoding=UTF-8' --class-path $roleOperationClasspath (Join-Path $PSScriptRoot 'probes/RoleOperationMysqlProbe.java') $roleOperationRoot
    if ($LASTEXITCODE -ne 0) { throw 'Actual MySQL legacy role-operation probe failed.' }
} finally {
    $env:EFORGE_ROLE_OPERATION_JDBC_URL = $roleOperationPreviousUrl
    $env:EFORGE_ROLE_OPERATION_JDBC_PASSWORD = $roleOperationPreviousPassword
    if ($roleOperationOwned) { & docker rm --force $roleOperationName | Out-Null }
}
