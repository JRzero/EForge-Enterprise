# Dot-sourced only by the disposable MySQL/Redis authentication harness.
$onlineBase='/api/v1/monitor/online-sessions'
$onlineUsername="on$runId"
$onlineBody=@{user=@{username=$onlineUsername;displayName='在线会话验证';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 6 -Compress
$onlineCreated=Request '/api/v1/system/users' 'POST' $onlineBody $authorized
Assert-Check ($onlineCreated.StatusCode -eq 201) 'Owned online account creation failed.'
$onlineUserId=($onlineCreated.Content|ConvertFrom-Json).id
function Online-SessionId([string]$jwt) {
    $payload=$jwt.Split('.')[1].Replace('-','+').Replace('_','/')
    while($payload.Length%4){$payload+='='}
    return ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload))|ConvertFrom-Json).login_user_key
}
try {
    $onlineCredentials=@{username=$onlineUsername;password='User12345'}|ConvertTo-Json -Compress
    $onlineTokens=@();$onlineIds=@()
    for($index=0;$index -lt 3;$index++) {
        $loginResponse=Request '/api/v1/auth/login' 'POST' $onlineCredentials
        Assert-Check ($loginResponse.StatusCode -eq 200) 'Owned online login failed.'
        $jwt=($loginResponse.Content|ConvertFrom-Json).accessToken
        $onlineTokens+=,$jwt;$onlineIds+=,(Online-SessionId $jwt)
    }
    $onlineReader=@{Authorization="Bearer $($onlineTokens[0])"}
    Assert-Problem (Request $onlineBase 'GET' '' $onlineReader) 403 'ACCESS_DENIED'
    Assert-Problem (Request "$onlineBase/$($onlineIds[1])" 'DELETE' '' $onlineReader) 403 'ACCESS_DENIED'
    Assert-Problem (Request $onlineBase) 401 'AUTHENTICATION_REQUIRED'
    $onlineQuery="$onlineBase`?username=$onlineUsername&pageSize=100"
    $onlineList=Request $onlineQuery 'GET' '' $authorized
    Assert-Check ($onlineList.StatusCode -eq 200) 'Canonical online list failed.'
    $onlineRows=$onlineList.Content|ConvertFrom-Json
    Assert-Check ($onlineRows.total -eq 3 -and $onlineRows.items.Count -eq 3 -and !$onlineRows.rows) 'Actual online sessions/paging were not projected.'
    foreach($row in $onlineRows.items) {
        Assert-Check ($row.id -in $onlineIds -and $row.username -eq $onlineUsername -and $row.ip -eq '127.0.0.1' -and !!$row.loggedInAt) 'Online projection did not match actual owned Redis sessions.'
        Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS "login_tokens:$($row.id)") -eq '1') 'Listed online session does not exist in Redis.'
        Assert-Check (!$row.PSObject.Properties['password'] -and !$row.PSObject.Properties['permissions'] -and !$row.PSObject.Properties['user'] -and !$row.PSObject.Properties['accessToken']) 'Online projection exposed cached credentials or grants.'
    }
    $pageTwo=(Request "$onlineBase`?username=$onlineUsername&page=2&pageSize=1" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($pageTwo.total -eq 3 -and $pageTwo.items.Count -eq 1 -and $pageTwo.items[0].id -eq $onlineRows.items[1].id) 'Actual online paging/order differs from the complete projection.'
    foreach($query in @("username=$($onlineUsername.Substring(0,5))", "username=$onlineUsername&ip=127.", "username=$onlineUsername&ip=127.0.0.2")) {
        Assert-Check (((Request "$onlineBase`?$query" 'GET' '' $authorized).Content|ConvertFrom-Json).total -eq 0) 'Upstream exact online filtering must not become substring matching.'
    }
    Assert-Check (((Request "$onlineBase`?username=$onlineUsername&ip=127.0.0.1" 'GET' '' $authorized).Content|ConvertFrom-Json).total -eq 3) 'Combined exact online filtering failed.'
    Assert-Problem (Request "$onlineBase`?pageSize=101" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
    Assert-Problem (Request "$onlineBase/pwd_err_cnt:admin" 'DELETE' '' $authorized) 400 'VALIDATION_ERROR'
    try {
        Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-keys' | Out-Null
        Assert-Problem (Request $onlineQuery 'GET' '' $authorized) 503 'ONLINE_SESSIONS_UNAVAILABLE'
    } finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+keys' | Out-Null}
    try {
        Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-del' '-unlink' | Out-Null
        Assert-Problem (Request "$onlineBase/$($onlineIds[0])" 'DELETE' '' $authorized) 503 'ONLINE_SESSIONS_UNAVAILABLE'
        Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $onlineReader).StatusCode -eq 200) 'Failed force logout must preserve the actual session.'
    } finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+del' '+unlink' | Out-Null}
    Assert-Check ((Request "$onlineBase/$($onlineIds[0])" 'DELETE' '' $authorized).StatusCode -eq 204) 'Canonical force logout failed.'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS "login_tokens:$($onlineIds[0])") -eq '0') 'Selected force logout did not remove the actual Redis key.'
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $onlineReader) 401 'AUTHENTICATION_REQUIRED'
    foreach($jwt in $onlineTokens[1..2]) {Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' @{Authorization="Bearer $jwt"}).StatusCode -eq 200) 'Force logout revoked a different session.'}
    Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $authorized).StatusCode -eq 200) 'Force logout revoked its caller.'
    Assert-Check (((Request $onlineQuery 'GET' '' $authorized).Content|ConvertFrom-Json).total -eq 2) 'Revoked session remained in the actual list.'
    Assert-Check ((Request "$onlineBase/$($onlineIds[0])" 'DELETE' '' $authorized).StatusCode -eq 204) 'Already absent force logout must be idempotent.'
} finally {Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($onlineUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned online account cleanup failed.'}
Write-Host 'Online sessions: actual Redis projection, exact combined filters, stable paging, no-role grants, key enumeration/deletion ACL faults, scoped force logout and immediate JWT invalidation passed.'
