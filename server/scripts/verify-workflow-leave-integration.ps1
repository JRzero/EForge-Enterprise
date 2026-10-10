# Only runs in the parent-owned disposable database. Every helper/variable has a leave prefix.
$leaveBase='/api/v1/workflow/leaves'
$leaveSubmit=@{submissionId=[guid]::NewGuid().ToString();startDate='2026-11-01';endDate='2026-11-02';reason='真实请假审批'}
$leaveSubmitJson=$leaveSubmit | ConvertTo-Json -Compress
Assert-Problem (Request $leaveBase 'POST' $leaveSubmitJson) 401 'AUTHENTICATION_REQUIRED'
if (!$EnableWorkflow) {
    Assert-Problem (Request $leaveBase 'POST' $leaveSubmitJson $authorized) 503 'WORKFLOW_DISABLED'
} else {
    function Leave-Sql([string]$sql) { Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e $sql }
    function Leave-Command([string]$revision,[string]$task='') {
        $leaveCommand=@{commandId=[guid]::NewGuid().ToString();expectedRevision=$revision;comment='审批验证'}
        if ($task) {$leaveCommand.taskId=$task}
        return $leaveCommand
    }
    $leaveRoleId=$null;$leaveUserId=$null;$leaveAuth=$null
    try {
        # Test-only function permissions: no fake navigation routes, no grants to the built-in role.
        Leave-Sql "INSERT INTO sys_menu(menu_name,parent_id,order_num,menu_type,visible,status,perms,menu_key) VALUES ('Leave fixture list',0,0,'F','0','0','workflow:task:list','leave-test-list-$runId'),('Leave fixture handle',0,0,'F','0','0','workflow:task:handle','leave-test-handle-$runId');" | Out-Null
        $leaveRoleBody=@{name="请假审批$runId";key="leave$runId";sort=20;status='0';remark='owned fixture';menuLinked=$false;menuKeys=@("leave-test-list-$runId","leave-test-handle-$runId")}
        $leaveRoleReply=Request '/api/v1/system/roles' 'POST' ($leaveRoleBody|ConvertTo-Json -Compress) $authorized
        Assert-Check ($leaveRoleReply.StatusCode -eq 201) 'Create owned leave permission role.'
        $leaveRoleId=($leaveRoleReply.Content|ConvertFrom-Json).id
        $leaveUsername="leave$runId"
        $leaveUserReply=Request '/api/v1/system/users' 'POST' (@{user=@{username=$leaveUsername;displayName='审批测试';departmentId='103';sex='2';status='0';roleIds=@('2',$leaveRoleId);postIds=@()};password='Workflow123'}|ConvertTo-Json -Depth 6 -Compress) $authorized
        Assert-Check ($leaveUserReply.StatusCode -eq 201) 'Create owned leave approver.'
        $leaveUserId=($leaveUserReply.Content|ConvertFrom-Json).id
        $leaveSigned=Request '/api/v1/auth/login' 'POST' (@{username=$leaveUsername;password='Workflow123'}|ConvertTo-Json -Compress)
        Assert-Check ($leaveSigned.StatusCode -eq 200) 'Actual approver login.'
        $leaveAuth=@{Authorization="Bearer $(($leaveSigned.Content|ConvertFrom-Json).accessToken)"}
        Assert-Problem (Request $leaveBase 'POST' $leaveSubmitJson $leaveAuth) 403 'ACCESS_DENIED'
        $leaveCreated=Request $leaveBase 'POST' $leaveSubmitJson $authorized
        Assert-Check ($leaveCreated.StatusCode -eq 200) 'Create actual leave/process atomically.'
        $leaveRow=$leaveCreated.Content|ConvertFrom-Json
        Assert-Check ($leaveRow.initiatorId -ceq '1' -and $leaveRow.revision -ceq '1' -and $leaveRow.status -ceq 'PENDING') 'Authenticated actor and exact leave revision.'
        Assert-Check ((Request $leaveBase 'POST' $leaveSubmitJson $authorized).Content -ceq $leaveCreated.Content) 'Submission replay must preserve the original entity.'
        $leaveSubmit.reason='changed'
        Assert-Problem (Request $leaveBase 'POST' ($leaveSubmit|ConvertTo-Json -Compress) $authorized) 409 'WORKFLOW_LEAVE_CONFLICT'
        $leavePending=(Request "$leaveBase/pending?page=1&pageSize=1" 'GET' '' $leaveAuth).Content|ConvertFrom-Json
        Assert-Check ($leavePending.total -eq 1 -and $leavePending.items[0].canHandle) 'Actual candidate role query before paging.'
        $leaveTask=$leavePending.items[0].task.id
        $leaveClaim=Leave-Command '1' $leaveTask
        $leaveClaimJson=$leaveClaim|ConvertTo-Json -Compress
        Assert-Check ((Request "$leaveBase/$($leaveRow.id)/claim" 'POST' $leaveClaimJson $leaveAuth).StatusCode -eq 200) 'Candidate claim.'
        Assert-Check (((Request "$leaveBase/$($leaveRow.id)/claim" 'POST' $leaveClaimJson $leaveAuth).Content|ConvertFrom-Json).revision -ceq '2') 'Claim retry cannot increment twice.'
        $leaveDecision=@{command=(Leave-Command '2' $leaveTask);approved=$true}|ConvertTo-Json -Depth 5 -Compress
        Leave-Sql "DELETE FROM sys_user_role WHERE user_id=$leaveUserId AND role_id=2;" | Out-Null
        try {
            Assert-Problem (Request "$leaveBase/$($leaveRow.id)/decision" 'POST' $leaveDecision $leaveAuth) 403 'WORKFLOW_TASK_FORBIDDEN'
            $leaveRevoked=(Request "$leaveBase/$($leaveRow.id)" 'GET' '' $leaveAuth).Content|ConvertFrom-Json
            Assert-Check ($leaveRevoked.tasks.Count -eq 1 -and !$leaveRevoked.tasks[0].canHandle) 'Historical participant reads must refresh current task capability.'
        }
        finally { Leave-Sql "INSERT INTO sys_user_role(user_id,role_id) VALUES($leaveUserId,2);" | Out-Null }
        Leave-Sql 'ALTER TABLE ef_workflow_leave_audit ADD CONSTRAINT leave_http_audit_fault CHECK (action <> ''APPROVE'');' | Out-Null
        try { Assert-Problem (Request "$leaveBase/$($leaveRow.id)/decision" 'POST' $leaveDecision $leaveAuth) 503 'WORKFLOW_STORAGE_UNAVAILABLE' }
        finally { Leave-Sql 'ALTER TABLE ef_workflow_leave_audit DROP CHECK leave_http_audit_fault;' | Out-Null }
        $leaveAfterFault=(Request "$leaveBase/$($leaveRow.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
        Assert-Check ($leaveAfterFault.leave.revision -ceq '2' -and $leaveAfterFault.tasks.Count -eq 1) 'HTTP audit fault rolls back both task completion and business revision.'
        $leaveApproved=Request "$leaveBase/$($leaveRow.id)/decision" 'POST' $leaveDecision $leaveAuth
        Assert-Check ($leaveApproved.StatusCode -eq 200 -and ($leaveApproved.Content|ConvertFrom-Json).status -ceq 'APPROVED') 'Actual engine approval after recovery.'
        Assert-Check ((Request "$leaveBase/$($leaveRow.id)/decision" 'POST' $leaveDecision $leaveAuth).Content -ceq $leaveApproved.Content) 'Decision replay must not run twice.'
        $leaveHistory=(Request "$leaveBase/$($leaveRow.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
        Assert-Check (($leaveHistory.history.action -join ',') -ceq 'SUBMIT,CLAIM,APPROVE') 'Business history must preserve actual actor/action order.'
        Assert-Check (((Request "$leaveBase/handled" 'GET' '' $leaveAuth).Content|ConvertFrom-Json).total -eq 1) 'Handled query isolates current actor.'
        Assert-Check (((Request "$leaveBase/pending" 'GET' '' $leaveAuth).Content|ConvertFrom-Json).total -eq 0) 'Completed task leaves pending list.'
        foreach ($leaveOutcome in @('REJECTED','WITHDRAWN')) {
            $leaveSubmit.submissionId=[guid]::NewGuid().ToString();$leaveSubmit.reason=$leaveOutcome
            $leaveNext=(Request $leaveBase 'POST' ($leaveSubmit|ConvertTo-Json -Compress) $authorized).Content|ConvertFrom-Json
            if ($leaveOutcome -eq 'WITHDRAWN') {
                $leaveResult=Request "$leaveBase/$($leaveNext.id)/withdrawal" 'POST' ((Leave-Command '1')|ConvertTo-Json -Compress) $authorized
            } else {
                $leaveNextDetail=(Request "$leaveBase/$($leaveNext.id)" 'GET' '' $leaveAuth).Content|ConvertFrom-Json
                $leaveNextTask=$leaveNextDetail.tasks[0].id
                Assert-Check ((Request "$leaveBase/$($leaveNext.id)/claim" 'POST' ((Leave-Command '1' $leaveNextTask)|ConvertTo-Json -Compress) $leaveAuth).StatusCode -eq 200) 'Second actual task claim.'
                $leaveResult=Request "$leaveBase/$($leaveNext.id)/decision" 'POST' (@{command=(Leave-Command '2' $leaveNextTask);approved=$false}|ConvertTo-Json -Depth 5 -Compress) $leaveAuth
            }
            Assert-Check ($leaveResult.StatusCode -eq 200 -and ($leaveResult.Content|ConvertFrom-Json).status -ceq $leaveOutcome) 'Actual reject/withdraw outcome.'
        }
        Assert-Check ([int](Leave-Sql 'SELECT COUNT(*) FROM ACT_RU_TASK;') -eq 0) 'Terminal leave requests retain no runtime tasks.'
        Write-Output 'PASS: actual HTTP leave submission/replay, role candidate claim, revocation, audit rollback/recovery, approve/reject/withdraw and ordered history.'
    } finally {
        if ($leaveAuth) {Request '/logout' 'POST' '' $leaveAuth|Out-Null}
        if ($leaveUserId) {Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($leaveUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Remove owned leave user.'}
        if ($leaveRoleId) {Assert-Check ((Request '/api/v1/system/roles' 'DELETE' (@{ids=@($leaveRoleId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Remove owned leave role.'}
        Leave-Sql "DELETE FROM sys_menu WHERE menu_key IN ('leave-test-list-$runId','leave-test-handle-$runId');"|Out-Null
    }
}
