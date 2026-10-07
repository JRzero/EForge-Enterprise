param([ValidateSet(0,1)][int]$LowerCaseTableNames=0)
$ErrorActionPreference='Stop'
$taskRepo=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskReport=Join-Path $taskRepo 'server/eforge-boot/target/surefire-reports/TEST-io.eforge.enterprise.web.controller.api.v1.monitor.TaskMutationBoundaryTest.xml'
if(!(Test-Path -LiteralPath $taskReport)){throw 'Run the task boundary Maven tests before the native probe.'}
[xml]$taskXml=Get-Content -LiteralPath $taskReport -Raw
$taskClasspath=($taskXml.testsuite.properties.property | Where-Object {$_.name -eq 'java.class.path'}).value
if(!$taskClasspath){throw 'Missing resolved task runtime classpath.'}
$taskClasspath=($taskClasspath.Split([IO.Path]::PathSeparator) | Where-Object {![string]::IsNullOrWhiteSpace($_)}) -join [IO.Path]::PathSeparator
foreach($taskDependency in $taskClasspath.Split([IO.Path]::PathSeparator)){if(!(Test-Path -LiteralPath $taskDependency)){throw 'Missing task runtime dependency.'}}
$taskName='eforge-task-boundary-'+[guid]::NewGuid().ToString('N').Substring(0,12)
$taskPassword=[guid]::NewGuid().ToString('N')
$taskOwned=$false
$taskPreviousUrl=$env:EFORGE_POLICY_JDBC_URL
$taskPreviousPassword=$env:EFORGE_POLICY_JDBC_PASSWORD
try {
 & docker run --detach --name $taskName --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$taskPassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_enterprise mysql:8.4 "--lower-case-table-names=$LowerCaseTableNames" | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Unable to create isolated task database.'}
 $taskOwned=$true
 $taskReady=$false
 for($taskAttempt=0;$taskAttempt -lt 60;$taskAttempt++){
  & docker exec --env "MYSQL_PWD=$taskPassword" $taskName mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
  if($LASTEXITCODE -eq 0){$taskReady=$true;break}
  Start-Sleep -Seconds 2
 }
 if(!$taskReady){throw 'Isolated task database did not become ready.'}
 $taskAddress=& docker port $taskName 3306/tcp
 if($LASTEXITCODE -ne 0 -or $taskAddress -notmatch '^127\.0\.0\.1:(\d+)$'){throw 'Unexpected isolated task port binding.'}
 $env:EFORGE_POLICY_JDBC_URL="jdbc:mysql://127.0.0.1:$($Matches[1])/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
 $env:EFORGE_POLICY_JDBC_PASSWORD=$taskPassword
 & java --class-path $taskClasspath (Join-Path $PSScriptRoot 'probes/TaskMutationMysqlProbe.java') $taskRepo
 if($LASTEXITCODE -ne 0){throw 'Actual MySQL task consistency probe failed.'}
} finally {
 $env:EFORGE_POLICY_JDBC_URL=$taskPreviousUrl
 $env:EFORGE_POLICY_JDBC_PASSWORD=$taskPreviousPassword
 if($taskOwned){& docker rm --force $taskName | Out-Null}
}
