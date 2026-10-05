# Dot-sourced only inside the owned disposable Redis/MySQL harness.
$cacheBase='/api/v1/monitor/cache'
$cacheName='sys_config:'
$cacheKey="sys_config:cache-$runId/中文&a"
$cacheOther="sys_dict:cache-$runId"
$cacheCustom="custom:cache-$runId"
$cacheWrong="sys_config:wrong-type-$runId"
$cacheUsername="cm$runId"
$cacheCreated=Request '/api/v1/system/users' 'POST' (@{user=@{username=$cacheUsername;displayName='缓存权限验证';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 6 -Compress) $authorized
Assert-Check ($cacheCreated.StatusCode -eq 201) 'Owned cache account creation failed.'
$cacheUserId=($cacheCreated.Content|ConvertFrom-Json).id
try {
    $cacheLogin=Request '/api/v1/auth/login' 'POST' (@{username=$cacheUsername;password='User12345'}|ConvertTo-Json -Compress)
    Assert-Check ($cacheLogin.StatusCode -eq 200) 'Owned cache login failed.'
    $cacheReader=@{Authorization="Bearer $(($cacheLogin.Content|ConvertFrom-Json).accessToken)"}
    $cacheClearKey=@{name=$cacheName;key=$cacheKey}|ConvertTo-Json -Compress
    $cacheKeyUrl=[Uri]::EscapeDataString($cacheKey)
    $cacheOperations=@(@{path=$cacheBase;method='GET';body=''},@{path="$cacheBase/names";method='GET';body=''},
        @{path="$cacheBase/keys?name=sys_config%3A";method='GET';body=''},@{path="$cacheBase/value?name=sys_config%3A&key=$cacheKeyUrl";method='GET';body=''},
        @{path="$cacheBase/names/sys_config%3A";method='DELETE';body=''},@{path="$cacheBase/keys";method='DELETE';body=$cacheClearKey},@{path=$cacheBase;method='DELETE';body=''})
    foreach($operation in $cacheOperations) {
        Assert-Problem (Request $operation.path $operation.method $operation.body $cacheReader) 403 'ACCESS_DENIED'
        Assert-Problem (Request $operation.path $operation.method $operation.body) 401 'AUTHENTICATION_REQUIRED'
    }
    $cacheNames=(Request "$cacheBase/names" 'GET' '' $authorized).Content|ConvertFrom-Json
    $cacheLegacyNames=(Request '/monitor/cache/getNames' 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($cacheNames.Count -eq 7 -and (($cacheNames.name -join ',') -eq ($cacheLegacyNames.data.cacheName -join ','))) 'Canonical cache namespaces changed the original list/order.'
    $cacheStatsResponse=Request $cacheBase 'GET' '' $authorized
    Assert-Check ($cacheStatsResponse.StatusCode -eq 200) 'Actual Redis stats failed.'
    $cacheStats=$cacheStatsResponse.Content|ConvertFrom-Json
    $cacheLegacy=(Request '/monitor/cache' 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check (!!$cacheStats.info.version -and $cacheStats.info.version -eq $cacheLegacy.data.info.redis_version -and $cacheStats.info.mode -eq $cacheLegacy.data.info.redis_mode -and [long]$cacheStats.keyCount -gt 0 -and [long]$cacheStats.info.usedMemoryBytes -gt 0 -and $cacheStats.commands.Count -gt 0) 'Canonical Redis stats diverge from actual compatibility info.'
    foreach($command in $cacheStats.commands) {Assert-Check ($command.calls -match '^\d+$' -and !!$command.name) 'Actual command counters must remain exact decimal text.'}
    $cacheText='中文/缓存 & <script>安全文本</script>'
    Invoke-Docker exec $redisName redis-cli SET $cacheKey ($cacheText|ConvertTo-Json -Compress) | Out-Null
    Invoke-Docker exec $redisName redis-cli SET $cacheOther '9007199254740993' | Out-Null
    Invoke-Docker exec $redisName redis-cli SET $cacheCustom 'owned-custom-value' | Out-Null
    Invoke-Docker exec $redisName redis-cli RPUSH $cacheWrong 'owned-list-value' | Out-Null
    $cacheKeysResponse=Request "$cacheBase/keys?name=sys_config%3A" 'GET' '' $authorized
    Assert-Check ($cacheKeysResponse.StatusCode -eq 200) 'Actual cache key enumeration failed.'
    $cacheKeys=@($cacheKeysResponse.Content|ConvertFrom-Json)
    Assert-Check ($cacheKeys -contains $cacheKey -and $cacheKeys -contains $cacheWrong) 'Actual Unicode/slash keys were lost in enumeration.'
    $cacheValueResponse=Request "$cacheBase/value?name=sys_config%3A&key=$cacheKeyUrl" 'GET' '' $authorized
    Assert-Check ($cacheValueResponse.StatusCode -eq 200 -and ($cacheValueResponse.Content|ConvertFrom-Json).value -eq $cacheText) 'Actual cached scalar text was not preserved.'
    $cacheOtherValue=(Request "$cacheBase/value?name=sys_dict%3A&key=$([Uri]::EscapeDataString($cacheOther))" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($cacheOtherValue.value -eq '9007199254740993') 'Raw Redis numeric text lost precision.'
    $cacheCallerId=Online-SessionId ($authorized.Authorization.Substring(7))
    $cacheSession=(Request "$cacheBase/value?name=login_tokens%3A&key=login_tokens%3A$cacheCallerId" 'GET' '' $authorized).Content|ConvertFrom-Json
    $cacheSessionJson=$cacheSession.value|ConvertFrom-Json
    Assert-Check ($cacheSessionJson.user.userName -eq 'admin' -and $cacheSession.value -notmatch '"password"|"accessToken"|"refreshToken"') 'Session diagnostic values exposed credentials or failed to retain metadata.'
    Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $authorized).StatusCode -eq 200) 'Reading cache diagnostics mutated the actual caller session.'
    Assert-Problem (Request "$cacheBase/value?name=sys_config%3A&key=$([Uri]::EscapeDataString($cacheOther))" 'GET' '' $authorized) 400 'INVALID_CACHE_KEY'
    Assert-Problem (Request "$cacheBase/value?name=sys_config%3A&key=$([Uri]::EscapeDataString($cacheWrong))" 'GET' '' $authorized) 503 'CACHE_UNAVAILABLE'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli LINDEX $cacheWrong 0) -eq 'owned-list-value') 'Failed value reads must not change incompatible Redis values.'
    try {
        Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-info' | Out-Null
        Assert-Problem (Request $cacheBase 'GET' '' $authorized) 503 'CACHE_UNAVAILABLE'
    } finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+info' | Out-Null}
    try {
        Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-keys' | Out-Null
        Assert-Problem (Request "$cacheBase/keys?name=sys_config%3A" 'GET' '' $authorized) 503 'CACHE_UNAVAILABLE'
        Assert-Problem (Request "$cacheBase/names/sys_config%3A" 'DELETE' '' $authorized) 503 'CACHE_UNAVAILABLE'
        Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS $cacheKey) -eq '1') 'Failed namespace enumeration deleted data.'
    } finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+keys' | Out-Null}
    try {
        Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-del' '-unlink' | Out-Null
        Assert-Problem (Request "$cacheBase/keys" 'DELETE' $cacheClearKey $authorized) 503 'CACHE_UNAVAILABLE'
        Assert-Problem (Request "$cacheBase/names/sys_config%3A" 'DELETE' '' $authorized) 503 'CACHE_UNAVAILABLE'
        Assert-Problem (Request $cacheBase 'DELETE' '' $authorized) 503 'CACHE_UNAVAILABLE'
        Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS $cacheKey $cacheOther $cacheCustom) -eq '3' -and (Request '/api/v1/app/bootstrap' 'GET' '' $cacheReader).StatusCode -eq 200) 'Failed cache clearing must preserve keys and other sessions.'
    } finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+del' '+unlink' | Out-Null}
    Assert-Check ((Request "$cacheBase/keys" 'DELETE' $cacheClearKey $authorized).StatusCode -eq 204) 'Canonical single-key clear failed.'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS $cacheKey $cacheOther $cacheCustom) -eq '2') 'Single-key clear removed another namespace/key.'
    Assert-Problem (Request "$cacheBase/value?name=sys_config%3A&key=$cacheKeyUrl" 'GET' '' $authorized) 404 'CACHE_KEY_NOT_FOUND'
    Assert-Check ((Request "$cacheBase/keys" 'DELETE' $cacheClearKey $authorized).StatusCode -eq 204) 'Already absent clear must be idempotent.'
    Invoke-Docker exec $redisName redis-cli SET $cacheKey 'restored-value' | Out-Null
    Assert-Check ((Request "$cacheBase/names/sys_config%3A" 'DELETE' '' $authorized).StatusCode -eq 204) 'Canonical namespace clear failed.'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS $cacheKey $cacheWrong) -eq '0' -and (Invoke-Docker exec $redisName redis-cli EXISTS $cacheOther $cacheCustom) -eq '2') 'Namespace clear crossed its boundary or failed to delete its snapshot.'
    $cacheReaderJwt=($cacheLogin.Content|ConvertFrom-Json).accessToken
    $cacheReaderId=Online-SessionId $cacheReaderJwt
    $cacheSessionClear=@{name='login_tokens:';key="login_tokens:$cacheReaderId"}|ConvertTo-Json -Compress
    Assert-Check ((Request "$cacheBase/keys" 'DELETE' $cacheSessionClear $authorized).StatusCode -eq 204) 'Cache single-key session revocation failed.'
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $cacheReader) 401 'AUTHENTICATION_REQUIRED'
    Assert-Check ((Request '/api/v1/app/bootstrap' 'GET' '' $authorized).StatusCode -eq 200) 'Cache single-key revocation removed its caller.'
    $cacheLogin=Request '/api/v1/auth/login' 'POST' (@{username=$cacheUsername;password='User12345'}|ConvertTo-Json -Compress)
    Assert-Check ($cacheLogin.StatusCode -eq 200) 'Owned cache session recreation failed.'
    $cacheReader=@{Authorization="Bearer $(($cacheLogin.Content|ConvertFrom-Json).accessToken)"}
    Assert-Check ((Request "$cacheBase/names/login_tokens%3A" 'DELETE' '' $authorized).StatusCode -eq 204) 'Cache login namespace clear failed.'
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $authorized) 401 'AUTHENTICATION_REQUIRED'
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $cacheReader) 401 'AUTHENTICATION_REQUIRED'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli EXISTS $cacheOther $cacheCustom) -eq '2') 'Login namespace clear deleted unrelated cached values.'
    $cacheAdminLogin=Request '/api/v1/auth/login' 'POST' $credentials
    Assert-Check ($cacheAdminLogin.StatusCode -eq 200) 'Admin session recreation before full cache clear failed.'
    $authorized=@{Authorization="Bearer $(($cacheAdminLogin.Content|ConvertFrom-Json).accessToken)"}
    $cacheLogin=Request '/api/v1/auth/login' 'POST' (@{username=$cacheUsername;password='User12345'}|ConvertTo-Json -Compress)
    Assert-Check ($cacheLogin.StatusCode -eq 200) 'Reader session recreation before full cache clear failed.'
    $cacheReader=@{Authorization="Bearer $(($cacheLogin.Content|ConvertFrom-Json).accessToken)"}
    Assert-Check ((Request $cacheBase 'DELETE' '' $authorized).StatusCode -eq 204) 'Canonical all-cache clear failed.'
    Assert-Check ((Invoke-Docker exec $redisName redis-cli DBSIZE) -eq '0') 'All-cache clear did not delete every key in the owned database.'
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $authorized) 401 'AUTHENTICATION_REQUIRED'
    Assert-Problem (Request '/api/v1/app/bootstrap' 'GET' '' $cacheReader) 401 'AUTHENTICATION_REQUIRED'
} finally {
    # Global clear intentionally removes the caller too; restore authentication for owned cleanup and later tests.
    $cacheAdminLogin=Request '/api/v1/auth/login' 'POST' $credentials
    Assert-Check ($cacheAdminLogin.StatusCode -eq 200) 'Admin login after cache clearing failed.'
    $authorized=@{Authorization="Bearer $(($cacheAdminLogin.Content|ConvertFrom-Json).accessToken)"}
    Invoke-Docker exec $redisName redis-cli DEL $cacheKey $cacheOther $cacheCustom $cacheWrong | Out-Null
    Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($cacheUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned cache account cleanup failed.'
}
Write-Host 'Cache monitor: actual Redis info/counters, original namespaces, Unicode/JSON/exact values, session credential boundary, all no-role grants, info/key/delete ACL faults, scoped/idempotent clearing and actual all-key/session invalidation passed.'
