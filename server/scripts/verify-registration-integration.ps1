# Dot-sourced only in the parent's uniquely owned disposable MySQL/Redis fixture.
$registrationConfigBackups=@()
$registrationUserIds=[System.Collections.Generic.List[string]]::new()
function Set-RegistrationFixtureConfiguration([string]$key,[string]$value) {
    $registrationReply=Request "/api/v1/system/configurations?key=$key" 'GET' '' $authorized
    Assert-Check ($registrationReply.StatusCode -eq 200) 'Registration fixture configuration read failed.'
    $registrationRecord=($registrationReply.Content|ConvertFrom-Json).items|Where-Object key -eq $key
    Assert-Check ($null -ne $registrationRecord) 'Original registration configuration missing.'
    if(!($script:registrationConfigBackups|Where-Object id -eq $registrationRecord.id)) {$script:registrationConfigBackups+= $registrationRecord}
    $registrationUpdate=@{name=$registrationRecord.name;key=$registrationRecord.key;value=$value;builtin=$registrationRecord.builtin;remark=$registrationRecord.remark}|ConvertTo-Json -Compress
    Assert-Check ((Request "/api/v1/system/configurations/$($registrationRecord.id)" 'PUT' $registrationUpdate $authorized).StatusCode -eq 204) 'Registration fixture configuration update failed.'
}
function Registration-FixtureBody([string]$name,[string]$code='',[string]$uuid='') {
    return @{username=$name;password='Register123';confirmPassword='Register123';code=$code;uuid=$uuid;roleIds=@('1');departmentId='103'}|ConvertTo-Json -Compress
}
function Track-RegisteredFixture([string]$name) {
    $registrationId=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT user_id FROM sys_user WHERE user_name='$name' AND del_flag='0';"
    Assert-Check ($registrationId -match '^[0-9]+$') 'Expected exactly one owned registered account.'
    $registrationUserIds.Add([string]$registrationId)
    return [string]$registrationId
}
try {
    Set-RegistrationFixtureConfiguration 'sys.account.registerUser' 'false'
    $registrationName="reg-$runId"
    $registrationBody=Registration-FixtureBody $registrationName
    $registrationStatus=Request '/api/v1/auth/registration'
    Assert-Check ($registrationStatus.StatusCode -eq 200 -and ($registrationStatus.Content|ConvertFrom-Json).enabled -eq $false -and (($registrationStatus.Content|ConvertFrom-Json).PSObject.Properties.Count -eq 1)) 'Public registration status must expose only availability.'
    Assert-Problem (Request '/api/v1/auth/register' 'POST' $registrationBody) 403 'REGISTRATION_DISABLED'
    Assert-Problem (Request '/api/v1/auth/register') 401 'AUTHENTICATION_REQUIRED'
    Set-RegistrationFixtureConfiguration 'sys.account.registerUser' 'true'
    Assert-Check ((Request '/api/v1/auth/registration').Content|ConvertFrom-Json|Select-Object -ExpandProperty enabled) 'Enabled registration status failed.'
    $registrationMismatch=@{username=$registrationName;password='Register123';confirmPassword='Different123'}|ConvertTo-Json -Compress
    Assert-Problem (Request '/api/v1/auth/register' 'POST' $registrationMismatch) 400 'REGISTRATION_PASSWORD_MISMATCH'
    $registrationCreated=Request '/api/v1/auth/register' 'POST' $registrationBody
    Assert-Check ($registrationCreated.StatusCode -eq 201 -and [string]::IsNullOrEmpty($registrationCreated.Content) -and !$registrationCreated.Headers['Set-Cookie']) 'Registration must create no response credentials/session cookie.'
    $registrationId=Track-RegisteredFixture $registrationName
    $registrationSqlProof=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT CONCAT((password LIKE CONCAT(CHAR(36),'2%')),',',(pwd_update_date IS NOT NULL),',',COALESCE(dept_id,0),',',(SELECT COUNT(*) FROM sys_user_role WHERE user_id=$registrationId),',',(SELECT COUNT(*) FROM sys_user_post WHERE user_id=$registrationId)) FROM sys_user WHERE user_id=$registrationId;"
    Assert-Check ($registrationSqlProof -ceq '1,1,0,0,0') 'Registered account must have BCrypt/current password date and no request-supplied department/roles/posts.'
    Assert-Problem (Request '/api/v1/auth/register' 'POST' $registrationBody) 409 'REGISTRATION_USERNAME_EXISTS'
    $registrationLogin=Request '/api/v1/auth/login' 'POST' (@{username=$registrationName;password='Register123'}|ConvertTo-Json -Compress)
    Assert-Check ($registrationLogin.StatusCode -eq 200) 'Actual registered BCrypt credential cannot log in.'
    $registrationHeaders=@{Authorization="Bearer $(($registrationLogin.Content|ConvertFrom-Json).accessToken)"}
    $registrationBootstrap=(Request '/api/v1/app/bootstrap' 'GET' '' $registrationHeaders).Content|ConvertFrom-Json
    Assert-Check ($registrationBootstrap.user.id -eq $registrationId -and $registrationBootstrap.roles.Count -eq 0 -and $registrationBootstrap.permissions.Count -eq 0 -and !$registrationBootstrap.passwordStatus.initialChangeRecommended -and !$registrationBootstrap.passwordStatus.expired -and !$registrationBootstrap.user.PSObject.Properties['password']) 'Registered no-role bootstrap or password date failed.'
    Assert-Problem (Request '/api/v1/system/users' 'GET' '' $registrationHeaders) 403 'ACCESS_DENIED'
    Assert-Check ((Request '/logout' 'POST' '' $registrationHeaders).StatusCode -eq 200) 'Registered fixture logout failed.'
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $registrationHeaders) 401 'AUTHENTICATION_REQUIRED'
    $registrationRaceName="race-$runId";$registrationRaceBody=Registration-FixtureBody $registrationRaceName;$registrationRaceUrl="http://127.0.0.1:$AppPort/api/v1/auth/register"
    $registrationRaces=@(1..8|ForEach-Object -Parallel {$registrationRaceReply=Invoke-WebRequest -Uri $using:registrationRaceUrl -Method POST -ContentType 'application/json' -Body $using:registrationRaceBody -SkipHttpErrorCheck;[pscustomobject]@{Status=$registrationRaceReply.StatusCode;Content=$registrationRaceReply.Content}} -ThrottleLimit 8)
    Assert-Check (@($registrationRaces|Where-Object Status -eq 201).Count -eq 1 -and @($registrationRaces|Where-Object Status -eq 409).Count -eq 7) 'Concurrent registration must produce one committed account/seven safe conflicts.'
    $null=Track-RegisteredFixture $registrationRaceName
    Set-RegistrationFixtureConfiguration 'sys.account.captchaEnabled' 'true'
    $registrationCaptchaName="cap-$runId";$registrationChallenge="reg-$runId"
    Invoke-Docker exec $redisName redis-cli set "captcha_codes:$registrationChallenge" '"42"' EX 120 | Out-Null
    Assert-Problem (Request '/api/v1/auth/register' 'POST' (Registration-FixtureBody $registrationCaptchaName 'wrong' $registrationChallenge)) 400 'CAPTCHA_INVALID'
    Assert-Problem (Request '/api/v1/auth/register' 'POST' (Registration-FixtureBody $registrationCaptchaName '42' $registrationChallenge)) 400 'CAPTCHA_INVALID'
    Invoke-Docker exec $redisName redis-cli set "captcha_codes:$registrationChallenge" '"42"' EX 120 | Out-Null
    Assert-Check ((Request '/api/v1/auth/register' 'POST' (Registration-FixtureBody $registrationCaptchaName '42' $registrationChallenge)).StatusCode -eq 201) 'Actual registration captcha success failed.'
    $null=Track-RegisteredFixture $registrationCaptchaName
    Assert-Problem (Request '/api/v1/auth/register' 'POST' (Registration-FixtureBody "replay-$runId" '42' $registrationChallenge)) 400 'CAPTCHA_INVALID'
    Set-RegistrationFixtureConfiguration 'sys.account.captchaEnabled' 'false'
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE sys_user TO sys_user_registration_fault;' | Out-Null
    try {
        Assert-Problem (Request '/api/v1/auth/register' 'POST' (Registration-FixtureBody "fault-$runId")) 503 'REGISTRATION_UNAVAILABLE'
    } finally {Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE sys_user_registration_fault TO sys_user;' | Out-Null}
    Assert-Check ((Request '/api/v1/auth/register' 'POST' (Registration-FixtureBody "fault-$runId")).StatusCode -eq 201) 'Registration SQL-fault retry failed.'
    $null=Track-RegisteredFixture "fault-$runId"
    $registrationAuditReady=$false
    for($registrationAuditAttempt=0;$registrationAuditAttempt -lt 20;$registrationAuditAttempt++){
        $registrationAuditCount=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT COUNT(*) FROM sys_logininfor WHERE user_name='$registrationName' AND status='0';"
        if([int]$registrationAuditCount -ge 1){$registrationAuditReady=$true;break};Start-Sleep -Milliseconds 100
    }
    Assert-Check $registrationAuditReady 'Original successful registration audit was not persisted.'
    Set-RegistrationFixtureConfiguration 'sys.account.registerUser' 'false'
    Assert-Problem (Request '/api/v1/auth/register' 'POST' (Registration-FixtureBody "late-$runId")) 403 'REGISTRATION_DISABLED'
    Write-Output 'Registration: original default/switch/captcha replay, BCrypt and password date, zero implicit grants, no session response, actual login/logout, eight concurrent unique outcomes, SQL fault/privacy/retry and original audit passed.'
} finally {
    foreach($registrationRecord in $registrationConfigBackups){
        $registrationRestore=@{name=$registrationRecord.name;key=$registrationRecord.key;value=$registrationRecord.value;builtin=$registrationRecord.builtin;remark=$registrationRecord.remark}|ConvertTo-Json -Compress
        Assert-Check ((Request "/api/v1/system/configurations/$($registrationRecord.id)" 'PUT' $registrationRestore $authorized).StatusCode -eq 204) 'Restoring original registration configuration failed.'
    }
    if($registrationUserIds.Count){Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($registrationUserIds)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned registered fixture cleanup failed.'}
}

