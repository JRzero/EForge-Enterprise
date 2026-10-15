# This probe owns one labeled disposable MySQL container on a random loopback port.
# It never compiles/packages production code or touches the preview database.
param()
$ErrorActionPreference = 'Stop'
$deptProbeRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$deptProbeReport = Join-Path $deptProbeRoot 'server/eforge-boot/target/surefire-reports/TEST-io.eforge.enterprise.web.controller.api.v1.system.AuthorizationMutationCommitTest.xml'
if (!(Test-Path -LiteralPath $deptProbeReport)) { throw 'Complete current Maven verification before this native department probe.' }
[xml]$deptProbeXml = Get-Content -LiteralPath $deptProbeReport -Raw
$deptProbeClasspath = ($deptProbeXml.testsuite.properties.property | Where-Object name -eq 'java.class.path').value
if (!$deptProbeClasspath) { throw 'The Maven report has no resolved Java classpath.' }
$deptProbeClasspath = ($deptProbeClasspath.Split([IO.Path]::PathSeparator) | Where-Object { $_ } | ForEach-Object {
    $deptProbeEntry = $_
    if ($deptProbeEntry.StartsWith((Join-Path $deptProbeRoot 'server') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetExtension($deptProbeEntry) -eq '.jar' -and [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($deptProbeEntry)) -eq 'target') {
        $deptProbeEntry = Join-Path ([IO.Path]::GetDirectoryName($deptProbeEntry)) 'classes'
    }
    if (!(Test-Path -LiteralPath $deptProbeEntry)) { throw 'Compile all current reactor dependencies before this native probe.' }
    $deptProbeEntry
}) -join [IO.Path]::PathSeparator
foreach ($deptProbeRelative in @(
    'eforge-system/src/main/java/io/eforge/enterprise/system/service/impl/SysDeptServiceImpl.java',
    'eforge-boot/src/main/java/io/eforge/enterprise/web/controller/system/SysDeptController.java',
    'eforge-framework/src/main/java/io/eforge/enterprise/framework/aspectj/DataScopeAspect.java')) {
    $deptProbeSource = Join-Path $deptProbeRoot "server/$deptProbeRelative"
    $deptProbeClass = $deptProbeSource -replace '[\\/]src[\\/]main[\\/]java[\\/]', '/target/classes/' -replace '\.java$', '.class'
    if (!(Test-Path -LiteralPath $deptProbeClass) -or (Get-Item -LiteralPath $deptProbeSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $deptProbeClass).LastWriteTimeUtc) {
        throw "Compile the current production department classes first ($deptProbeRelative); this probe never builds."
    }
}
$deptProbeRun = [guid]::NewGuid().ToString('N').Substring(0,12)
$deptProbeContainer = "eforge-dept-mutation-$deptProbeRun"
$deptProbePassword = [guid]::NewGuid().ToString('N')
$deptProbeOwned = $false
$deptProbePreviousUrl = $env:EFORGE_DEPT_MUTATION_JDBC_URL
$deptProbePreviousPassword = $env:EFORGE_DEPT_MUTATION_JDBC_PASSWORD
try {
    & docker run --detach --name $deptProbeContainer --label "eforge.dept-mutation-owner=$deptProbeRun" --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$deptProbePassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the owned department MySQL fixture.' }; $deptProbeOwned = $true
    $deptProbeReady = $false
    for ($deptProbeAttempt = 0; $deptProbeAttempt -lt 60; $deptProbeAttempt++) {
        & docker exec --env "MYSQL_PWD=$deptProbePassword" $deptProbeContainer mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $deptProbeReady = $true; break }; Start-Sleep -Seconds 2
    }
    if (!$deptProbeReady) { throw 'Owned department MySQL did not become ready.' }
    $deptProbeAddress = & docker port $deptProbeContainer 3306/tcp
    if ($LASTEXITCODE -ne 0 -or $deptProbeAddress -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Unexpected owned department MySQL binding.' }
    $env:EFORGE_DEPT_MUTATION_JDBC_URL = "jdbc:mysql://127.0.0.1:$($Matches[1])/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
    $env:EFORGE_DEPT_MUTATION_JDBC_PASSWORD = $deptProbePassword
    & java '-Dfile.encoding=UTF-8' --class-path $deptProbeClasspath (Join-Path $PSScriptRoot 'probes/DepartmentMutationMysqlProbe.java') $deptProbeRoot
    if ($LASTEXITCODE -ne 0) { throw 'Actual department transaction/root-lock probe failed.' }
} finally {
    $env:EFORGE_DEPT_MUTATION_JDBC_URL = $deptProbePreviousUrl
    $env:EFORGE_DEPT_MUTATION_JDBC_PASSWORD = $deptProbePreviousPassword
    if ($deptProbeOwned) {
        $deptProbeOwner = & docker inspect --format '{{ index .Config.Labels "eforge.dept-mutation-owner" }}' $deptProbeContainer 2>$null
        if ($LASTEXITCODE -eq 0 -and $deptProbeOwner -ceq $deptProbeRun) { & docker rm --force $deptProbeContainer | Out-Null }
    }
}
