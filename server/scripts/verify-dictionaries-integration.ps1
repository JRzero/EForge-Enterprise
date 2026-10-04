# Runs only inside the owned disposable MySQL/Redis fixture.
$dictBase='/api/v1/system/dictionaries';$entryBase='/api/v1/system/dictionary-entries'
function Dict-Create([hashtable]$body) {
    $response=Request $dictBase 'POST' ($body|ConvertTo-Json -Compress) $authorized
    Assert-Check ($response.StatusCode -eq 201) "Dictionary create failed: $($response.Content)"
    $row=$response.Content|ConvertFrom-Json
    Assert-Check ($row.id -is [string] -and ($response.Headers.Location -join '') -eq "$dictBase/$($row.id)") 'Dictionary ID/Location must be exact.'
    return $row
}
function Entry-Create([hashtable]$body) {
    $response=Request $entryBase 'POST' ($body|ConvertTo-Json -Compress) $authorized
    Assert-Check ($response.StatusCode -eq 201) "Dictionary entry create failed: $($response.Content)"
    $row=$response.Content|ConvertFrom-Json
    Assert-Check ($row.id -is [string] -and ($response.Headers.Location -join '') -eq "$entryBase/$($row.id)") 'Entry ID/Location must be exact.'
    return $row
}
function Dict-Xlsx([string]$path,[string[]]$expected,[string[]]$absent=@()) {
    $file=Join-Path $logDirectory ('dict-'+[guid]::NewGuid().ToString('N')+'.xlsx')
    Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$path" -Method POST -Headers $authorized -OutFile $file | Out-Null
    $zip=[IO.Compression.ZipFile]::OpenRead($file)
    try {
        $reader=[IO.StreamReader]::new($zip.GetEntry('xl/worksheets/sheet1.xml').Open())
        try {$sheet=$reader.ReadToEnd()} finally {$reader.Dispose()}
        foreach($value in $expected){Assert-Check ($sheet.Contains($value)) "Dictionary workbook missing $value"}
        foreach($value in $absent){Assert-Check (!$sheet.Contains($value)) "Dictionary workbook unexpectedly includes $value"}
    } finally {$zip.Dispose()}
}
Assert-Problem (Request "$dictBase/lookup/sys_normal_disable") 401 'AUTHENTICATION_REQUIRED'
Assert-Problem (Request "$dictBase`?page=0" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$dictBase`?from=2026-02-30" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$dictBase`?from=2026-10-05&to=2026-10-04" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$dictBase/9223372036854775808" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
$code="test_dict_$runId";$body=@{name="字典验证-$runId";code=$code;status='0';remark='最初备注'}
$type=Dict-Create $body
$empty=Dict-Create @{name="空字典-$runId";code="empty_dict_$runId";status='0';remark=''}
Assert-Problem (Request $dictBase 'POST' ($body|ConvertTo-Json -Compress) $authorized) 409 'DICTIONARY_CODE_EXISTS'
$upper=@{name='Upper';code=$code.ToUpperInvariant();status='0'}
Assert-Problem (Request $dictBase 'POST' ($upper|ConvertTo-Json -Compress) $authorized) 400 'VALIDATION_ERROR'
$page=(Request "$dictBase`?code=$code&pageSize=1" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($page.total -eq 1 -and $page.items[0].id -eq $type.id -and !$page.items[0].PSObject.Properties['params']) 'Dictionary filtered paging is incorrect.'
$today=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d');"
$dated=(Request "$dictBase`?code=$code&from=$today&to=$today" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($dated.total -eq 1) 'Dictionary inclusive date filtering failed.'
$outside=(Request "$dictBase`?code=$code&to=2000-01-01" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($outside.total -eq 0) 'Dictionary date filtering ignored its upper bound.'
$entryBody=@{dictionaryId=$type.id;label='中文标签';value='same';sort=7;style='SUCCESS';cssClass='custom_label';defaultEntry=$true;status='0';remark='原备注'}
$first=Entry-Create $entryBody
$entryBody.label='重复键值';$entryBody.sort=1;$second=Entry-Create $entryBody
$entryBody.label='停用标签';$entryBody.status='1';$entryBody.sort=0;$disabled=Entry-Create $entryBody
$entryPage=(Request "$entryBase`?dictionaryId=$($type.id)&pageSize=1" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($entryPage.total -eq 3 -and $entryPage.items[0].id -eq $disabled.id -and $entryPage.items[0].style -eq 'SUCCESS') 'Entry paging/style/order is incorrect.'
$options=@((Request "$dictBase/lookup/$code" 'GET' '' $authorized).Content|ConvertFrom-Json)
Assert-Check ($options.Count -eq 2 -and $options[0].label -eq '重复键值' -and $options[0].defaultEntry -and $options[1].defaultEntry -and !$options[0].PSObject.Properties['remark']) 'Lookup must retain duplicate values/defaults and exclude disabled entries/administrative fields.'
Assert-Check ((Invoke-Docker exec $redisName redis-cli exists "sys_dict:$code") -eq '1') 'Lookup did not populate actual Redis dictionary state.'
Assert-Problem (Request $dictBase 'DELETE' (@{ids=@($empty.id,$type.id)}|ConvertTo-Json -Compress) $authorized) 409 'DICTIONARY_HAS_ENTRIES'
Assert-Check ((Request "$dictBase/$($empty.id)" 'GET' '' $authorized).StatusCode -eq 200) 'Type batch failure partially deleted an empty type.'
Assert-Problem (Request $entryBase 'DELETE' (@{ids=@($first.id,'9223372036854775807')}|ConvertTo-Json -Compress) $authorized) 404 'DICTIONARY_ENTRY_NOT_FOUND'
Assert-Check ((Request "$entryBase/$($first.id)" 'GET' '' $authorized).StatusCode -eq 200) 'Entry batch failure partially deleted existing data.'
$renamed="renamed_dict_$runId";$body.code=$renamed;$body.status='1';$body.remark=''
Assert-Check ((Request "$dictBase/$($type.id)" 'PUT' ($body|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Dictionary rename failed.'
Assert-Check ((Invoke-Docker exec $redisName redis-cli exists "sys_dict:$code") -eq '0') 'Rename left the old Redis key readable.'
$old=@((Request "$dictBase/lookup/$code" 'GET' '' $authorized).Content|ConvertFrom-Json)
$new=@((Request "$dictBase/lookup/$renamed" 'GET' '' $authorized).Content|ConvertFrom-Json)
Assert-Check ($old.Count -eq 0 -and $new.Count -eq 2) 'Rename lookup or original disabled-type semantics regressed.'
$stored=(Request "$entryBase/$($first.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($stored.dictionaryCode -eq $renamed -and $stored.dictionaryId -eq $type.id) 'Rename did not cascade entry types.'
$storedType=(Request "$dictBase/$($type.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($storedType.remark -eq '' -and $storedType.status -eq '1') 'Type clearing/status did not persist.'
# Fault only the disposable Redis delete command; JWT reads remain available.
# A failed invalidation must roll back both the type rename and its entry cascade.
$cacheFailure=$body.Clone();$cacheFailure.code="cachefail_dict_$runId";$cacheFailure.name='必须回滚'
try {
    Invoke-Docker exec $redisName redis-cli ACL SETUSER default '-del' '-unlink' | Out-Null
    Assert-Problem (Request "$dictBase/$($type.id)" 'PUT' ($cacheFailure|ConvertTo-Json -Compress) $authorized) 503 'DICTIONARY_CACHE_UNAVAILABLE'
} finally {Invoke-Docker exec $redisName redis-cli ACL SETUSER default '+del' '+unlink' | Out-Null}
$afterFailure=(Request "$dictBase/$($type.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
$entryAfterFailure=(Request "$entryBase/$($first.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($afterFailure.code -eq $renamed -and $afterFailure.name -eq $body.name -and $entryAfterFailure.dictionaryCode -eq $renamed) 'Redis failure did not roll back actual MySQL type/data writes.'
Write-Host 'Dictionary Redis ACL fault: HTTP 503 and complete MySQL type/data rollback verified.'
$entryBody.label='清空样式';$entryBody.value='0';$entryBody.sort=9;$entryBody.style='DEFAULT';$entryBody.cssClass='';$entryBody.defaultEntry=$false;$entryBody.status='0';$entryBody.remark=''
Assert-Check ((Request "$entryBase/$($first.id)" 'PUT' ($entryBody|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Entry update failed.'
$stored=(Request "$entryBase/$($first.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($stored.style -eq 'DEFAULT' -and $stored.cssClass -eq '' -and !$stored.defaultEntry -and $stored.remark -eq '' -and $stored.sort -eq 9) 'Entry clear/default/order did not persist.'
$values=@((Request "$dictBase/lookup/$renamed" 'GET' '' $authorized).Content|ConvertFrom-Json)
Assert-Check ($values[1].label -eq '清空样式' -and $values[1].value -eq '0') 'Entry mutation left stale dictionary values.'
$bad=$entryBody.Clone();$bad.cssClass='<script>'
Assert-Problem (Request $entryBase 'POST' ($bad|ConvertTo-Json -Compress) $authorized) 400 'VALIDATION_ERROR'
$stale="sys_dict:stale_$runId";Invoke-Docker exec $redisName redis-cli set $stale '[]' | Out-Null
Assert-Check ((Request "$dictBase/cache/refresh" 'POST' '' $authorized).StatusCode -eq 204) 'Dictionary cache refresh failed.'
Assert-Check ((Invoke-Docker exec $redisName redis-cli exists $stale) -eq '0' -and (Invoke-Docker exec $redisName redis-cli exists "sys_dict:$($empty.code)") -eq '1') 'Cache reset retained stale keys or failed to load empty types.'
$cached=Invoke-Docker exec $redisName redis-cli get "sys_dict:$renamed"
Assert-Check (($cached -join '').Contains('清空样式') -and !($cached -join '').Contains('停用标签')) 'Actual Redis cache reset included disabled/stale entries.'
Dict-Xlsx "$dictBase/export?code=$renamed&status=1" @($renamed,'停用') @($empty.code)
Dict-Xlsx "$entryBase/export?dictionaryId=$($type.id)&status=0" @('清空样式','重复键值','正常') @('停用标签')
# Database uniqueness remains authoritative independently of endpoint prevalidation.
$sql="INSERT INTO sys_dict_type(dict_name,dict_type,status) SELECT 'Duplicate',dict_type,'0' FROM sys_dict_type WHERE dict_id=$($type.id);"
$probe=& docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e $sql 2>&1
Assert-Check ($LASTEXITCODE -ne 0 -and ($probe -join '') -match '1062') 'Dictionary type code needs a real database unique index.'
$raceBody=@{name='Race';code="race_dict_$runId";status='0'}|ConvertTo-Json -Compress
$raceUrl="http://127.0.0.1:$AppPort$dictBase"
$races=@(1..8|ForEach-Object -Parallel {
    $reply=Invoke-WebRequest -Uri $using:raceUrl -Method POST -Body $using:raceBody -Headers $using:authorized -ContentType 'application/json' -SkipHttpErrorCheck -TimeoutSec 20
    [pscustomobject]@{Status=$reply.StatusCode;Body=($reply.Content|ConvertFrom-Json)}
} -ThrottleLimit 8)
Assert-Check (@($races|Where-Object Status -eq 201).Count -eq 1 -and @($races|Where-Object Status -eq 409).Count -eq 7) 'Concurrent dictionary type creation must have one success/seven conflicts.'
$race=($races|Where-Object Status -eq 201).Body
Assert-Check ((Request $entryBase 'DELETE' (@{ids=@($first.id,$second.id,$disabled.id,$first.id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Entry batch cleanup failed.'
Assert-Check ((Request $dictBase 'DELETE' (@{ids=@($type.id,$empty.id,$race.id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Type batch cleanup failed.'
Assert-Check ((Invoke-Docker exec $redisName redis-cli exists "sys_dict:$renamed") -eq '0') 'Deleted dictionary Redis state remains.'
Write-Host 'Dictionary CRUD, paging/date filters, duplicate entry/default parity, rename/cache consistency, deletion guards, XLSX, real indexes and concurrent creation passed.'
