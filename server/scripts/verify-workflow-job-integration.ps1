# Runs only in the enclosing disposable application/database. Never manipulates deployed jobs.
$jobPlaceholder='00000000-0000-0000-0000-000000000001'
$jobReadPath="/api/v1/workflow/releases/$jobPlaceholder/failed-jobs"
Assert-Problem (Request $jobReadPath) 401 'AUTHENTICATION_REQUIRED'
if(!$EnableWorkflow){
    Assert-Problem (Request $jobReadPath 'GET' '' $authorized) 503 'WORKFLOW_DISABLED'
} else {
    function Job-Sql([string]$sql){Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e $sql}
    $jobPrevious=(Request '/api/v1/workflow/activations/leave' 'GET' '' $authorized).Content|ConvertFrom-Json
    $jobSource=$workflowValidationBody|ConvertFrom-Json
    $jobSource.bpmnXml=$jobSource.bpmnXml.Replace('<userTask id="review"','<userTask flowable:async="true" id="review"')
    $jobDraftReply=Request '/api/v1/workflow/packages' 'POST' (@{name='后台恢复验证';businessType='leave';source=$jobSource}|ConvertTo-Json -Depth 12 -Compress) $authorized
    Assert-Check ($jobDraftReply.StatusCode -eq 201) 'Create actual async package.'
    $jobDraft=$jobDraftReply.Content|ConvertFrom-Json
    Assert-Check ((Request "/api/v1/workflow/packages/$($jobDraft.id)/validation" 'POST' '{"expectedRevision":"1"}' $authorized).StatusCode -eq 200) 'Async proof executes real initial job then rolls back.'
    $jobReleaseReply=Request "/api/v1/workflow/packages/$($jobDraft.id)/releases" 'POST' '{"expectedRevision":"1"}' $authorized
    Assert-Check ($jobReleaseReply.StatusCode -eq 200) 'Publish bounded async package.'
    $jobRelease=$jobReleaseReply.Content|ConvertFrom-Json
    $jobActivation=@{releaseId=$jobRelease.id;expectedRevision=$jobPrevious.revision}|ConvertTo-Json -Compress
    if(!$EnableWorkflowAsync){
        Assert-Problem (Request '/api/v1/workflow/activations/leave' 'PUT' $jobActivation $authorized) 409 'WORKFLOW_ASYNC_DISABLED'
    }else{
        $jobFault=$false;$jobAuditFault=$false;$jobLeave=$null
        try{
            Assert-Check ((Request '/api/v1/workflow/activations/leave' 'PUT' $jobActivation $authorized).StatusCode -eq 200) 'Explicit async activation.'
            Job-Sql "ALTER TABLE ACT_RU_TASK ADD CONSTRAINT owned_workflow_job_fault CHECK (TASK_DEF_KEY_ <> 'review');"|Out-Null;$jobFault=$true
            $jobSubmitted=Request '/api/v1/workflow/leaves' 'POST' (@{submissionId=[guid]::NewGuid().ToString();startDate='2026-11-01';endDate='2026-11-02';reason='实际后台 SQL 故障'}|ConvertTo-Json -Compress) $authorized
            Assert-Check ($jobSubmitted.StatusCode -eq 200) 'Async submission commits business and queued job.'
            $jobLeave=$jobSubmitted.Content|ConvertFrom-Json
            $jobFound=$null
            for($jobAttempt=0;$jobAttempt -lt 35;$jobAttempt++){
                # Test-only bounded wait: shorten this owned failed job's retry delay/count. The
                # official worker still causes the real SQL failure and moves it into deadletter.
                Job-Sql "UPDATE ACT_RU_TIMER_JOB SET RETRIES_=1,DUEDATE_=NOW() WHERE PROCESS_INSTANCE_ID_='$($jobLeave.processId)';"|Out-Null
                $jobPageReply=Request "/api/v1/workflow/releases/$($jobRelease.id)/failed-jobs?page=1&pageSize=1" 'GET' '' $authorized
                Assert-Check ($jobPageReply.StatusCode -eq 200) 'Read safe failed-job page.'
                $jobPage=$jobPageReply.Content|ConvertFrom-Json
                if($jobPage.page.total -eq 1){$jobFound=$jobPage.page.items[0];break}
                Start-Sleep -Seconds 1
            }
            Assert-Check ($null -ne $jobFound -and $jobFound.leaveId -ceq $jobLeave.id -and $jobPage.recoveryEnabled) 'Official background worker must produce one bound deadletter.'
            Assert-Check ($jobPageReply.Content -notmatch 'exception|jdbc|constraint|owned_workflow_job_fault') 'Failure metadata must not reveal SQL or engine exception details.'
            Assert-Check ([int](Job-Sql "SELECT COUNT(*) FROM ACT_RU_TASK WHERE PROC_INST_ID_='$($jobLeave.processId)';") -eq 0) 'Failed transaction leaves no human task.'
            Job-Sql 'ALTER TABLE ACT_RU_TASK DROP CHECK owned_workflow_job_fault;'|Out-Null;$jobFault=$false
            $jobCommand=@{commandId=[guid]::NewGuid().ToString();leaveId=$jobLeave.id}
            $jobRetryPath="/api/v1/workflow/jobs/$($jobFound.id)/retry"
            Job-Sql 'ALTER TABLE ef_workflow_job_audit ADD CONSTRAINT owned_workflow_job_audit_fault CHECK (actor_id <> 1);'|Out-Null;$jobAuditFault=$true
            Assert-Problem (Request $jobRetryPath 'POST' ($jobCommand|ConvertTo-Json -Compress) $authorized) 503 'WORKFLOW_STORAGE_UNAVAILABLE'
            Assert-Check ([int](Job-Sql "SELECT COUNT(*) FROM ACT_RU_DEADLETTER_JOB WHERE ID_='$($jobFound.id)';") -eq 1) 'Audit failure rolls back the requeue.'
            Job-Sql 'ALTER TABLE ef_workflow_job_audit DROP CHECK owned_workflow_job_audit_fault;'|Out-Null;$jobAuditFault=$false
            $jobQueued=Request $jobRetryPath 'POST' ($jobCommand|ConvertTo-Json -Compress) $authorized
            Assert-Check ($jobQueued.StatusCode -eq 202 -and ($jobQueued.Content|ConvertFrom-Json).status -ceq 'QUEUED') 'Recovery acknowledges queueing, not approval.'
            Assert-Check ((Request $jobRetryPath 'POST' ($jobCommand|ConvertTo-Json -Compress) $authorized).Content -ceq $jobQueued.Content) 'Same recovery command is idempotent.'
            $jobOldUrl=$env:EFORGE_WORKFLOW_URL;$jobOldToken=$env:EFORGE_WORKFLOW_TOKEN
            try{
                $env:EFORGE_WORKFLOW_URL="http://127.0.0.1:$AppPort";$env:EFORGE_WORKFLOW_TOKEN=$authorized.Authorization -replace '^Bearer ',''
                $jobAgent=& node (Join-Path $repoRoot 'scripts/workflow-agent.mjs') retry --job $jobFound.id --leave $jobLeave.id --command $jobCommand.commandId
                Assert-Check ($LASTEXITCODE -eq 0 -and ($jobAgent|ConvertFrom-Json).data.queuedJobId -ceq ($jobQueued.Content|ConvertFrom-Json).queuedJobId) 'Actual Agent recovery replays same command without requeue.'
            }finally{$env:EFORGE_WORKFLOW_URL=$jobOldUrl;$env:EFORGE_WORKFLOW_TOKEN=$jobOldToken}
            $jobReady=$false
            for($jobAttempt=0;$jobAttempt -lt 35;$jobAttempt++){
                $jobDetail=(Request "/api/v1/workflow/leaves/$($jobLeave.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
                if($jobDetail.tasks.Count -eq 1){$jobReady=$true;break};Start-Sleep -Seconds 1
            }
            Assert-Check ($jobReady -and $jobDetail.leave.status -ceq 'PENDING' -and $jobDetail.history.Count -eq 1) 'Recovered background worker creates exactly one pending task without approval.'
            Assert-Check ([int](Job-Sql "SELECT COUNT(*) FROM ef_workflow_job_audit WHERE leave_id='$($jobLeave.id)';") -eq 1) 'Recovery audit commits exactly once.'
        }finally{
            if($jobFault){Job-Sql 'ALTER TABLE ACT_RU_TASK DROP CHECK owned_workflow_job_fault;'|Out-Null}
            if($jobAuditFault){Job-Sql 'ALTER TABLE ef_workflow_job_audit DROP CHECK owned_workflow_job_audit_fault;'|Out-Null}
            if($jobLeave){Request "/api/v1/workflow/leaves/$($jobLeave.id)/withdrawal" 'POST' (@{commandId=[guid]::NewGuid().ToString();expectedRevision='1';comment='owned fixture cleanup'}|ConvertTo-Json -Compress) $authorized|Out-Null}
            $jobCurrent=(Request '/api/v1/workflow/activations/leave' 'GET' '' $authorized).Content|ConvertFrom-Json
            if($jobPrevious.releaseId){Assert-Check ((Request '/api/v1/workflow/activations/leave' 'PUT' (@{releaseId=$jobPrevious.releaseId;expectedRevision=$jobCurrent.revision}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 200) 'Restore previous fixture activation.'}
        }
    }
}
Write-Output 'PASS: workflow jobs permission/defaults, bounded async SQL failure, safe metadata, audit rollback, idempotent HTTP/Agent recovery and pending human task.'
