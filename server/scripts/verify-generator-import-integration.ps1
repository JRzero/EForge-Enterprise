# Canonical imports affect only generator metadata in the parent-owned disposable schema.
$importMarker="gimport_$runId";$importUserId=$null;$importTrigger="gimport_fail_$runId"
function GeneratorImport-Sql([string]$sql) {return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e $sql}
function GeneratorImport-Body($names) {return @{names=@($names)}|ConvertTo-Json -Compress}
try {
    foreach($suffix in @('a','b','race')) {GeneratorImport-Sql "CREATE TABLE ${importMarker}_$suffix (entry_id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(64) NOT NULL) COMMENT='导入中文';"|Out-Null}
    $body=GeneratorImport-Body @("${importMarker}_a","${importMarker}_b")
    Assert-Problem (Request '/api/v1/tool/generator/imports' 'POST' $body) 401 'AUTHENTICATION_REQUIRED'
    $importUsername="gi$runId"
    $created=Request '/api/v1/system/users' 'POST' (@{user=@{username=$importUsername;displayName='导入无权限';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 5 -Compress) $authorized
    Assert-Check ($created.StatusCode -eq 201) 'Owned generator import no-role account creation failed.';$importUserId=($created.Content|ConvertFrom-Json).id
    $login=Request '/api/v1/auth/login' 'POST' (@{username=$importUsername;password='User12345'}|ConvertTo-Json -Compress)
    Assert-Problem (Request '/api/v1/tool/generator/imports' 'POST' $body @{Authorization="Bearer $(($login.Content|ConvertFrom-Json).accessToken)"}) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/tool/generator/imports' 'POST' (GeneratorImport-Body @("${importMarker}_a","missing_$runId")) $authorized) 404 'GENERATOR_DATABASE_TABLE_NOT_FOUND'
    Assert-Check ((GeneratorImport-Sql "SELECT COUNT(*) FROM gen_table WHERE table_name LIKE '${importMarker}%';") -eq '0') 'Missing selection must not import a partial batch.'
    # Fail after the first table and first column were inserted: actual JDBC transaction must roll back everything.
    GeneratorImport-Sql "SET SESSION sql_mode='STRICT_ALL_TABLES'; CREATE TRIGGER $importTrigger BEFORE INSERT ON gen_table_column FOR EACH ROW SET NEW.column_name=IF(NEW.column_name='name',REPEAT('x',1000),NEW.column_name);"|Out-Null
    try {
        $failed=Request '/api/v1/tool/generator/imports' 'POST' $body $authorized
        Assert-Problem $failed 500 'INTERNAL_ERROR'
        Assert-Check (!$failed.Content.Contains('column_name') -and !$failed.Content.Contains($importTrigger)) 'Import SQL failure must be sanitized.'
        Assert-Check ((GeneratorImport-Sql "SELECT COUNT(*) FROM gen_table WHERE table_name LIKE '${importMarker}%';") -eq '0') 'Failed batch must roll back tables.'
        Assert-Check ((GeneratorImport-Sql "SELECT COUNT(*) FROM gen_table_column c LEFT JOIN gen_table t ON c.table_id=t.table_id WHERE t.table_id IS NULL;") -eq '0') 'Failed batch must not leave orphan fields.'
    } finally {GeneratorImport-Sql "DROP TRIGGER IF EXISTS $importTrigger;"|Out-Null}
    $imported=Request '/api/v1/tool/generator/imports' 'POST' $body $authorized
    Assert-Check ($imported.StatusCode -eq 201) 'Canonical batch import failed.'
    $result=$imported.Content|ConvertFrom-Json
    Assert-Check ($result.tables.Count -eq 2 -and $result.tables[0].name -eq "${importMarker}_a" -and $result.tables[0].columnCount -eq 2 -and $result.tables[0].id -is [string]) 'Import result/order/IDs must be typed.'
    foreach($row in $result.tables) {
        $detail=(Request "/api/v1/tool/generator/tables/$($row.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
        Assert-Check ($detail.table.webType -eq 'eforge-react' -and $detail.columns.Count -eq 2 -and $detail.columns[0].primaryKey -and $detail.columns[0].autoIncrement -and $detail.columns[1].required -and $detail.columns[1].javaField -eq 'name') 'Actual original initialization and exact field ownership failed.'
    }
    Assert-Problem (Request '/api/v1/tool/generator/imports' 'POST' $body $authorized) 409 'GENERATOR_TABLE_ALREADY_IMPORTED'
    Assert-Check ((GeneratorImport-Sql "SELECT COUNT(*) FROM gen_table WHERE table_name LIKE '${importMarker}%';") -eq '2') 'Repeat import must not duplicate metadata.'
    # Two real HTTP requests race for the same physical table; SQL uniqueness is authoritative.
    $raceBody=GeneratorImport-Body @("${importMarker}_race")
    $jobs=@()
    try {
        1..2|ForEach-Object {$jobs+=Start-Job -ScriptBlock {param($url,$body,$authorization)
            (Invoke-WebRequest -Uri $url -Method POST -ContentType 'application/json' -Body $body -Headers @{Authorization=$authorization} -SkipHttpErrorCheck -TimeoutSec 30).StatusCode
        } -ArgumentList "http://127.0.0.1:$AppPort/api/v1/tool/generator/imports",$raceBody,$authorized.Authorization}
        $jobs|Wait-Job -Timeout 45|Out-Null
        $statuses=@($jobs|Receive-Job)
        Assert-Check ($statuses.Count -eq 2 -and (@($statuses|Where-Object {$_ -eq 201}).Count -eq 1) -and (@($statuses|Where-Object {$_ -eq 409}).Count -eq 1)) 'Concurrent import must produce one success and one conflict.'
    } finally {$jobs|Remove-Job -Force}
    Assert-Check ((GeneratorImport-Sql "SELECT COUNT(*) FROM gen_table WHERE table_name='${importMarker}_race';") -eq '1') 'Concurrent import must save exactly one configuration.'
    Assert-Check ((GeneratorImport-Sql "SELECT COUNT(*) FROM gen_table_column c JOIN gen_table t ON c.table_id=t.table_id WHERE t.table_name='${importMarker}_race';") -eq '2') 'Concurrent loser must leave no partial columns.'
    Write-Output 'Generator import: real schema, original grant, batch initialization, exact IDs/ownership, missing preflight, SQL rollback/retry and concurrent SQL uniqueness passed.'
} finally {
    GeneratorImport-Sql "DROP TRIGGER IF EXISTS $importTrigger; DELETE c FROM gen_table_column c JOIN gen_table t ON c.table_id=t.table_id WHERE t.table_name LIKE '${importMarker}%'; DELETE FROM gen_table WHERE table_name LIKE '${importMarker}%';"|Out-Null
    if($importUserId){Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($importUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned import user cleanup failed.'}
    foreach($suffix in @('a','b','race')) {GeneratorImport-Sql "DROP TABLE IF EXISTS ${importMarker}_$suffix;"|Out-Null}
}
