# Uses only the enclosing runner's disposable database and authenticated session.
if (!$EnableWorkflow) {
    Assert-Problem (Request '/api/v1/workflow/packages' 'GET' '' $authorized) 503 'WORKFLOW_DISABLED'
} else {
    $workflowPackageContent = @{name='请假审批包';businessType='leave';source=($workflowValidationBody | ConvertFrom-Json)}
    $workflowPackageCreate = Request '/api/v1/workflow/packages' 'POST' ($workflowPackageContent | ConvertTo-Json -Depth 12 -Compress) $authorized
    Assert-Check ($workflowPackageCreate.StatusCode -eq 201) 'Workflow package creation failed.'
    $workflowPackage = $workflowPackageCreate.Content | ConvertFrom-Json
    $workflowPackageId = $workflowPackage.id
    Assert-Check ($workflowPackageId -cmatch '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' -and $workflowPackage.revision -is [string] -and $workflowPackage.revision -ceq '1') 'Package identity and exact string revision are required.'
    $workflowPackagePath = '/api/v1/workflow/packages/'+$workflowPackageId
    Assert-Check ($workflowPackage.source.bpmnXml -ceq $workflowXml) 'Draft must preserve exact BPMN source.'
    $workflowPackageValidated = Request ($workflowPackagePath+'/validation') 'POST' '{"expectedRevision":"1"}' $authorized
    Assert-Check ($workflowPackageValidated.StatusCode -eq 200) 'Stored real workflow scenarios must pass.'
    $workflowPackageProof = $workflowPackageValidated.Content | ConvertFrom-Json
    Assert-Check ($workflowPackageProof.validatedRevision -ceq '1' -and !$workflowPackageProof.PSObject.Properties['source']) 'Validation result must bind revision without disclosing source.'
    $workflowPackageContent.name='更新后的请假审批包'
    $workflowPackageUpdateBody=@{expectedRevision='1';content=$workflowPackageContent} | ConvertTo-Json -Depth 12 -Compress
    $workflowPackageUpdated=Request $workflowPackagePath 'PUT' $workflowPackageUpdateBody $authorized
    Assert-Check ($workflowPackageUpdated.StatusCode -eq 200) 'Package update failed.'
    $workflowPackageAfter=$workflowPackageUpdated.Content | ConvertFrom-Json
    Assert-Check ($workflowPackageAfter.revision -ceq '2' -and $null -eq $workflowPackageAfter.validatedRevision -and $workflowPackageAfter.contentDigest -cne $workflowPackage.contentDigest) 'Any edit must invalidate old proof and advance its content digest.'
    Assert-Problem (Request $workflowPackagePath 'PUT' $workflowPackageUpdateBody $authorized) 409 'WORKFLOW_PACKAGE_CONFLICT'
    Assert-Problem (Request ($workflowPackagePath+'/validation') 'POST' '{"expectedRevision":"1"}' $authorized) 409 'WORKFLOW_PACKAGE_CONFLICT'
    $workflowPackageBeforeFault=(Request $workflowPackagePath 'GET' '' $authorized).Content
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE ef_workflow_package_audit TO workflow_package_fault_audit;' | Out-Null
    try {
        $workflowPackageRetryBody=@{expectedRevision='2';content=$workflowPackageContent} | ConvertTo-Json -Depth 12 -Compress
        Assert-Problem (Request $workflowPackagePath 'PUT' $workflowPackageRetryBody $authorized) 503 'WORKFLOW_STORAGE_UNAVAILABLE'
    } finally {
        Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE workflow_package_fault_audit TO ef_workflow_package_audit;' | Out-Null
    }
    Assert-Check ((Request $workflowPackagePath 'GET' '' $authorized).Content -ceq $workflowPackageBeforeFault) 'Audit failure must roll back the entire draft write.'
    Assert-Check ((Request $workflowPackagePath 'PUT' $workflowPackageRetryBody $authorized).StatusCode -eq 200) 'Draft write must recover after audit storage is restored.'
    $workflowPackagePage=(Request '/api/v1/workflow/packages?page=1&pageSize=10' 'GET' '' $authorized).Content | ConvertFrom-Json
    Assert-Check ($workflowPackagePage.total -eq 1 -and $workflowPackagePage.items[0].revision -ceq '3' -and !$workflowPackagePage.items[0].PSObject.Properties['source']) 'Package list must use safe paged summaries.'
    $workflowPackageActor=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e "SELECT COUNT(*) FROM ef_workflow_package_audit WHERE package_id='$workflowPackageId' AND actor_id='1';"
    Assert-Check ([int]$workflowPackageActor -eq 4) 'Package changes and successful validation must have exact authenticated audit records.'
}
# No-role account is created and removed through the real authorized identity API.
$workflowReaderName='wf'+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$workflowReaderCreated=Request '/api/v1/system/users' 'POST' (@{user=@{username=$workflowReaderName;displayName='流程权限验证';departmentId='103';sex='2';status='0';roleIds=@();postIds=@()};password='Workflow123'} | ConvertTo-Json -Depth 6 -Compress) $authorized
Assert-Check ($workflowReaderCreated.StatusCode -eq 201) 'Owned workflow reader fixture creation failed.'
$workflowReaderId=($workflowReaderCreated.Content | ConvertFrom-Json).id
try {
    $workflowReaderLogin=Request '/api/v1/auth/login' 'POST' (@{username=$workflowReaderName;password='Workflow123'} | ConvertTo-Json -Compress)
    Assert-Check ($workflowReaderLogin.StatusCode -eq 200) 'Owned no-role account must authenticate.'
    $workflowReaderHeaders=@{Authorization='Bearer '+(($workflowReaderLogin.Content | ConvertFrom-Json).accessToken)}
    Assert-Check ((Request '/api/v1/workflow/status' 'GET' '' $workflowReaderHeaders).StatusCode -eq 200) 'Authenticated status does not grant workflow maintenance.'
    Assert-Problem (Request '/api/v1/workflow/packages' 'GET' '' $workflowReaderHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/workflow/packages/00000000-0000-0000-0000-000000000001/comparison?baselineReleaseId=00000000-0000-0000-0000-000000000002' 'GET' '' $workflowReaderHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/workflow/validation' 'POST' $workflowValidationBody $workflowReaderHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/workflow/activations/leave' 'GET' '' $workflowReaderHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/workflow/packages/00000000-0000-0000-0000-000000000001/releases' 'POST' '{"expectedRevision":"1"}' $workflowReaderHeaders) 403 'ACCESS_DENIED'
    Assert-Problem (Request '/api/v1/workflow/activations/leave' 'PUT' '{"releaseId":"00000000-0000-0000-0000-000000000001","expectedRevision":"0"}' $workflowReaderHeaders) 403 'ACCESS_DENIED'
} finally {
    Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($workflowReaderId)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned workflow identity cleanup failed.'
}
Write-Output 'PASS: workflow package exact source/revision, real scenarios, stale proof rejection, atomic audit rollback/retry and no-role denial.'
