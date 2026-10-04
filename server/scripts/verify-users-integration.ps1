# Dot-sourced by the owned disposable MySQL/Redis auth fixture.
$userBase = '/api/v1/system/users'
function User-Body([string]$username, [string]$department = '103', [string]$phone = '', [string]$email = '') {
    return @{username=$username;displayName="用户-$username";departmentId=$department;phone=$phone;email=$email;sex='2';status='0';remark='integration';roleIds=@('2');postIds=@('2')}
}
function Create-User([string]$username, [string]$department = '103', [string]$phone = '', [string]$email = '') {
    $body = @{user=(User-Body $username $department $phone $email);password='User12345'} | ConvertTo-Json -Depth 5 -Compress
    $response = Request $userBase 'POST' $body $authorized
    Assert-Check ($response.StatusCode -eq 201) "Creating the user fixture failed: $($response.Content)"
    $user = $response.Content | ConvertFrom-Json
    Assert-Check ($user.id -is [string] -and $response.Headers.Location -eq "$userBase/$($user.id)") 'User creation must return a string identity and Location.'
    return $user
}
Assert-Problem (Request $userBase) 401 'AUTHENTICATION_REQUIRED'
Assert-Problem (Request "$userBase/999999" 'GET' '' $authorized) 404 'USER_NOT_FOUND'
Assert-Problem (Request $userBase 'POST' '{}' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$userBase`?beginDate=2026-02-30" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$userBase/1/status" 'PUT' '{"status":"1"}' $authorized) 409 'USER_ADMIN_PROTECTED'
Assert-Problem (Request $userBase 'DELETE' '{"ids":["1"]}' $authorized) 409 'USER_SELF_DELETE'
$optionsResponse = Request "$userBase/options" 'GET' '' $authorized
$options = $optionsResponse.Content | ConvertFrom-Json
Assert-Check ($optionsResponse.StatusCode -eq 200 -and $optionsResponse.Headers.'Cache-Control' -contains 'no-store' -and @($options.roles | Where-Object id -eq '1').Count -eq 0) 'Editor options must omit the super-admin role and prohibit credential caching.'

$userName = "u-$runId"
$managedUser = Create-User $userName '103' '13900000001' "$userName@example.com"
# Bypass service prechecks to prove the actual database indexes protect legacy writes too.
foreach ($sqlProbe in @(
    "INSERT INTO sys_user(user_name,nick_name) VALUES('$userName','Duplicate name');",
    "INSERT INTO sys_user(user_name,nick_name,phonenumber) VALUES('i-$runId','Duplicate phone','13900000001');",
    "INSERT INTO sys_user(user_name,nick_name,email) VALUES('j-$runId','Duplicate email','$userName@example.com');")) {
    $indexFailure = (& docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e $sqlProbe 2>&1) | Out-String
    Assert-Check ($LASTEXITCODE -ne 0 -and $indexFailure.Contains('ERROR 1062')) 'User uniqueness must be enforced by MySQL even when service checks are bypassed.'
}
$details = (Request "$userBase/$($managedUser.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($details.roleIds[0] -eq '2' -and $details.postIds[0] -eq '2' -and !$details.user.PSObject.Properties['password']) 'User associations must persist without exposing a password.'
Assert-Problem (Request $userBase 'POST' (@{user=(User-Body $userName);password='User12345'} | ConvertTo-Json -Depth 5 -Compress) $authorized) 409 'USER_USERNAME_EXISTS'
Assert-Problem (Request $userBase 'POST' (@{user=(User-Body "p-$runId" '103' '13900000001');password='User12345'} | ConvertTo-Json -Depth 5 -Compress) $authorized) 409 'USER_PHONE_EXISTS'
Assert-Problem (Request $userBase 'POST' (@{user=(User-Body "e-$runId" '103' '' "$userName@example.com");password='User12345'} | ConvertTo-Json -Depth 5 -Compress) $authorized) 409 'USER_EMAIL_EXISTS'
$filtered = (Request "$userBase`?username=$userName&departmentId=101&pageSize=1&beginDate=2000-01-01&endDate=2099-12-31" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($filtered.total -eq 1 -and $filtered.items[0].id -eq $managedUser.id) 'User date, username, ancestor-department filters and paging must compose.'
$noDepartmentBody = User-Body $userName
$noDepartmentBody.departmentId = $null
Assert-Check ((Request "$userBase/$($managedUser.id)" 'PUT' ($noDepartmentBody | ConvertTo-Json -Depth 5 -Compress) $authorized).StatusCode -eq 200) 'Administrator must be able to clear the optional department.'
$noDepartmentDetails = (Request "$userBase/$($managedUser.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check (!$noDepartmentDetails.user.PSObject.Properties['departmentId']) 'Clearing the optional department must persist as NULL.'
$updateUser = User-Body $userName '105'
$updateUser.displayName = '已更新用户'; $updateUser.remark = ''; $updateUser.postIds = @('3'); $updateUser.roleIds = @()
Assert-Check ((Request "$userBase/$($managedUser.id)" 'PUT' ($updateUser | ConvertTo-Json -Depth 5 -Compress) $authorized).StatusCode -eq 200) 'Updating the user failed.'
$details = (Request "$userBase/$($managedUser.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($details.user.departmentId -eq '105' -and $details.user.phone -eq '' -and $details.user.email -eq '' -and $details.user.remark -eq '' -and $details.postIds[0] -eq '3' -and $details.roleIds.Count -eq 0) 'User edits must persist association changes and cleared contacts/remark.'
Assert-Check ((Request "$userBase/$($managedUser.id)/roles" 'PUT' '{"roleIds":["2"]}' $authorized).StatusCode -eq 204) 'Role allocation failed.'
Assert-Problem (Request "$userBase/$($managedUser.id)/roles" 'PUT' '{"roleIds":["1"]}' $authorized) 409 'USER_ADMIN_ROLE_PROTECTED'
$managedLogin = Request '/api/v1/auth/login' 'POST' (@{username=$userName;password='User12345'} | ConvertTo-Json -Compress)
Assert-Check ($managedLogin.StatusCode -eq 200) 'Created user cannot authenticate with its initial password.'
$managedToken = ($managedLogin.Content | ConvertFrom-Json).accessToken
$managedHeaders = @{Authorization="Bearer $managedToken"}
Assert-Check ((Request "$userBase/$($managedUser.id)/status" 'PUT' '{"status":"1"}' $authorized).StatusCode -eq 204) 'Disabling the managed user failed.'
Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $managedHeaders).StatusCode -eq 401) 'A disabled account must lose its real Redis session at bootstrap.'
Assert-Check ((Request "$userBase/$($managedUser.id)/status" 'PUT' '{"status":"0"}' $authorized).StatusCode -eq 204) 'Enabling the user failed.'
Assert-Check ((Request "$userBase/$($managedUser.id)/password" 'PUT' '{"password":"Reset12345"}' $authorized).StatusCode -eq 204) 'Resetting the user password failed.'
Assert-Check ((Request '/api/v1/auth/login' 'POST' (@{username=$userName;password='User12345'} | ConvertTo-Json -Compress)).StatusCode -ne 200) 'The old password must stop authenticating.'
$resetLogin = Request '/api/v1/auth/login' 'POST' (@{username=$userName;password='Reset12345'} | ConvertTo-Json -Compress)
Assert-Check ($resetLogin.StatusCode -eq 200) 'Reset password cannot authenticate.'
$resetHeaders = @{Authorization="Bearer $(($resetLogin.Content | ConvertFrom-Json).accessToken)"}
Request '/logout' 'POST' '' $resetHeaders | Out-Null

# Inspect the actual exported workbook rather than a successful HTTP response alone.
$workbook = Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$userBase/export?username=$userName" -Method POST -Headers $authorized -SkipHttpErrorCheck
Assert-Check ($workbook.StatusCode -eq 200 -and $workbook.Content[0] -eq 80 -and $workbook.Content[1] -eq 75) 'User export must be a real XLSX workbook.'
$xlsxStream = [IO.MemoryStream]::new([byte[]]$workbook.Content)
$archive = [IO.Compression.ZipArchive]::new($xlsxStream, [IO.Compression.ZipArchiveMode]::Read)
try {
    $sheetReader = [IO.StreamReader]::new($archive.GetEntry('xl/worksheets/sheet1.xml').Open())
    try { $sheet = $sheetReader.ReadToEnd() } finally { $sheetReader.Dispose() }
    $stringsEntry = $archive.GetEntry('xl/sharedStrings.xml')
    $strings = ''
    if ($stringsEntry) { $stringsReader = [IO.StreamReader]::new($stringsEntry.Open()); try { $strings = $stringsReader.ReadToEnd() } finally { $stringsReader.Dispose() } }
    Assert-Check (($sheet + $strings).Contains($userName) -and !($sheet + $strings).Contains('Reset12345')) 'Exported user cells must include the filtered account and exclude passwords.'
} finally { $archive.Dispose(); $xlsxStream.Dispose() }

# Independent department-only role proves scoped mutations and all permission gates.
$scopeName = "s-$runId"
$scopeUser = Create-User $scopeName '105'
Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e `
    "INSERT INTO sys_role(role_name,role_key,role_sort,data_scope,status,del_flag) VALUES('User fixture','$scopeName',9,'3','0','0'); DELETE FROM sys_user_role WHERE user_id=$($scopeUser.id); INSERT INTO sys_user_role SELECT $($scopeUser.id),role_id FROM sys_role WHERE role_key='$scopeName'; INSERT INTO sys_role_menu SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m WHERE r.role_key='$scopeName' AND m.perms LIKE 'system:user:%';" | Out-Null
$scopeToken = ((Request '/api/v1/auth/login' 'POST' (@{username=$scopeName;password='User12345'} | ConvertTo-Json -Compress)).Content | ConvertFrom-Json).accessToken
$scopeHeaders = @{Authorization="Bearer $scopeToken"}
Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $scopeHeaders).StatusCode -eq 200) 'User-scope bootstrap failed.'
$scopedUsers = (Request $userBase 'GET' '' $scopeHeaders).Content | ConvertFrom-Json
Assert-Check ($scopedUsers.items.id -contains $managedUser.id -and $scopedUsers.items.id -notcontains '1') 'Department-only user lists must exclude out-of-scope accounts.'
Assert-Problem (Request "$userBase/1" 'GET' '' $scopeHeaders) 403 'ACCESS_DENIED'
Assert-Problem (Request "$userBase/1/roles" 'GET' '' $scopeHeaders) 403 'ACCESS_DENIED'
$outsideBody = User-Body "o-$runId" '103'; $outsideBody.roleIds = @(); $outsideBody.postIds = @()
Assert-Problem (Request $userBase 'POST' (@{user=$outsideBody;password='User12345'} | ConvertTo-Json -Depth 5 -Compress) $scopeHeaders) 403 'ACCESS_DENIED'
$unscopedBody = User-Body "z-$runId"
$unscopedBody.departmentId = $null; $unscopedBody.roleIds = @(); $unscopedBody.postIds = @()
Assert-Problem (Request $userBase 'POST' (@{user=$unscopedBody;password='User12345'} | ConvertTo-Json -Depth 5 -Compress) $scopeHeaders) 403 'ACCESS_DENIED'
Assert-Problem (Request $userBase 'DELETE' (@{ids=@($managedUser.id,'1')} | ConvertTo-Json -Compress) $scopeHeaders) 403 'ACCESS_DENIED'
Assert-Check ((Request "$userBase/$($managedUser.id)" 'GET' '' $authorized).StatusCode -eq 200) 'Denied mixed-scope deletion must leave all targets intact.'
Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e "DELETE rm FROM sys_role_menu rm JOIN sys_role r ON r.role_id=rm.role_id WHERE r.role_key='$scopeName';" | Out-Null
Request '/api/v1/app/bootstrap' 'GET' '' $scopeHeaders | Out-Null
foreach ($probe in @(
    @($userBase,'GET',''), @("$userBase/departments",'GET',''), @("$userBase/options",'GET',''), @("$userBase/$($managedUser.id)",'GET',''),
    @("$userBase/$($managedUser.id)/roles",'GET',''), @($userBase,'POST',(@{user=$outsideBody;password='User12345'} | ConvertTo-Json -Depth 5 -Compress)),
    @("$userBase/$($managedUser.id)",'PUT',($updateUser | ConvertTo-Json -Depth 5 -Compress)), @("$userBase/$($managedUser.id)/status",'PUT','{"status":"1"}'),
    @("$userBase/$($managedUser.id)/password",'PUT','{"password":"Reset12345"}'), @("$userBase/$($managedUser.id)/roles",'PUT','{"roleIds":[]}'),
    @($userBase,'DELETE',(@{ids=@($managedUser.id)} | ConvertTo-Json -Compress)), @("$userBase/export",'POST',''))) {
    Assert-Problem (Request $probe[0] $probe[1] $probe[2] $scopeHeaders) 403 'ACCESS_DENIED'
}
Request '/logout' 'POST' '' $scopeHeaders | Out-Null
Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e "DELETE ur FROM sys_user_role ur JOIN sys_role r ON r.role_id=ur.role_id WHERE r.role_key='$scopeName'; DELETE FROM sys_role WHERE role_key='$scopeName';" | Out-Null
Assert-Check ((Request $userBase 'DELETE' (@{ids=@($managedUser.id,$scopeUser.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'User fixture cleanup failed.'
Assert-Problem (Request "$userBase/$($managedUser.id)" 'GET' '' $authorized) 404 'USER_NOT_FOUND'
$concurrentUserName = "c-$runId"
$concurrentUserBody = @{user=(User-Body $concurrentUserName);password='User12345'} | ConvertTo-Json -Depth 5 -Compress
$userCreateResults = @(1..8 | ForEach-Object -Parallel {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$using:AppPort$using:userBase" -Method POST -Headers $using:authorized -ContentType 'application/json' -Body $using:concurrentUserBody -SkipHttpErrorCheck
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    [pscustomobject]@{Status=$response.StatusCode;Payload=($content | ConvertFrom-Json)}
} -ThrottleLimit 8)
Assert-Check (@($userCreateResults | Where-Object Status -eq 201).Count -eq 1 -and @($userCreateResults | Where-Object { $_.Status -eq 409 -and $_.Payload.code -in @('USER_USERNAME_EXISTS','USER_CONFLICT') }).Count -eq 7) 'Concurrent user-name duplicates must result in one create and seven safe conflicts.'
$concurrentUserId = ($userCreateResults | Where-Object Status -eq 201).Payload.id
Assert-Check ((Request $userBase 'DELETE' (@{ids=@($concurrentUserId)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Concurrent user fixture cleanup failed.'
1..2 | ForEach-Object { $reused = Create-User $userName; Assert-Check ((Request $userBase 'DELETE' (@{ids=@($reused.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Account name reuse after soft-delete failed.' }
Write-Output 'User CRUD, paging/filtering, associations, password/status/session behavior, XLSX, uniqueness and real data-scope enforcement passed.'
