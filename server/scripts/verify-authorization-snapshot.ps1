# Owns only its uniquely named disposable MySQL container and random localhost port.
# Does not build modules or use a running application, preview port, or shared database.
param()
$ErrorActionPreference = 'Stop'
$authProbeRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$authProbeReportPath = Join-Path $authProbeRoot 'server/eforge-boot/target/surefire-reports/TEST-io.eforge.enterprise.web.controller.api.v1.app.BootstrapServiceTest.xml'
if (!(Test-Path -LiteralPath $authProbeReportPath)) { throw 'Run Maven verify before the authorization snapshot probe.' }
[xml]$authProbeReport = Get-Content -LiteralPath $authProbeReportPath -Raw
$authProbeClasspath = ($authProbeReport.testsuite.properties.property | Where-Object { $_.name -eq 'java.class.path' }).value
if (!$authProbeClasspath) { throw 'The Maven report has no resolved runtime classpath.' }
$authProbeClasspath = ($authProbeClasspath.Split([IO.Path]::PathSeparator) | Where-Object { ![string]::IsNullOrWhiteSpace($_) }) -join [IO.Path]::PathSeparator
# Surefire may record reactor jars. Use the corresponding compiled reactor output,
# so a focused test-compile cannot accidentally probe an older packaged class.
$authProbeClasspath = ($authProbeClasspath.Split([IO.Path]::PathSeparator) | ForEach-Object {
    $authProbeEntry = $_
    if ($authProbeEntry.StartsWith((Join-Path $authProbeRoot 'server') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetExtension($authProbeEntry) -eq '.jar' -and [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($authProbeEntry)) -eq 'target') {
        $authProbeCompiled = Join-Path ([IO.Path]::GetDirectoryName($authProbeEntry)) 'classes'
        if (!(Test-Path -LiteralPath $authProbeCompiled)) { throw 'Compile the reactor modules before the authorization snapshot probe.' }
        $authProbeEntry = $authProbeCompiled
    }
    $authProbeEntry
}) -join [IO.Path]::PathSeparator
foreach ($authProbeDependency in $authProbeClasspath.Split([IO.Path]::PathSeparator)) {
    if (!(Test-Path -LiteralPath $authProbeDependency)) { throw 'Build the current modules before the authorization snapshot probe.' }
}
$authProbeClass = Join-Path $authProbeRoot 'server/eforge-framework/target/classes/io/eforge/enterprise/framework/web/service/AuthorizationSnapshotService.class'
if (!(Test-Path -LiteralPath $authProbeClass)) { throw 'Build AuthorizationSnapshotService before this probe; the script never builds while an application is running.' }
$authProbeSource = Join-Path $authProbeRoot 'server/eforge-framework/src/main/java/io/eforge/enterprise/framework/web/service/AuthorizationSnapshotService.java'
if ((Get-Item -LiteralPath $authProbeSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $authProbeClass).LastWriteTimeUtc) { throw 'AuthorizationSnapshotService changed after compilation; compile it before running the probe.' }
$authProbeName = 'eforge-auth-snapshot-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$authProbePassword = [guid]::NewGuid().ToString('N')
$authProbeOwned = $false
$authProbePreviousUrl = $env:EFORGE_AUTH_PROBE_JDBC_URL
$authProbePreviousPassword = $env:EFORGE_AUTH_PROBE_JDBC_PASSWORD
try {
    & docker run --detach --name $authProbeName --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$authProbePassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Unable to create the isolated authorization database.' }
    $authProbeOwned = $true
    $authProbeReady = $false
    for ($authProbeAttempt = 0; $authProbeAttempt -lt 60; $authProbeAttempt++) {
        & docker exec --env "MYSQL_PWD=$authProbePassword" $authProbeName mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $authProbeReady = $true; break }
        Start-Sleep -Seconds 2
    }
    if (!$authProbeReady) { throw 'The isolated authorization database did not become ready.' }
    $authProbeAddress = & docker port $authProbeName 3306/tcp
    if ($LASTEXITCODE -ne 0 -or $authProbeAddress -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected authorization database port binding.' }
    $authProbePort = $Matches[1]
    $env:EFORGE_AUTH_PROBE_JDBC_URL = "jdbc:mysql://127.0.0.1:$authProbePort/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
    $env:EFORGE_AUTH_PROBE_JDBC_PASSWORD = $authProbePassword
    & java '-Dfile.encoding=UTF-8' --class-path $authProbeClasspath (Join-Path $PSScriptRoot 'probes/AuthorizationSnapshotMysqlProbe.java') $authProbeRoot
    if ($LASTEXITCODE -ne 0) { throw 'Actual Spring/MyBatis authorization snapshot probe failed.' }
} finally {
    $env:EFORGE_AUTH_PROBE_JDBC_URL = $authProbePreviousUrl
    $env:EFORGE_AUTH_PROBE_JDBC_PASSWORD = $authProbePreviousPassword
    if ($authProbeOwned) { & docker rm --force $authProbeName | Out-Null }
}
