# Only fixtures in the parent-owned disposable schema are changed or removed.
$bundleMarker="gbundle_$runId";$bundleUserId=$null
function GeneratorBundle-Sql([string]$sql){return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e $sql}
function GeneratorBundle-Snapshot([string]$id){return @(GeneratorBundle-Sql "SELECT * FROM gen_table WHERE table_id=$id; SELECT * FROM gen_table_column WHERE table_id=$id ORDER BY column_id;") -join "`n"}
function GeneratorBundle-Zip([string]$path,[string]$method='GET',[string]$body=''){
    $bundleRequestArgs=@{Uri="http://127.0.0.1:$AppPort$path";Headers=$authorized;Method=$method;SkipHttpErrorCheck=$true;TimeoutSec=30}
    if($body){$bundleRequestArgs.Body=$body;$bundleRequestArgs.ContentType='application/json'}
    $bundleResponse=Invoke-WebRequest @bundleRequestArgs
    $bundleExpectedFilename=if($path.StartsWith('/api/v1/')){'eforge-generated.zip'}else{'ruoyi.zip'}
    Assert-Check ($bundleResponse.StatusCode -eq 200 -and $bundleResponse.Headers['Content-Disposition'] -like "*$bundleExpectedFilename*") 'Original download must return the complete attachment.'
    $bundleBytes=$bundleResponse.Content
    Assert-Check ($bundleBytes -is [byte[]]) 'Archive response must retain binary bytes.'
    $bundleFiles=[ordered]@{}
    $bundleStream=[IO.MemoryStream]::new($bundleBytes,$false)
    $bundleArchive=[IO.Compression.ZipArchive]::new($bundleStream,[IO.Compression.ZipArchiveMode]::Read)
    try{
        foreach($bundleEntry in $bundleArchive.Entries){
            Assert-Check (!$bundleFiles.Contains($bundleEntry.FullName)) 'Archive contains duplicate file names.'
            $bundleReader=[IO.StreamReader]::new($bundleEntry.Open(),[Text.UTF8Encoding]::new($false,$true))
            try{$bundleFiles[$bundleEntry.FullName]=$bundleReader.ReadToEnd()}finally{$bundleReader.Dispose()}
        }
    }finally{$bundleArchive.Dispose();$bundleStream.Dispose()}
    return $bundleFiles
}
function GeneratorBundle-Preview([string]$id){
    $bundleReply=(Request "/tool/gen/preview/$id" 'GET' '' $authorized).Content|ConvertFrom-Json -AsHashtable
    Assert-Check ($bundleReply.code -eq 200 -and $bundleReply.data.Count -ge 9) 'Original preview omitted files.'
    return $bundleReply.data
}
try{
    foreach($bundleSuffix in @('root','line','tree')){
        GeneratorBundle-Sql "CREATE TABLE ${bundleMarker}_$bundleSuffix (id BIGINT PRIMARY KEY,parent_id BIGINT,name VARCHAR(64)); INSERT INTO ${bundleMarker}_$bundleSuffix VALUES(1,0,'保留原数据');"|Out-Null
    }
    $bundleOptions='{"parentMenuId":"3","treeCode":"id","treeParentCode":"parent_id","treeName":"name"}'
    GeneratorBundle-Sql "INSERT INTO gen_table(table_name,class_name,tpl_category,tpl_web_type,package_name,module_name,business_name,function_name,function_author,form_col_num,options,sub_table_name,sub_table_fk_name) VALUES ('${bundleMarker}_root','BundleRoot','sub','element-plus-typescript','io.eforge.enterprise.bundle','bundle','root','主表输出','作者',2,'$bundleOptions','${bundleMarker}_line','parent_id'),('${bundleMarker}_line','BundleLine','crud','element-plus-typescript','io.eforge.enterprise.bundle','bundle','line','子表输出','作者',2,'$bundleOptions','',''),('${bundleMarker}_tree','BundleTree','tree','element-plus-typescript','io.eforge.enterprise.bundle','bundle','tree','树表输出','作者',2,'$bundleOptions','','');"|Out-Null
    $bundleSelection=@{}
    foreach($bundleSuffix in @('root','line','tree')){
        $bundleSelection[$bundleSuffix]=[string](GeneratorBundle-Sql "SELECT table_id FROM gen_table WHERE table_name='${bundleMarker}_$bundleSuffix';")
        $bundleParentProperty=if($bundleSuffix -eq 'line'){'ownerReference'}else{'parentId'}
        GeneratorBundle-Sql "INSERT INTO gen_table_column(table_id,column_name,column_comment,column_type,java_type,java_field,is_pk,is_increment,is_required,is_insert,is_edit,is_list,is_query,query_type,html_type,dict_type,sort) VALUES($($bundleSelection[$bundleSuffix]),'id','编号','bigint','Long','id','1','0','1','1','1','1','0','EQ','input','',0),($($bundleSelection[$bundleSuffix]),'parent_id','父项','bigint','Long','$bundleParentProperty','0','0','0','1','1','1','0','EQ','input','',1),($($bundleSelection[$bundleSuffix]),'name','中文名称','varchar(64)','String','name','0','0','0','1','1','1','1','LIKE','input','',2);"|Out-Null
    }
    GeneratorBundle-Sql "UPDATE gen_table_column SET java_field='oRderKey' WHERE table_id=$($bundleSelection.root) AND column_name='id';"|Out-Null
    $bundleBefore=@(foreach($bundleId in $bundleSelection.Values){GeneratorBundle-Snapshot $bundleId}) -join "`n"
    $bundlePhysicalBefore=@(foreach($bundleSuffix in @('root','line','tree')){GeneratorBundle-Sql "SELECT JSON_OBJECT('id',id,'parent',parent_id,'name',name) FROM ${bundleMarker}_$bundleSuffix ORDER BY id;"}) -join "`n"
    $bundleRootPreview=GeneratorBundle-Preview $bundleSelection.root;$bundleTreePreview=GeneratorBundle-Preview $bundleSelection.tree
    $bundleRootZip=GeneratorBundle-Zip "/tool/gen/download/${bundleMarker}_root"
    Assert-Check ($bundleRootZip.Count -eq $bundleRootPreview.Count) 'Single archive must include every preview template.'
    foreach($bundleText in $bundleRootPreview.Values){Assert-Check (@($bundleRootZip.Values|Where-Object {$_ -ceq $bundleText}).Count -ge 1) 'Single archive differs from preview content.'}
    Assert-Check ($bundleRootZip['main/java/io/eforge/enterprise/bundle/service/impl/BundleRootServiceImpl.java'].Contains('setOwnerReference(oRderKey)')) 'Actual downloaded service ignored the saved FK property.'
    $bundleService=$bundleRootZip['main/java/io/eforge/enterprise/bundle/service/impl/BundleRootServiceImpl.java']
    Assert-Check ($bundleService.Contains('getoRderKey()') -and !$bundleService.Contains('getORderKey()')) 'Downloaded service must use the actual configured primary-key accessor.'
    Assert-Check ($bundleRootZip['main/java/io/eforge/enterprise/bundle/domain/BundleRoot.java'].Contains('getoRderKey()')) 'Downloaded domain accessor differs from generated service.'
    $bundleBatch=GeneratorBundle-Zip "/tool/gen/batchGenCode?tables=${bundleMarker}_root,${bundleMarker}_tree"
    Assert-Check ($bundleBatch.Count -eq ($bundleRootPreview.Count+$bundleTreePreview.Count-1)) 'Batch archive lost files or duplicated the shared index.'
    $bundleExport=$bundleRootPreview['vm/ts/index.ts.vm']
    foreach($bundleLine in ($bundleTreePreview['vm/ts/index.ts.vm'] -split "`n")){if($bundleLine.StartsWith('export * from')){$bundleExport+="`n$bundleLine"}}
    Assert-Check ($bundleBatch['vue/types/api/index-bak.ts'] -ceq $bundleExport) 'Original shared export index semantics changed.'
    foreach($bundleTemplate in $bundleTreePreview.Keys){if($bundleTemplate -ne 'vm/ts/index.ts.vm'){Assert-Check (@($bundleBatch.Values|Where-Object {$_ -ceq $bundleTreePreview[$bundleTemplate]}).Count -ge 1) 'Batch omitted tree output content.'}}
    $bundleCanonicalPreviewReply=Request "/api/v1/tool/generator/tables/$($bundleSelection.root)/preview" 'GET' '' $authorized
    Assert-Check ($bundleCanonicalPreviewReply.StatusCode -eq 200 -and ($bundleCanonicalPreviewReply.Headers['Cache-Control'] -join ',') -eq 'no-store') 'Canonical preview must return no-store JSON.'
    $bundleCanonicalPreview=$bundleCanonicalPreviewReply.Content|ConvertFrom-Json
    Assert-Check ($bundleCanonicalPreview.tableId -ceq $bundleSelection.root -and $bundleCanonicalPreview.files.Count -eq $bundleRootPreview.Count -and !$bundleCanonicalPreview.PSObject.Properties['data']) 'Canonical typed preview ID/files boundary failed.'
    foreach($bundleFile in $bundleCanonicalPreview.files){Assert-Check ($bundleFile.content -ceq $bundleRootPreview[$bundleFile.template] -and $bundleFile.content -ceq $bundleRootZip[$bundleFile.path]) 'Canonical preview differs from actual original preview/ZIP.'}
    $bundleCanonicalSingle=GeneratorBundle-Zip '/api/v1/tool/generator/downloads' 'POST' (@{tableIds=@($bundleSelection.root)}|ConvertTo-Json -Compress)
    Assert-Check ($bundleCanonicalSingle.Count -eq $bundleRootZip.Count) 'Canonical single ZIP omitted files.'
    foreach($bundlePath in $bundleRootZip.Keys){Assert-Check ($bundleCanonicalSingle[$bundlePath] -ceq $bundleRootZip[$bundlePath]) 'Canonical single ZIP content mismatch.'}
    $bundleCanonicalBatch=GeneratorBundle-Zip '/api/v1/tool/generator/downloads' 'POST' (@{tableIds=@($bundleSelection.root,$bundleSelection.tree)}|ConvertTo-Json -Compress)
    Assert-Check ($bundleCanonicalBatch.Count -eq $bundleBatch.Count) 'Canonical batch omitted files.'
    foreach($bundlePath in $bundleBatch.Keys){Assert-Check ($bundleCanonicalBatch[$bundlePath] -ceq $bundleBatch[$bundlePath]) 'Canonical batch content mismatch.'}
    Assert-Problem (Request "/api/v1/tool/generator/tables/$($bundleSelection.root)/preview") 401 'AUTHENTICATION_REQUIRED'
    Assert-Problem (Request '/api/v1/tool/generator/downloads' 'POST' (@{tableIds=@($bundleSelection.root,$bundleSelection.root)}|ConvertTo-Json -Compress) $authorized) 400 'GENERATOR_SNAPSHOT_SELECTION_INVALID'
    Assert-Problem (Request '/api/v1/tool/generator/tables/9223372036854775807/preview' 'GET' '' $authorized) 404 'GENERATOR_TABLE_NOT_FOUND'
    Assert-Problem (Request '/api/v1/tool/generator/downloads' 'POST' '{"tableIds":["9223372036854775808"]}' $authorized) 400 'VALIDATION_ERROR'
    $bundleMissing=Request "/tool/gen/download/${bundleMarker}_missing" 'GET' '' $authorized
    Assert-Check (($bundleMissing.Content|ConvertFrom-Json).code -eq 404 -and !$bundleMissing.Headers['Content-Disposition']) 'Missing output must be JSON failure without partial attachment.'
    $bundleDuplicate=Request "/tool/gen/batchGenCode?tables=${bundleMarker}_root,${bundleMarker}_root" 'GET' '' $authorized
    Assert-Check (($bundleDuplicate.Content|ConvertFrom-Json).code -eq 400 -and !$bundleDuplicate.Headers['Content-Disposition']) 'Duplicate output must reject before ZIP.'
    $bundleUnsafeBefore=GeneratorBundle-Snapshot $bundleSelection.root
    GeneratorBundle-Sql "UPDATE gen_table SET module_name='../private_secret' WHERE table_id=$($bundleSelection.root);"|Out-Null
    try{
        Assert-Problem (Request "/api/v1/tool/generator/tables/$($bundleSelection.root)/preview" 'GET' '' $authorized) 400 'GENERATOR_OUTPUT_PATH_INVALID'
        $bundleUnsafe=Request "/tool/gen/download/${bundleMarker}_root" 'GET' '' $authorized
        Assert-Check (($bundleUnsafe.Content|ConvertFrom-Json).code -eq 400 -and !$bundleUnsafe.Content.Contains('private_secret') -and !$bundleUnsafe.Headers['Content-Disposition']) 'Unsafe persisted output path must refuse without echo or partial archive.'
    }finally{GeneratorBundle-Sql "UPDATE gen_table SET module_name='bundle' WHERE table_id=$($bundleSelection.root);"|Out-Null}
    Assert-Check ((GeneratorBundle-Snapshot $bundleSelection.root) -ceq $bundleUnsafeBefore) 'Output refusal changed metadata.'
    GeneratorBundle-Sql "RENAME TABLE gen_table_column TO bundle_fields_fault_$runId;"|Out-Null
    try{
        Assert-Problem (Request '/api/v1/tool/generator/downloads' 'POST' (@{tableIds=@($bundleSelection.root)}|ConvertTo-Json -Compress) $authorized) 503 'GENERATOR_SNAPSHOT_UNAVAILABLE'
        $bundleFault=Request "/tool/gen/download/${bundleMarker}_root" 'GET' '' $authorized
        Assert-Check (($bundleFault.Content|ConvertFrom-Json).code -eq 503 -and !$bundleFault.Content.Contains('bundle_fields_fault') -and !$bundleFault.Headers['Content-Disposition']) 'Actual SQL fault must return safe JSON without partial ZIP.'
    }finally{GeneratorBundle-Sql "RENAME TABLE bundle_fields_fault_$runId TO gen_table_column;"|Out-Null}
    Assert-Check ((GeneratorBundle-Zip "/tool/gen/download/${bundleMarker}_root").Count -eq $bundleRootZip.Count) 'Download did not recover after actual SQL failure.'
    $bundleCustomRoute="/api/v1/tool/generator/tables/$($bundleSelection.root)/custom-output"
    if($EnableCustomOutput){
        $bundleCustom=Request $bundleCustomRoute 'POST' '' $authorized
        Assert-Check ($bundleCustom.StatusCode -eq 200) 'Explicitly enabled custom output failed.'
        $bundleCustomFiles=($bundleCustom.Content|ConvertFrom-Json).files
        Assert-Check ($bundleCustomFiles.Count -eq 7 -and @($bundleCustomFiles|Where-Object state -ne 'CREATED').Count -eq 0) 'Complete original backend custom selection was not created.'
        foreach($bundleCustomFile in $bundleCustomFiles){
            $bundleWritten=[IO.File]::ReadAllText((Join-Path $customOutputDirectory $bundleCustomFile.path),[Text.UTF8Encoding]::new($false,$true))
            Assert-Check ($bundleWritten -ceq $bundleRootZip[$bundleCustomFile.path]) 'Actual custom file differs from complete original archive.'
        }
        $bundleCustomAgain=(Request $bundleCustomRoute 'POST' '' $authorized).Content|ConvertFrom-Json
        Assert-Check (@($bundleCustomAgain.files|Where-Object state -ne 'REPLACED').Count -eq 0) 'Explicit custom overwrite did not report replacements.'
        $bundleOriginalCustom=(Request "/tool/gen/genCode/${bundleMarker}_root" 'GET' '' $authorized).Content|ConvertFrom-Json
        Assert-Check ($bundleOriginalCustom.code -eq 200) 'Original custom route did not share completed output.'
        GeneratorBundle-Sql "UPDATE gen_table SET gen_path='../escape' WHERE table_id=$($bundleSelection.root);"|Out-Null
        try{Assert-Problem (Request $bundleCustomRoute 'POST' '' $authorized) 400 'GENERATOR_CUSTOM_PATH_INVALID'}finally{GeneratorBundle-Sql "UPDATE gen_table SET gen_path='/' WHERE table_id=$($bundleSelection.root);"|Out-Null}
    }else{
        Assert-Problem (Request $bundleCustomRoute 'POST' '' $authorized) 403 'GENERATOR_CUSTOM_OUTPUT_DISABLED'
        Assert-Check (!(Test-Path -LiteralPath $customOutputDirectory)) 'Disabled custom output touched the filesystem.'
        Assert-Check (((Request "/tool/gen/genCode/${bundleMarker}_root" 'GET' '' $authorized).Content|ConvertFrom-Json).code -eq 500) 'Original disabled custom output protection changed.'
    }
    $bundleCreated=Request '/api/v1/system/users' 'POST' (@{user=@{username="gb$runId";displayName='生成输出无角色';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 5 -Compress) $authorized
    Assert-Check ($bundleCreated.StatusCode -eq 201) 'No-role output fixture failed.';$bundleUserId=($bundleCreated.Content|ConvertFrom-Json).id
    $bundleLogin=(Request '/api/v1/auth/login' 'POST' (@{username="gb$runId";password='User12345'}|ConvertTo-Json -Compress)).Content|ConvertFrom-Json
    Assert-Problem (Request "/api/v1/tool/generator/tables/$($bundleSelection.root)/preview" 'GET' '' @{Authorization="Bearer $($bundleLogin.accessToken)"}) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/tool/generator/downloads' 'POST' (@{tableIds=@($bundleSelection.root)}|ConvertTo-Json -Compress) @{Authorization="Bearer $($bundleLogin.accessToken)"}) 403 'ACCESS_DENIED'
    Assert-Problem (Request $bundleCustomRoute 'POST' '' @{Authorization="Bearer $($bundleLogin.accessToken)"}) 403 'ACCESS_DENIED'
    $bundleDenied=Request "/tool/gen/download/${bundleMarker}_root" 'GET' '' @{Authorization="Bearer $($bundleLogin.accessToken)"}
    Assert-Check (($bundleDenied.Content|ConvertFrom-Json).code -eq 403 -and !$bundleDenied.Headers['Content-Disposition']) 'No-role original download grant must remain authoritative.'
    $bundleAfter=@(foreach($bundleId in $bundleSelection.Values){GeneratorBundle-Snapshot $bundleId}) -join "`n"
    $bundlePhysicalAfter=@(foreach($bundleSuffix in @('root','line','tree')){GeneratorBundle-Sql "SELECT JSON_OBJECT('id',id,'parent',parent_id,'name',name) FROM ${bundleMarker}_$bundleSuffix ORDER BY id;"}) -join "`n"
    Assert-Check ($bundleAfter -ceq $bundleBefore -and $bundlePhysicalAfter -ceq $bundlePhysicalBefore) 'Output changed metadata/audit fields or business rows.'
    $bundleAuditReady=$false
    for($bundleAttempt=0;$bundleAttempt -lt 50;$bundleAttempt++){
        $bundleAuditGood=[int](GeneratorBundle-Sql "SELECT COUNT(*) FROM sys_oper_log WHERE oper_url='/tool/gen/download/${bundleMarker}_root' AND business_type=8 AND status=0;")
        $bundleAuditBad=[int](GeneratorBundle-Sql "SELECT COUNT(*) FROM sys_oper_log WHERE oper_url='/tool/gen/download/${bundleMarker}_root' AND business_type=8 AND status=1;")
        if($bundleAuditGood -ge 1 -and $bundleAuditBad -ge 2){$bundleAuditReady=$true;break};Start-Sleep -Milliseconds 100
    }
    Assert-Check $bundleAuditReady 'Actual output success/failure audit did not retain honest outcomes.'
    Write-Output 'Generator output: actual original preview/single and batch binary ZIP fidelity, saved FK property, shared TS exports, no-role, missing/duplicate/path/real SQL safe failures, recovery, honest audit and exact metadata/business-row retention passed.'
}finally{
    if($bundleUserId){Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($bundleUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned output user cleanup failed.'}
    GeneratorBundle-Sql "DELETE c FROM gen_table_column c JOIN gen_table t ON c.table_id=t.table_id WHERE t.table_name LIKE '${bundleMarker}%'; DELETE FROM gen_table WHERE table_name LIKE '${bundleMarker}%';"|Out-Null
    foreach($bundleSuffix in @('root','line','tree')){GeneratorBundle-Sql "DROP TABLE IF EXISTS ${bundleMarker}_$bundleSuffix;"|Out-Null}
}