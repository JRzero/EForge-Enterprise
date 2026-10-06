# Only the parent-owned disposable schema and uniquely named fixture are modified.
$configMarker="gconfig_$runId";$configUserId=$null;$configTrigger="gconfig_fault_$runId"
function GeneratorConfig-Sql([string]$sql){return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e $sql}
function GeneratorConfig-Input($detail){
    $fields=@($detail.columns|ForEach-Object {@{id=$_.id;comment=$_.comment;javaType=$_.javaType;javaField=$_.javaField;required=[bool]$_.required;insertable=[bool]$_.insertable;editable=[bool]$_.editable;listed=[bool]$_.listed;queryable=[bool]$_.queryable;queryType=$_.queryType;controlType=$_.controlType;dictionaryType=$_.dictionaryType;order=$_.order}})
    return @{name=$detail.table.name;comment='配置中文';className='ConfiguredEntry';category='crud';packageName='io.eforge.enterprise.owned';moduleName='sales-api';businessName='order-line';functionName='配置';author='作者';formColumns=3;outputType='1';outputPath='D:/生成输出';remark='';options=@{parentMenuId='0';generateDetail=$true};columns=$fields}
}
function GeneratorConfig-Snapshot($id){return @(GeneratorConfig-Sql "SELECT CONCAT_WS('|',table_name,table_comment,class_name,tpl_category,tpl_web_type,function_name,form_col_num,gen_type,gen_path,remark,options,update_by,IFNULL(CAST(update_time AS CHAR),'<null>')) FROM gen_table WHERE table_id=$id; SELECT CONCAT_WS('|',column_id,column_name,column_comment,column_type,java_type,java_field,is_pk,is_increment,is_required,is_insert,is_edit,is_list,is_query,query_type,html_type,dict_type,sort,update_by,IFNULL(CAST(update_time AS CHAR),'<null>')) FROM gen_table_column WHERE table_id=$id ORDER BY column_id;") -join "`n"}
try {
    $configSpec=Get-Content -LiteralPath $snapshotPath -Raw|ConvertFrom-Json -AsHashtable
    Assert-Check ($configSpec.components.schemas.Options.properties.parentMenuName -and ($configSpec.components.schemas.GeneratorConfigurationOptions.required -contains 'generateDetail') -and ($configSpec.components.schemas.GeneratorConfigurationUpdate.properties.options.'$ref' -ceq '#/components/schemas/GeneratorConfigurationOptions')) 'Generator read/write OpenAPI options must have distinct complete schemas.'
    foreach($suffix in @('a','b','c')){GeneratorConfig-Sql "CREATE TABLE ${configMarker}_$suffix (entry_id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(64) NOT NULL) COMMENT='配置中文'; INSERT INTO ${configMarker}_$suffix(name) VALUES('owned-preserve-$suffix');"|Out-Null}
    $imported=Request '/api/v1/tool/generator/imports' 'POST' (@{names=@("${configMarker}_a","${configMarker}_b")}|ConvertTo-Json -Compress) $authorized
    Assert-Check ($imported.StatusCode -eq 201) 'Configuration fixture import failed.'
    $resources=$imported.Content|ConvertFrom-Json;$configId=$resources.tables[0].id;$otherId=$resources.tables[1].id;$configPath="/api/v1/tool/generator/tables/$configId"
    $detail=(Request $configPath 'GET' '' $authorized).Content|ConvertFrom-Json
    $other=(Request "/api/v1/tool/generator/tables/$otherId" 'GET' '' $authorized).Content|ConvertFrom-Json
    $configWrite=GeneratorConfig-Input $detail
    $before=GeneratorConfig-Snapshot $configId;$otherBefore=GeneratorConfig-Snapshot $otherId
    $bad=GeneratorConfig-Input $detail;$bad.columns[0].id=$other.columns[0].id
    Assert-Problem (Request $configPath 'PUT' ($bad|ConvertTo-Json -Depth 10 -Compress) $authorized) 409 'GENERATOR_COLUMN_MISMATCH'
    Assert-Check ((GeneratorConfig-Snapshot $configId) -ceq $before -and (GeneratorConfig-Snapshot $otherId) -ceq $otherBefore) 'Foreign field refusal must preserve both configurations.'
    $bad=GeneratorConfig-Input $detail;$bad.columns=@($bad.columns[0]);Assert-Problem (Request $configPath 'PUT' ($bad|ConvertTo-Json -Depth 10 -Compress) $authorized) 409 'GENERATOR_COLUMN_MISMATCH'
    $bad=GeneratorConfig-Input $detail;$bad.category='tree';Assert-Problem (Request $configPath 'PUT' ($bad|ConvertTo-Json -Depth 10 -Compress) $authorized) 400 'GENERATOR_TREE_FIELDS_INVALID'
    $configUsername="gc$runId"
    $created=Request '/api/v1/system/users' 'POST' (@{user=@{username=$configUsername;displayName='配置无权限';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 5 -Compress) $authorized
    Assert-Check ($created.StatusCode -eq 201) 'Owned configuration no-role account creation failed.';$configUserId=($created.Content|ConvertFrom-Json).id
    $login=Request '/api/v1/auth/login' 'POST' (@{username=$configUsername;password='User12345'}|ConvertTo-Json -Compress)
    $body=$configWrite|ConvertTo-Json -Depth 10 -Compress
    Assert-Problem (Request $configPath 'PUT' $body) 401 'AUTHENTICATION_REQUIRED'
    Assert-Problem (Request $configPath 'PUT' $body @{Authorization="Bearer $(($login.Content|ConvertFrom-Json).accessToken)"}) 403 'ACCESS_DENIED'
    GeneratorConfig-Sql "SET SESSION sql_mode='STRICT_ALL_TABLES'; CREATE TRIGGER $configTrigger BEFORE UPDATE ON gen_table_column FOR EACH ROW SET NEW.column_comment=IF(NEW.column_name='name',REPEAT('x',1000),NEW.column_comment);"|Out-Null
    try {
        $failed=Request $configPath 'PUT' $body $authorized;Assert-Problem $failed 500 'INTERNAL_ERROR'
        Assert-Check (!$failed.Content.Contains('column_comment') -and (GeneratorConfig-Snapshot $configId) -ceq $before) 'Actual failure after table/first field writes must roll back the complete configuration.'
    }finally{GeneratorConfig-Sql "DROP TRIGGER IF EXISTS $configTrigger;"|Out-Null}
    Assert-Check ((Request $configPath 'PUT' $body $authorized).StatusCode -eq 204) 'Configuration retry failed.'
    $saved=(Request $configPath 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($saved.configuration.formColumns -eq 3 -and $saved.configuration.outputPath -ceq 'D:/生成输出' -and $saved.configuration.options.generateDetail -and $saved.table.webType -ceq 'eforge-react' -and $saved.columns[0].primaryKey -and $saved.columns[0].autoIncrement -and $saved.columns[0].id -ceq $detail.columns[0].id) 'Configuration fields/options/physical identity were not retained.'
    # Original preview now captures the root/child graph once, before rendering.
    $configPreviewPath="/tool/gen/preview/$configId"
    $configAnonymousPreview=Request $configPreviewPath
    $configAnonymousBody=$configAnonymousPreview.Content|ConvertFrom-Json
    Assert-Check ($configAnonymousPreview.StatusCode -eq 200 -and $configAnonymousBody.code -eq 401 -and !$configAnonymousBody.data) 'Anonymous original preview must keep the legacy denial envelope and contain no generated data.'
    $configNoRoleHeaders=@{Authorization="Bearer $(($login.Content|ConvertFrom-Json).accessToken)"}
    $configDeniedPreview=Request $configPreviewPath 'GET' '' $configNoRoleHeaders
    $configDeniedBody=$configDeniedPreview.Content|ConvertFrom-Json
    Assert-Check ($configDeniedPreview.StatusCode -eq 200 -and $configDeniedBody.code -eq 403 -and !$configDeniedBody.data) 'No-role original preview must keep the legacy denial envelope and contain no generated data.'
    $configPreviewReply=Request $configPreviewPath 'GET' '' $authorized
    $configPreview=$configPreviewReply.Content|ConvertFrom-Json -AsHashtable
    Assert-Check ($configPreviewReply.StatusCode -eq 200 -and $configPreview.code -eq 200) 'Original preview must keep the successful compatibility response.'
    Assert-Check ($configPreview.data.Count -ge 9 -and $configPreview.data['vm/java/domain.java.vm'].Contains('class ConfiguredEntry') -and $configPreview.data['vm/java/controller.java.vm'].Contains('配置') -and $configPreview.data.ContainsKey('vm/vue/view.vue.vm')) 'Original preview must render actual configured Java, Unicode labels and detail template.'
    $configMissingPreview=Request '/tool/gen/preview/9223372036854775807' 'GET' '' $authorized
    $configMissingPreviewBody=$configMissingPreview.Content|ConvertFrom-Json
    Assert-Check ($configMissingPreview.StatusCode -eq 200 -and $configMissingPreviewBody.code -eq 404 -and !$configMissingPreviewBody.data) 'Missing original preview must keep a safe compatibility error.'
    GeneratorConfig-Sql "RENAME TABLE gen_table_column TO ${configMarker}_preview_fields;"|Out-Null
    try {
        $configFaultPreview=Request $configPreviewPath 'GET' '' $authorized
        $configFaultPreviewBody=$configFaultPreview.Content|ConvertFrom-Json
        Assert-Check ($configFaultPreview.StatusCode -eq 200 -and $configFaultPreviewBody.code -eq 503 -and !$configFaultPreviewBody.data -and $configFaultPreviewBody.msg -ceq 'Generator metadata cannot be read safely.') 'Actual preview SQL failure must retain the compatibility envelope without private diagnostics.'
    } finally { GeneratorConfig-Sql "RENAME TABLE ${configMarker}_preview_fields TO gen_table_column;"|Out-Null }
    $configRecoveredPreview=Request $configPreviewPath 'GET' '' $authorized
    Assert-Check (($configRecoveredPreview.Content|ConvertFrom-Json).code -eq 200) 'Original preview must recover after the real SQL fault.'
    # Hold only the parent-owned generator guard in a separate real SQL transaction.
    # Canonical save and original sync must wait for rollback, then complete normally.
    foreach($guardCase in @(@{path=$configPath;method='PUT';payload=$body},@{path="$configPath/synchronize";method='POST';payload=''},@{path="/tool/gen/synchDb/${configMarker}_a";method='GET';payload=''},@{path='/api/v1/tool/generator/tables';method='DELETE';payload='{"ids": ["9223372036854775807"]}'},@{path='/tool/gen/9223372036854775807';method='DELETE';payload=''})) {
        $guardOwner=$null;$guardRequest=$null
        try {
            $guardOwner=Start-Job -ScriptBlock {
                param($container,$password)
                & docker exec --env "MYSQL_PWD=$password" $container mysql -N -B -uroot eforge_enterprise -e 'START TRANSACTION; SELECT guard_id FROM gen_metadata_guard WHERE guard_id=1 FOR UPDATE; SELECT SLEEP(10); ROLLBACK;'
                if($LASTEXITCODE -ne 0){throw 'Owned guard transaction failed.'}
            } -ArgumentList $mysqlName,$testPassword
            $guardHeld=$false
            for($guardAttempt=0;$guardAttempt -lt 80;$guardAttempt++) {
                $guardCount=GeneratorConfig-Sql "SELECT COUNT(*) FROM performance_schema.data_locks WHERE OBJECT_SCHEMA='eforge_enterprise' AND OBJECT_NAME='gen_metadata_guard' AND LOCK_TYPE='RECORD' AND LOCK_STATUS='GRANTED';"
                if([int]$guardCount -gt 0){$guardHeld=$true;break};Start-Sleep -Milliseconds 100
            }
            Assert-Check $guardHeld 'Owned SQL guard must be observed live before checking HTTP serialization.'
            if($guardCase.path -eq $configPath -and $guardCase.method -eq 'PUT') {
                $configUnlockedPreview=Request $configPreviewPath 'GET' '' $authorized
                Assert-Check ($configUnlockedPreview.StatusCode -eq 200 -and ($configUnlockedPreview.Content|ConvertFrom-Json).code -eq 200) 'Preview must complete while the metadata mutation guard is held.'
                $configPreviewGuard=GeneratorConfig-Sql "SELECT COUNT(*) FROM performance_schema.data_locks WHERE OBJECT_SCHEMA='eforge_enterprise' AND OBJECT_NAME='gen_metadata_guard' AND LOCK_TYPE='RECORD' AND LOCK_STATUS='GRANTED';"
                Assert-Check ([int]$configPreviewGuard -gt 0) 'The successful preview must precede the observed guard release.'
            }
            $guardRequest=Start-Job -ScriptBlock {
                param($port,$path,$method,$payload,$headers)
                $guardHttpArgs=@{Uri="http://127.0.0.1:$port$path";Method=$method;Headers=$headers;TimeoutSec=30;SkipHttpErrorCheck=$true}
                if($payload){$guardHttpArgs.Body=$payload;$guardHttpArgs.ContentType='application/json'}
                $reply=Invoke-WebRequest @guardHttpArgs
                return [pscustomobject]@{status=$reply.StatusCode;body=$reply.Content}
            } -ArgumentList $AppPort,$guardCase.path,$guardCase.method,$guardCase.payload,$authorized
            $guardWaiting=$false
            for($guardAttempt=0;$guardAttempt -lt 80;$guardAttempt++) {
                $guardWaitCount=GeneratorConfig-Sql "SELECT COUNT(*) FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON w.REQUESTING_ENGINE_LOCK_ID=l.ENGINE_LOCK_ID WHERE l.OBJECT_SCHEMA='eforge_enterprise' AND l.OBJECT_NAME='gen_metadata_guard';"
                if([int]$guardWaitCount -gt 0){$guardWaiting=$true;break};Start-Sleep -Milliseconds 100
            }
            Assert-Check $guardWaiting 'Actual HTTP writer must be observed waiting on the SQL guard, not merely a background job startup.'
            Assert-Check ($guardRequest.State -eq 'Running') 'Metadata writer must wait while another SQL transaction holds its guard.'
            Wait-Job $guardOwner -Timeout 15|Out-Null
            Assert-Check ($guardOwner.State -eq 'Completed') 'Owned guard rollback did not release its transaction.'
            Receive-Job $guardOwner -ErrorAction Stop|Out-Null
            Wait-Job $guardRequest -Timeout 30|Out-Null
            Assert-Check ($guardRequest.State -eq 'Completed') 'Metadata writer did not resume after guard rollback.'
            $guardReply=Receive-Job $guardRequest -ErrorAction Stop
            if($guardCase.path.StartsWith('/api/v1/')){Assert-Check ($guardReply.status -eq 204) 'Canonical save must resume and commit after rollback.'}
            else{Assert-Check ($guardReply.status -eq 200 -and ($guardReply.body|ConvertFrom-Json).code -eq 200) 'Original sync must resume normally after rollback.'}
        } finally {
            foreach($ownedGuardJob in @($guardOwner,$guardRequest)) {
                if($ownedGuardJob){if($ownedGuardJob.State -eq 'Running'){Stop-Job $ownedGuardJob};Remove-Job $ownedGuardJob -Force}
            }
        }
    }
    Write-Output 'Generator metadata boundary: observed actual SQL record lock, canonical save and original sync wait/resume, transaction rollback release passed.'
    foreach($control in @('input','textarea','select','radio','checkbox','datetime','imageUpload','fileUpload','editor')) {
        $configWrite.columns[1].controlType=$control;$configWrite.columns[1].javaType='Boolean';$configWrite.columns[1].queryType='LTE';$configWrite.columns[1].dictionaryType='sys_common_status'
        Assert-Check ((Request $configPath 'PUT' ($configWrite|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Original control setting failed.'
        $current=(Request $configPath 'GET' '' $authorized).Content|ConvertFrom-Json
        Assert-Check ($current.columns[1].controlType -ceq $control -and $current.columns[1].javaType -ceq 'Boolean' -and $current.columns[1].queryType -ceq 'LTE') 'Original Boolean/LTE/control settings were lost.'
    }
    $configWrite.columns[1].dictionaryType='';$configWrite.columns[1].comment='';$configWrite.columns[1].order=0;$configWrite.columns[0].order=1
    $configWrite.category='tree';$configWrite.options.treeCode='entry_id';$configWrite.options.treeParentCode='entry_id';$configWrite.options.treeName='name'
    Assert-Check ((Request $configPath 'PUT' ($configWrite|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Tree settings and clear/reorder failed.'
    $tree=(Request $configPath 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($tree.table.category -ceq 'tree' -and $tree.configuration.options.treeName -ceq 'name' -and $tree.columns[0].name -ceq 'name' -and $tree.columns[0].dictionaryType -ceq '' -and $tree.columns[0].comment -ceq '') 'Actual clearing, order and tree options failed.'
    $configWrite.category='sub';$configWrite.subTableName="${configMarker}_b";$configWrite.subTableForeignKey='entry_id'
    Assert-Check ((Request $configPath 'PUT' ($configWrite|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Actual subtable configuration failed.'
    $configWrite.name="${configMarker}_c";Assert-Check ((Request $configPath 'PUT' ($configWrite|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Original table-name edit with matching real schema failed.'
    Assert-Check (((Request $configPath 'GET' '' $authorized).Content|ConvertFrom-Json).table.name -ceq "${configMarker}_c") 'Table-name edit must retain its string resource ID.'
    $deletePath='/api/v1/tool/generator/tables';$deleteBody=@{ids=@($configId,$otherId)}|ConvertTo-Json -Compress
    Assert-Problem (Request $deletePath 'DELETE' $deleteBody) 401 'AUTHENTICATION_REQUIRED'
    Assert-Problem (Request $deletePath 'DELETE' $deleteBody @{Authorization="Bearer $(($login.Content|ConvertFrom-Json).accessToken)"}) 403 'ACCESS_DENIED'
    $parentBefore=GeneratorConfig-Snapshot $configId;$childBefore=GeneratorConfig-Snapshot $otherId
    Assert-Problem (Request $deletePath 'DELETE' (@{ids=@($otherId)}|ConvertTo-Json -Compress) $authorized) 409 'GENERATOR_TABLE_REFERENCED'
    $legacyRefusal=Request "/tool/gen/$otherId" 'DELETE' '' $authorized
    Assert-Check (($legacyRefusal.Content|ConvertFrom-Json).code -ne 200 -and (GeneratorConfig-Snapshot $otherId) -ceq $childBefore) 'Original delete must not bypass reference protection.'
    $child=(Request "/api/v1/tool/generator/tables/$otherId" 'GET' '' $authorized).Content|ConvertFrom-Json
    $childWrite=GeneratorConfig-Input $child;$childWrite.name="${configMarker}_a"
    GeneratorConfig-Sql "SET SESSION sql_mode='STRICT_ALL_TABLES'; CREATE TRIGGER $configTrigger BEFORE UPDATE ON gen_table_column FOR EACH ROW SET NEW.column_comment=IF(NEW.column_name='name',REPEAT('x',1000),NEW.column_comment);"|Out-Null
    try {
        Assert-Problem (Request "/api/v1/tool/generator/tables/$otherId" 'PUT' ($childWrite|ConvertTo-Json -Depth 10 -Compress) $authorized) 500 'INTERNAL_ERROR'
        Assert-Check ((GeneratorConfig-Snapshot $configId) -ceq $parentBefore -and (GeneratorConfig-Snapshot $otherId) -ceq $childBefore) 'Rename failure must roll back child name and propagated parent reference together.'
    }finally{GeneratorConfig-Sql "DROP TRIGGER $configTrigger;"|Out-Null}
    Assert-Check ((Request "/api/v1/tool/generator/tables/$otherId" 'PUT' ($childWrite|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Child rename retry failed.'
    Assert-Check ((GeneratorConfig-Sql "SELECT sub_table_name FROM gen_table WHERE table_id=$configId;") -ceq "${configMarker}_a") 'Canonical rename must preserve parent references.'
    $legacyDetail=(Request "/tool/gen/$otherId" 'GET' '' $authorized).Content|ConvertFrom-Json -AsHashtable
    $legacyPhysicalType=$legacyDetail.data.rows[0].columnType;
    $legacyWrite=$legacyDetail.data.info;$legacyWrite.columns=$legacyDetail.data.rows
    $legacyWrite.params=@{parentMenuId=0;genView=$true}
    $legacyBefore=GeneratorConfig-Snapshot $otherId;$legacyParentBefore=GeneratorConfig-Snapshot $configId
    foreach($invalidCase in @('foreign','duplicate','incomplete','null','missing-child','self-child','missing-foreign-key','foreign-tree','unknown-category')) {
        $badLegacy=($legacyWrite|ConvertTo-Json -Depth 20)|ConvertFrom-Json -AsHashtable
        switch($invalidCase){'foreign'{$badLegacy.columns[0].columnId=[long]$detail.columns[0].id};'duplicate'{$badLegacy.columns[1].columnId=$badLegacy.columns[0].columnId};'incomplete'{$badLegacy.columns=@($badLegacy.columns[0])};'null'{$badLegacy.columns=@($null,$badLegacy.columns[1])};'missing-child'{$badLegacy.tplCategory='sub';$badLegacy.subTableName='owned_missing_generator_child';$badLegacy.subTableFkName='entry_id'};'self-child'{$badLegacy.tplCategory='sub';$badLegacy.subTableName=$legacyWrite.tableName;$badLegacy.subTableFkName='entry_id'};'missing-foreign-key'{$badLegacy.tplCategory='sub';$badLegacy.subTableName="${configMarker}_c";$badLegacy.subTableFkName='owned_missing_field'};'foreign-tree'{$badLegacy.tplCategory='tree';$badLegacy.params=@{treeCode='owned_missing_field';treeParentCode='entry_id';treeName='name'}};'unknown-category'{$badLegacy.tplCategory='unknown'}}
        $legacyBad=Request '/tool/gen' 'PUT' ($badLegacy|ConvertTo-Json -Depth 20 -Compress) $authorized
        Assert-Check (($legacyBad.Content|ConvertFrom-Json).code -ne 200 -and (GeneratorConfig-Snapshot $otherId) -ceq $legacyBefore -and (GeneratorConfig-Snapshot $configId) -ceq $legacyParentBefore) 'Original save must reject unowned/duplicate/incomplete/null fields without mutation.'
    }
    $legacyWrite.tableName="${configMarker}_b";$legacyWrite.columns[0].columnType='varchar(200)'
    $legacySaved=Request '/tool/gen' 'PUT' ($legacyWrite|ConvertTo-Json -Depth 20 -Compress) $authorized
    Assert-Check (($legacySaved.Content|ConvertFrom-Json).code -eq 200 -and (GeneratorConfig-Sql "SELECT sub_table_name FROM gen_table WHERE table_id=$configId;") -ceq "${configMarker}_b") 'Original rename must preserve references in the shared transaction.'
    Assert-Check ((GeneratorConfig-Sql "SELECT column_type FROM gen_table_column WHERE column_id=$($legacyWrite.columns[0].columnId);") -ceq $legacyPhysicalType) 'Original save must retain server-owned physical type despite request tampering.'
    # Two actual HTTP writers queue behind the same observed SQL lock: only a valid serial outcome is allowed.
    $configWrite.category='crud';Assert-Check ((Request $configPath 'PUT' ($configWrite|ConvertTo-Json -Depth 10 -Compress) $authorized).StatusCode -eq 204) 'Race fixture reset failed.'
    $configWrite.category='sub';$configWrite.subTableName="${configMarker}_b";$configWrite.subTableForeignKey='entry_id'
    $raceOwner=$null;$raceRequests=@()
    try {
        $raceOwner=Start-Job -ScriptBlock {param($container,$password);& docker exec --env "MYSQL_PWD=$password" $container mysql -N -B -uroot eforge_enterprise -e 'START TRANSACTION; SELECT guard_id FROM gen_metadata_guard WHERE guard_id=1 FOR UPDATE; SELECT SLEEP(15); ROLLBACK;';if($LASTEXITCODE -ne 0){throw 'Race guard failed.'}} -ArgumentList $mysqlName,$testPassword
        $raceHeld=$false
        for($raceAttempt=0;$raceAttempt -lt 80;$raceAttempt++){if([int](GeneratorConfig-Sql "SELECT COUNT(*) FROM performance_schema.data_locks WHERE OBJECT_NAME='gen_metadata_guard' AND LOCK_TYPE='RECORD' AND LOCK_STATUS='GRANTED';") -gt 0){$raceHeld=$true;break};Start-Sleep -Milliseconds 100}
        Assert-Check $raceHeld 'Race owner lock must be observed before dispatch.'
        foreach($raceCase in @(@{path=$configPath;method='PUT';body=($configWrite|ConvertTo-Json -Depth 10 -Compress)},@{path=$deletePath;method='DELETE';body=(@{ids=@($otherId)}|ConvertTo-Json -Compress)})) {
            $raceRequests+=Start-Job -ScriptBlock {param($port,$case,$headers);$reply=Invoke-WebRequest -Uri "http://127.0.0.1:$port$($case.path)" -Method $case.method -Body $case.body -ContentType 'application/json' -Headers $headers -SkipHttpErrorCheck -TimeoutSec 35;return [int]$reply.StatusCode} -ArgumentList $AppPort,$raceCase,$authorized
        }
        $raceQueued=$false
        for($raceAttempt=0;$raceAttempt -lt 80;$raceAttempt++){if([int](GeneratorConfig-Sql "SELECT COUNT(*) FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON w.REQUESTING_ENGINE_LOCK_ID=l.ENGINE_LOCK_ID WHERE l.OBJECT_NAME='gen_metadata_guard';") -ge 2){$raceQueued=$true;break};Start-Sleep -Milliseconds 100}
        Assert-Check $raceQueued 'Both actual HTTP writers must be observed concurrently waiting on SQL.'
        Wait-Job $raceOwner -Timeout 20|Out-Null;Assert-Check ($raceOwner.State -eq 'Completed') 'Race owner rollback failed.';Receive-Job $raceOwner -ErrorAction Stop|Out-Null
        $raceStatuses=@();foreach($raceRequest in $raceRequests){Wait-Job $raceRequest -Timeout 35|Out-Null;Assert-Check ($raceRequest.State -eq 'Completed') 'Concurrent writer did not finish.';$raceStatuses+=Receive-Job $raceRequest -ErrorAction Stop}
        Write-Output "Generator reference/delete concurrent statuses: $($raceStatuses -join ',')"
        Assert-Check (($raceStatuses -join ',') -in @('204,409','400,204')) 'Concurrent reference creation/deletion must have one valid serial outcome.'
        Assert-Check ([int](GeneratorConfig-Sql "SELECT COUNT(*) FROM gen_table p LEFT JOIN gen_table c ON p.sub_table_name=c.table_name WHERE p.table_id=$configId AND p.tpl_category='sub' AND c.table_id IS NULL;") -eq 0) 'Concurrent writers must never commit a dangling subtable reference.'
    }finally{foreach($ownedRaceJob in @($raceOwner)+$raceRequests){if($ownedRaceJob){if($ownedRaceJob.State -eq 'Running'){Stop-Job $ownedRaceJob};Remove-Job $ownedRaceJob -Force}}}
    $deleteParentBefore=GeneratorConfig-Snapshot $configId;$deleteChildBefore=GeneratorConfig-Snapshot $otherId
    GeneratorConfig-Sql "CREATE TRIGGER $configTrigger BEFORE DELETE ON gen_table_column FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned deletion fault';"|Out-Null
    try {
        Assert-Problem (Request $deletePath 'DELETE' $deleteBody $authorized) 500 'INTERNAL_ERROR'
        Assert-Check ((GeneratorConfig-Snapshot $configId) -ceq $deleteParentBefore -and (GeneratorConfig-Snapshot $otherId) -ceq $deleteChildBefore) 'Field deletion failure must roll back the entire selected metadata batch.'
    }finally{GeneratorConfig-Sql "DROP TRIGGER $configTrigger;"|Out-Null}
    foreach($repeatDelete in 1..2){Assert-Check ((Request $deletePath 'DELETE' $deleteBody $authorized).StatusCode -eq 204) 'Batch metadata deletion must be atomic and idempotent.'}
    Assert-Check ([int](GeneratorConfig-Sql "SELECT COUNT(*) FROM gen_table WHERE table_id IN ($configId,$otherId);") -eq 0 -and [int](GeneratorConfig-Sql "SELECT COUNT(*) FROM gen_table_column WHERE table_id IN ($configId,$otherId);") -eq 0) 'Metadata deletion must leave no selected fields or tables.'
    Assert-Check ([int](GeneratorConfig-Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=database() AND table_name IN ('${configMarker}_a','${configMarker}_b','${configMarker}_c');") -eq 3) 'Metadata deletion must retain every actual physical fixture table.'
    foreach($retainedSuffix in @('a','b','c')) {
        Assert-Check ([int](GeneratorConfig-Sql "SELECT COUNT(*) FROM ${configMarker}_$retainedSuffix WHERE entry_id=1 AND name='owned-preserve-$retainedSuffix';") -eq 1) 'Metadata deletion must preserve original physical row identity and content.'
    }
    Write-Output 'Generator deletion/references: real permissions, canonical/legacy guards and rename, full rename/deletion rollback, legacy complete owned fields/physical types, observed concurrent valid outcomes, idempotent batch cleanup and physical SQL table retention passed.'
    Write-Output 'Generator configuration: actual original settings/control types/tree/subtable/name, clear/order/IDs/physical identity, no-role/foreign/incomplete refusal and SQL full rollback/retry passed.'
}finally {
    GeneratorConfig-Sql "DROP TRIGGER IF EXISTS $configTrigger; DELETE c FROM gen_table_column c JOIN gen_table t ON c.table_id=t.table_id WHERE t.table_name LIKE '${configMarker}%'; DELETE FROM gen_table WHERE table_name LIKE '${configMarker}%';"|Out-Null
    if($configUserId){Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($configUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned configuration user cleanup failed.'}
    foreach($suffix in @('a','b','c')){GeneratorConfig-Sql "DROP TABLE IF EXISTS ${configMarker}_$suffix;"|Out-Null}
}
