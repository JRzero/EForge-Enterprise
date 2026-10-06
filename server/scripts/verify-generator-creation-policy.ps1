# Pure prepared-SQL fidelity probe. Owns only its uniquely named disposable container.
param([string]$MavenRepository = (Join-Path $env:USERPROFILE '.m2/repository'))
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$policySource = Join-Path $PSScriptRoot 'probes/GeneratorCreationPolicyMysqlProbe.java'
$policyClasspath = @(
 (Join-Path $repoRoot 'server/eforge-generator/target/classes'),
 (Join-Path $repoRoot 'server/eforge-common/target/classes'),
 (Join-Path $MavenRepository 'com/alibaba/druid/1.2.28/druid-1.2.28.jar')
) -join [IO.Path]::PathSeparator
foreach ($policyDependency in $policyClasspath.Split([IO.Path]::PathSeparator)) {
 if (!(Test-Path -LiteralPath $policyDependency)) { throw 'Run Maven verify before the creation policy probe; dependency paths must exist.' }
}
$policyEncoded = & java --class-path $policyClasspath $policySource
if ($LASTEXITCODE -ne 0) { throw 'Creation policy probe generation failed.' }
$policyPreparedPath = Join-Path $repoRoot 'server/eforge-boot/target/generator-create-policy-prepared.sql'
[IO.File]::WriteAllText($policyPreparedPath, [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($policyEncoded)), [Text.UTF8Encoding]::new($false))
$ErrorActionPreference = 'Stop'
$probeContainer = 'eforge-policy-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$probePassword = [guid]::NewGuid().ToString('N')
$probeOwned = $false
try {
 & docker run --detach --network none --name $probeContainer --env "MYSQL_ROOT_PASSWORD=$probePassword" --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 | Out-Null
 if ($LASTEXITCODE -ne 0) { throw 'Unable to create isolated policy database.' }
 $probeOwned = $true
 $probeReady = $false
 for ($probeAttempt=0; $probeAttempt -lt 60; $probeAttempt++) {
  & docker exec --env "MYSQL_PWD=$probePassword" $probeContainer mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $probeReady = $true; break }
  Start-Sleep -Seconds 2
 }
 if (!$probeReady) { throw 'Isolated database did not become ready.' }
 "CREATE TABLE owned_source(id INT PRIMARY KEY,name VARCHAR(32));INSERT INTO owned_source VALUES(1,'retained');" | & docker exec -i --env "MYSQL_PWD=$probePassword" $probeContainer mysql -uroot eforge_enterprise
 if ($LASTEXITCODE -ne 0) { throw 'Unable to initialize owned source fixture.' }
 Get-Content -Raw -Encoding utf8 -LiteralPath $policyPreparedPath | & docker exec -i --env "MYSQL_PWD=$probePassword" $probeContainer mysql -uroot eforge_enterprise
 if ($LASTEXITCODE -ne 0) { throw 'Prepared SQL failed against actual MySQL.' }
 $probeMethods = & docker exec --env "MYSQL_PWD=$probePassword" $probeContainer mysql -uroot -N -B -e "SELECT DISTINCT TABLE_NAME,PARTITION_METHOD FROM information_schema.PARTITIONS WHERE TABLE_SCHEMA='eforge_enterprise' AND TABLE_NAME IN ('range_plain','range_columns','year_bounds') ORDER BY TABLE_NAME"
 if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect actual partition types.' }
 $probeMethods | Write-Output
 if (($probeMethods -join "`n") -notmatch "range_plain\s+RANGE(?:\r?\n|$)" -or ($probeMethods -join "`n") -notmatch "range_columns\s+RANGE COLUMNS") { throw 'Prepared range types changed actual database semantics.' }
 $probeShow = & docker exec --env "MYSQL_PWD=$probePassword" $probeContainer mysql -uroot -N -B eforge_enterprise -e 'SHOW CREATE TABLE sub_options'
 if ($LASTEXITCODE -ne 0 -or ($probeShow -join ' ') -notmatch "COMMENT = 'kept'") { throw 'Subpartition comment was not retained in actual DDL.' }
 $probeData = & docker exec --env "MYSQL_PWD=$probePassword" $probeContainer mysql -uroot -N -B eforge_enterprise -e 'SELECT id,name FROM cte_copy;SELECT id,name FROM owned_source;SELECT COUNT(*) FROM like_copy'
 if ($LASTEXITCODE -ne 0 -or $probeData.Count -ne 3 -or $probeData[0] -ne "1`tretained" -or $probeData[1] -ne "1`tretained" -or $probeData[2] -ne '0') { throw 'CTE/LIKE copy or source retention differs.' }
 Write-Output 'PASS: isolated MySQL prepared RANGE/RANGE COLUMNS/YEAR/subpartition/CTE/LIKE and source retention.'
} finally {
 if ($probeOwned) { & docker rm --force $probeContainer | Out-Null }
}