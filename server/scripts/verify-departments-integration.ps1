# Called only by the owning disposable MySQL/Redis integration fixture.
$departmentBase = '/api/v1/system/departments'
function Department-Body([string]$parentId, [string]$name, [string]$status = '0', [int]$sort = 1) {
    return (@{parentId=$parentId; name=$name; status=$status; sort=$sort; leader='验证负责人'; phone='13812345678'; email='department@example.test'} | ConvertTo-Json -Compress)
}
function Create-Department([string]$parentId, [string]$name, [hashtable]$headers = $authorized) {
    $response = Request $departmentBase 'POST' (Department-Body $parentId $name) $headers
    Assert-Check ($response.StatusCode -eq 201) 'Creating a department must return 201.'
    $department = $response.Content | ConvertFrom-Json
    Assert-Check ($department.id -is [string] -and $department.id -match '^[1-9][0-9]*$' -and ($response.Headers.Location -join '') -eq "$departmentBase/$($department.id)") 'Department must have a generated string ID and Location.'
    return $department
}
Assert-Problem (Request $departmentBase) 401 'AUTHENTICATION_REQUIRED'
Assert-Problem (Request $departmentBase 'POST' '{}' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$departmentBase/9223372036854775807" 'GET' '' $authorized) 404 'DEPARTMENT_NOT_FOUND'
Assert-Problem (Request "$departmentBase/103" 'DELETE' '' $authorized) 409 'DEPARTMENT_HAS_USERS'
Assert-Problem (Request "$departmentBase/101" 'DELETE' '' $authorized) 409 'DEPARTMENT_HAS_CHILDREN'
Assert-Problem (Request "$departmentBase/100" 'DELETE' '' $authorized) 409 'DEPARTMENT_ROOT_PROTECTED'
$parentDepartment = Create-Department '100' "验证父部门-$runId"
$childDepartment = Create-Department $parentDepartment.id "验证子部门-$runId"
$grandchildDepartment = Create-Department $childDepartment.id "验证孙部门-$runId"
Assert-Problem (Request $departmentBase 'POST' (Department-Body '100' $parentDepartment.name) $authorized) 409 'DEPARTMENT_NAME_EXISTS'
$options = (Request "$departmentBase`?excludeId=$($parentDepartment.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check (@($options | Where-Object id -In @($parentDepartment.id,$childDepartment.id,$grandchildDepartment.id)).Count -eq 0) 'Parent options must exclude the whole descendant subtree.'
Assert-Problem (Request "$departmentBase/$($parentDepartment.id)" 'PUT' (Department-Body $parentDepartment.id $parentDepartment.name) $authorized) 409 'DEPARTMENT_CYCLE'
Assert-Problem (Request "$departmentBase/$($parentDepartment.id)" 'PUT' (Department-Body $grandchildDepartment.id $parentDepartment.name) $authorized) 409 'DEPARTMENT_CYCLE'
$moved = Request "$departmentBase/$($parentDepartment.id)" 'PUT' (Department-Body '101' $parentDepartment.name) $authorized
Assert-Check ($moved.StatusCode -eq 200) 'Moving a department failed.'
$grandchildAncestors = Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e "SELECT ancestors FROM sys_dept WHERE dept_id=$($grandchildDepartment.id);"
Assert-Check ($grandchildAncestors -eq "0,100,101,$($parentDepartment.id),$($childDepartment.id)") 'Reparenting must persist every descendant ancestor chain.'
Assert-Problem (Request "$departmentBase/$($parentDepartment.id)" 'PUT' (Department-Body '101' $parentDepartment.name '1') $authorized) 409 'DEPARTMENT_ACTIVE_CHILDREN'
$sortBody = @{items=@(@{id=$parentDepartment.id;sort=9},@{id=$childDepartment.id;sort=8})} | ConvertTo-Json -Compress
Assert-Check ((Request "$departmentBase/sort" 'PUT' $sortBody $authorized).StatusCode -eq 204) 'Saving hierarchy sort failed.'
Assert-Check (((Request "$departmentBase/$($childDepartment.id)" 'GET' '' $authorized).Content | ConvertFrom-Json).sort -eq 8) 'Department ordering did not persist.'
Assert-Problem (Request "$departmentBase/$($parentDepartment.id)" 'DELETE' '' $authorized) 409 'DEPARTMENT_HAS_CHILDREN'
Assert-Check ((Request "$departmentBase/$($grandchildDepartment.id)" 'DELETE' '' $authorized).StatusCode -eq 204) 'Deleting grandchild failed.'
Assert-Check ((Request "$departmentBase/$($childDepartment.id)" 'PUT' (Department-Body $parentDepartment.id $childDepartment.name '1') $authorized).StatusCode -eq 200) 'Disabling leaf department failed.'
Assert-Check ((Request "$departmentBase/$($parentDepartment.id)" 'PUT' (Department-Body '101' $parentDepartment.name '1') $authorized).StatusCode -eq 200) 'Parent with no active children may be disabled.'
Assert-Problem (Request $departmentBase 'POST' (Department-Body $parentDepartment.id '禁止新增') $authorized) 409 'DEPARTMENT_PARENT_DISABLED'
Assert-Check ((Request "$departmentBase/$($childDepartment.id)" 'PUT' (Department-Body $parentDepartment.id $childDepartment.name) $authorized).StatusCode -eq 200) 'Enabling child failed.'
Assert-Check (((Request "$departmentBase/$($parentDepartment.id)" 'GET' '' $authorized).Content | ConvertFrom-Json).status -eq '0') 'Original enable-child behavior must also enable ancestors.'
foreach ($department in @($childDepartment,$parentDepartment)) {
    Assert-Check ((Request "$departmentBase/$($department.id)" 'DELETE' '' $authorized).StatusCode -eq 204) 'Department cleanup failed.'
    Assert-Problem (Request "$departmentBase/$($department.id)" 'GET' '' $authorized) 404 'DEPARTMENT_NOT_FOUND'
}

# Atomic hierarchy locking prevents concurrent A->B and B->A from forming a cycle.
$cycleA = Create-Department '100' "并发部门A-$runId"
$cycleB = Create-Department '100' "并发部门B-$runId"
$cycleRequests = @(@{id=$cycleA.id;body=(Department-Body $cycleB.id $cycleA.name)}, @{id=$cycleB.id;body=(Department-Body $cycleA.id $cycleB.name)})
$departmentMutationUrl = "http://127.0.0.1:$AppPort$departmentBase"
$cycleResults = @($cycleRequests | ForEach-Object -Parallel {
    $response = Invoke-WebRequest -Uri ($using:departmentMutationUrl + '/' + $_.id) -Method PUT -Body $_.body `
        -Headers $using:authorized -ContentType 'application/json' -SkipHttpErrorCheck -TimeoutSec 20
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    [pscustomobject]@{Status=$response.StatusCode;Payload=($content | ConvertFrom-Json)}
} -ThrottleLimit 2)
Write-Host ('Concurrent department moves: ' + (($cycleResults | Select-Object Status, @{Name='code';Expression={$_.Payload.code}}, @{Name='parentId';Expression={$_.Payload.parentId}}) | ConvertTo-Json -Compress))
Assert-Check (@($cycleResults | Where-Object Status -eq 200).Count -eq 1 -and @($cycleResults | Where-Object { $_.Status -eq 409 -and $_.Payload.code -eq 'DEPARTMENT_CYCLE' }).Count -eq 1) 'Concurrent mutual reparenting must produce one valid move and one cycle rejection.'
$storedCycleA = (Request "$departmentBase/$($cycleA.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
$cycleCleanup = if ($storedCycleA.parentId -eq $cycleB.id) { @($cycleA,$cycleB) } else { @($cycleB,$cycleA) }
foreach ($department in $cycleCleanup) {
    Assert-Check ((Request "$departmentBase/$($department.id)" 'DELETE' '' $authorized).StatusCode -eq 204) 'Concurrent hierarchy fixture cleanup failed.'
}
$duplicateDepartmentBody = Department-Body '100' "并发同名部门-$runId"
$duplicateDepartmentResults = @(1..8 | ForEach-Object -Parallel {
    $response = Invoke-WebRequest -Uri $using:departmentMutationUrl -Method POST -Body $using:duplicateDepartmentBody `
        -Headers $using:authorized -ContentType 'application/json' -SkipHttpErrorCheck -TimeoutSec 20
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    [pscustomobject]@{Status=$response.StatusCode;Payload=($content | ConvertFrom-Json)}
} -ThrottleLimit 8)
Assert-Check (@($duplicateDepartmentResults | Where-Object Status -eq 201).Count -eq 1 -and @($duplicateDepartmentResults | Where-Object { $_.Status -eq 409 -and $_.Payload.code -eq 'DEPARTMENT_NAME_EXISTS' }).Count -eq 7) 'Concurrent sibling duplicates must produce one creation and seven conflicts.'
$duplicateDepartmentId = ($duplicateDepartmentResults | Where-Object Status -eq 201).Payload.id
Assert-Check ((Request "$departmentBase/$duplicateDepartmentId" 'DELETE' '' $authorized).StatusCode -eq 204) 'Duplicate fixture deletion failed.'
# Reusing an already deleted name multiple times must not collide with old rows.
1..2 | ForEach-Object {
    $reusedDepartment = Create-Department '100' "并发同名部门-$runId"
    Assert-Check ((Request "$departmentBase/$($reusedDepartment.id)" 'DELETE' '' $authorized).StatusCode -eq 204) 'Repeated name reuse after soft-delete failed.'
}

# A separate account/role proves real department-only scope without changing ry's role.
$departmentUsername = "d-$runId"
Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
    "INSERT INTO sys_user(dept_id,user_name,nick_name,password,status,del_flag,create_time) SELECT 105,'$departmentUsername','Department fixture',password,'0','0',NOW() FROM sys_user WHERE user_id=1; INSERT INTO sys_role(role_name,role_key,role_sort,data_scope,status,del_flag) VALUES('Department fixture','$departmentUsername',9,'3','0','0'); INSERT INTO sys_user_role SELECT u.user_id,r.role_id FROM sys_user u JOIN sys_role r ON r.role_key=u.user_name WHERE u.user_name='$departmentUsername'; INSERT INTO sys_role_menu SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m WHERE r.role_key='$departmentUsername' AND m.perms LIKE 'system:dept:%';" | Out-Null
$departmentLogin = (Request '/api/v1/auth/login' 'POST' (@{username=$departmentUsername;password='admin123'} | ConvertTo-Json -Compress)).Content | ConvertFrom-Json
Assert-Check ([bool]$departmentLogin.accessToken) 'Department-scope fixture login failed.'
$departmentHeaders = @{Authorization="Bearer $($departmentLogin.accessToken)"}
Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $departmentHeaders).StatusCode -eq 200) 'Department-scope bootstrap failed.'
$scopedDepartments = (Request $departmentBase 'GET' '' $departmentHeaders).Content | ConvertFrom-Json
Assert-Check ($scopedDepartments.Count -eq 1 -and $scopedDepartments[0].id -eq '105') 'Department-only role must see exactly its own department.'
Assert-Problem (Request "$departmentBase/103" 'GET' '' $departmentHeaders) 403 'ACCESS_DENIED'
Assert-Problem (Request "$departmentBase/103" 'DELETE' '' $departmentHeaders) 403 'ACCESS_DENIED'
Assert-Problem (Request $departmentBase 'POST' (Department-Body '103' '范围外新增') $departmentHeaders) 403 'ACCESS_DENIED'
Assert-Problem (Request "$departmentBase/105" 'PUT' (Department-Body '103' '测试部门') $departmentHeaders) 403 'ACCESS_DENIED'
$beforeSort = ((Request "$departmentBase/105" 'GET' '' $authorized).Content | ConvertFrom-Json).sort
Assert-Problem (Request "$departmentBase/sort" 'PUT' '{"items":[{"id":"105","sort":99},{"id":"103","sort":88}]}' $departmentHeaders) 403 'ACCESS_DENIED'
Assert-Check (((Request "$departmentBase/105" 'GET' '' $authorized).Content | ConvertFrom-Json).sort -eq $beforeSort) 'Rejected mixed-scope sorting must not partially write.'
$ownDepartment = (Request "$departmentBase/105" 'GET' '' $departmentHeaders).Content | ConvertFrom-Json
$unchangedParentBody = @{parentId=$ownDepartment.parentId;name=$ownDepartment.name;sort=$ownDepartment.sort;status=$ownDepartment.status;leader=$ownDepartment.leader;phone=$ownDepartment.phone;email=$ownDepartment.email} | ConvertTo-Json -Compress
Assert-Check ((Request "$departmentBase/105" 'PUT' $unchangedParentBody $departmentHeaders).StatusCode -eq 200) 'An unchanged parent outside scope must not block editing an authorized department.'
$scopedChild = Create-Department '105' "范围内子部门-$runId" $departmentHeaders
Assert-Problem (Request "$departmentBase/$($scopedChild.id)" 'GET' '' $departmentHeaders) 403 'ACCESS_DENIED'
Assert-Check ((Request "$departmentBase/$($scopedChild.id)" 'DELETE' '' $authorized).StatusCode -eq 204) 'Scoped child cleanup failed.'
Assert-Check (((Request '/logout' 'POST' '' $departmentHeaders).Content | ConvertFrom-Json).code -eq 200) 'Department fixture session logout failed.'
Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
    "DELETE ur FROM sys_user_role ur JOIN sys_user u ON u.user_id=ur.user_id WHERE u.user_name='$departmentUsername'; DELETE FROM sys_user WHERE user_name='$departmentUsername'; DELETE rm FROM sys_role_menu rm JOIN sys_role r ON r.role_id=rm.role_id WHERE r.role_key='$departmentUsername'; DELETE FROM sys_role WHERE role_key='$departmentUsername';" | Out-Null
Write-Host 'Department hierarchy, sorting, validation, deletion/disable protection and real data-scope enforcement passed.'
