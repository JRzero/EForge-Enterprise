# Only the parent-owned disposable schema and uniquely named fixture are modified.
$configMarker="gconfig_$runId";$configUserId=$null;$configTrigger="gconfig_fault_$runId"
function GeneratorConfig-Sql([string]$sql){return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e $sql}
function GeneratorConfig-Input($detail){
    $fields=@($detail.columns|ForEach-Object {@{id=$_.id;comment=$_.comment;javaType=$_.javaType;javaField=$_.javaField;required=[bool]$_.required;insertable=[bool]$_.insertable;editable=[bool]$_.editable;listed=[bool]$_.listed;queryable=[bool]$_.queryable;queryType=$_.queryType;controlType=$_.controlType;dictionaryType=$_.dictionaryType;order=$_.order}})
    return @{name=$detail.table.name;comment='配置中文';className='ConfiguredEntry';category='crud';packageName='io.eforge.enterprise.owned';moduleName='sales-api';businessName='order-line';functionName='配置';author='作者';formColumns=3;outputType='1';outputPath='D:/生成输出';remark='';options=@{parentMenuId='0';generateDetail=$true};columns=$fields}
}
function GeneratorConfig-Snapshot($id){return @(GeneratorConfig-Sql "SELECT CONCAT_WS('|',table_name,table_comment,class_name,tpl_category,tpl_web_type,function_name,form_col_num,gen_type,gen_path,remark,options) FROM gen_table WHERE table_id=$id; SELECT CONCAT_WS('|',column_id,column_name,column_comment,column_type,java_type,java_field,is_pk,is_increment,is_required,is_insert,is_edit,is_list,is_query,query_type,html_type,dict_type,sort) FROM gen_table_column WHERE table_id=$id ORDER BY column_id;") -join "`n"}
try {
    $configSpec=Get-Content -LiteralPath $snapshotPath -Raw|ConvertFrom-Json -AsHashtable
    Assert-Check ($configSpec.components.schemas.Options.properties.parentMenuName -and ($configSpec.components.schemas.GeneratorConfigurationOptions.required -contains 'generateDetail') -and ($configSpec.components.schemas.GeneratorConfigurationUpdate.properties.options.'$ref' -ceq '#/components/schemas/GeneratorConfigurationOptions')) 'Generator read/write OpenAPI options must have distinct complete schemas.'
    foreach($suffix in @('a','b','c')){GeneratorConfig-Sql "CREATE TABLE ${configMarker}_$suffix (entry_id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(64) NOT NULL) COMMENT='配置中文';"|Out-Null}
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
    Write-Output 'Generator configuration: actual original settings/control types/tree/subtable/name, clear/order/IDs/physical identity, no-role/foreign/incomplete refusal and SQL full rollback/retry passed.'
}finally {
    GeneratorConfig-Sql "DROP TRIGGER IF EXISTS $configTrigger; DELETE c FROM gen_table_column c JOIN gen_table t ON c.table_id=t.table_id WHERE t.table_name LIKE '${configMarker}%'; DELETE FROM gen_table WHERE table_name LIKE '${configMarker}%';"|Out-Null
    if($configUserId){Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($configUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned configuration user cleanup failed.'}
    foreach($suffix in @('a','b','c')){GeneratorConfig-Sql "DROP TABLE IF EXISTS ${configMarker}_$suffix;"|Out-Null}
}
