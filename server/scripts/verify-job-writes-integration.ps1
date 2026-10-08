# Dot-sourced only by the parent-owned disposable MySQL/Redis/application run.
# Prefix every variable: other integration scripts share this PowerShell scope.
$taskWriteBase='/api/v1/monitor/jobs';$taskWriteMarker="writes-$runId"
$taskWriteOwned=@();$taskWriteUser=$null;$taskWriteRoles=@()
function TaskWrite-Body([string]$suffix,[string]$target='ryTask.ryNoParams') {
    return @{name="$taskWriteMarker-$suffix";group='SYSTEM';invokeTarget=$target;cronExpression='0 0 0 1 1 ? 2099';misfirePolicy='3';concurrent=$false;status='0';remark='Owned task write validation'}
}
function TaskWrite-Create($body,[hashtable]$headers=$authorized) {
    $taskWriteResponse=Request $taskWriteBase 'POST' ($body|ConvertTo-Json -Compress) $headers
    Assert-Check ($taskWriteResponse.StatusCode -eq 201) 'Canonical task creation must return 201.'
    $taskWriteCreated=$taskWriteResponse.Content|ConvertFrom-Json
    Assert-Check ($taskWriteCreated.id -is [string] -and $taskWriteResponse.Headers.Location -eq "$taskWriteBase/$($taskWriteCreated.id)") 'Created task must expose a string identity and Location.'
    return $taskWriteCreated.id
}
function TaskWrite-WaitLog([string]$id,[string]$target) {
    $taskWriteTargetHex=[Convert]::ToHexString([Text.Encoding]::UTF8.GetBytes($target))
    for($taskWriteWait=0;$taskWriteWait -lt 40;$taskWriteWait++) {
        $taskWriteExecuted=Log-Sql "SELECT COUNT(*) FROM sys_job_log WHERE job_name=(SELECT job_name FROM sys_job WHERE job_id=$id) AND invoke_target=CONVERT(0x$taskWriteTargetHex USING utf8mb4) AND status='0';"
        if([long]$taskWriteExecuted -gt 0){break};Start-Sleep -Milliseconds 200
    }
    Assert-Check ([long]$taskWriteExecuted -gt 0) 'Committed task must actually execute successfully through Quartz.'
    $taskWriteLogDetail=(Request "/api/v1/monitor/job-logs?name=$taskWriteMarker" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check (@($taskWriteLogDetail.items|Where-Object invokeTarget -CEQ $target).Count -gt 0) 'Actual execution log must preserve the exact invocation target.'
}
try {
    # This entire schema belongs to the disposable parent. Existing job rows
    # remain unchanged; generated identities now exercise actual bigint HTTP
    # and scheduler keys beyond JavaScript's safe integer range.
    Log-Sql 'ALTER TABLE sys_job AUTO_INCREMENT=9007199254740993;'|Out-Null
    $taskWriteBody=TaskWrite-Body 'original'
    $taskWriteId=TaskWrite-Create $taskWriteBody;$taskWriteOwned+=@($taskWriteId)
    $taskWriteDetail=(Request "$taskWriteBase/$taskWriteId" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ([long]$taskWriteId -ge 9007199254740993 -and $taskWriteDetail.id -ceq $taskWriteId -and (Log-Sql "SELECT CAST(job_id AS CHAR) FROM sys_job WHERE job_id=$taskWriteId;") -ceq $taskWriteId) 'Actual MySQL/generated HTTP/detail/scheduler identity must retain every bigint digit.'
    Assert-Check ($taskWriteDetail.status -eq '1' -and $taskWriteDetail.invokeTarget -ceq 'ryTask.ryNoParams' -and $taskWriteDetail.concurrent -eq $false) 'Creation must preserve original paused default and seed target syntax.'
    $taskWriteWorkbook=Join-Path $logDirectory 'owned-task-bigint.xlsx'
    Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$taskWriteBase/export?name=$($taskWriteBody.name)" -Method POST -Headers $authorized -OutFile $taskWriteWorkbook|Out-Null
    $taskWriteArchive=[IO.Compression.ZipFile]::OpenRead($taskWriteWorkbook)
    try {
        $taskWriteReader=[IO.StreamReader]::new($taskWriteArchive.GetEntry('xl/worksheets/sheet1.xml').Open())
        try {[xml]$taskWriteSheet=$taskWriteReader.ReadToEnd()} finally {$taskWriteReader.Dispose()}
        $taskWriteIdentityCell=$taskWriteSheet.SelectSingleNode("//*[local-name()='sheetData']/*[local-name()='row'][@r='2']/*[local-name()='c'][@r='A2']")
        Assert-Check ($taskWriteIdentityCell.t -eq 'inlineStr' -and $taskWriteIdentityCell.InnerText -ceq $taskWriteId) 'Actual task XLSX must retain every large identity digit as literal text.'
    } finally {$taskWriteArchive.Dispose()}
    Assert-Check ((Log-Sql "SELECT create_by FROM sys_job WHERE job_id=$taskWriteId;") -ceq 'admin') 'Creation actor must come from authentication.'
    Assert-Check ((Request "$taskWriteBase/$taskWriteId/run" 'POST' '' $authorized).StatusCode -eq 202) 'Paused task manual dispatch must be accepted after commit.'
    TaskWrite-WaitLog $taskWriteId $taskWriteBody.invokeTarget
    $taskWriteBody.group='DEFAULT';$taskWriteBody.remark='';$taskWriteBody.concurrent=$true;$taskWriteBody.status='1';$taskWriteBody.misfirePolicy='2'
    $taskWriteBody.invokeTarget="ryTask.ryMultipleParams('中文, O'Brien (data) `${literal}', true, 9007199254740993L, 0x1.8p1D, -7)"
    Assert-Check ((Request "$taskWriteBase/$taskWriteId" 'PUT' ($taskWriteBody|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Canonical full task replacement failed.'
    $taskWriteDetail=(Request "$taskWriteBase/$taskWriteId" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($taskWriteDetail.group -eq 'DEFAULT' -and $taskWriteDetail.remark -ceq '' -and $taskWriteDetail.concurrent -eq $true -and $taskWriteDetail.misfirePolicy -eq '2' -and $taskWriteDetail.invokeTarget -ceq $taskWriteBody.invokeTarget) 'Full task update must retain exact target and clear remark.'
    Assert-Check ((Request "$taskWriteBase/$taskWriteId/run" 'POST' '' $authorized).StatusCode -eq 202) 'Replaced task must be manually runnable.'
    TaskWrite-WaitLog $taskWriteId $taskWriteBody.invokeTarget
    foreach($taskWriteStatus in @('0','1')) {
        Assert-Check ((Request "$taskWriteBase/$taskWriteId/status" 'PUT' (@{status=$taskWriteStatus}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Canonical enable/pause failed.'
        Assert-Check ((Log-Sql "SELECT CONCAT(status,':',misfire_policy,':',job_group,':',update_by) FROM sys_job WHERE job_id=$taskWriteId;") -ceq "${taskWriteStatus}:2:DEFAULT:admin") 'Sparse status write must preserve unrelated configuration and actor.'
    }
    $taskWriteSqlSnapshot="SELECT JSON_OBJECT('id',job_id,'name',job_name,'group',job_group,'target',invoke_target,'cron',cron_expression,'misfire',misfire_policy,'concurrent',concurrent,'status',status,'remark',remark,'actor',update_by,'updated',update_time) FROM sys_job WHERE job_id=$taskWriteId;"
    $taskWriteBefore=Log-Sql $taskWriteSqlSnapshot
    Log-Sql "CREATE TRIGGER owned_canonical_task_fault BEFORE UPDATE ON sys_job FOR EACH ROW SET NEW.job_name=IF(NEW.job_id=$taskWriteId,REPEAT('x',1000),NEW.job_name);"|Out-Null
    try {
        Assert-Problem (Request "$taskWriteBase/$taskWriteId/status" 'PUT' '{"status":"0"}' $authorized) 503 'JOB_SCHEDULE_UNAVAILABLE'
        Assert-Check ((Log-Sql $taskWriteSqlSnapshot) -ceq $taskWriteBefore) 'Real SQL failure must retain complete canonical task state.'
    } finally {Log-Sql 'DROP TRIGGER IF EXISTS owned_canonical_task_fault;'|Out-Null}
    $taskWriteAudit=''
    for($taskWriteWait=0;$taskWriteWait -lt 40;$taskWriteWait++) {
        $taskWriteAudit=Log-Sql "SELECT error_msg FROM sys_oper_log WHERE oper_url='$taskWriteBase/$taskWriteId/status' AND status=1 ORDER BY oper_id DESC LIMIT 1;"
        if($taskWriteAudit){break};Start-Sleep -Milliseconds 100
    }
    Assert-Check ($taskWriteAudit -ceq 'Task scheduling is temporarily unavailable.') 'Canonical failure audit must contain only the safe scheduling error.'
    Assert-Check ((Request "$taskWriteBase/$taskWriteId/status" 'PUT' '{"status":"1"}' $authorized).StatusCode -eq 204) 'Canonical task status retry after SQL recovery failed.'
    $taskWriteExpired=TaskWrite-Body 'expired';$taskWriteExpired.cronExpression='0 0 0 1 1 ? 2020'
    $taskWriteExpiredId=TaskWrite-Create $taskWriteExpired;$taskWriteOwned+=@($taskWriteExpiredId)
    Assert-Problem (Request "$taskWriteBase/$taskWriteExpiredId/run" 'POST' '' $authorized) 409 'JOB_NOT_RUNNABLE'
    # The first delete can succeed inside the transaction before the second
    # owned row encounters a real SQL scalar-subquery failure. Both must return.
    Log-Sql "CREATE TRIGGER owned_canonical_task_delete_fault BEFORE DELETE ON sys_job FOR EACH ROW SET @owned_task_delete=IF(OLD.job_id=$taskWriteExpiredId,(SELECT job_id FROM sys_job LIMIT 2),0);"|Out-Null
    try {
        Assert-Problem (Request $taskWriteBase 'DELETE' (@{ids=@($taskWriteId,$taskWriteExpiredId)}|ConvertTo-Json -Compress) $authorized) 503 'JOB_SCHEDULE_UNAVAILABLE'
        Assert-Check ((Log-Sql "SELECT COUNT(*) FROM sys_job WHERE job_id IN ($taskWriteId,$taskWriteExpiredId);") -eq '2') 'Actual partial SQL batch failure must retain both task rows.'
        Assert-Check ((Request "$taskWriteBase/$taskWriteId/run" 'POST' '' $authorized).StatusCode -eq 202) 'Quartz snapshot must recover the first deleted key after batch SQL rollback.'
    } finally {Log-Sql 'DROP TRIGGER IF EXISTS owned_canonical_task_delete_fault;'|Out-Null}
    Assert-Problem (Request "$taskWriteBase/9223372036854775807" 'PUT' ($taskWriteBody|ConvertTo-Json -Compress) $authorized) 404 'JOB_NOT_FOUND'
    $taskWriteInvalid=TaskWrite-Body 'invalid' 'ryTask.getClass()'
    Assert-Problem (Request $taskWriteBase 'POST' ($taskWriteInvalid|ConvertTo-Json -Compress) $authorized) 400 'JOB_TARGET_INVALID'
    # Real schedule, not just immediate dispatch: enable an owned one-second task.
    $taskWriteAutomatic=TaskWrite-Body 'automatic';$taskWriteAutomatic.cronExpression='*/1 * * * * ?'
    $taskWriteAutomaticId=TaskWrite-Create $taskWriteAutomatic;$taskWriteOwned+=@($taskWriteAutomaticId)
    Assert-Check ((Request "$taskWriteBase/$taskWriteAutomaticId/status" 'PUT' '{"status":"0"}' $authorized).StatusCode -eq 204) 'Automatic task enable failed.'
    TaskWrite-WaitLog $taskWriteAutomaticId $taskWriteAutomatic.invokeTarget
    Assert-Check ((Request "$taskWriteBase/$taskWriteAutomaticId/status" 'PUT' '{"status":"1"}' $authorized).StatusCode -eq 204) 'Automatic task pause failed.'
    # Independent original grants must work without borrowing query/list permission.
    $taskWriteUserBody=@{user=@{username="jw$runId";displayName='Task write permissions';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 6 -Compress
    $taskWriteUserResponse=Request '/api/v1/system/users' 'POST' $taskWriteUserBody $authorized
    Assert-Check ($taskWriteUserResponse.StatusCode -eq 201) 'Owned task writer account creation failed.'
    $taskWriteUser=$taskWriteUserResponse.Content|ConvertFrom-Json
    $taskWriteLogin=Request '/api/v1/auth/login' 'POST' (@{username="jw$runId";password='User12345'}|ConvertTo-Json -Compress)
    $taskWriteHeaders=@{Authorization="Bearer $(($taskWriteLogin.Content|ConvertFrom-Json).accessToken)"}
    foreach($taskWriteDenied in @(@{},$taskWriteHeaders)) {
        $taskWriteDeniedStatus=if($taskWriteDenied.Count){403}else{401};$taskWriteDeniedCode=if($taskWriteDenied.Count){'ACCESS_DENIED'}else{'AUTHENTICATION_REQUIRED'}
        foreach($taskWritePathMethod in @(@($taskWriteBase,'POST'),@("$taskWriteBase/$taskWriteId",'PUT'),@("$taskWriteBase/$taskWriteId/status",'PUT'),@("$taskWriteBase/$taskWriteId/run",'POST'),@($taskWriteBase,'DELETE'))) {
            $taskWriteDeniedBody=if($taskWritePathMethod[0] -like '*/status'){'{"status":"1"}'}elseif($taskWritePathMethod[1] -eq 'DELETE'){@{ids=@($taskWriteId)}|ConvertTo-Json -Compress}elseif($taskWritePathMethod[0] -like '*/run'){''}else{$taskWriteBody|ConvertTo-Json -Compress}
            Assert-Problem (Request $taskWritePathMethod[0] $taskWritePathMethod[1] $taskWriteDeniedBody $taskWriteDenied) $taskWriteDeniedStatus $taskWriteDeniedCode
        }
    }
    $taskWriteMenus=(Request '/api/v1/system/roles/menus' 'GET' '' $authorized).Content|ConvertFrom-Json
    foreach($taskWriteGrant in @('add','edit','changeStatus','remove')) {
        $taskWriteMenu=@($taskWriteMenus|Where-Object permission -EQ "monitor:job:$taskWriteGrant")
        Assert-Check ($taskWriteMenu.Count -eq 1) 'Original task grant must have one stable menu identity.'
        $taskWriteRole=Create-Role "jw$($taskWriteRoles.Count)" @($taskWriteMenu[0].key);$taskWriteRoles+=@($taskWriteRole.id)
        Assert-Check ((Request "/api/v1/system/users/$($taskWriteUser.id)/roles" 'PUT' (@{roleIds=@($taskWriteRole.id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Task writer grant assignment failed.'
        Assert-Problem (Request "$taskWriteBase/$taskWriteId" 'GET' '' $taskWriteHeaders) 403 'ACCESS_DENIED'
        if($taskWriteGrant -in @('add','edit')) {
            Assert-Check ((Request "$taskWriteBase/cron-preview?expression=0%200%200%201%201%20%3F%202099" 'GET' '' $taskWriteHeaders).StatusCode -eq 200) 'Original add/edit grant must independently authorize form Cron preview.'
        }
        switch($taskWriteGrant) {
            'add' {
                $taskWriteBefore=Log-Sql $taskWriteSqlSnapshot
                $taskWriteGrantId=TaskWrite-Create (TaskWrite-Body 'add-only') $taskWriteHeaders;$taskWriteOwned+=@($taskWriteGrantId)
                Assert-Problem (Request "$taskWriteBase/$taskWriteId" 'PUT' ($taskWriteBody|ConvertTo-Json -Compress) $taskWriteHeaders) 403 'ACCESS_DENIED'
                $taskWriteForged=@{jobId=$taskWriteId;jobName="$taskWriteMarker-forged";jobGroup='SYSTEM';invokeTarget='ryTask.ryNoParams';cronExpression='0 0 0 1 1 ? 2099';misfirePolicy='3';concurrent='1';status='1'}
                Assert-Check (((Request '/monitor/job' 'POST' ($taskWriteForged|ConvertTo-Json -Compress) $taskWriteHeaders).Content|ConvertFrom-Json).code -eq 200) 'Legacy add-only creation must remain available.'
                $taskWriteForgedId=Log-Sql "SELECT job_id FROM sys_job WHERE job_name='$taskWriteMarker-forged';";$taskWriteOwned+=@("$taskWriteForgedId")
                Assert-Check ($taskWriteForgedId -and "$taskWriteForgedId" -ne $taskWriteId -and (Log-Sql $taskWriteSqlSnapshot) -ceq $taskWriteBefore) 'Legacy client-supplied ID must not replace an existing task or reuse its identity.'
            }
            'edit' {Assert-Check ((Request "$taskWriteBase/$taskWriteId" 'PUT' ($taskWriteBody|ConvertTo-Json -Compress) $taskWriteHeaders).StatusCode -eq 204) 'Edit-only task update failed.'}
            'changeStatus' {
                Assert-Check ((Request "$taskWriteBase/$taskWriteId/status" 'PUT' '{"status":"1"}' $taskWriteHeaders).StatusCode -eq 204) 'Change-status-only task write failed.'
                Assert-Check ((Request "$taskWriteBase/$taskWriteId/run" 'POST' '' $taskWriteHeaders).StatusCode -eq 202) 'Change-status-only manual dispatch failed.'
            }
            'remove' {Assert-Check ((Request $taskWriteBase 'DELETE' (@{ids=@($taskWriteExpiredId,$taskWriteExpiredId)}|ConvertTo-Json -Compress) $taskWriteHeaders).StatusCode -eq 204) 'Remove-only deduplicated task batch failed.'}
        }
        Assert-Check ((Request "/api/v1/system/users/$($taskWriteUser.id)/roles" 'PUT' '{"roleIds":[]}' $authorized).StatusCode -eq 204) 'Task permission revocation failed.'
        Assert-Problem (Request "$taskWriteBase/$taskWriteId/status" 'PUT' '{"status":"1"}' $taskWriteHeaders) 403 'ACCESS_DENIED'
    }
    Assert-Check ((Request $taskWriteBase 'DELETE' (@{ids=@($taskWriteOwned)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Canonical task batch cleanup failed.'
    Assert-Check ((Request $taskWriteBase 'DELETE' (@{ids=@($taskWriteOwned)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Canonical task deletion must remain idempotent.'
    Assert-Problem (Request "$taskWriteBase/$taskWriteId" 'GET' '' $authorized) 404 'JOB_NOT_FOUND'
    Write-Output 'Canonical task writes: real creation/update/status/manual and automatic execution, exact inert target, SQL rollback/private audit/retry, expired cron, independent original grants, immediate revocation, legacy ID isolation and idempotent batch deletion passed.'
} finally {
    if($taskWriteOwned.Count){Request $taskWriteBase 'DELETE' (@{ids=@($taskWriteOwned)}|ConvertTo-Json -Compress) $authorized|Out-Null}
    if($taskWriteUser){Request '/api/v1/system/users' 'DELETE' (@{ids=@($taskWriteUser.id)}|ConvertTo-Json -Compress) $authorized|Out-Null}
    if($taskWriteRoles.Count){Request '/api/v1/system/roles' 'DELETE' (@{ids=@($taskWriteRoles)}|ConvertTo-Json -Compress) $authorized|Out-Null}
}
