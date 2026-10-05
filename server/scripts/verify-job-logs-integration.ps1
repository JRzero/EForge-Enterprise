# Owned fixture only: real Quartz success/failure logs plus canonical reads, cleanup and preview.
$jobLogBase='/api/v1/monitor/job-logs';$jobMarker="jobs-$runId";$ownedJobs=@();$jobLogUser=$null
try {
    foreach($target in @("ryTask.ryParams('$jobMarker')",'ryTask.missingMethod()')) {
        $name="$jobMarker-$($ownedJobs.Count)"
        $body=@{jobName=$name;jobGroup='SYSTEM';invokeTarget=$target;cronExpression='0 0 0 1 1 ? 2099';misfirePolicy='3';concurrent='1';status='1';remark='Owned validation'}|ConvertTo-Json -Compress
        $created=Request '/monitor/job' 'POST' $body $authorized
        Assert-Check ($created.StatusCode -eq 200 -and ($created.Content|ConvertFrom-Json).code -eq 200) 'Owned legacy Quartz task creation failed.'
        $selected=(Request "/monitor/job/list?jobName=$name" 'GET' '' $authorized).Content|ConvertFrom-Json
        Assert-Check ($selected.rows.Count -eq 1) 'Owned task identity lookup failed.'
        $job=$selected.rows[0];$ownedJobs+=@($job.jobId)
        $run=Request '/monitor/job/run' 'PUT' (@{jobId=$job.jobId;jobGroup='SYSTEM'}|ConvertTo-Json -Compress) $authorized
        Assert-Check ($run.StatusCode -eq 200 -and ($run.Content|ConvertFrom-Json).code -eq 200) 'Real Quartz task dispatch failed.'
    }
    $actual=$null
    for($attempt=0;$attempt -lt 30;$attempt++) {
        $actual=(Request "$jobLogBase`?name=$jobMarker" 'GET' '' $authorized).Content|ConvertFrom-Json
        if($actual.total -eq 2){break};Start-Sleep -Milliseconds 200
    }
    Assert-Check ($actual.total -eq 2 -and @($actual.items|Where-Object status -eq '0').Count -eq 1 -and @($actual.items|Where-Object status -eq '1').Count -eq 1) 'Quartz must produce actual success and failure logs.'
    $failure=@($actual.items|Where-Object status -eq '1')[0]
    $detail=(Request "$jobLogBase/$($failure.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($detail.exceptionInfo.Contains('NoSuchMethodException') -and !$failure.PSObject.Properties['exceptionInfo'] -and $detail.entry.endedAt -and $detail.entry.startedAt) 'Canonical summary/detail boundary must preserve real exception and timestamps.'
    $page=(Request "$jobLogBase`?name=$jobMarker&group=SYSTEM&status=1&invokeTarget=missingMethod&pageSize=1&direction=asc" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($page.total -eq 1 -and $page.items[0].id -eq $failure.id) 'Combined log filtering/paging failed.'
    Assert-Problem (Request "$jobLogBase`?direction=invalid" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
    Assert-Problem (Request "$jobLogBase`?from=2026-10-06&to=2026-10-05" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
    $preview=(Request '/api/v1/monitor/jobs/cron-preview?expression=0%200%209%20%3F%20*%20MON%232' 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($preview.times.Count -eq 5 -and $preview.zone) 'Actual Quartz special-week cron preview failed.'
    $expired=(Request '/api/v1/monitor/jobs/cron-preview?expression=0%200%200%201%201%20%3F%202020' 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($expired.times.Count -eq 0) 'Valid exhausted year must return an empty preview.'
    Assert-Problem (Request '/api/v1/monitor/jobs/cron-preview?expression=invalid' 'GET' '' $authorized) 400 'JOB_CRON_INVALID'
    # Exercise a real checked scheduling failure after SQL UPDATE and old-key deletion.
    # The legacy controller accepts this policy; Quartz rejects it inside the transaction.
    $originalTask=(Request "/monitor/job/$($ownedJobs[0])" 'GET' '' $authorized).Content|ConvertFrom-Json
    $originalTask=$originalTask.data
    $replacement=@{jobId=$originalTask.jobId;jobName=$originalTask.jobName;jobGroup='DEFAULT';invokeTarget="ryTask.ryParams('failed replacement')";cronExpression=$originalTask.cronExpression;misfirePolicy='9';concurrent=$originalTask.concurrent;status=$originalTask.status;remark='Must roll back'}|ConvertTo-Json -Compress
    $failedReplacement=Request '/monitor/job' 'PUT' $replacement $authorized
    Assert-Check (($failedReplacement.Content|ConvertFrom-Json).code -eq 500) 'Real invalid policy must fail inside Quartz scheduling.'
    $retainedTask=((Request "/monitor/job/$($ownedJobs[0])" 'GET' '' $authorized).Content|ConvertFrom-Json).data
    Assert-Check ($retainedTask.jobGroup -eq $originalTask.jobGroup -and $retainedTask.invokeTarget -eq $originalTask.invokeTarget -and $retainedTask.misfirePolicy -eq $originalTask.misfirePolicy -and $retainedTask.status -eq $originalTask.status -and $retainedTask.remark -eq $originalTask.remark) 'MySQL transaction must retain every original task field after scheduling failure.'
    $oldRun=Request '/monitor/job/run' 'PUT' (@{jobId=$originalTask.jobId;jobGroup=$originalTask.jobGroup}|ConvertTo-Json -Compress) $authorized
    Assert-Check (($oldRun.Content|ConvertFrom-Json).code -eq 200) 'Original real Quartz key must remain runnable after failed group replacement.'
    $uncommittedRun=Request '/monitor/job/run' 'PUT' (@{jobId=$originalTask.jobId;jobGroup='DEFAULT'}|ConvertTo-Json -Compress) $authorized
    Assert-Check (($uncommittedRun.Content|ConvertFrom-Json).code -eq 500) 'Attempted replacement key must not survive failed scheduling.'
    $newExecution=@()
    for($attempt=0;$attempt -lt 30;$attempt++) {
        $afterRun=(Request "$jobLogBase`?name=$jobMarker" 'GET' '' $authorized).Content|ConvertFrom-Json
        $newExecution=@($afterRun.items|Where-Object { $_.id -notin $actual.items.id })
        if($newExecution.Count -eq 1){break};Start-Sleep -Milliseconds 200
    }
    Assert-Check ($newExecution.Count -eq 1 -and $newExecution[0].status -eq '0' -and $newExecution[0].invokeTarget -eq $originalTask.invokeTarget) 'Recovered task must actually execute the original target and produce a successful log.'
    Assert-Check ((Request $jobLogBase 'DELETE' (@{ids=@($newExecution[0].id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned recovery execution cleanup failed.'
    Write-Output 'Task replacement: real MySQL checked-exception rollback, original Quartz key/manual execution and failed-key cleanup passed.'
    $file=Join-Path $logDirectory 'owned-job-logs.xlsx'
    Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$jobLogBase/export?name=$jobMarker&pageSize=1" -Method POST -Headers $authorized -OutFile $file|Out-Null
    $archive=[IO.Compression.ZipFile]::OpenRead($file)
    try {
        $reader=[IO.StreamReader]::new($archive.GetEntry('xl/worksheets/sheet1.xml').Open());try{$sheet=$reader.ReadToEnd()}finally{$reader.Dispose()}
        [xml]$xml=$sheet;$rows=@($xml.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']"))
        Assert-Check ($rows.Count -eq 3 -and $sheet.Contains($jobMarker)) 'Job log XLSX must include every filtered row despite pageSize=1.'
    } finally {$archive.Dispose()}
    $username="jl$runId";$userBody=@{user=@{username=$username;displayName='Job log permission';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 6 -Compress
    $createdUser=Request '/api/v1/system/users' 'POST' $userBody $authorized;Assert-Check ($createdUser.StatusCode -eq 201) 'Owned job log reader creation failed.';$jobLogUser=$createdUser.Content|ConvertFrom-Json
    $login=Request '/api/v1/auth/login' 'POST' (@{username=$username;password='User12345'}|ConvertTo-Json -Compress);$denied=@{Authorization="Bearer $(($login.Content|ConvertFrom-Json).accessToken)"}
    foreach($headers in @(@{},$denied)) {
        $expected=if($headers.Count){403}else{401};$code=if($headers.Count){'ACCESS_DENIED'}else{'AUTHENTICATION_REQUIRED'}
        foreach($path in @($jobLogBase,"$jobLogBase/$($failure.id)",'/api/v1/monitor/jobs/cron-preview?expression=0%20*%20*%20*%20*%20%3F')) {Assert-Problem (Request $path 'GET' '' $headers) $expected $code}
        foreach($path in @("$jobLogBase/clear","$jobLogBase/export")) {Assert-Problem (Request $path 'POST' '' $headers) $expected $code}
        Assert-Problem (Request $jobLogBase 'DELETE' (@{ids=@($failure.id)}|ConvertTo-Json -Compress) $headers) $expected $code
    }
    $ids=@($actual.items|ForEach-Object id);$deleteBody=@{ids=$ids}|ConvertTo-Json -Compress
    Log-Sql "CREATE TRIGGER owned_job_log_delete_fault BEFORE DELETE ON sys_job_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned fault';"|Out-Null
    try {
        Assert-Problem (Request $jobLogBase 'DELETE' $deleteBody $authorized) 500 'INTERNAL_ERROR'
        Assert-Check (((Request "$jobLogBase`?name=$jobMarker" 'GET' '' $authorized).Content|ConvertFrom-Json).total -eq 2) 'Failed batch deletion must preserve every log.'
        Assert-Problem (Request "$jobLogBase/clear" 'POST' '' $authorized) 500 'INTERNAL_ERROR'
    } finally {Log-Sql 'DROP TRIGGER owned_job_log_delete_fault;'|Out-Null}
    foreach($repeat in 1..2) {Assert-Check ((Request $jobLogBase 'DELETE' $deleteBody $authorized).StatusCode -eq 204) 'Job log deletion must be idempotent.'}
    Assert-Problem (Request "$jobLogBase/$($failure.id)" 'GET' '' $authorized) 404 'JOB_LOG_NOT_FOUND'
    Log-Sql "INSERT INTO sys_job_log(job_log_id,job_name,job_group,invoke_target,status,create_time) VALUES(939998,'$jobMarker-calendar','SYSTEM','ryTask.ryNoParams()','0','2026-10-01 00:00:00'),(939999,'$jobMarker-calendar','SYSTEM','ryTask.ryNoParams()','0','2026-10-01 23:59:59'),(940000,'$jobMarker-calendar','SYSTEM','ryTask.ryNoParams()','0','2026-10-02 00:00:00');"|Out-Null
    foreach($direction in @('asc','desc')) {
        $calendar=(Request "$jobLogBase`?name=$jobMarker-calendar&from=2026-10-01&to=2026-10-01&direction=$direction&pageSize=1" 'GET' '' $authorized).Content|ConvertFrom-Json
        $first=if($direction -eq 'asc'){'939998'}else{'939999'}
        Assert-Check ($calendar.total -eq 2 -and $calendar.items.Count -eq 1 -and $calendar.items[0].id -eq $first) 'Calendar bounds and time ordering must be applied before pagination.'
    }
    Log-Sql "INSERT INTO sys_job_log(job_log_id,job_name,job_group,invoke_target,status,create_time) VALUES(940001,'$jobMarker-clear','SYSTEM','ryTask.ryNoParams()','0',sysdate());"|Out-Null
    Assert-Check ((Request "$jobLogBase/clear" 'POST' '' $authorized).StatusCode -eq 204) 'Canonical clear failed.'
    Log-Sql "INSERT INTO sys_job_log(job_name,job_group,invoke_target,status,create_time) VALUES('$jobMarker-after','SYSTEM','ryTask.ryNoParams()','0',sysdate());"|Out-Null
    Assert-Check ([long](Log-Sql "SELECT job_log_id FROM sys_job_log WHERE job_name='$jobMarker-after';") -gt 940001) 'Clear must not reuse identifiers selected by a stale client.'
    Write-Output 'Job logs and Cron: actual Quartz success/failure, typed filters/details/paging/XLSX, all permission gates, fault preservation, monotonic clearing and real special/exhausted cron preview passed.'
} finally {
    if($ownedJobs.Count){Request "/monitor/job/$($ownedJobs -join ',')" 'DELETE' '' $authorized|Out-Null}
    if($jobLogUser){Request '/api/v1/system/users' 'DELETE' (@{ids=@($jobLogUser.id)}|ConvertTo-Json -Compress) $authorized|Out-Null}
}
