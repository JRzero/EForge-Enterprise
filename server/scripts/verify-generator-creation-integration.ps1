# Uses only parent-owned disposable database fixtures.
$creationMarker="gcreate_$runId";$creationTrigger="gcreate_fault_$runId";$creationUserId=$null
function Creation-Sql([string]$sql){return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e $sql}
function Creation-Body([string]$sql){return @{sql=$sql}|ConvertTo-Json -Compress}
function Creation-Legacy([string]$sql,[string]$template='element-ui'){
    $response=Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort/tool/gen/createTable" -Method POST -Headers $authorized -Body @{sql=$sql;tplWebType=$template} -SkipHttpErrorCheck -TimeoutSec 30
    return $response.Content|ConvertFrom-Json
}
try {
    $creationPath='/api/v1/tool/generator/creations'
    $creationSql="CREATE TABLE $($creationMarker)_success(entry_id BIGINT PRIMARY KEY AUTO_INCREMENT,name VARCHAR(40) NOT NULL)"
    Assert-Problem (Request $creationPath 'POST' (Creation-Body $creationSql)) 401 'AUTHENTICATION_REQUIRED'
    $creationUsername="gcrt$runId"
    $creationAccount=Request '/api/v1/system/users' 'POST' (@{user=@{username=$creationUsername;displayName='建表无角色';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 5 -Compress) $authorized
    Assert-Check ($creationAccount.StatusCode -eq 201) 'Creation no-role account setup failed.'
    $creationUserId=($creationAccount.Content|ConvertFrom-Json).id
    $creationLogin=Request '/api/v1/auth/login' 'POST' (@{username=$creationUsername;password='User12345'}|ConvertTo-Json -Compress)
    Assert-Problem (Request $creationPath 'POST' (Creation-Body $creationSql) @{Authorization="Bearer $(($creationLogin.Content|ConvertFrom-Json).accessToken)"}) 403 'ACCESS_DENIED'
    Assert-Check ((Creation-Sql "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$($creationMarker)_success';") -eq '0') 'Creation refusal ran physical DDL.'
    $creationResponse=Request $creationPath 'POST' (Creation-Body $creationSql) $authorized
    Assert-Check ($creationResponse.StatusCode -eq 201) 'Canonical physical creation/import failed.'
    $creationResult=$creationResponse.Content|ConvertFrom-Json
    Assert-Check ($creationResult.importState -eq 'IMPORTED' -and $creationResult.imported.Count -eq 1 -and $creationResult.imported[0].id -is [string] -and $creationResult.imported[0].columnCount -eq 2 -and $creationResult.physical[0].state -eq 'CREATED') 'Creation result is not concrete or truthful.'
    $creationDetail=(Request "/api/v1/tool/generator/tables/$($creationResult.imported[0].id)" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($creationDetail.table.webType -eq 'eforge-react' -and $creationDetail.columns[0].primaryKey -and $creationDetail.columns[0].autoIncrement) 'Created metadata lost original initialization.'
    $creationMixed="CREATE TABLE $($creationMarker)_mixed(id INT); DELETE FROM $($creationMarker)_success"
    Assert-Problem (Request $creationPath 'POST' (Creation-Body $creationMixed) $authorized) 400 'GENERATOR_CREATE_SQL_INVALID'
    Assert-Check ((Creation-Sql "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$($creationMarker)_mixed';") -eq '0') 'Invalid later statement caused early DDL.'
    $creationPartial="CREATE TABLE $($creationMarker)_first(id INT);CREATE TABLE $($creationMarker)_bad(value VARCHAR(70000));CREATE TABLE $($creationMarker)_last(id INT)"
    $creationFailure=Request $creationPath 'POST' (Creation-Body $creationPartial) $authorized
    Assert-Problem $creationFailure 500 'GENERATOR_CREATE_DDL_FAILED'
    $creationPartialResult=($creationFailure.Content|ConvertFrom-Json).creation
    Assert-Check (($creationPartialResult.physical.state -join ',') -eq 'CREATED,FAILED,UNATTEMPTED' -and $creationPartialResult.importState -eq 'UNATTEMPTED') 'Partial physical HTTP outcomes lost.'
    Creation-Sql "INSERT INTO $($creationMarker)_first VALUES(81);"|Out-Null
    Assert-Check ((Creation-Sql "SELECT id FROM $($creationMarker)_first;") -eq '81') 'Partial created physical table not retained.'
    Assert-Check ((Creation-Sql "SELECT COUNT(*) FROM gen_table WHERE table_name='$($creationMarker)_first';") -eq '0') 'Partial physical batch imported metadata.'
    $creationLegacy=Creation-Legacy "CREATE TABLE $($creationMarker)_original(id INT)" 'element-plus-typescript'
    Assert-Check ($creationLegacy.code -eq 200 -and $creationLegacy.data.importState -eq 'IMPORTED') 'Original creation did not use shared successful pipeline.'
    Assert-Check ((Creation-Sql "SELECT tpl_web_type FROM gen_table WHERE table_name='$($creationMarker)_original';") -eq 'element-plus-typescript') 'Original creation template lost.'
    Creation-Sql "SET SESSION sql_mode='STRICT_ALL_TABLES'; CREATE TRIGGER $creationTrigger BEFORE INSERT ON gen_table_column FOR EACH ROW SET NEW.column_name=IF(NEW.column_name='fault_field',REPEAT('x',1000),NEW.column_name);"|Out-Null
    try {
        foreach($creationMode in @('canonical','legacy')){
            $creationFaultName="$($creationMarker)_$creationMode"
            $creationFaultSql="CREATE TABLE $creationFaultName(id INT,fault_field INT)"
            if($creationMode -eq 'canonical'){
                $creationFaultResponse=Request $creationPath 'POST' (Creation-Body $creationFaultSql) $authorized
                Assert-Problem $creationFaultResponse 500 'GENERATOR_IMPORT_FAILED'
                $creationFault=($creationFaultResponse.Content|ConvertFrom-Json).creation
                Assert-Check (!$creationFaultResponse.Content.Contains('fault_field') -and !$creationFaultResponse.Content.Contains($creationTrigger)) 'Canonical creation leaked SQL/driver information.'
            } else {
                $creationFaultAjax=Creation-Legacy $creationFaultSql
                Assert-Check ($creationFaultAjax.code -eq 500 -and $creationFaultAjax.failureCode -eq 'GENERATOR_IMPORT_FAILED') 'Legacy creation hid import failure.'
                $creationFault=$creationFaultAjax.data
                Assert-Check ($creationFaultAjax.msg -eq 'Created table metadata could not be saved.') 'Legacy creation leaked driver message.'
            }
            Assert-Check ($creationFault.importState -eq 'FAILED' -and $creationFault.physical[0].state -eq 'CREATED') 'Metadata failure hid committed DDL.'
            Assert-Check ((Creation-Sql "SELECT COUNT(*) FROM gen_table WHERE table_name='$creationFaultName';") -eq '0') 'Creation failure left metadata.'
            Creation-Sql "INSERT INTO $creationFaultName(id) VALUES(87);"|Out-Null
            Assert-Check ((Creation-Sql "SELECT id FROM $creationFaultName;") -eq '87') 'Creation import rollback destroyed physical table.'
        }
    } finally {Creation-Sql "DROP TRIGGER IF EXISTS $creationTrigger;"|Out-Null}
    Assert-Problem (Request $creationPath 'POST' (Creation-Body "CREATE TABLE IF NOT EXISTS $($creationMarker)_canonical(id INT)") $authorized) 409 'GENERATOR_CREATE_TARGET_EXISTS'
    $creationRecovery=Request '/api/v1/tool/generator/imports' 'POST' (@{names=@("$($creationMarker)_canonical","$($creationMarker)_legacy")}|ConvertTo-Json -Compress) $authorized
    Assert-Check ($creationRecovery.StatusCode -eq 201) 'Retained physical tables cannot be recovered with explicit metadata import.'
    $creationRaceBody=Creation-Body "CREATE TABLE IF NOT EXISTS $($creationMarker)_race(id INT)"
    $creationJobs=@()
    try {
        1..2|ForEach-Object {$creationJobs+=Start-Job -ScriptBlock {param($url,$body,$authorization)
            $response=Invoke-WebRequest -Uri $url -Method POST -ContentType 'application/json' -Body $body -Headers @{Authorization=$authorization} -SkipHttpErrorCheck -TimeoutSec 45
            $creationPayload=$response.Content
            $creationPayloadKind=$creationPayload.GetType().Name
            if($creationPayload -is [byte[]]){$creationPayload=[Text.Encoding]::UTF8.GetString($creationPayload)}
            [pscustomobject]@{status=[int]$response.StatusCode;content=$creationPayload;payloadKind=$creationPayloadKind}
        } -ArgumentList "http://127.0.0.1:$AppPort/api/v1/tool/generator/creations",$creationRaceBody,$authorized.Authorization}
        $creationJobs|Wait-Job -Timeout 60|Out-Null
        $creationRaceOutcomes=@($creationJobs|Receive-Job)
        Assert-Check ($creationRaceOutcomes.Count -eq 2 -and @($creationRaceOutcomes|Where-Object {$_.status -eq 201}).Count -eq 1 -and @($creationRaceOutcomes|Where-Object {$_.status -eq 409}).Count -eq 1) 'Concurrent creation must acknowledge one owner and reject the other.'
        $creationRaceLoser=($creationRaceOutcomes|Where-Object {$_.status -eq 409}).content|ConvertFrom-Json
        Write-Output ("Creation HTTP payload kinds: $($creationRaceOutcomes.payloadKind -join ','); loser code $($creationRaceLoser.code).")
        Assert-Check (@('GENERATOR_CREATE_TARGET_EXISTS','GENERATOR_TABLE_ALREADY_IMPORTED') -contains $creationRaceLoser.code) 'Concurrent IF NOT EXISTS loser claimed ownership.'
        Write-Output ("Creation race: one HTTP 201 owner; HTTP 409 loser code $($creationRaceLoser.code).")
    } finally {$creationJobs|Remove-Job -Force}
    Assert-Check ((Creation-Sql "SELECT COUNT(*) FROM gen_table WHERE table_name='$($creationMarker)_race';") -eq '1') 'Concurrent creation duplicated metadata.'
    $creationAuditReady=$false
    for($creationAuditAttempt=0;$creationAuditAttempt -lt 40;$creationAuditAttempt++){
        $creationAuditCount=[int](Creation-Sql "SELECT COUNT(*) FROM sys_oper_log WHERE oper_url IN ('/api/v1/tool/generator/creations','/tool/gen/createTable');")
        if($creationAuditCount -ge 6){$creationAuditReady=$true;break}
        Start-Sleep -Milliseconds 250
    }
    Assert-Check $creationAuditReady 'Creation audit records did not arrive.'
    Assert-Check ((Creation-Sql "SELECT COUNT(*) FROM sys_oper_log WHERE oper_url IN ('/api/v1/tool/generator/creations','/tool/gen/createTable') AND COALESCE(oper_param,'')<>'';") -eq '0') 'Creation request SQL was stored in audit.'
    Assert-Check ([int](Creation-Sql "SELECT COUNT(*) FROM sys_oper_log WHERE oper_url='/tool/gen/createTable' AND status=1;") -ge 1) 'Original failed creation audit was incorrectly successful.'
    Assert-Check ((Creation-Sql "SELECT COUNT(*) FROM sys_oper_log WHERE oper_url IN ('/api/v1/tool/generator/creations','/tool/gen/createTable') AND (error_msg LIKE '%fault_field%' OR error_msg LIKE '%$creationTrigger%');") -eq '0') 'Creation audit leaked SQL failure details.'
    Write-Output 'Generator creation HTTP: canonical/legacy shared pipeline, complete batch preflight, physical partial outcomes, retained rows, SQL fault metadata rollback/privacy and explicit recovery passed.'
} finally {
    Creation-Sql "DROP TRIGGER IF EXISTS $creationTrigger; DELETE c FROM gen_table_column c JOIN gen_table t ON c.table_id=t.table_id WHERE t.table_name LIKE '$creationMarker%';DELETE FROM gen_table WHERE table_name LIKE '$creationMarker%';"|Out-Null
    if($creationUserId){Request "/api/v1/system/users/$creationUserId" 'DELETE' '' $authorized|Out-Null}
    # Fixtures are fixed names in this run's disposable database, never arbitrary user names.
    foreach($creationSuffix in @('success','mixed','first','bad','last','original','legacy','canonical','race')){
        Creation-Sql "DROP TABLE IF EXISTS $($creationMarker)_$creationSuffix;"|Out-Null
    }
}
