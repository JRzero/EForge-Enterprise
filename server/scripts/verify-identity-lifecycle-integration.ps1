# Dot-sourced after the user/role helpers by the owned disposable MySQL/Redis fixture.
# Never print credentials, password fingerprints, JWTs or Redis session contents.
$identityUserIds = [System.Collections.Generic.List[string]]::new()
$identityRoleIds = [System.Collections.Generic.List[string]]::new()
$identityLogins = [System.Collections.Generic.List[object]]::new()

function Identity-Sql([string]$statement) {
    return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e $statement
}
function Identity-LegacyResult($response, [int]$code, [string]$message) {
    Assert-Check ($response.StatusCode -eq 200 -and ($response.Content | ConvertFrom-Json).code -eq $code) $message
}
function Identity-RoleSnapshot([string]$roleId) {
    return Identity-Sql "SELECT JSON_OBJECT('name',role_name,'key',role_key,'sort',role_sort,'scope',data_scope,'status',status,'menuLinked',menu_check_strictly,'departmentLinked',dept_check_strictly,'menus',(SELECT GROUP_CONCAT(menu_id ORDER BY menu_id) FROM sys_role_menu WHERE role_id=$roleId)) FROM sys_role WHERE role_id=$roleId;"
}
function Identity-UserInvariant([string]$userId) {
    return Identity-Sql "SELECT JSON_OBJECT('department',dept_id,'passwordFingerprint',SHA2(password,256),'passwordDate',pwd_update_date,'roles',(SELECT GROUP_CONCAT(role_id ORDER BY role_id) FROM sys_user_role WHERE user_id=$userId),'posts',(SELECT GROUP_CONCAT(post_id ORDER BY post_id) FROM sys_user_post WHERE user_id=$userId)) FROM sys_user WHERE user_id=$userId;"
}
function Identity-UserFields([string]$userId) {
    return Identity-Sql "SELECT JSON_OBJECT('nickname',nick_name,'email',email,'phone',phonenumber,'sex',sex,'status',status) FROM sys_user WHERE user_id=$userId;"
}
function Identity-CreateUser([string]$suffix, [string]$roleId) {
    $account = Create-User "$suffix-$runId" '103'
    $identityUserIds.Add($account.id)
    Assert-Check ((Request "/api/v1/system/users/$($account.id)/roles" 'PUT' (@{roleIds=@($roleId)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Assigning an owned identity fixture role failed.'
    return $account
}
function Identity-Login($account) {
    $response = Request '/api/v1/auth/login' 'POST' (@{username=$account.username;password='User12345'} | ConvertTo-Json -Compress)
    Assert-Check ($response.StatusCode -eq 200) 'Owned identity fixture login failed.'
    $token = ($response.Content | ConvertFrom-Json).accessToken
    $payload = $token.Split('.')[1].Replace('-', '+').Replace('_', '/')
    $payload = $payload.PadRight([int]([Math]::Ceiling($payload.Length / 4.0) * 4), '=')
    $sessionId = ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json).login_user_key
    Assert-Check (![string]::IsNullOrWhiteSpace($sessionId)) 'Owned login must identify a Redis session.'
    $login = [pscustomobject]@{Headers=@{Authorization="Bearer $token"};Key="login_tokens:$sessionId"}
    $identityLogins.Add($login)
    Assert-Check ([int](Invoke-Docker exec $redisName redis-cli TTL $login.Key) -gt 0) 'Owned login session must exist and expire.'
    return $login
}
function Identity-ActiveSession($account, $login, [string]$nickname) {
    # This ordinary protected request must succeed before any bootstrap/getInfo refresh.
    $response = Request "/system/user/list?userName=$($account.username)" 'GET' '' $login.Headers
    Identity-LegacyResult $response 200 'A retained identity session lost its existing user-list grant.'
    $page = $response.Content | ConvertFrom-Json
    Assert-Check ($page.total -eq 1 -and [string]$page.rows[0].userId -eq $account.id) 'The retained department-only session has an incorrect data scope.'
    # getInfo reads LoginUser.user from Redis; it does not select a fresh SQL user.
    # Its separate permission recalculation cannot repair a stale cached nickname.
    $infoResponse = Request '/getInfo' 'GET' '' $login.Headers
    Identity-LegacyResult $infoResponse 200 'Reading the retained identity snapshot failed.'
    $info = $infoResponse.Content | ConvertFrom-Json
    Assert-Check ($info.user.nickName -ceq $nickname -and [string]$info.user.deptId -eq '103' -and $info.user.status -eq '0') 'Committed import fields did not refresh the existing Redis user snapshot.'
    Assert-Check ([int](Invoke-Docker exec $redisName redis-cli TTL $login.Key) -gt 0) 'Refreshing the existing session must preserve its expiry.'
}
function Identity-RevokedSession($account, $login) {
    $response = Request "/system/user/list?userName=$($account.username)" 'GET' '' $login.Headers
    Identity-LegacyResult $response 401 'A disabled imported account retained its existing authenticated session.'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS $login.Key) -eq '0') 'Disabled account session still exists in Redis.'
    Assert-Problem (Request '/api/v1/system/users' 'GET' '' $login.Headers) 401 'AUTHENTICATION_REQUIRED'
}
function Identity-Import([string]$kind, [string]$filePath) {
    if ($kind -eq 'canonical') { return Import-Workbook $filePath $true $authorized }
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort/system/user/importData?updateSupport=true" -Method POST -Form @{file=(Get-Item -LiteralPath $filePath)} -Headers $authorized -SkipHttpErrorCheck -TimeoutSec 20
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    return [pscustomobject]@{StatusCode=$response.StatusCode;Content=$content;Result=($content | ConvertFrom-Json)}
}
function Identity-ImportResult($response, [string]$kind, [int]$updated, [int]$failed) {
    Assert-Check ($response.StatusCode -eq 200) 'Import must return its original successful/partial HTTP envelope.'
    if ($kind -eq 'canonical') {
        Assert-Check ($response.Result.total -eq ($updated + $failed) -and $response.Result.created -eq 0 -and $response.Result.updated -eq $updated -and $response.Result.failed -eq $failed) 'Canonical import lost its exact committed/failed row counts.'
    }
    else {
        $expectedCode = if ($failed) {500} else {200}
        Assert-Check ($response.Result.code -eq $expectedCode) 'Legacy import lost its existing all-success/partial-failure envelope.'
        if ($failed) { Assert-Check ($response.Result.msg -match '已提交|已保存') 'Legacy partial failure must acknowledge its committed successful rows.' }
    }
}

try {
    # The operator cannot inherit the target's broader grants: only a different
    # same-department member holds that role, making it editable through data scope.
    $identityOperatorRole = Create-Role 'id-op' @('system','system-roles','system-role-query','system-role-add','system-role-edit','system-post-query')
    $identityRoleIds.Add($identityOperatorRole.id)
    Assert-Check ((Role-Scope $identityOperatorRole.id '3').StatusCode -eq 204) 'Preparing the limited role operator scope failed.'
    $identityTargetRole = Create-Role 'id-target' @('system-post-query','system-post-export')
    $identityRoleIds.Add($identityTargetRole.id)
    $identityOperator = Identity-CreateUser 'imo' $identityOperatorRole.id
    $identityMember = Identity-CreateUser 'imm' $identityTargetRole.id
    $identityOperatorLogin = Identity-Login $identityOperator
    $identityMenuIds = @{}
    foreach ($identityLine in @(Identity-Sql "SELECT menu_key,menu_id FROM sys_menu WHERE menu_key IN ('system-post-query','system-post-export','system-user-remove');")) {
        $identityParts = $identityLine.Split("`t")
        $identityMenuIds[$identityParts[0]] = [long]$identityParts[1]
    }
    Assert-Check ($identityMenuIds.Count -eq 3) 'Owned menu-boundary fixture requires all three stable seed identities.'
    $identityAllowedMenu = $identityMenuIds['system-post-query']
    $identityRetainedMenu = $identityMenuIds['system-post-export']
    $identityForbiddenMenu = $identityMenuIds['system-user-remove']
    $identityOperatorMenus = (Request '/api/v1/system/roles/menus' 'GET' '' $identityOperatorLogin.Headers).Content | ConvertFrom-Json
    Assert-Check ($identityOperatorMenus.key -contains 'system-post-query' -and $identityOperatorMenus.key -notcontains 'system-post-export' -and $identityOperatorMenus.key -notcontains 'system-user-remove') 'The restricted operator unexpectedly owns a forbidden target grant.'
    Identity-LegacyResult (Request "/system/role/$($identityTargetRole.id)" 'GET' '' $identityOperatorLogin.Headers) 200 'The target role must be inside the restricted operator data scope.'

    $identityLegacyCreate = @{roleName="Identity create $runId";roleKey="id-create-$runId";roleSort=7;status='0';dataScope='1';menuCheckStrictly=$true;deptCheckStrictly=$true;menuIds=@($identityAllowedMenu,$identityForbiddenMenu)}
    Identity-LegacyResult (Request '/system/role' 'POST' ($identityLegacyCreate | ConvertTo-Json -Depth 5 -Compress) $identityOperatorLogin.Headers) 403 'Legacy role creation accepted a new grant the operator does not own.'
    Assert-Check ((Identity-Sql "SELECT COUNT(*) FROM sys_role WHERE role_key='id-create-$runId';") -eq '0') 'Denied legacy role creation partially inserted a role.'
    $identityLegacyCreate.roleId = $identityTargetRole.id
    $identityLegacyCreate.menuIds = @($identityAllowedMenu,$identityRetainedMenu)
    $identityTargetBefore = Identity-RoleSnapshot $identityTargetRole.id
    Identity-LegacyResult (Request '/system/role' 'POST' ($identityLegacyCreate | ConvertTo-Json -Depth 5 -Compress) $identityOperatorLogin.Headers) 403 'Legacy role creation borrowed another role identity to retain a forbidden grant.'
    Assert-Check ((Identity-Sql "SELECT COUNT(*) FROM sys_role WHERE role_key='id-create-$runId';") -eq '0' -and (Identity-RoleSnapshot $identityTargetRole.id) -ceq $identityTargetBefore) 'Denied role identity reuse changed SQL state.'
    $identityLegacyCreate.Remove('roleId')
    $identityLegacyCreate.menuIds = @($identityAllowedMenu)
    Identity-LegacyResult (Request '/system/role' 'POST' ($identityLegacyCreate | ConvertTo-Json -Depth 5 -Compress) $identityOperatorLogin.Headers) 200 'Legacy role creation rejected an allowed grant.'
    $identityCreatedPage = (Request "/api/v1/system/roles?key=id-create-$runId" 'GET' '' $authorized).Content | ConvertFrom-Json
    Assert-Check ($identityCreatedPage.total -eq 1) 'Allowed legacy role creation did not persist exactly one role.'
    $identityRoleIds.Add($identityCreatedPage.items[0].id)
    $identityCreatedRole = (Request "/api/v1/system/roles/$($identityCreatedPage.items[0].id)" 'GET' '' $authorized).Content | ConvertFrom-Json
    Assert-Check ($identityCreatedRole.menuKeys.Count -eq 1 -and $identityCreatedRole.menuKeys[0] -eq 'system-post-query') 'Allowed legacy creation stored an incorrect grant set.'

    $identityLegacyEdit = @{roleId=$identityTargetRole.id;roleName="Denied edit $runId";roleKey=$identityTargetRole.key;roleSort=8;status='0';dataScope='1';menuCheckStrictly=$true;deptCheckStrictly=$true;menuIds=@($identityAllowedMenu,$identityRetainedMenu,$identityForbiddenMenu)}
    Identity-LegacyResult (Request '/system/role' 'PUT' ($identityLegacyEdit | ConvertTo-Json -Depth 5 -Compress) $identityOperatorLogin.Headers) 403 'Legacy role editing accepted a new out-of-range grant.'
    Assert-Check ((Identity-RoleSnapshot $identityTargetRole.id) -ceq $identityTargetBefore) 'Denied role editing partially changed metadata or menu associations.'
    $identityLegacyEdit.roleName = "Retained $runId"
    $identityLegacyEdit.menuIds = @($identityAllowedMenu,$identityRetainedMenu)
    Identity-LegacyResult (Request '/system/role' 'PUT' ($identityLegacyEdit | ConvertTo-Json -Depth 5 -Compress) $identityOperatorLogin.Headers) 200 'Legacy role editing must retain an existing broader grant.'
    $identityRetained = (Request "/api/v1/system/roles/$($identityTargetRole.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
    Assert-Check ($identityRetained.role.name -eq $identityLegacyEdit.roleName -and (@($identityRetained.menuKeys | Sort-Object) -join ',') -eq 'system-post-export,system-post-query') 'Allowed legacy edit failed to preserve its complete existing grant set.'
    $identityLegacyEdit.menuIds = @($identityAllowedMenu)
    Identity-LegacyResult (Request '/system/role' 'PUT' ($identityLegacyEdit | ConvertTo-Json -Depth 5 -Compress) $identityOperatorLogin.Headers) 200 'Legacy role editing must allow explicit revocation of a broader grant.'
    $identityTargetBefore = Identity-RoleSnapshot $identityTargetRole.id
    Assert-Check ((Identity-Sql "SELECT COUNT(*) FROM sys_role_menu WHERE role_id=$($identityTargetRole.id) AND menu_id=$identityRetainedMenu;") -eq '0') 'Explicit legacy grant revocation did not persist.'
    $identityLegacyEdit.menuIds = @($identityAllowedMenu,$identityRetainedMenu)
    Identity-LegacyResult (Request '/system/role' 'PUT' ($identityLegacyEdit | ConvertTo-Json -Depth 5 -Compress) $identityOperatorLogin.Headers) 403 'A revoked grant remained available through the previous-grant exception.'
    Assert-Check ((Identity-RoleSnapshot $identityTargetRole.id) -ceq $identityTargetBefore) 'Denied grant restoration changed the role.'
    Write-Output 'Legacy role menu boundary: limited operator, denied create/edit without SQL changes, valid grants, retained broader grants and rejected regrant after removal passed.'

    $identityImportRole = Create-Role 'id-import' @('system','system-users','system-user-query')
    $identityRoleIds.Add($identityImportRole.id)
    Assert-Check ((Role-Scope $identityImportRole.id '3').StatusCode -eq 204) 'Preparing department-only import fixture sessions failed.'
    foreach ($identityKind in @('canonical','legacy')) {
        $identityPrefix = if ($identityKind -eq 'canonical') {'ic'} else {'il'}
        $identityDisabled = Identity-CreateUser "${identityPrefix}d" $identityImportRole.id
        $identityRejected = Identity-CreateUser "${identityPrefix}x" $identityImportRole.id
        $identityProfile = Identity-CreateUser "${identityPrefix}p" $identityImportRole.id
        $identityAccounts = @($identityDisabled,$identityRejected,$identityProfile)
        $identityInvariants = @{}
        foreach ($identityAccount in $identityAccounts) { $identityInvariants[$identityAccount.id] = Identity-UserInvariant $identityAccount.id }
        $identityRejectedBefore = Identity-UserFields $identityRejected.id
        $identityDisabledLogin = Identity-Login $identityDisabled
        $identityRejectedLogin = Identity-Login $identityRejected
        $identityProfileLogin = Identity-Login $identityProfile
        Identity-ActiveSession $identityProfile $identityProfileLogin $identityProfile.displayName

        # A failed middle row must not suppress either earlier revocation or later refresh.
        # Both imports intentionally retain department 103 despite workbook department 105.
        $identityPartial = User-Workbook "identity-$identityKind-partial-$runId" @(
            @('105',$identityDisabled.username,"Disabled $identityKind",'','','未知','停用'),
            @('105',$identityRejected.username,'Must not persist','invalid-email','','未知','停用'),
            @('105',$identityProfile.username,"Partial $identityKind","$identityPrefix-$runId@example.test",'','女','正常'))
        $identityPartialResponse = Identity-Import $identityKind $identityPartial
        Identity-ImportResult $identityPartialResponse $identityKind 2 1
        if ($identityKind -eq 'canonical') {
            Assert-Check (($identityPartialResponse.Result.rows.outcome -join ',') -eq 'UPDATED,FAILED,UPDATED' -and $identityPartialResponse.Result.rows[1].code -eq 'VALIDATION_ERROR') 'Canonical mixed import lost ordered per-row outcomes.'
        }
        Identity-RevokedSession $identityDisabled $identityDisabledLogin
        Identity-ActiveSession $identityProfile $identityProfileLogin "Partial $identityKind"
        Identity-ActiveSession $identityRejected $identityRejectedLogin $identityRejected.displayName
        Assert-Check ((Identity-UserFields $identityRejected.id) -ceq $identityRejectedBefore) 'Rejected import row changed its persistent user fields.'
        $identityDisabledSql = (Identity-UserFields $identityDisabled.id) | ConvertFrom-Json
        $identityProfileSql = (Identity-UserFields $identityProfile.id) | ConvertFrom-Json
        Assert-Check ($identityDisabledSql.status -eq '1' -and $identityProfileSql.nickname -ceq "Partial $identityKind") 'Mixed import did not commit both successful user updates.'

        $identityAllSuccess = User-Workbook "identity-$identityKind-success-$runId" @(
            @('105',$identityDisabled.username,"Enabled $identityKind",'','','未知','正常'),
            @('105',$identityProfile.username,"Complete $identityKind",'','','未知','正常'))
        Identity-ImportResult (Identity-Import $identityKind $identityAllSuccess) $identityKind 2 0
        Identity-RevokedSession $identityDisabled $identityDisabledLogin
        Identity-ActiveSession $identityProfile $identityProfileLogin "Complete $identityKind"
        $identityEnabledLogin = Identity-Login $identityDisabled
        Identity-ActiveSession $identityDisabled $identityEnabledLogin "Enabled $identityKind"
        foreach ($identityAccount in $identityAccounts) {
            Assert-Check ((Identity-UserInvariant $identityAccount.id) -ceq $identityInvariants[$identityAccount.id]) 'Import changed an existing department, role, post, password or password timestamp.'
            $identityEditor = (Request "/api/v1/system/users/$($identityAccount.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
            Assert-Check ($identityEditor.user.departmentId -eq '103' -and $identityEditor.roleIds.Count -eq 1 -and $identityEditor.roleIds[0] -eq $identityImportRole.id -and $identityEditor.postIds.Count -eq 1 -and $identityEditor.postIds[0] -eq '2') 'Imported user HTTP details lost their preserved associations.'
        }
        Write-Output "Identity import ${identityKind}: mixed commits, immediate session revocation/profile refresh, all-success refresh, no token resurrection and retained department/role/post/password passed."
    }
}
finally {
    foreach ($identityLogin in $identityLogins) { Request '/logout' 'POST' '' $identityLogin.Headers | Out-Null }
    if ($identityUserIds.Count) { Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($identityUserIds.ToArray())} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned identity user cleanup failed.' }
    if ($identityRoleIds.Count) { Assert-Check ((Request '/api/v1/system/roles' 'DELETE' (@{ids=@($identityRoleIds.ToArray())} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned identity role cleanup failed.' }
}
