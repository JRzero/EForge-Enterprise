# All DDL/resources below belong only to the parent-owned disposable schema.
$syncMarker="gsync_$runId";$syncTrigger="gsync_fault_$runId";$syncUserId=$null
try {
    GeneratorConfig-Sql "CREATE TABLE ${syncMarker}_child (entry_id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(64) NOT NULL, obsolete BIGINT) COMMENT='同步'; INSERT INTO ${syncMarker}_child(name,obsolete) VALUES('owned-retained',1); CREATE TABLE ${syncMarker}_parent (entry_id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(64));"|Out-Null
    $syncImportReply=Request '/api/v1/tool/generator/imports' 'POST' (@{names=@("${syncMarker}_child","${syncMarker}_parent")}|ConvertTo-Json -Compress) $authorized
    Assert-Check ($syncImportReply.StatusCode -eq 201) 'Sync fixture import failed.'
    $syncImportedTables=($syncImportReply.Content|ConvertFrom-Json).tables;$syncId=$syncImportedTables[0].id;$syncParentId=$syncImportedTables[1].id;$syncPath="/api/v1/tool/generator/tables/$syncId/synchronize"
    $syncRead=Request "/api/v1/tool/generator/tables/$syncId" 'GET' '' $authorized
    Assert-Check ($syncRead.StatusCode -eq 200) ('Sync fixture detail must succeed: '+$syncRead.Content)
    $syncDetail=$syncRead.Content|ConvertFrom-Json
    $syncInput=GeneratorConfig-Input $syncDetail
    $physicalNameField=$syncDetail.columns|Where-Object { $_.name -eq 'name' }
    Assert-Check ($null -ne $physicalNameField) ('Sync physical name field missing: '+($syncDetail.columns|ConvertTo-Json -Depth 6 -Compress))
    $syncNameEdit=$syncInput.columns|Where-Object { $_['id'] -ceq $physicalNameField.id }
    Assert-Check (@($syncNameEdit).Count -eq 1 -and $null -ne $syncNameEdit) ('Sync named-field fixture must have one exact matching ID: '+($syncDetail.columns|ConvertTo-Json -Depth 6 -Compress))
    $syncNameEdit['queryType']='LIKE';$syncNameEdit['dictionaryType']='sys_normal_disable';$syncNameEdit['controlType']='textarea';$syncNameEdit['required']=$true
    Assert-Check ((Request "/api/v1/tool/generator/tables/$syncId" 'PUT' ($syncInput|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Sync settings fixture failed.'
    $syncCreatedUser=Request '/api/v1/system/users' 'POST' (@{user=@{username="gs$runId";displayName='同步无权限';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 5 -Compress) $authorized
    Assert-Check ($syncCreatedUser.StatusCode -eq 201) 'Sync no-role fixture failed.';$syncUserId=($syncCreatedUser.Content|ConvertFrom-Json).id
    $syncNoRoleLogin=(Request '/api/v1/auth/login' 'POST' (@{username="gs$runId";password='User12345'}|ConvertTo-Json -Compress)).Content|ConvertFrom-Json
    $syncBefore=GeneratorConfig-Snapshot $syncId
    Assert-Problem (Request $syncPath 'POST' '') 401 'AUTHENTICATION_REQUIRED'
    Assert-Problem (Request $syncPath 'POST' '' @{Authorization="Bearer $($syncNoRoleLogin.accessToken)"}) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/tool/generator/tables/9223372036854775807/synchronize' 'POST' '' $authorized) 404 'GENERATOR_TABLE_NOT_FOUND'
    Assert-Check ((GeneratorConfig-Snapshot $syncId) -ceq $syncBefore) 'Permission/missing sync must retain metadata.'
    $syncParentDetail=(Request "/api/v1/tool/generator/tables/$syncParentId" 'GET' '' $authorized).Content|ConvertFrom-Json
    $syncParentInput=GeneratorConfig-Input $syncParentDetail;$syncParentInput.category='sub';$syncParentInput.subTableName="${syncMarker}_child";$syncParentInput.subTableForeignKey='obsolete'
    Assert-Check ((Request "/api/v1/tool/generator/tables/$syncParentId" 'PUT' ($syncParentInput|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Sync parent reference fixture failed.'
    $staleLegacy=(Request "/tool/gen/$syncId" 'GET' '' $authorized).Content|ConvertFrom-Json -AsHashtable
    $staleLegacyWrite=$staleLegacy.data.info;$staleLegacyWrite.columns=$staleLegacy.data.rows;$staleLegacyWrite.params=@{parentMenuId=0;genView=$true}
    GeneratorConfig-Sql "ALTER TABLE ${syncMarker}_child MODIFY entry_id BIGINT NOT NULL, DROP PRIMARY KEY, DROP COLUMN obsolete, MODIFY name VARCHAR(128) NOT NULL, ADD amount DECIMAL(18,2), ADD alternate_id BIGINT PRIMARY KEY AUTO_INCREMENT;"|Out-Null
    $syncPhysicalSnapshot=@(GeneratorConfig-Sql "SELECT CONCAT_WS('|',entry_id,name,IFNULL(CAST(amount AS CHAR),'<null>'),alternate_id) FROM ${syncMarker}_child ORDER BY entry_id;") -join "`n"
    $syncBefore=GeneratorConfig-Snapshot $syncId
    Assert-Problem (Request $syncPath 'POST' '' $authorized) 409 'GENERATOR_SCHEMA_REFERENCED'
    $legacyBlocked=Request "/tool/gen/synchDb/${syncMarker}_child" 'GET' '' $authorized
    Assert-Check (($legacyBlocked.Content|ConvertFrom-Json).code -ne 200 -and (GeneratorConfig-Snapshot $syncId) -ceq $syncBefore) 'Canonical/original sync must reject a removed referenced FK without metadata changes.'
    $syncParentInput.category='crud';Assert-Check ((Request "/api/v1/tool/generator/tables/$syncParentId" 'PUT' ($syncParentInput|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Sync reference reset failed.'
    $syncInput.category='tree';$syncInput.options=@{parentMenuId='0';generateDetail=$true;treeCode='entry_id';treeParentCode='obsolete';treeName='name'}
    Assert-Check ((Request "/api/v1/tool/generator/tables/$syncId" 'PUT' ($syncInput|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Sync tree fixture failed.'
    $syncBefore=GeneratorConfig-Snapshot $syncId;Assert-Problem (Request $syncPath 'POST' '' $authorized) 409 'GENERATOR_SCHEMA_REFERENCED';Assert-Check ((GeneratorConfig-Snapshot $syncId) -ceq $syncBefore) 'Removed tree fields must not leave invalid metadata.'
    $syncInput.category='crud';$syncInput.options=@{parentMenuId='0';generateDetail=$true};Assert-Check ((Request "/api/v1/tool/generator/tables/$syncId" 'PUT' ($syncInput|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Sync tree reset failed.'
    foreach($syncFault in @('update','insert','delete')) {
        $syncBefore=GeneratorConfig-Snapshot $syncId
        $syncTriggerSql=switch($syncFault){'update'{"SET SESSION sql_mode='STRICT_ALL_TABLES'; CREATE TRIGGER $syncTrigger BEFORE UPDATE ON gen_table_column FOR EACH ROW SET NEW.column_comment=IF(NEW.column_name='name',REPEAT('x',1000),NEW.column_comment);"};'insert'{"CREATE TRIGGER $syncTrigger BEFORE INSERT ON gen_table_column FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned sync insert fault'"};'delete'{"CREATE TRIGGER $syncTrigger BEFORE DELETE ON gen_table_column FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned sync delete fault'"}}
        GeneratorConfig-Sql $syncTriggerSql|Out-Null
        try {
            Assert-Problem (Request $syncPath 'POST' '' $authorized) 500 'INTERNAL_ERROR'
            Assert-Check ((GeneratorConfig-Snapshot $syncId) -ceq $syncBefore) "Sync $syncFault failure must completely roll back fields, physical identities and audit."
            $syncLegacyFaultReply=Request "/tool/gen/synchDb/${syncMarker}_child" 'GET' '' $authorized
            Assert-Check ($syncLegacyFaultReply.StatusCode -eq 200 -and ($syncLegacyFaultReply.Content|ConvertFrom-Json).code -eq 500 -and !$syncLegacyFaultReply.Content.Contains('column_comment') -and !$syncLegacyFaultReply.Content.Contains('gen_table_column') -and !$syncLegacyFaultReply.Content.Contains('owned sync') -and (GeneratorConfig-Snapshot $syncId) -ceq $syncBefore) 'Original SQL failure must preserve compatibility shape, complete rollback and safe public error without SQL details.'
        }finally{GeneratorConfig-Sql "DROP TRIGGER $syncTrigger;"|Out-Null}
    }
    $syncRaceOwner=$null;$syncRaceRequests=@()
    try {
        $syncRaceOwner=Start-Job -ScriptBlock {param($container,$password);& docker exec --env "MYSQL_PWD=$password" $container mysql -N -B -uroot eforge_enterprise -e 'START TRANSACTION; SELECT guard_id FROM gen_metadata_guard WHERE guard_id=1 FOR UPDATE; SELECT SLEEP(15); ROLLBACK;';if($LASTEXITCODE -ne 0){throw 'Sync race owner failed.'}} -ArgumentList $mysqlName,$testPassword
        $syncRaceHeld=$false
        for($syncAttempt=0;$syncAttempt -lt 80;$syncAttempt++){if([int](GeneratorConfig-Sql "SELECT COUNT(*) FROM performance_schema.data_locks WHERE OBJECT_NAME='gen_metadata_guard' AND LOCK_TYPE='RECORD' AND LOCK_STATUS='GRANTED';") -gt 0){$syncRaceHeld=$true;break};Start-Sleep -Milliseconds 100}
        Assert-Check $syncRaceHeld 'Sync race owner SQL lock must be observed.'
        foreach($syncRaceCase in @(@{path=$syncPath;method='POST';body=''},@{path="/api/v1/tool/generator/tables/$syncId";method='PUT';body=($syncInput|ConvertTo-Json -Depth 10 -Compress)})) {
            $syncRaceRequests+=Start-Job -ScriptBlock {param($port,$case,$headers);$argsForHttp=@{Uri="http://127.0.0.1:$port$($case.path)";Method=$case.method;Headers=$headers;SkipHttpErrorCheck=$true;TimeoutSec=35};if($case.body){$argsForHttp.Body=$case.body;$argsForHttp.ContentType='application/json'};return [int](Invoke-WebRequest @argsForHttp).StatusCode} -ArgumentList $AppPort,$syncRaceCase,$authorized
        }
        $syncRaceQueued=$false
        for($syncAttempt=0;$syncAttempt -lt 80;$syncAttempt++){if([int](GeneratorConfig-Sql "SELECT COUNT(*) FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON w.REQUESTING_ENGINE_LOCK_ID=l.ENGINE_LOCK_ID WHERE l.OBJECT_NAME='gen_metadata_guard';") -ge 2){$syncRaceQueued=$true;break};Start-Sleep -Milliseconds 100}
        Assert-Check $syncRaceQueued 'Both actual sync/save HTTP writers must be observed concurrently waiting on SQL.'
        Wait-Job $syncRaceOwner -Timeout 20|Out-Null;Assert-Check ($syncRaceOwner.State -eq 'Completed') 'Sync race owner release failed.';Receive-Job $syncRaceOwner -ErrorAction Stop|Out-Null
        $syncRaceStatuses=@();foreach($syncHttpJob in $syncRaceRequests){Wait-Job $syncHttpJob -Timeout 35|Out-Null;Assert-Check ($syncHttpJob.State -eq 'Completed') 'Sync race writer did not finish.';$syncRaceStatuses+=Receive-Job $syncHttpJob -ErrorAction Stop}
        Write-Output "Generator sync/save concurrent statuses: $($syncRaceStatuses -join ',')"
        Assert-Check (($syncRaceStatuses -join ',') -in @('204,409','204,204')) 'Concurrent sync/save must commit a valid serial outcome.'
    }finally{foreach($ownedSyncJob in @($syncRaceOwner)+$syncRaceRequests){if($ownedSyncJob){if($ownedSyncJob.State -eq 'Running'){Stop-Job $ownedSyncJob};Remove-Job $ownedSyncJob -Force}}}
    $afterSync=GeneratorConfig-Snapshot $syncId
    Assert-Problem (Request "/api/v1/tool/generator/tables/$syncId" 'PUT' ($syncInput|ConvertTo-Json -Depth 10 -Compress) $authorized) 409 'GENERATOR_COLUMN_MISMATCH'
    Assert-Check ((GeneratorConfig-Snapshot $syncId) -ceq $afterSync) 'Stale pre-sync field set must not overwrite synchronized metadata or audit.'
    $staleOriginal=Request '/tool/gen' 'PUT' ($staleLegacyWrite|ConvertTo-Json -Depth 20 -Compress) $authorized
    Assert-Check (($staleOriginal.Content|ConvertFrom-Json).code -ne 200 -and (GeneratorConfig-Snapshot $syncId) -ceq $afterSync) 'Original stale complete-field save must refuse synchronized field mismatch without changes.'
    $syncUpdatedDetail=(Request "/api/v1/tool/generator/tables/$syncId" 'GET' '' $authorized).Content|ConvertFrom-Json
    $syncEntryField=$syncUpdatedDetail.columns|Where-Object name -eq 'entry_id';$syncNameField=$syncUpdatedDetail.columns|Where-Object name -eq 'name';$syncAmountField=$syncUpdatedDetail.columns|Where-Object name -eq 'amount';$syncAlternateField=$syncUpdatedDetail.columns|Where-Object name -eq 'alternate_id'
    Assert-Check ($syncUpdatedDetail.columns.Count -eq 4 -and -not $syncEntryField.primaryKey -and -not $syncEntryField.autoIncrement -and $syncAlternateField.primaryKey -and $syncAlternateField.autoIncrement -and -not $syncAlternateField.editable -and -not $syncAlternateField.listed -and -not $syncAlternateField.queryable -and $syncAmountField.javaType -eq 'BigDecimal') 'Actual add/drop/primary-key/auto-increment/decimal probe must be persisted.'
    Assert-Check ($syncNameField.id -ceq ($syncDetail.columns|Where-Object name -eq 'name').id -and $syncNameField.databaseType -eq 'varchar(128)' -and $syncNameField.queryType -eq 'LIKE' -and $syncNameField.dictionaryType -eq 'sys_normal_disable' -and $syncNameField.required -and $syncNameField.controlType -eq 'textarea') 'Sync must retain exact existing field identity and original conditional choices.'
    $legacy=Request "/tool/gen/synchDb/${syncMarker}_child" 'GET' '' $authorized;Assert-Check (($legacy.Content|ConvertFrom-Json).code -eq 200) 'Original sync must share and accept the repaired schema.'
    $syncPhysicalAfter=@(GeneratorConfig-Sql "SELECT CONCAT_WS('|',entry_id,name,IFNULL(CAST(amount AS CHAR),'<null>'),alternate_id) FROM ${syncMarker}_child ORDER BY entry_id;") -join "`n"
    Assert-Check ($syncPhysicalAfter -ceq $syncPhysicalSnapshot -and [int](GeneratorConfig-Sql "SELECT COUNT(*) FROM ${syncMarker}_child WHERE entry_id=1 AND name='owned-retained';") -eq 1) 'Synchronization must retain the exact post-DDL physical row snapshot and original row identity/content.'
    GeneratorConfig-Sql "DROP TABLE ${syncMarker}_child;"|Out-Null
    $syncBefore=GeneratorConfig-Snapshot $syncId;Assert-Problem (Request $syncPath 'POST' '' $authorized) 409 'GENERATOR_SCHEMA_UNAVAILABLE';Assert-Check ((GeneratorConfig-Snapshot $syncId) -ceq $syncBefore) 'Missing physical schema must preserve all metadata.'
    Write-Output 'Generator sync: actual add/drop/type/PK/auto-increment/decimal, original choices/exact IDs, canonical/original reference guards, update/insert/delete complete rollback/retry, permissions/missing schema and retained physical rows passed.'
}finally {
    GeneratorConfig-Sql "DROP TRIGGER IF EXISTS $syncTrigger; DELETE c FROM gen_table_column c JOIN gen_table t ON c.table_id=t.table_id WHERE t.table_name LIKE '${syncMarker}%'; DELETE FROM gen_table WHERE table_name LIKE '${syncMarker}%'; DROP TABLE IF EXISTS ${syncMarker}_child; DROP TABLE IF EXISTS ${syncMarker}_parent;"|Out-Null
    if($syncUserId){Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($syncUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Sync user cleanup failed.'}
}
