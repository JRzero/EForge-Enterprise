# Canonical monitor checks run only in the parent-owned disposable MySQL/Redis fixture.
$operationLogBase='/api/v1/monitor/operation-logs'
$loginLogBase='/api/v1/monitor/login-logs'
$logMarker="logs-$runId"
function Log-Sql([string]$sql) {
    return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e $sql
}
Log-Sql "INSERT INTO sys_oper_log(oper_id,title,business_type,oper_name,oper_ip,status,oper_time,cost_time,oper_param,json_result,error_msg) VALUES (910001,'$logMarker',2,'张三','127.0.0.1',0,'2026-10-01 00:00:00',99,'中文请求','<script>raw data</script>',''),(910002,'$logMarker',3,'李四','127.0.0.2',1,'2026-10-01 23:59:59',5,'第二请求','结果','错误详情'),(910003,'$logMarker',2,'张三','127.0.0.1',0,'2026-10-02 00:00:00',40,'第三请求','结果',''); INSERT INTO sys_logininfor(info_id,user_name,ipaddr,status,msg,login_time) VALUES (920001,'$logMarker-a','127.0.0.1','0','成功中文','2026-10-01 00:00:00'),(920002,'$logMarker-b','127.0.0.2','1','密码错误','2026-10-01 23:59:59'),(920003,'$logMarker-c','127.0.0.1','0','成功','2026-10-02 00:00:00');" | Out-Null
$page=(Request "$operationLogBase`?title=$logMarker&sort=duration&direction=asc&pageSize=1" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($page.total -eq 3 -and $page.items.Count -eq 1 -and $page.items[0].id -ceq '910002' -and !$page.items[0].PSObject.Properties['requestParameters'] -and !$page.PSObject.Properties['rows']) 'Operation log paging/sort/typed summary failed.'
$calendar=(Request "$operationLogBase`?title=$logMarker&from=2026-10-01&to=2026-10-01" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($calendar.total -eq 2) 'Operation calendar range must include both day boundaries and exclude next midnight.'
$filtered=(Request "$operationLogBase`?title=$logMarker&operator=$([uri]::EscapeDataString('张'))&ip=127.0.0.1&businessType=2&status=0" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($filtered.total -eq 2 -and $filtered.items[0].id -eq '910003') 'Operation filters/default time ordering failed.'
$detail=(Request "$operationLogBase/910001" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($detail.entry.id -eq '910001' -and $detail.requestParameters -eq '中文请求' -and $detail.responseBody -eq '<script>raw data</script>') 'Operation detail must retain untrusted log text as data.'
Assert-Problem (Request "$operationLogBase/9223372036854775807" 'GET' '' $authorized) 404 'OPERATION_LOG_NOT_FOUND'
Assert-Problem (Request "$operationLogBase`?sort=oper_time%20desc" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$loginLogBase`?sort=user_name%20desc" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$loginLogBase`?from=2026-10-02&to=2026-10-01" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
$loginPage=(Request "$loginLogBase`?username=$logMarker&sort=username&direction=asc&pageSize=1&page=2" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($loginPage.total -eq 3 -and $loginPage.items[0].id -eq '920002' -and $loginPage.items[0].message -eq '密码错误') 'Login log paging/username order/projection failed.'
$loginDates=(Request "$loginLogBase`?username=$logMarker&from=2026-10-01&to=2026-10-01" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($loginDates.total -eq 2) 'Login calendar boundaries failed.'
$loginFiltered=(Request "$loginLogBase`?username=$logMarker&ip=127.0.0.2&status=1" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($loginFiltered.total -eq 1 -and $loginFiltered.items[0].id -eq '920002') 'Login IP/status filters failed.'
foreach($export in @(
    @{Base=$operationLogBase;Query="title=$logMarker&sort=duration&direction=asc&page=999&pageSize=1";Name='operation-logs';Required='中文请求';First='第二请求'},
    @{Base=$loginLogBase;Query="username=$logMarker&sort=username&direction=asc&page=999&pageSize=1";Name='login-logs';Required='成功中文';First="$logMarker-a"}
)) {
    $file=Join-Path $logDirectory "$($export.Name).xlsx"
    Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$($export.Base)/export?$($export.Query)" -Method POST -Headers $authorized -OutFile $file | Out-Null
    $archive=[IO.Compression.ZipFile]::OpenRead($file)
    try {
        $reader=[IO.StreamReader]::new($archive.GetEntry('xl/worksheets/sheet1.xml').Open())
        try{$sheet=$reader.ReadToEnd()}finally{$reader.Dispose()}
        [xml]$xml=$sheet
        $rows=$xml.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")
        Assert-Check ($rows.Count -eq 4 -and $sheet.Contains($export.Required) -and $rows[1].InnerText.Contains($export.First)) 'Filtered/sorted XLSX must contain every result, ignoring list pagination.'
    } finally {$archive.Dispose()}
}
try {
    Log-Sql "CREATE TRIGGER owned_operation_delete_fault BEFORE DELETE ON sys_oper_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned log fault';" | Out-Null
    Assert-Problem (Request $operationLogBase 'DELETE' '{"ids":["910001","910002"]}' $authorized) 500 'INTERNAL_ERROR'
} finally {Log-Sql 'DROP TRIGGER IF EXISTS owned_operation_delete_fault;' | Out-Null}
Assert-Check ((Log-Sql 'SELECT COUNT(*) FROM sys_oper_log WHERE oper_id IN (910001,910002);') -eq '2') 'Failed immutable log deletion changed actual rows.'
Assert-Check ((Request $operationLogBase 'DELETE' '{"ids":["910001","910001","9223372036854775807"]}' $authorized).StatusCode -eq 204) 'Log deletion must deduplicate and allow already-missing immutable IDs.'
Assert-Check ((Log-Sql 'SELECT COUNT(*) FROM sys_oper_log WHERE oper_id=910001;') -eq '0') 'Operation log deletion did not persist.'
Assert-Check ((Request $loginLogBase 'DELETE' '{"ids":["920001","920001"]}' $authorized).StatusCode -eq 204) 'Login log batch deletion failed.'
Assert-Check ((Log-Sql 'SELECT COUNT(*) FROM sys_logininfor WHERE info_id=920001;') -eq '0') 'Login log deletion did not persist.'

$logUsername="lg$runId"
$userBody=@{user=@{username=$logUsername;displayName='日志无权限账号';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 6 -Compress
$created=Request '/api/v1/system/users' 'POST' $userBody $authorized
Assert-Check ($created.StatusCode -eq 201) 'Owned log account creation failed.'
$logUserId=($created.Content|ConvertFrom-Json).id
try {
    $loginCredentials=@{username=$logUsername;password='User12345'}|ConvertTo-Json -Compress
    $token=((Request '/api/v1/auth/login' 'POST' $loginCredentials).Content|ConvertFrom-Json).accessToken
    Assert-Check (!!$token) 'Owned log account login failed.'
    $logHeaders=@{Authorization="Bearer $token"}
    foreach($denied in @(
        @{Path=$operationLogBase;Method='GET';Body=''},@{Path="$operationLogBase/910002";Method='GET';Body=''},
        @{Path=$operationLogBase;Method='DELETE';Body='{"ids":["910002"]}'},@{Path="$operationLogBase/clear";Method='POST';Body=''},@{Path="$operationLogBase/export";Method='POST';Body=''},
        @{Path=$loginLogBase;Method='GET';Body=''},@{Path=$loginLogBase;Method='DELETE';Body='{"ids":["920002"]}'},
        @{Path="$loginLogBase/clear";Method='POST';Body=''},@{Path="$loginLogBase/export";Method='POST';Body=''},@{Path="$loginLogBase/unlock";Method='POST';Body="{`"username`":`"$logUsername`"}"}
    )) {Assert-Problem (Request $denied.Path $denied.Method $denied.Body $logHeaders) 403 'ACCESS_DENIED'}
    $wrong=@{username=$logUsername;password='Wrong12345'}|ConvertTo-Json -Compress
    for($attempt=0;$attempt -lt 5;$attempt++){Assert-Problem (Request '/api/v1/auth/login' 'POST' $wrong) 401 'AUTHENTICATION_FAILED'}
    Assert-Problem (Request '/api/v1/auth/login' 'POST' $loginCredentials) 401 'AUTHENTICATION_FAILED'
    $failureKey="pwd_err_cnt:$logUsername"
    Assert-Check ((Invoke-Docker exec $redisName redis-cli GET $failureKey) -eq '5' -and [int](Invoke-Docker exec $redisName redis-cli TTL $failureKey) -gt 0) 'Actual password retry state/TTL must block valid credentials.'
    try {
        Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-del' '-unlink' | Out-Null
        Assert-Problem (Request "$loginLogBase/unlock" 'POST' (@{username=$logUsername}|ConvertTo-Json -Compress) $authorized) 503 'LOGIN_UNLOCK_UNAVAILABLE'
        Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS $failureKey) -eq '1') 'Failed unlock must not report success or remove the actual retry state.'
    } finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+del' '+unlink' | Out-Null}
    Assert-Check ((Request "$loginLogBase/unlock" 'POST' (@{username=$logUsername}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Canonical login unlock failed.'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS $failureKey) -eq '0' -and (Request '/api/v1/auth/login' 'POST' $loginCredentials).StatusCode -eq 200) 'Unlock must clear Redis retry state and permit the actual correct password.'
    Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $logHeaders).StatusCode -eq 200) 'Password unlock must not revoke an existing valid session.'
} finally {Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($logUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned log account cleanup failed.'}
Assert-Check ((Request "$operationLogBase/clear" 'POST' '' $authorized).StatusCode -eq 204) 'Canonical operation clear failed.'
Assert-Check ((Request "$loginLogBase/clear" 'POST' '' $authorized).StatusCode -eq 204) 'Canonical login clear failed.'
# New asynchronous audit/login events may arrive after a clear; require all owned historical rows to disappear.
Assert-Check ((Log-Sql "SELECT COUNT(*) FROM sys_oper_log WHERE title='$logMarker';") -eq '0' -and (Log-Sql "SELECT COUNT(*) FROM sys_logininfor WHERE user_name LIKE '$logMarker%';") -eq '0') 'Canonical clear retained owned historical log rows.'
Write-Host 'Logs: typed paging/filter/date/sort/detail, real sorted XLSX, idempotent batch deletion, SQL failure preservation, clear, all no-role permission guards and real Redis password lock/unlock/ACL-failure passed.'
