# Creates a real failed job only inside the parent-owned disposable database, for the browser.
$jobBrowserFixture=$null
if($EnableWorkflow -and $EnableWorkflowAsync -and (!$WebTestPattern -or $WebTestPattern -match 'workflow')){
    $jobBrowserPrevious=(Request '/api/v1/workflow/activations/leave' 'GET' '' $authorized).Content|ConvertFrom-Json
    $jobBrowserFault=$false
    try{
        Assert-Check ((Request '/api/v1/workflow/activations/leave' 'PUT' (@{releaseId=$jobRelease.id;expectedRevision=$jobBrowserPrevious.revision}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 200) 'Activate owned browser async fixture.'
        Job-Sql "ALTER TABLE ACT_RU_TASK ADD CONSTRAINT owned_browser_job_fault CHECK (TASK_DEF_KEY_ <> 'review');"|Out-Null;$jobBrowserFault=$true
        $jobBrowserSubmitted=Request '/api/v1/workflow/leaves' 'POST' (@{submissionId=[guid]::NewGuid().ToString();startDate='2026-11-01';endDate='2026-11-02';reason='浏览器恢复验证'}|ConvertTo-Json -Compress) $authorized
        Assert-Check ($jobBrowserSubmitted.StatusCode -eq 200) 'Submit real browser async fixture.'
        $jobBrowserLeave=$jobBrowserSubmitted.Content|ConvertFrom-Json
        for($jobBrowserAttempt=0;$jobBrowserAttempt -lt 35;$jobBrowserAttempt++){
            Job-Sql "UPDATE ACT_RU_TIMER_JOB SET RETRIES_=1,DUEDATE_=NOW() WHERE PROCESS_INSTANCE_ID_='$($jobBrowserLeave.processId)';"|Out-Null
            $jobBrowserPage=(Request "/api/v1/workflow/releases/$($jobRelease.id)/failed-jobs" 'GET' '' $authorized).Content|ConvertFrom-Json
            $jobBrowserMatch=@($jobBrowserPage.page.items|Where-Object leaveId -eq $jobBrowserLeave.id)
            if($jobBrowserMatch.Count -eq 1){
                $jobBrowserFixture=@{packageId=$jobDraft.id;releaseId=$jobRelease.id;leaveId=$jobBrowserLeave.id;jobId=$jobBrowserMatch[0].id;name='后台恢复验证'}
                break
            }
            Start-Sleep -Seconds 1
        }
        Assert-Check ($null -ne $jobBrowserFixture) 'Official worker creates browser deadletter fixture.'
    }finally{
        if($jobBrowserFault){Job-Sql 'ALTER TABLE ACT_RU_TASK DROP CHECK owned_browser_job_fault;'|Out-Null}
        $jobBrowserCurrent=(Request '/api/v1/workflow/activations/leave' 'GET' '' $authorized).Content|ConvertFrom-Json
        Assert-Check ((Request '/api/v1/workflow/activations/leave' 'PUT' (@{releaseId=$jobBrowserPrevious.releaseId;expectedRevision=$jobBrowserCurrent.revision}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 200) 'Restore activation before browser tests.'
    }
}
$previousEnv['EFORGE_E2E_WORKFLOW_JOB']=[Environment]::GetEnvironmentVariable('EFORGE_E2E_WORKFLOW_JOB','Process')
[Environment]::SetEnvironmentVariable('EFORGE_E2E_WORKFLOW_JOB',$(if($jobBrowserFixture){$jobBrowserFixture|ConvertTo-Json -Compress}else{''}),'Process')
