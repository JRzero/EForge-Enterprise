# Only the parent-owned disposable schema and records are modified by this verifier.
$generatorBase='/api/v1/tool/generator';$generatorMarker="gread_$runId";$generatorUserId=$null
$generatorOptions = '{"treeCode":"entry_id","treeParentCode":"parent_id","treeName":"name","parentMenuId":9007199254740993,"genView":true}'
function GeneratorRead-Sql([string]$sql) {return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e $sql}
try {
    foreach($suffix in @('a','b','c')) {GeneratorRead-Sql "CREATE TABLE ${generatorMarker}_$suffix (entry_id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(64) NOT NULL) COMMENT='生成器中文';"|Out-Null}
    GeneratorRead-Sql "INSERT INTO gen_table(table_id,table_name,table_comment,class_name,tpl_category,tpl_web_type,package_name,module_name,business_name,function_name,function_author,form_col_num,gen_type,gen_path,sub_table_name,sub_table_fk_name,options,create_time) VALUES (9007199254740993,'${generatorMarker}_a','生成器中文','ReadOwned','tree','element-plus','io.eforge.enterprise.owned','owned','read','读取','作者',3,'1','owned-output','${generatorMarker}_b','entry_id','$generatorOptions','2026-10-01 00:00:00'),(9007199254740994,'${generatorMarker}_b','生成器中文','ReadChild','crud','element-ui','io.eforge.enterprise.owned','owned','child','子表','作者',1,'0','/','','','{}','2026-10-02 00:00:00'); INSERT INTO gen_table_column(column_id,table_id,column_name,column_comment,column_type,java_type,java_field,is_pk,is_increment,is_required,is_insert,is_edit,is_list,is_query,query_type,html_type,dict_type,sort) VALUES (9007199254741003,9007199254740993,'entry_id','主键','bigint','Long','entryId','1','1','1','1','0','1','1','EQ','input','',0),(9007199254741004,9007199254740993,'name','中文名称','varchar(64)','String','name','0','0','1','1','1','1','1','LIKE','select','sys_common_status',1);" | Out-Null
    $list=(Request "$generatorBase/tables?name=$generatorMarker&comment=$([Uri]::EscapeDataString('生成器中文'))&pageSize=1&sort=name&direction=desc" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($list.total -eq 2 -and $list.items.Count -eq 1 -and $list.items[0].id -ceq '9007199254740994' -and !$list.PSObject.Properties['rows']) 'Generator SQL filters/order-before-page/string IDs failed.'
        $menuChoicesResponse=Request "$generatorBase/menu-options" 'GET' '' $authorized
    Assert-Check ($menuChoicesResponse.StatusCode -eq 200) 'Generator scoped menu options failed.'
    $menuChoices=@($menuChoicesResponse.Content|ConvertFrom-Json)
    $menuSqlIds=@(GeneratorRead-Sql 'SELECT CAST(menu_id AS CHAR) FROM sys_menu ORDER BY menu_id;')
    Assert-Check ((($menuChoices.id|Sort-Object) -join ',') -ceq (($menuSqlIds|Sort-Object) -join ',')) 'Admin generator choices must preserve the original full menu scope.'
    Assert-Check (@($menuChoices|Where-Object {$_.kind -eq 'F'}).Count -gt 0 -and !$menuChoices[0].PSObject.Properties['params']) 'Generator choices must retain node kinds without compatibility fields.'
    $calendar=(Request "$generatorBase/tables?name=$generatorMarker&from=2026-10-01&to=2026-10-01" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($calendar.total -eq 1 -and $calendar.items[0].id -ceq '9007199254740993') 'Generator inclusive SQL date filter failed.'
    $detail=(Request "$generatorBase/tables/9007199254740993" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($detail.configuration.options.parentMenuId -ceq '9007199254740993' -and $detail.configuration.options.generateDetail -and $detail.configuration.formColumns -eq 3 -and $detail.configuration.subTableForeignKey -eq 'entry_id' -and $detail.columns.Count -eq 2 -and $detail.columns[0].primaryKey -and !$detail.columns[0].editable -and $detail.columns[1].dictionaryType -eq 'sys_common_status' -and !$detail.table.PSObject.Properties['params']) 'Generator full typed configuration/column flags failed.'
    Assert-Check (@($detail.tables|Where-Object name -eq "${generatorMarker}_b").Count -eq 1 -and $detail.columns[0].tableId -ceq '9007199254740993') 'Generator table choices and exact column ownership failed.'
    $db=(Request "$generatorBase/database-tables?name=$generatorMarker&sort=name&direction=asc" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($db.total -eq 1 -and $db.items[0].name -eq "${generatorMarker}_c" -and !$db.items[0].PSObject.Properties['id']) 'Original imported-table exclusion and actual information_schema projection failed.'
    $injection=(Request "$generatorBase/tables?name=$([Uri]::EscapeDataString("x%' OR 1=1--"))" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($injection.total -eq 0) 'Generator name filter must remain a bound parameter.'
    Assert-Problem (Request "$generatorBase/tables?sort=drop" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
    Assert-Problem (Request "$generatorBase/tables?from=2026-10-02&to=2026-10-01" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
    Assert-Problem (Request "$generatorBase/tables/9223372036854775807" 'GET' '' $authorized) 404 'GENERATOR_TABLE_NOT_FOUND'
    $columnsActual=@((Request "$generatorBase/tables/9007199254740993/columns" 'GET' '' $authorized).Content|ConvertFrom-Json)
    Assert-Check ($columnsActual.Count -eq 2 -and $columnsActual[0].id -ceq '9007199254741003') 'Generator actual sorted field endpoint failed.'
    $generatorUsername="gr$runId";$generatorPassword='User12345'
    $created=Request '/api/v1/system/users' 'POST' (@{user=@{username=$generatorUsername;displayName='生成无权限';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password=$generatorPassword}|ConvertTo-Json -Depth 5 -Compress) $authorized
    Assert-Check ($created.StatusCode -eq 201) 'Owned generator no-role account creation failed.';$generatorUserId=($created.Content|ConvertFrom-Json).id
    $signedIn=Request '/api/v1/auth/login' 'POST' (@{username=$generatorUsername;password=$generatorPassword}|ConvertTo-Json -Compress)
    $generatorDenied=@{Authorization="Bearer $(($signedIn.Content|ConvertFrom-Json).accessToken)"}
    Assert-Problem (Request "$generatorBase/menu-options") 401 'AUTHENTICATION_REQUIRED'
    $emptyChoices=Request "$generatorBase/menu-options" 'GET' '' $generatorDenied
    Assert-Check ($emptyChoices.StatusCode -eq 200 -and @($emptyChoices.Content|ConvertFrom-Json).Count -eq 0) 'Authenticated no-role generator choices must keep original empty user scope without menu-admin permission.'
    foreach($path in @('/tables','/database-tables','/tables/9007199254740993','/tables/9007199254740993/columns')) {
        Assert-Problem (Request "$generatorBase$path") 401 'AUTHENTICATION_REQUIRED'
        Assert-Problem (Request "$generatorBase$path" 'GET' '' $generatorDenied) 403 'ACCESS_DENIED'
    }
    GeneratorRead-Sql "UPDATE gen_table SET options='malformed private' WHERE table_id=9007199254740993;"|Out-Null
    Assert-Problem (Request "$generatorBase/tables/9007199254740993" 'GET' '' $authorized) 500 'GENERATOR_CONFIGURATION_INVALID'
    try {
        GeneratorRead-Sql "RENAME TABLE gen_table TO gen_table_fault_$runId;"|Out-Null
        foreach($path in @('/tables','/database-tables')) { $failure=Request "$generatorBase$path" 'GET' '' $authorized; Assert-Check ($failure.StatusCode -eq 500 -and !$failure.Content.Contains("gen_table_fault_$runId")) 'Generator SQL fault must be sanitized.' }
    } finally {GeneratorRead-Sql "RENAME TABLE gen_table_fault_$runId TO gen_table;"|Out-Null}
    Assert-Check (((Request "$generatorBase/tables?name=$generatorMarker" 'GET' '' $authorized).Content|ConvertFrom-Json).total -eq 2) 'Generator SQL failure must preserve metadata and allow retry.'
    Write-Output 'Generator reads: actual schema/import exclusion, typed configuration/fields/choices, long IDs, filters/calendar/order-before-page, original permissions, malformed options and SQL fault preservation passed.'
} finally {
    if($generatorUserId) {Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($generatorUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned generator account cleanup failed.'}
    GeneratorRead-Sql "DELETE FROM gen_table_column WHERE table_id IN (9007199254740993,9007199254740994); DELETE FROM gen_table WHERE table_id IN (9007199254740993,9007199254740994);"|Out-Null
    foreach($suffix in @('a','b','c')) {GeneratorRead-Sql "DROP TABLE IF EXISTS ${generatorMarker}_$suffix;"|Out-Null}
}
