# Dot-sourced only by the disposable MySQL/Redis/Flowable parent runner.
$purchaseBase='/api/v1/samples/purchases'
Assert-Problem (Request "$purchaseBase`?page=1&pageSize=10" 'GET') 401 'AUTHENTICATION_REQUIRED'
if (!$EnableWorkflow) {
    Assert-Problem (Request "$purchaseBase`?page=1&pageSize=10" 'GET' '' $authorized) 503 'WORKFLOW_DISABLED'
} else {
    function Purchase-Sql([string]$sql) { Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e $sql }
    function Purchase-Command([string]$revision) { return @{commandId=[guid]::NewGuid().ToString();expectedRevision=$revision;comment='采购验证'} }
    $purchaseLeaveBefore=(Request '/api/v1/workflow/activations/leave' 'GET' '' $authorized).Content
    $purchaseSource=@{name='采购单级审批';businessType='purchase';source=@{bpmnXml=(Get-Content (Join-Path $repoRoot 'workflows/purchase-approval/process.bpmn20.xml') -Raw);scenarios=@(@{name='批准';decisions=@(@{taskKey='review';approved=$true});expectedEnd='approvedEnd'},@{name='拒绝';decisions=@(@{taskKey='review';approved=$false});expectedEnd='rejectedEnd'})}}
    $purchasePackageReply=Request '/api/v1/workflow/packages' 'POST' ($purchaseSource|ConvertTo-Json -Depth 8 -Compress) $authorized
    Assert-Check ($purchasePackageReply.StatusCode -eq 201) 'Create actual purchase package.'
    $purchasePackage=$purchasePackageReply.Content|ConvertFrom-Json
    $purchasePackagePath='/api/v1/workflow/packages/'+$purchasePackage.id
    $purchaseRevision=@{expectedRevision=$purchasePackage.revision}|ConvertTo-Json -Compress
    Assert-Check ((Request "$purchasePackagePath/validation" 'POST' $purchaseRevision $authorized).StatusCode -eq 200) 'Actual purchase approve/reject proof.'
    $purchasePublished=Request "$purchasePackagePath/releases" 'POST' $purchaseRevision $authorized
    Assert-Check ($purchasePublished.StatusCode -eq 200) 'Publish actual purchase binding.'
    $purchaseRelease=$purchasePublished.Content|ConvertFrom-Json
    Assert-Check ((Request '/api/v1/workflow/activations/purchase' 'PUT' (@{releaseId=$purchaseRelease.id;expectedRevision='0'}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 200) 'Activate purchase independently.'
    Assert-Check ((Request '/api/v1/workflow/activations/leave' 'GET' '' $authorized).Content -ceq $purchaseLeaveBefore) 'Purchase activation preserves leave activation exactly.'
    $purchaseRoleReply=Request '/api/v1/system/roles' 'POST' (@{name="采购$runId";key="purchase$runId";sort=20;status='0';remark='owned fixture';menuLinked=$false;menuKeys=@('sample-purchases','sample-purchase-approve')}|ConvertTo-Json -Compress) $authorized
    Assert-Check ($purchaseRoleReply.StatusCode -eq 201) 'Create owned purchase approver role.'
    $purchaseRoleId=($purchaseRoleReply.Content|ConvertFrom-Json).id
    $purchaseUsername="purchase$runId"
    $purchaseUserReply=Request '/api/v1/system/users' 'POST' (@{user=@{username=$purchaseUsername;displayName='采购审批测试';departmentId='103';sex='2';status='0';roleIds=@($purchaseRoleId);postIds=@()};password='Purchase123'}|ConvertTo-Json -Depth 6 -Compress) $authorized
    Assert-Check ($purchaseUserReply.StatusCode -eq 201) 'Create actual purchase approver.'
    $purchaseUserId=($purchaseUserReply.Content|ConvertFrom-Json).id
    $purchaseLogin=Request '/api/v1/auth/login' 'POST' (@{username=$purchaseUsername;password='Purchase123'}|ConvertTo-Json -Compress)
    Assert-Check ($purchaseLogin.StatusCode -eq 200) 'Actual purchase approver login.'
    $purchaseAuth=@{Authorization="Bearer $(($purchaseLogin.Content|ConvertFrom-Json).accessToken)"}
    $purchaseOptions=(Request "$purchaseBase/approvers?page=1&pageSize=100" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check (@($purchaseOptions.items|Where-Object id -eq $purchaseUserId).Count -eq 1) 'Only currently authorized approver options.'
    $purchaseContent=@{title='采购真实闭环';reason='办公设备';approverId=$purchaseUserId;items=@(@{id=[guid]::NewGuid().ToString();name='设备一';unit='台';quantity='0.005';unitPrice='1.00'},@{id=[guid]::NewGuid().ToString();name='设备二';unit='台';quantity='0.005';unitPrice='1.00'})}
    $purchaseCreate=@{commandId=[guid]::NewGuid().ToString();content=$purchaseContent}|ConvertTo-Json -Depth 6 -Compress
    Assert-Problem (Request $purchaseBase 'POST' $purchaseCreate $purchaseAuth) 403 'ACCESS_DENIED'
    $purchaseCreated=Request $purchaseBase 'POST' $purchaseCreate $authorized
    Assert-Check ($purchaseCreated.StatusCode -eq 201) 'Create actual purchase draft.'
    $purchaseRow=$purchaseCreated.Content|ConvertFrom-Json
    Assert-Check ($purchaseRow.total -ceq '0.02' -and $purchaseRow.initiatorId -ceq '1' -and $purchaseRow.revision -ceq '1') 'Server actor, exact per-line rounding and revision.'
    Assert-Check ((Request $purchaseBase 'POST' $purchaseCreate $authorized).Content -ceq $purchaseCreated.Content) 'Create command retry preserves identity and exact body.'
    Assert-Problem (Request "$purchaseBase/$($purchaseRow.id)" 'GET' '' $purchaseAuth) 404 'PURCHASE_NOT_FOUND'
    $purchaseSubmit=Purchase-Command '1';$purchaseSubmitJson=$purchaseSubmit|ConvertTo-Json -Compress
    Purchase-Sql "ALTER TABLE ef_purchase_audit ADD CONSTRAINT purchase_http_fault CHECK (action <> 'SUBMIT');" | Out-Null
    try { Assert-Problem (Request "$purchaseBase/$($purchaseRow.id)/submission" 'POST' $purchaseSubmitJson $authorized) 503 'PURCHASE_STORAGE_UNAVAILABLE' }
    finally { Purchase-Sql 'ALTER TABLE ef_purchase_audit DROP CHECK purchase_http_fault;' | Out-Null }
    $purchaseAfterFault=(Request "$purchaseBase/$($purchaseRow.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($purchaseAfterFault.purchase.status -ceq 'DRAFT' -and $purchaseAfterFault.purchase.revision -ceq '1' -and $purchaseAfterFault.history.Count -eq 1) 'Submit audit fault rolls back business and audit.'
    Assert-Check ((Request "$purchaseBase/$($purchaseRow.id)/submission" 'POST' $purchaseSubmitJson $authorized).StatusCode -eq 200) 'Submission retry recovers after SQL fault.'
    $purchasePending=(Request "$purchaseBase`?view=pending&page=1&pageSize=10" 'GET' '' $purchaseAuth).Content|ConvertFrom-Json
    Assert-Check ($purchasePending.total -eq 1 -and $purchasePending.items[0].id -ceq $purchaseRow.id) 'Assigned approver pending page.'
    $purchaseDecision=@{command=(Purchase-Command '2');approved=$true}|ConvertTo-Json -Depth 4 -Compress
    Purchase-Sql "DELETE FROM sys_user_role WHERE user_id=$purchaseUserId AND role_id=$purchaseRoleId;" | Out-Null
    try { Assert-Problem (Request "$purchaseBase/$($purchaseRow.id)/decision" 'POST' $purchaseDecision $purchaseAuth) 403 'ACCESS_DENIED' }
    finally { Purchase-Sql "INSERT INTO sys_user_role(user_id,role_id) VALUES($purchaseUserId,$purchaseRoleId);" | Out-Null }
    $purchaseApproved=Request "$purchaseBase/$($purchaseRow.id)/decision" 'POST' $purchaseDecision $purchaseAuth
    Assert-Check ($purchaseApproved.StatusCode -eq 200 -and ($purchaseApproved.Content|ConvertFrom-Json).status -ceq 'APPROVED') 'Designated approver completes actual engine task.'
    Assert-Check ((Request "$purchaseBase/$($purchaseRow.id)/decision" 'POST' $purchaseDecision $purchaseAuth).Content -ceq $purchaseApproved.Content) 'Approval replay cannot duplicate audit or engine completion.'
    $purchaseFinal=(Request "$purchaseBase/$($purchaseRow.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($purchaseFinal.history.Count -eq 3 -and $purchaseFinal.purchase.total -ceq '0.02') 'Final exact total and three business events.'
    Write-Host 'Purchase HTTP: actual package proof/publication/isolated activation, approver role/login/options, draft privacy, decimal rounding, retry identity, SQL audit rollback/recovery, permission revocation and actual approval passed.'
}
