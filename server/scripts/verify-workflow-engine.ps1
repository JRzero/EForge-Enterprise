# Run only against this script's disposable MySQL; never a developer/production schema.
param([ValidateSet(0,1)][int]$LowerCaseTableNames=0, [switch]$Packages)
$ErrorActionPreference='Stop'
$workflowRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$workflowName='eforge-workflow-'+[guid]::NewGuid().ToString('N').Substring(0,12)
$workflowPassword=[guid]::NewGuid().ToString('N')
$workflowOwned=$false
$workflowPreviousUrl=$env:EFORGE_WORKFLOW_TEST_JDBC_URL
$workflowPreviousPassword=$env:EFORGE_WORKFLOW_TEST_JDBC_PASSWORD
try {
    & docker run --detach --name $workflowName --label 'eforge.test=workflow' --publish '127.0.0.1::3306' --env "MYSQL_ROOT_PASSWORD=$workflowPassword" --env 'MYSQL_ROOT_HOST=%' --env MYSQL_DATABASE=eforge_workflow mysql:8.4 "--lower-case-table-names=$LowerCaseTableNames" | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Could not create isolated workflow database.'}
    $workflowOwned=$true
    $workflowReady=$false
    for($workflowAttempt=0;$workflowAttempt -lt 60;$workflowAttempt++) {
        & docker exec --env "MYSQL_PWD=$workflowPassword" $workflowName mysql --protocol=TCP --host=127.0.0.1 -uroot -e 'SELECT 1' 2>$null | Out-Null
        if($LASTEXITCODE -eq 0){$workflowReady=$true;break}
        Start-Sleep -Seconds 2
    }
    if(!$workflowReady){throw 'Isolated workflow database did not become ready.'}
    foreach($workflowSchemaFile in @('01-common.sql','02-engine.sql','03-history.sql')) {
        Get-Content -LiteralPath (Join-Path $workflowRoot "sql/workflow/flowable-7.2.0/$workflowSchemaFile") -Raw |
            & docker exec -i --env "MYSQL_PWD=$workflowPassword" $workflowName mysql --default-character-set=utf8mb4 -uroot eforge_workflow
        if($LASTEXITCODE -ne 0){throw 'Explicit official workflow schema installation failed.'}
    }
    if ($Packages) {
        Get-Content -LiteralPath (Join-Path $workflowRoot 'sql/workflow/04-eforge-workflow.sql') -Raw |
            & docker exec -i --env "MYSQL_PWD=$workflowPassword" $workflowName mysql --default-character-set=utf8mb4 -uroot eforge_workflow
        if ($LASTEXITCODE -ne 0) { throw 'Workflow package schema installation failed.' }
    }
    $workflowAddress=& docker port $workflowName 3306/tcp
    if($LASTEXITCODE -ne 0 -or $workflowAddress -notmatch '^127\.0\.0\.1:(\d+)$'){throw 'Unexpected workflow port binding.'}
    $env:EFORGE_WORKFLOW_TEST_JDBC_URL="jdbc:mysql://127.0.0.1:$($Matches[1])/eforge_workflow?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC"
    $env:EFORGE_WORKFLOW_TEST_JDBC_PASSWORD=$workflowPassword
    $workflowTest = if ($Packages) {'-Dtest=WorkflowPackageMysqlTest'} else {'-Dtest=WorkflowEngineConfigurationTest#realEngineAndBusinessWritesShareCommitAndRollback'}
    & mvn -B -ntp -f (Join-Path $workflowRoot 'server/pom.xml') -pl eforge-workflow -am test $workflowTest '-Dsurefire.failIfNoSpecifiedTests=false'
    if($LASTEXITCODE -ne 0){throw 'Actual MySQL workflow transaction test failed.'}
} finally {
    $env:EFORGE_WORKFLOW_TEST_JDBC_URL=$workflowPreviousUrl
    $env:EFORGE_WORKFLOW_TEST_JDBC_PASSWORD=$workflowPreviousPassword
    if($workflowOwned){& docker rm --force $workflowName | Out-Null}
}
