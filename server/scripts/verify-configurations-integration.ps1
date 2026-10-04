# Runs only inside the owned disposable MySQL/Redis fixture.
$configBase='/api/v1/system/configurations'
function Config-Create([hashtable]$body){$response=Request $configBase 'POST' ($body|ConvertTo-Json -Compress) $authorized;Assert-Check ($response.StatusCode -eq 201) "Configuration creation failed: $($response.Content)";return $response.Content|ConvertFrom-Json}
Assert-Problem (Request "$configBase/lookup?key=missing") 401 'AUTHENTICATION_REQUIRED'
$key="test.config.$runId";$body=@{name="参数验证-$runId";key=$key;value='中文值 & data';builtin=$false;remark='原备注'}
$config=Config-Create $body
$unicodeKey="测试/配置 & $runId"
$unicodeConfig=Config-Create @{name='Unicode key';key=$unicodeKey;value='原值 <plain>';builtin=$false}
$encodedUnicodeKey=[Uri]::EscapeDataString($unicodeKey)
Assert-Check (((Request "$configBase/lookup?key=$encodedUnicodeKey" 'GET' '' $authorized).Content|ConvertFrom-Json).value -eq '原值 <plain>') 'Unicode/slash/ampersand configuration key did not survive query lookup.'
Assert-Check ($config.id -is [string]) 'Configuration IDs must be exact strings.'
Assert-Problem (Request $configBase 'POST' ($body|ConvertTo-Json -Compress) $authorized) 409 'CONFIGURATION_KEY_EXISTS'
$lookup=(Request "$configBase/lookup?key=$key" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($lookup.value -eq $body.value) 'Configuration Unicode lookup failed.'
$missing=(Request "$configBase/lookup?key=missing.$runId" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($missing.value -eq '') 'Original missing-key behavior must remain an empty string.'
$today=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d');"
$page=(Request "$configBase`?key=$key&builtin=false&from=$today&to=$today&pageSize=1" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($page.total -eq 1 -and $page.items[0].id -eq $config.id) 'Configuration inclusive dates/paging/builtin filters failed.'
Assert-Problem (Request "$configBase`?from=2026-10-05&to=2026-10-04" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
$builtin=Config-Create @{name='内置验证';key="builtin.config.$runId";value='builtin';builtin=$true}
Assert-Problem (Request $configBase 'DELETE' (@{ids=@($config.id,$builtin.id)}|ConvertTo-Json -Compress) $authorized) 409 'CONFIGURATION_BUILTIN'
Assert-Check ((Request "$configBase/$($config.id)" 'GET' '' $authorized).StatusCode -eq 200) 'Builtin batch rejection partially deleted another configuration.'
$renamed="$key.renamed";$body.key=$renamed;$body.value='新值';$body.remark=''
Assert-Check ((Request "$configBase/$($config.id)" 'PUT' ($body|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Configuration rename failed.'
Assert-Check (((Request "$configBase/lookup?key=$key" 'GET' '' $authorized).Content|ConvertFrom-Json).value -eq '') 'Old configuration key remains visible.'
Assert-Check (((Request "$configBase/lookup?key=$renamed" 'GET' '' $authorized).Content|ConvertFrom-Json).value -eq '新值') 'Renamed key lookup failed.'
Assert-Check (((Request "/system/config/configKey/$renamed" 'GET' '' $authorized).Content|ConvertFrom-Json).msg -eq '新值') 'Compatibility consumer did not observe canonical write.'
$stored=(Request "$configBase/$($config.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($stored.remark -eq '') 'Configuration remark clearing did not persist.'
Assert-Problem (Request $configBase 'DELETE' (@{ids=@($config.id,'9223372036854775807')}|ConvertTo-Json -Compress) $authorized) 404 'CONFIGURATION_NOT_FOUND'
Assert-Check ((Request "$configBase/$($config.id)" 'GET' '' $authorized).StatusCode -eq 200) 'Missing batch member partially deleted existing configuration.'
# Stale Redis data must never override committed policy values, including compatibility reads.
Invoke-Docker exec $redisName redis-cli set "sys_config:$renamed" '"stale"' | Out-Null
Assert-Check (((Request "/system/config/configKey/$renamed" 'GET' '' $authorized).Content|ConvertFrom-Json).msg -eq '新值') 'Compatibility lookup trusted stale Redis data.'
$cacheFailure=$body.Clone();$cacheFailure.key="$key.failed";$cacheFailure.value='必须回滚'
try {
    Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-del' '-unlink' | Out-Null
    Assert-Problem (Request "$configBase/$($config.id)" 'PUT' ($cacheFailure|ConvertTo-Json -Compress) $authorized) 503 'CONFIGURATION_CACHE_UNAVAILABLE'
} finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+del' '+unlink' | Out-Null}
$afterFailure=(Request "$configBase/$($config.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($afterFailure.key -eq $renamed -and $afterFailure.value -eq '新值') 'Redis invalidation failure did not roll back MySQL key/value writes.'
$sql="INSERT INTO sys_config(config_name,config_key,config_value,config_type) SELECT 'Duplicate',config_key,'duplicate','N' FROM sys_config WHERE config_id=$($config.id);"
$probe=& docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e $sql 2>&1
Assert-Check ($LASTEXITCODE -ne 0 -and ($probe -join '') -match '1062') 'Configuration key needs a real database unique index.'
$file=Join-Path $logDirectory 'configurations.xlsx'
Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$configBase/export?key=$renamed" -Method POST -Headers $authorized -OutFile $file | Out-Null
$zip=[IO.Compression.ZipFile]::OpenRead($file)
try{$reader=[IO.StreamReader]::new($zip.GetEntry('xl/worksheets/sheet1.xml').Open());try{$sheet=$reader.ReadToEnd()}finally{$reader.Dispose()};Assert-Check ($sheet.Contains($renamed) -and $sheet.Contains('新值') -and !$sheet.Contains($builtin.key)) 'Configuration XLSX contents/filter failed.'}finally{$zip.Dispose()}
Invoke-Docker exec $redisName redis-cli set 'sys_config:stale_alias' '"stale"' | Out-Null
Assert-Check ((Request "$configBase/cache/refresh" 'POST' '' $authorized).StatusCode -eq 204) 'Configuration cache refresh failed.'
Assert-Check ((Invoke-Docker exec $redisName redis-cli exists 'sys_config:stale_alias') -eq '0') 'Cache refresh retained stale alias.'
$raceBody=@{name='Concurrent';key="race.config.$runId";value='race';builtin=$false}|ConvertTo-Json -Compress
$raceUrl="http://127.0.0.1:$AppPort$configBase"
$races=@(1..8|ForEach-Object -Parallel {$reply=Invoke-WebRequest -Uri $using:raceUrl -Method POST -Body $using:raceBody -Headers $using:authorized -ContentType 'application/json' -SkipHttpErrorCheck;[pscustomobject]@{Status=$reply.StatusCode;Body=($reply.Content|ConvertFrom-Json)}} -ThrottleLimit 8)
Assert-Check (@($races|Where-Object Status -eq 201).Count -eq 1 -and @($races|Where-Object Status -eq 409).Count -eq 7) 'Concurrent configuration creates must yield one success/seven conflicts.'
$race=($races|Where-Object Status -eq 201).Body
$builtinBody=@{name=$builtin.name;key=$builtin.key;value=$builtin.value;builtin=$false;remark=''}|ConvertTo-Json -Compress
Assert-Check ((Request "$configBase/$($builtin.id)" 'PUT' $builtinBody $authorized).StatusCode -eq 204) 'Original builtin editability must be preserved.'
Assert-Check ((Request $configBase 'DELETE' (@{ids=@($config.id,$builtin.id,$race.id,$unicodeConfig.id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Configuration cleanup failed.'
Write-Host 'Configuration CRUD, Unicode, dates/paging, builtin batch protection/editability, rename/compatibility lookup, XLSX, cache refresh and concurrent uniqueness passed.'
