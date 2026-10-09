# Dot-sourced by the owned MySQL/Redis integration runner; no independent cleanup.
$workflowStatusReply = Request '/api/v1/workflow/status' 'GET' '' $authorized
Assert-Check ($workflowStatusReply.StatusCode -eq 200) 'Workflow status must be available to authenticated users.'
Assert-Check ((($workflowStatusReply.Content | ConvertFrom-Json).enabled) -eq $EnableWorkflow.IsPresent) 'Workflow status must reflect the actual engine.'
$workflowXml = Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'workflows/leave-approval/process.bpmn20.xml')
$workflowScenarioList = @('approved','rejected') | ForEach-Object {
    Get-Content -Raw -LiteralPath (Join-Path $repoRoot "workflows/leave-approval/scenarios/$_.json") | ConvertFrom-Json
}
$workflowValidationBody = @{ bpmnXml=$workflowXml; scenarios=@($workflowScenarioList) } | ConvertTo-Json -Depth 10 -Compress
Assert-Problem (Request '/api/v1/workflow/validation' 'POST' $workflowValidationBody) 401 'AUTHENTICATION_REQUIRED'
if (!$EnableWorkflow) {
    Assert-Problem (Request '/api/v1/workflow/validation' 'POST' $workflowValidationBody $authorized) 503 'WORKFLOW_DISABLED'
} else {
    foreach ($workflowRepeat in 1..2) {
        $workflowValidationReply = Request '/api/v1/workflow/validation' 'POST' $workflowValidationBody $authorized
        Assert-Check ($workflowValidationReply.StatusCode -eq 200) 'Actual workflow scenarios must pass.'
        $workflowProof = $workflowValidationReply.Content | ConvertFrom-Json
        $workflowDigest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($workflowXml))).ToLowerInvariant()
        Assert-Check ($workflowProof.processKey -eq 'leaveApproval' -and $workflowProof.sha256 -ceq $workflowDigest) 'Workflow proof must bind the exact source.'
        Assert-Check ($workflowProof.scenarios.Count -eq 2 -and $workflowProof.scenarios[0].endActivity -eq 'approvedEnd' -and $workflowProof.scenarios[1].endActivity -eq 'rejectedEnd') 'Both real engine outcomes must match.'
    }
    $workflowWrongBody = @{bpmnXml=$workflowXml;scenarios=@(@{name='wrong';decisions=@(@{taskKey='review';approved=$false});expectedEnd='approvedEnd'})} | ConvertTo-Json -Depth 10 -Compress
    Assert-Problem (Request '/api/v1/workflow/validation' 'POST' $workflowWrongBody $authorized) 400 'WORKFLOW_SCENARIO_FAILED'
    $workflowUnsafeBody = @{bpmnXml=$workflowXml.Replace('userTask','scriptTask');scenarios=@($workflowScenarioList)} | ConvertTo-Json -Depth 10 -Compress
    Assert-Problem (Request '/api/v1/workflow/validation' 'POST' $workflowUnsafeBody $authorized) 400 'WORKFLOW_INVALID_BPMN'
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE ACT_RU_TASK TO workflow_validation_fault_task;' | Out-Null
    try {
        $workflowFaultReply = Request '/api/v1/workflow/validation' 'POST' $workflowValidationBody $authorized
        Assert-Problem $workflowFaultReply 503 'WORKFLOW_STORAGE_UNAVAILABLE'
        Assert-Check ($workflowFaultReply.Content -notmatch 'ACT_|SELECT|workflow_validation_fault|SQLException') 'Workflow storage failure must not expose SQL details.'
    } finally {
        Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE workflow_validation_fault_task TO ACT_RU_TASK;' | Out-Null
    }
    Assert-Check ((Request '/api/v1/workflow/validation' 'POST' $workflowValidationBody $authorized).StatusCode -eq 200) 'Workflow validation must recover after a storage failure.'
    foreach ($workflowTable in @('ACT_RE_DEPLOYMENT','ACT_RE_PROCDEF','ACT_RU_EXECUTION','ACT_RU_TASK','ACT_HI_PROCINST','ACT_HI_TASKINST')) {
        $workflowRows = Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e "SELECT COUNT(*) FROM $workflowTable;"
        Assert-Check ([long]$workflowRows -eq 0) 'Scenario validation must leave no committed engine state.'
    }
}
Write-Output 'PASS: workflow status, actual scenario outcomes, exact digest, safe rejection and rolled-back engine state.'
