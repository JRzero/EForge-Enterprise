# Continues the enclosing runner's owned package fixture, never a deployed application database.
$workflowActivationPath='/api/v1/workflow/activations/leave'
if (!$EnableWorkflow) {
    Assert-Problem (Request $workflowActivationPath 'GET' '' $authorized) 503 'WORKFLOW_DISABLED'
} else {
    $workflowPublicationPath=$workflowPackagePath+'/releases'
    Assert-Problem (Request $workflowPublicationPath 'POST' '{"expectedRevision":"3"}' $authorized) 409 'WORKFLOW_PROOF_REQUIRED'
    Assert-Check ((Request ($workflowPackagePath+'/validation') 'POST' '{"expectedRevision":"3"}' $authorized).StatusCode -eq 200) 'Current publication source needs actual proof.'
    $workflowPublishedReply=Request $workflowPublicationPath 'POST' '{"expectedRevision":"3"}' $authorized
    Assert-Check ($workflowPublishedReply.StatusCode -eq 200) 'Actual engine publication failed.'
    $workflowRelease=$workflowPublishedReply.Content | ConvertFrom-Json
    Assert-Check ($workflowRelease.packageRevision -ceq '3' -and $workflowRelease.processDefinitionId -and !$workflowRelease.PSObject.Properties['source']) 'Publication must return exact revision and safe immutable reference.'
    Assert-Check ((Request $workflowPublicationPath 'POST' '{"expectedRevision":"3"}' $authorized).Content -ceq $workflowPublishedReply.Content) 'Same version publication must return the identical release.'
    Assert-Check (((Request $workflowActivationPath 'GET' '' $authorized).Content | ConvertFrom-Json).revision -ceq '0') 'Publication must not implicitly activate.'
    $workflowActivationBody=@{releaseId=$workflowRelease.id;expectedRevision='0'} | ConvertTo-Json -Compress
    Assert-Check ((Request $workflowActivationPath 'PUT' $workflowActivationBody $authorized).StatusCode -eq 200) 'Explicit activation failed.'
    Assert-Problem (Request $workflowActivationPath 'PUT' $workflowActivationBody $authorized) 409 'WORKFLOW_RELEASE_CONFLICT'
    $workflowPackageContent.name='新发布版本'
    Assert-Check ((Request $workflowPackagePath 'PUT' (@{expectedRevision='3';content=$workflowPackageContent} | ConvertTo-Json -Depth 12 -Compress) $authorized).StatusCode -eq 200) 'New publication draft version failed.'
    Assert-Check ((Request $workflowPublicationPath 'POST' '{"expectedRevision":"3"}' $authorized).Content -ceq $workflowPublishedReply.Content) 'Old successful version retry must survive later draft edits.'
    Assert-Check ((Request ($workflowPackagePath+'/validation') 'POST' '{"expectedRevision":"4"}' $authorized).StatusCode -eq 200) 'Updated release proof failed.'
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE ef_workflow_release_audit TO workflow_release_fault_audit;' | Out-Null
    try {
        Assert-Problem (Request $workflowPublicationPath 'POST' '{"expectedRevision":"4"}' $authorized) 503 'WORKFLOW_STORAGE_UNAVAILABLE'
        Assert-Problem (Request $workflowActivationPath 'PUT' (@{releaseId=$workflowRelease.id;expectedRevision='1'} | ConvertTo-Json -Compress) $authorized) 503 'WORKFLOW_STORAGE_UNAVAILABLE'
        Assert-Check (((Request $workflowActivationPath 'GET' '' $authorized).Content | ConvertFrom-Json).revision -ceq '1') 'Failed activation audit must retain the previous selection and revision.'
    }
    finally { Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'RENAME TABLE workflow_release_fault_audit TO ef_workflow_release_audit;' | Out-Null }
    $workflowDeploymentCount=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e 'SELECT COUNT(*) FROM ACT_RE_DEPLOYMENT;'
    Assert-Check ([int]$workflowDeploymentCount -eq 1) 'Failed publication audit must roll back the actual engine deployment.'
    $workflowReleaseNextReply=Request $workflowPublicationPath 'POST' '{"expectedRevision":"4"}' $authorized
    Assert-Check ($workflowReleaseNextReply.StatusCode -eq 200) 'Publication must recover after SQL audit fault.'
    $workflowReleaseNext=$workflowReleaseNextReply.Content | ConvertFrom-Json
    Assert-Check ($workflowReleaseNext.id -ne $workflowRelease.id -and $workflowReleaseNext.processDefinitionId -ne $workflowRelease.processDefinitionId) 'New publication must have an immutable new definition.'
    Assert-Check (((Request $workflowActivationPath 'GET' '' $authorized).Content | ConvertFrom-Json).releaseId -ceq $workflowRelease.id) 'New release must preserve the active version until explicit activation.'
    $workflowReleasePage=(Request ($workflowPublicationPath+'?page=1&pageSize=1') 'GET' '' $authorized).Content | ConvertFrom-Json
    Assert-Check ($workflowReleasePage.total -eq 2 -and $workflowReleasePage.items.Count -eq 1 -and $workflowReleasePage.items[0].id -ceq $workflowReleaseNext.id) 'Release page must order immutable revisions before pagination.'
    Assert-Check ((Request ('/api/v1/workflow/releases/'+$workflowRelease.id) 'GET' '' $authorized).Content -ceq $workflowPublishedReply.Content) 'Old publication must remain exactly unchanged.'
}
Write-Output 'PASS: workflow publication/proof/idempotency, explicit CAS activation, immutable release paging, real deployment rollback and recovery.'
