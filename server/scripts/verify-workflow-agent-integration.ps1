# Called only inside the owning disposable integration runner after the release checks.
if ($EnableWorkflow) {
    $workflowAgentNode = if ($IsWindows) { 'node.exe' } else { 'node' }
    $workflowAgentScript=Join-Path $repoRoot 'scripts/workflow-agent.mjs'
    $workflowAgentOldUrl=[Environment]::GetEnvironmentVariable('EFORGE_WORKFLOW_URL','Process')
    $workflowAgentOldToken=[Environment]::GetEnvironmentVariable('EFORGE_WORKFLOW_TOKEN','Process')
    $workflowAgentFile=Join-Path $logDirectory "workflow-agent-$runId.json"
    function Invoke-WorkflowAgent([string[]]$Arguments,[bool]$Success=$true) {
        $workflowAgentOutput=& $workflowAgentNode $workflowAgentScript @Arguments
        $workflowAgentExit=$LASTEXITCODE
        $workflowAgentResult=$workflowAgentOutput | ConvertFrom-Json
        Assert-Check (($workflowAgentExit -eq 0) -eq $Success) 'Workflow agent exit status mismatch.'
        Assert-Check ($workflowAgentResult.ok -eq $Success) 'Workflow agent structured result mismatch.'
        return $workflowAgentResult
    }
    try {
        [Environment]::SetEnvironmentVariable('EFORGE_WORKFLOW_URL',"http://127.0.0.1:$AppPort",'Process')
        [Environment]::SetEnvironmentVariable('EFORGE_WORKFLOW_TOKEN',($authorized.Authorization -replace '^Bearer ',''),'Process')
        $workflowAgentContent=@{name='Agent审批包';businessType='leave';source=($workflowValidationBody | ConvertFrom-Json)}
        [IO.File]::WriteAllText($workflowAgentFile,($workflowAgentContent | ConvertTo-Json -Depth 12))
        Assert-Check ((Invoke-WorkflowAgent @('status')).data.enabled) 'Workflow agent must use actual enabled status.'
        $workflowAgentCreated=(Invoke-WorkflowAgent @('create','--file',$workflowAgentFile)).data
        $workflowAgentUpdated=(Invoke-WorkflowAgent @('update','--id',$workflowAgentCreated.id,'--revision','1','--file',$workflowAgentFile)).data
        Assert-Check ($workflowAgentUpdated.revision -ceq '2') 'Workflow agent update must preserve version strings.'
        $workflowAgentConflict=Invoke-WorkflowAgent @('update','--id',$workflowAgentCreated.id,'--revision','1','--file',$workflowAgentFile) $false
        Assert-Check ($workflowAgentConflict.status -eq 409 -and $workflowAgentConflict.code -ceq 'WORKFLOW_PACKAGE_CONFLICT') 'Agent must expose safe conflicts without retry.'
        Invoke-WorkflowAgent @('validate','--id',$workflowAgentCreated.id,'--revision','2') | Out-Null
        $workflowAgentPublished=(Invoke-WorkflowAgent @('publish','--id',$workflowAgentCreated.id,'--revision','2')).data
        $workflowAgentReplayed=(Invoke-WorkflowAgent @('publish','--id',$workflowAgentCreated.id,'--revision','2')).data
        Assert-Check ($workflowAgentReplayed.id -ceq $workflowAgentPublished.id) 'Agent publication retry must be idempotent.'
        $workflowAgentComparison=(Invoke-WorkflowAgent @('diff','--id',$workflowAgentCreated.id,'--baseline',$workflowAgentPublished.id)).data
        Assert-Check ($workflowAgentComparison.target.kind -ceq 'DRAFT' -and @($workflowAgentComparison.fields | Where-Object changed).Count -eq 0) 'Actual Agent diff must read the current identical draft without writes.'
        $workflowAgentBefore=(Invoke-WorkflowAgent @('activation')).data
        Assert-Check ($workflowAgentBefore.releaseId -cne $workflowAgentPublished.id) 'Agent publication must not implicitly activate.'
        $workflowAgentActive=(Invoke-WorkflowAgent @('activate','--id',$workflowAgentPublished.id,'--revision',$workflowAgentBefore.revision)).data
        Assert-Check ($workflowAgentActive.releaseId -ceq $workflowAgentPublished.id) 'Explicit agent activation failed.'
        [Environment]::SetEnvironmentVariable('EFORGE_WORKFLOW_TOKEN','owned-invalid-token','Process')
        $workflowAgentDenied=Invoke-WorkflowAgent @('list') $false
        Assert-Check ($workflowAgentDenied.status -eq 401) 'Agent must not bypass API authentication.'
        Write-Output 'PASS: actual Agent canonical create/update/conflict/proof/idempotent publication/explicit activation and invalid-token denial.'
    } finally {
        [Environment]::SetEnvironmentVariable('EFORGE_WORKFLOW_URL',$workflowAgentOldUrl,'Process')
        [Environment]::SetEnvironmentVariable('EFORGE_WORKFLOW_TOKEN',$workflowAgentOldToken,'Process')
        if (Test-Path -LiteralPath $workflowAgentFile) { Remove-Item -LiteralPath $workflowAgentFile }
    }
}
