# Owns one uniquely named disposable MySQL container and an ephemeral localhost port.
param([ValidateSet(0,1)][int]$LowerCaseTableNames=0)
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$probeReportPath=Join-Path $repoRoot 'server/eforge-boot/target/surefire-reports/TEST-io.eforge.enterprise.web.controller.api.v1.tool.GeneratorCreationAstPolicyTest.xml'
if(!(Test-Path -LiteralPath $probeReportPath)){throw 'Run Maven verify before the generator import probe.'}
[xml]$probeReport=Get-Content -LiteralPath $probeReportPath -Raw
$probeClasspath=($probeReport.testsuite.properties.property | Where-Object {$_.name -eq 'java.class.path'}).value
if(!$probeClasspath){throw 'The Maven report has no resolved runtime classpath.'}
$probeClasspath=($probeClasspath.Split([IO.Path]::PathSeparator) | Where-Object {![string]::IsNullOrWhiteSpace($_)}) -join [IO.Path]::PathSeparator
foreach($probeDependency in $probeClasspath.Split([IO.Path]::PathSeparator)) {if(!(Test-Path -LiteralPath $probeDependency)){throw 'Run Maven verify before the generator preflight probe.'}}
$probeName='eforge-import-'+[guid]::NewGuid().ToString('N').Substring(0,12)
$probePassword=[guid]::NewGuid().ToString('N')
$probeOwned=$false
$probePreviousUrl=$env:EFORGE_POLICY_JDBC_URL
$probePreviousPassword=$env:EFORGE_POLICY_JDBC_PASSWORD
try {
 & docker run --detach --name $probeName --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$probePassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 "--lower-case-table-names=$LowerCaseTableNames" | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Unable to create isolated preflight database.'}
 $probeOwned=$true
 $probeReady=$false
 for($probeAttempt=0;$probeAttempt -lt 60;$probeAttempt++) {
  & docker exec --env "MYSQL_PWD=$probePassword" $probeName mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
  if($LASTEXITCODE -eq 0){$probeReady=$true;break}
  Start-Sleep -Seconds 2
 }
 if(!$probeReady){throw 'Isolated preflight database did not become ready.'}
 $probeAddress=& docker port $probeName 3306/tcp
 if($LASTEXITCODE -ne 0 -or $probeAddress -notmatch '^127\.0\.0\.1:(\d+)$'){throw 'Unexpected preflight database port binding.'}
 $probePort=$Matches[1]
 $env:EFORGE_POLICY_JDBC_URL="jdbc:mysql://127.0.0.1:$probePort/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
 $env:EFORGE_POLICY_JDBC_PASSWORD=$probePassword
 & java --class-path $probeClasspath (Join-Path $PSScriptRoot 'probes/GeneratorCreationImportMysqlProbe.java') $repoRoot
 if($LASTEXITCODE -ne 0){throw 'Actual Spring/MyBatis generator import probe failed.'}
} finally {
 $env:EFORGE_POLICY_JDBC_URL=$probePreviousUrl
 $env:EFORGE_POLICY_JDBC_PASSWORD=$probePreviousPassword
 if($probeOwned){& docker rm --force $probeName | Out-Null}
}