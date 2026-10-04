# Owned disposable fixture only; all grants below use canonical endpoints.
$roleBase = '/api/v1/system/roles'
function Role-Body([string]$name, [string]$key, [string[]]$menuKeys = @()) {
    return @{name=$name;key=$key;sort=7;status='0';remark='角色集成验证';menuLinked=$true;menuKeys=@($menuKeys)}
}
function Create-Role([string]$suffix, [string[]]$keys = @()) {
    $body = Role-Body "验证角色-$suffix-$runId" "role-$suffix-$runId" $keys
    $response = Request $roleBase 'POST' ($body | ConvertTo-Json -Depth 5 -Compress) $authorized
    Assert-Check ($response.StatusCode -eq 201) "Creating role failed: $($response.Content)"
    $role = $response.Content | ConvertFrom-Json
    Assert-Check ($role.id -is [string] -and $response.Headers.Location -eq "$roleBase/$($role.id)" -and $role.dataScope -eq '1') 'Role creation identity/default scope is incorrect.'
    return $role
}
function Role-Users([string]$id, [string[]]$ids, [string]$method = 'PUT', [hashtable]$headers = $authorized) {
    return Request "$roleBase/$id/users" $method (@{userIds=@($ids)} | ConvertTo-Json -Compress) $headers
}
function Role-Scope([string]$id, [string]$mode, [string[]]$ids = @()) {
    return Request "$roleBase/$id/data-scope" 'PUT' (@{mode=$mode;departmentLinked=$true;departmentIds=@($ids)} | ConvertTo-Json -Compress) $authorized
}
Assert-Problem (Request $roleBase) 401 'AUTHENTICATION_REQUIRED'
Assert-Problem (Request "$roleBase`?page=0" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$roleBase`?beginDate=2026-02-30" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$roleBase/999999" 'GET' '' $authorized) 404 'ROLE_NOT_FOUND'
Assert-Problem (Request "$roleBase/1/status" 'PUT' '{"status":"1"}' $authorized) 409 'ROLE_ADMIN_PROTECTED'
Assert-Problem (Request $roleBase 'DELETE' '{"ids":["2"]}' $authorized) 409 'ROLE_IN_USE'
$roleMenus = (Request "$roleBase/menus" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check (@($roleMenus | Where-Object { $_.key -eq 'system-posts' -and $_.permission -eq 'system:post:list' }).Count -eq 1 -and !$roleMenus[0].PSObject.Properties['component']) 'Grant menu options must expose stable keys without backend component strings.'
$probeRole = Create-Role 'probe' @('system','system-posts','system-post-query')
$probeBody = Role-Body $probeRole.name $probeRole.key @('system','system-posts','system-post-query')
Assert-Problem (Request $roleBase 'POST' ($probeBody | ConvertTo-Json -Depth 5 -Compress) $authorized) 409 'ROLE_NAME_EXISTS'
$keyCollision = Role-Body "Other-$runId" $probeRole.key
Assert-Problem (Request $roleBase 'POST' ($keyCollision | ConvertTo-Json -Depth 5 -Compress) $authorized) 409 'ROLE_KEY_EXISTS'
foreach ($sqlProbe in @("INSERT INTO sys_role(role_name,role_key,role_sort,status) SELECT role_name,'other-$runId',1,'0' FROM sys_role WHERE role_id=$($probeRole.id);", "INSERT INTO sys_role(role_name,role_key,role_sort,status) SELECT 'Other name-$runId',role_key,1,'0' FROM sys_role WHERE role_id=$($probeRole.id);")) {
    $output = & docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -uroot eforge_enterprise -e $sqlProbe 2>&1
    Assert-Check ($LASTEXITCODE -ne 0 -and ($output -join '') -match '1062') "Active role uniqueness must be enforced by the real database: exit=$LASTEXITCODE; $($output -join ' ')"
}
$rolePage = (Request "$roleBase`?key=$($probeRole.key)&pageSize=1" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($rolePage.total -eq 1 -and $rolePage.items[0].id -eq $probeRole.id) 'Typed filtered role paging failed.'
$probeBody.sort=12;$probeBody.remark='';$probeBody.menuLinked=$false
Assert-Check ((Request "$roleBase/$($probeRole.id)" 'PUT' ($probeBody | ConvertTo-Json -Depth 5 -Compress) $authorized).StatusCode -eq 204) 'Role edit failed.'
$editor = (Request "$roleBase/$($probeRole.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($editor.role.sort -eq 12 -and $editor.role.remark -eq '' -and !$editor.role.menuLinked -and $editor.menuKeys.Count -eq 3 -and $editor.checkedMenuKeys.Count -eq 3) 'Role edit/independent menu checks did not persist.'
$roleExport = Join-Path $logDirectory 'roles-export.xlsx'
Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$roleBase/export?key=$($probeRole.key)" -Method POST -Headers $authorized -OutFile $roleExport | Out-Null
$archive=[IO.Compression.ZipFile]::OpenRead($roleExport)
try { $reader=[IO.StreamReader]::new($archive.GetEntry('xl/worksheets/sheet1.xml').Open());try {$sheet=$reader.ReadToEnd()}finally{$reader.Dispose()};Assert-Check ($sheet.Contains($probeRole.key) -and $sheet.Contains('正常')) 'Role export workbook content is incorrect.' } finally { $archive.Dispose() }

# Start a session with no role. Assignment/revocation must work without a bootstrap refresh.
$roleAccount=Create-User "ra-$runId" '101'
$otherAccount=Create-User "rb-$runId" '105'
$outsideAccount=Create-User "rc-$runId" '108'
foreach($account in @($roleAccount,$otherAccount,$outsideAccount)) { Assert-Check ((Request "$userBase/$($account.id)/roles" 'PUT' '{"roleIds":[]}' $authorized).StatusCode -eq 204) 'Clearing fixture grants failed.' }
$roleLogin=(Request '/api/v1/auth/login' 'POST' (@{username=$roleAccount.username;password='User12345'} | ConvertTo-Json -Compress)).Content | ConvertFrom-Json
$roleHeaders=@{Authorization="Bearer $($roleLogin.accessToken)"}
Assert-Problem (Request '/api/v1/system/posts' 'GET' '' $roleHeaders) 403 'ACCESS_DENIED'
Assert-Check ((Role-Users $probeRole.id @($roleAccount.id)).StatusCode -eq 204) 'Role user assignment failed.'
Assert-Check ((Role-Users $probeRole.id @($roleAccount.id)).StatusCode -eq 204) 'Repeated role assignment must be idempotent.'
Assert-Check ((Request '/api/v1/system/posts' 'GET' '' $roleHeaders).StatusCode -eq 200) 'Existing session must acquire committed permissions immediately.'
$allocated=(Request "$roleBase/$($probeRole.id)/users?assigned=true&username=$($roleAccount.username)" 'GET' '' $authorized).Content | ConvertFrom-Json
$unallocated=(Request "$roleBase/$($probeRole.id)/users?assigned=false&username=$($otherAccount.username)" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($allocated.total -eq 1 -and $allocated.items[0].id -eq $roleAccount.id -and !$allocated.items[0].PSObject.Properties['password'] -and $unallocated.total -eq 1) 'Allocated/unallocated paging or safe user projection failed.'
Assert-Problem (Role-Users $probeRole.id @($otherAccount.id,'1')) 409 'USER_ADMIN_PROTECTED'
Assert-Check (((Request "$roleBase/$($probeRole.id)/users?assigned=true&username=$($otherAccount.username)" 'GET' '' $authorized).Content | ConvertFrom-Json).total -eq 0) 'Mixed invalid assignment partially wrote grants.'
Assert-Check ((Request "$roleBase/$($probeRole.id)/status" 'PUT' '{"status":"1"}' $authorized).StatusCode -eq 204) 'Disabling role failed.'
Assert-Problem (Request '/api/v1/system/posts' 'GET' '' $roleHeaders) 403 'ACCESS_DENIED'
Assert-Problem (Role-Users $probeRole.id @($otherAccount.id)) 409 'ROLE_DISABLED'
Assert-Check ((Request "$roleBase/$($probeRole.id)/status" 'PUT' '{"status":"0"}' $authorized).StatusCode -eq 204) 'Enabling role failed.'
Assert-Check ((Request '/api/v1/system/posts' 'GET' '' $roleHeaders).StatusCode -eq 200) 'Existing session must regain enabled role permissions.'
$probeBody.menuKeys=@('system');Assert-Check ((Request "$roleBase/$($probeRole.id)" 'PUT' ($probeBody | ConvertTo-Json -Depth 5 -Compress) $authorized).StatusCode -eq 204) 'Removing grants failed.'
Assert-Problem (Request '/api/v1/system/posts' 'GET' '' $roleHeaders) 403 'ACCESS_DENIED'

# Exercise all original scope modes through the actual DataScopeAspect and Redis snapshot.
$probeBody.menuKeys=@('system','system-users','system-roles','system-role-query','system-role-edit','system-posts')
Assert-Check ((Request "$roleBase/$($probeRole.id)" 'PUT' ($probeBody | ConvertTo-Json -Depth 5 -Compress) $authorized).StatusCode -eq 204) 'Preparing scoped role grants failed.'
foreach($mode in @('5','3','4','2','1')) {
    [string[]]$ids=@();if($mode -eq '2'){$ids=@('105')}
    $scopeUpdate=Role-Scope $probeRole.id $mode $ids
    Assert-Check ($scopeUpdate.StatusCode -eq 204) "Updating scope $mode failed: $($scopeUpdate.Content)"
    $own=(Request "$userBase`?username=$($roleAccount.username)" 'GET' '' $roleHeaders).Content | ConvertFrom-Json
    $other=(Request "$userBase`?username=$($otherAccount.username)" 'GET' '' $roleHeaders).Content | ConvertFrom-Json
    $outside=(Request "$userBase`?username=$($outsideAccount.username)" 'GET' '' $roleHeaders).Content | ConvertFrom-Json
    Assert-Check ($own.total -eq $(if($mode -eq '2'){0}else{1}) -and $other.total -eq $(if($mode -in @('2','4','1')){1}else{0}) -and $outside.total -eq $(if($mode -eq '1'){1}else{0})) "Scope $mode did not immediately update the cached role metadata."
}
Assert-Check ((Role-Scope $probeRole.id '2' @('101')).StatusCode -eq 204) 'Preparing limited manager scope failed.'
$scopeRead=(Request "$roleBase/$($probeRole.id)/data-scope" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($scopeRead.departmentIds -contains '101' -and $scopeRead.mode -eq '2' -and $scopeRead.departmentLinked) 'Scope selection response failed.'
Assert-Problem (Request "$roleBase/$($probeRole.id)/data-scope" 'PUT' '{"mode":"1","departmentLinked":true,"departmentIds":["103"]}' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Role-Users $probeRole.id @($roleAccount.id,$otherAccount.id) 'PUT' $roleHeaders) 403 'ACCESS_DENIED'
Assert-Check (((Request "$roleBase/$($probeRole.id)/users?assigned=true&username=$($otherAccount.username)" 'GET' '' $authorized).Content | ConvertFrom-Json).total -eq 0) 'Out-of-scope mixed assignment partially wrote grants.'
Assert-Problem (Request "$roleBase/2" 'GET' '' $roleHeaders) 403 'ACCESS_DENIED'
Assert-Problem (Request "$roleBase/2/status" 'PUT' '{"status":"1"}' $roleHeaders) 403 'ACCESS_DENIED'
$escalation=Role-Body $probeRole.name $probeRole.key @('system','system-users','system-user-remove')
Assert-Problem (Request "$roleBase/$($probeRole.id)" 'PUT' ($escalation | ConvertTo-Json -Depth 5 -Compress) $roleHeaders) 403 'ACCESS_DENIED'
Assert-Check ((Role-Users $probeRole.id @($roleAccount.id) 'DELETE').StatusCode -eq 204) 'Cancelling role assignment failed.'
Assert-Problem (Request "$roleBase/$($probeRole.id)" 'GET' '' $roleHeaders) 403 'ACCESS_DENIED'
Assert-Check ((Role-Users $probeRole.id @($roleAccount.id) 'DELETE').StatusCode -eq 204) 'Repeated cancellation must be idempotent.'

$raceBody=Role-Body "并发角色-$runId" "role-race-$runId"
$raceJson=$raceBody | ConvertTo-Json -Depth 5 -Compress
$raceUrl="http://127.0.0.1:$AppPort$roleBase"
$raceResults=@(1..8 | ForEach-Object -Parallel {
    $response=Invoke-WebRequest -Uri $using:raceUrl -Method POST -Body $using:raceJson -Headers $using:authorized -ContentType 'application/json' -SkipHttpErrorCheck -TimeoutSec 20
    [pscustomobject]@{Status=$response.StatusCode;Payload=($response.Content | ConvertFrom-Json)}
} -ThrottleLimit 8)
Assert-Check (@($raceResults | Where-Object Status -eq 201).Count -eq 1 -and @($raceResults | Where-Object Status -eq 409).Count -eq 7) 'Concurrent roles must have one success and seven safe conflicts.'
$raceId=($raceResults | Where-Object Status -eq 201).Payload.id
Assert-Problem (Request $roleBase 'DELETE' (@{ids=@($probeRole.id,'999999')} | ConvertTo-Json -Compress) $authorized) 404 'ROLE_NOT_FOUND'
Assert-Check ((Request "$roleBase/$($probeRole.id)" 'GET' '' $authorized).StatusCode -eq 200) 'Missing batch member partially deleted an existing role.'
Assert-Check ((Request $roleBase 'DELETE' (@{ids=@($probeRole.id,$raceId)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Role cleanup failed.'
Assert-Problem (Request "$roleBase/$($probeRole.id)" 'GET' '' $authorized) 404 'ROLE_NOT_FOUND'
$reused=Create-Role 'probe'
Assert-Check ((Request $roleBase 'DELETE' (@{ids=@($reused.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Deleted role identities must be reusable.'
Assert-Check ((Request $userBase 'DELETE' (@{ids=@($roleAccount.id,$otherAccount.id,$outsideAccount.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Role user fixtures cleanup failed.'
Assert-Check ((Request '/logout' 'POST' '' $roleHeaders).StatusCode -eq 200) 'Role fixture session cleanup failed.'
Write-Host 'Role CRUD, real uniqueness/export, allocation, immediate permission revocation, five data scopes, batch scope guards and concurrent creation passed.'
