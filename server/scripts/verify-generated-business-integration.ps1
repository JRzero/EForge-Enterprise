# Runs only inside the parent-owned actual Boot/MySQL/Redis integration environment.
$generatedDeployUserId=$null
$generatedDeployRoleId=$null
$generatedDeployMenuId=$null
$generatedDeployPreviousToken=[Environment]::GetEnvironmentVariable('EFORGE_GENERATED_CLIENT_TOKEN','Process')
try {
    $generatedDeployUser=@{username="gen_nr_$runId";displayName='Generated no-role';departmentId='103';email='';phone='';sex='2';status='0';remark='owned generated deployment';roleIds=@();postIds=@()}
    $generatedDeployCreateUser=Request '/api/v1/system/users' 'POST' (@{user=$generatedDeployUser;password='admin123'}|ConvertTo-Json -Depth 8 -Compress) $authorized
    Assert-Check ($generatedDeployCreateUser.StatusCode -eq 201) 'Owned no-role deployment user creation failed.'
    $generatedDeployUserId=($generatedDeployCreateUser.Content|ConvertFrom-Json).id
    $generatedDeployNoRoleLogin=Request '/api/v1/auth/login' 'POST' (@{username=$generatedDeployUser.username;password='admin123'}|ConvertTo-Json -Compress)
    Assert-Check ($generatedDeployNoRoleLogin.StatusCode -eq 200) 'Actual no-role deployment login failed.'
    $generatedDeployNoRoleHeaders=@{Authorization='Bearer '+($generatedDeployNoRoleLogin.Content|ConvertFrom-Json).accessToken}
    $generatedDeployActorLogin=Request '/api/v1/auth/login' 'POST' $credentials
    Assert-Check ($generatedDeployActorLogin.StatusCode -eq 200) 'Actual generated actor login failed.'
    $generatedDeployActorToken=($generatedDeployActorLogin.Content|ConvertFrom-Json).accessToken
    $generatedDeployActorHeaders=@{Authorization="Bearer $generatedDeployActorToken"}
    $generatedDeployContract=(Request '/v3/api-docs/api-v1' 'GET' '' $generatedDeployActorHeaders).Content
    $generatedDeployContractPath=Join-Path $generatedBusinessDirectory 'actual-boot-openapi.json'
    [IO.File]::WriteAllText($generatedDeployContractPath,$generatedDeployContract,[Text.UTF8Encoding]::new($false))
    $generatedDeploySpec=$generatedDeployContract|ConvertFrom-Json -AsHashtable
    foreach($generatedDeployCategory in @('crud','tree','sub')) {
        $generatedDeployRoute="/api/v1/business/fixture/$generatedDeployCategory"
        Assert-Problem (Request "$generatedDeployRoute/9007199254740995") 401 'AUTHENTICATION_REQUIRED'
        Assert-Problem (Request "$generatedDeployRoute/9007199254740995" 'GET' '' $generatedDeployNoRoleHeaders) 403 'ACCESS_DENIED'
        Assert-Check ($generatedDeploySpec.paths.ContainsKey($generatedDeployRoute)) 'Installed generated module is missing from actual Boot canonical OpenAPI.'
        $generatedDeployInput=@{oRderKey='9007199254740995';label='部署中文';parentId='0';amount='9007199254740993.00001'}
        if($generatedDeployCategory -eq 'sub'){$generatedDeployInput.fixtureLineList=@(@{label='部署子表';ownerReference='1'})}
        $generatedDeployCreated=Request $generatedDeployRoute 'POST' ($generatedDeployInput|ConvertTo-Json -Depth 8 -Compress) $generatedDeployActorHeaders
        Assert-Check ($generatedDeployCreated.StatusCode -eq 201) 'Actual Boot generated create failed.'
        Assert-Check (($generatedDeployCreated.Content|ConvertFrom-Json).oRderKey -ceq '9007199254740995') 'Actual Boot generated ID lost precision.'
        $generatedDeployWorkbook=Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$generatedDeployRoute/export" -Method POST -Headers $generatedDeployActorHeaders -SkipHttpErrorCheck
        Assert-Check ($generatedDeployWorkbook.StatusCode -eq 200 -and $generatedDeployWorkbook.Content -is [byte[]]) 'Installed generated export must return an actual workbook.'
        $generatedDeployWorkbookStream=[IO.MemoryStream]::new([byte[]]$generatedDeployWorkbook.Content)
        $generatedDeployWorkbookZip=[IO.Compression.ZipArchive]::new($generatedDeployWorkbookStream,[IO.Compression.ZipArchiveMode]::Read)
        try {
            $generatedDeployWorkbookReader=[IO.StreamReader]::new($generatedDeployWorkbookZip.GetEntry('xl/worksheets/sheet1.xml').Open())
            try{$generatedDeployWorkbookXml=[xml]$generatedDeployWorkbookReader.ReadToEnd()}finally{$generatedDeployWorkbookReader.Dispose()}
            $generatedDeployWorkbookNs=[Xml.XmlNamespaceManager]::new($generatedDeployWorkbookXml.NameTable);$generatedDeployWorkbookNs.AddNamespace('s','http://schemas.openxmlformats.org/spreadsheetml/2006/main')
            $generatedDeployExactIdentity=$false
            foreach($generatedDeployCell in $generatedDeployWorkbookXml.SelectNodes('//s:sheetData/s:row[@r="2"]/s:c',$generatedDeployWorkbookNs)) {
                if($generatedDeployCell.t -eq 'inlineStr' -and $generatedDeployCell.InnerText -ceq '9007199254740995'){$generatedDeployExactIdentity=$true}
            }
            Assert-Check $generatedDeployExactIdentity 'Installed generated workbook lost its exact text Long identity.'
        }finally{$generatedDeployWorkbookZip.Dispose();$generatedDeployWorkbookStream.Dispose()}
        [Environment]::SetEnvironmentVariable('EFORGE_GENERATED_CLIENT_TOKEN',$generatedDeployActorToken,'Process')
        & node (Join-Path $repoRoot 'web/scripts/verify-generator-business-client.mjs') $generatedDeployContractPath "http://127.0.0.1:$AppPort" $generatedDeployCategory ('fixture'+(Get-Culture).TextInfo.ToTitleCase($generatedDeployCategory))
        Assert-Check ($LASTEXITCODE -eq 0) 'Actual Boot generated client HTTP verification failed.'
    }
    $generatedDeployCatalog=(Request '/api/v1/system/menus/routes' 'GET' '' $generatedDeployActorHeaders).Content|ConvertFrom-Json
    $generatedDeployBootstrapResponse=Request '/api/v1/app/bootstrap' 'GET' '' $generatedDeployActorHeaders
    Assert-Check ($generatedDeployBootstrapResponse.StatusCode -eq 200) 'Actual generated bootstrap request failed.'
    $generatedDeployBootstrap=$generatedDeployBootstrapResponse.Content
    [IO.File]::WriteAllText((Join-Path $repoRoot 'server/eforge-boot/target/generator-route-bootstrap-diagnostic.json'),$generatedDeployBootstrap,[Text.UTF8Encoding]::new($false))
    foreach($generatedDeployCategory in @('crud','tree','sub')) {
        $generatedDeployDeclared=@($generatedDeployCatalog|Where-Object {$_.path -ceq "/business/fixture/$generatedDeployCategory"})
        Assert-Check ($generatedDeployDeclared.Count -eq 1) 'Actual Boot did not load the installed compiled route declaration.'
        Assert-Check ($generatedDeployBootstrap.Contains($generatedDeployDeclared[0].id)) 'Actual bootstrap omitted the installed canonical SQL menu.'
    }
    if ($VerifyGeneratedReact) {
        Copy-Item -LiteralPath $generatedDeployContractPath -Destination (Join-Path $repoRoot 'server/eforge-boot/target/generator-react-captured-openapi.json') -Force
        & node (Join-Path $repoRoot 'web/scripts/verify-generator-react-pages.mjs') $generatedBusinessDirectory $generatedDeployContractPath "http://127.0.0.1:$AppPort" $generatedDeployUser.username
        Assert-Check ($LASTEXITCODE -eq 0) 'Actual generated React page verification failed.'
        $generatedAutoChildRows=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e 'SELECT COUNT(*) FROM boot_fixture_auto_lines'
        Assert-Check ([int]$generatedAutoChildRows -eq 0) 'Generated automatic subtable delete left physical orphan rows.'
        Write-Output 'PASS: generated automatic parent bulk deletion retains no physical child orphan rows.'
    }
    $generatedDeployMenus=(Request '/api/v1/system/menus' 'GET' '' $authorized).Content|ConvertFrom-Json
    $generatedDeployParent=@($generatedDeployMenus|Where-Object {$_.routeId -eq 'system-users'})[0].id
    $generatedDeployMenu=@{key="gen-query-$runId";name='Generated query';parentId=$generatedDeployParent;sort=99;type='FUNCTION';status='0';visible=$true;cached=$false;permission='fixture:crud:query'}
    $generatedDeployMenuResult=Request '/api/v1/system/menus' 'POST' ($generatedDeployMenu|ConvertTo-Json -Compress) $authorized
    Assert-Check ($generatedDeployMenuResult.StatusCode -eq 201) 'Actual generated query grant menu failed.'
    $generatedDeployMenuId=($generatedDeployMenuResult.Content|ConvertFrom-Json).id
    $generatedDeployRole=@{name='Generated fixture role';key="genr_$runId";sort=99;status='0';menuLinked=$false;menuKeys=@($generatedDeployMenu.key)}
    $generatedDeployRoleResult=Request '/api/v1/system/roles' 'POST' ($generatedDeployRole|ConvertTo-Json -Compress) $authorized
    Assert-Check ($generatedDeployRoleResult.StatusCode -eq 201) 'Actual generated query role failed.'
    $generatedDeployRoleId=($generatedDeployRoleResult.Content|ConvertFrom-Json).id
    Assert-Check ((Request "/api/v1/system/users/$generatedDeployUserId/roles" 'PUT' (@{roleIds=@($generatedDeployRoleId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Actual generated role assignment failed.'
    Assert-Check ((Request '/api/v1/business/fixture/crud/9007199254740995' 'GET' '' $generatedDeployNoRoleHeaders).StatusCode -eq 200) 'Existing JWT did not gain the actual assigned SQL grant.'
    Assert-Problem (Request '/api/v1/business/fixture/tree/9007199254740995' 'GET' '' $generatedDeployNoRoleHeaders) 403 'ACCESS_DENIED'
    Assert-Check ((Request "/api/v1/system/users/$generatedDeployUserId/roles" 'PUT' '{"roleIds":[]}' $authorized).StatusCode -eq 204) 'Actual user allocation withdrawal failed.'
    Assert-Problem (Request '/api/v1/business/fixture/crud/9007199254740995' 'GET' '' $generatedDeployNoRoleHeaders) 403 'ACCESS_DENIED'
    Assert-Check ((Request "/api/v1/system/users/$generatedDeployUserId/roles" 'PUT' (@{roleIds=@($generatedDeployRoleId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Actual user allocation regrant failed.'
    Assert-Check ((Request '/api/v1/business/fixture/crud/9007199254740995' 'GET' '' $generatedDeployNoRoleHeaders).StatusCode -eq 200) 'Existing JWT did not regain the re-assigned grant.'
    $generatedDeployRole.menuKeys=@()
    Assert-Check ((Request "/api/v1/system/roles/$generatedDeployRoleId" 'PUT' ($generatedDeployRole|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Actual generated role revocation failed.'
    Assert-Problem (Request '/api/v1/business/fixture/crud/9007199254740995' 'GET' '' $generatedDeployNoRoleHeaders) 403 'ACCESS_DENIED'
    Assert-Check ((Request "/api/v1/system/users/$generatedDeployUserId/status" 'PUT' '{"status":"1"}' $authorized).StatusCode -eq 204) 'Actual user disabling failed.'
    Assert-Problem (Request '/api/v1/business/fixture/crud/9007199254740995' 'GET' '' $generatedDeployNoRoleHeaders) 401 'AUTHENTICATION_REQUIRED'
    foreach($generatedDeployCategory in @('crud','tree','sub')) {
        Assert-Check ((Request "/api/v1/business/fixture/$generatedDeployCategory" 'DELETE' '{"ids":["9007199254740995"]}' $generatedDeployActorHeaders).StatusCode -eq 204) 'Actual Boot generated cleanup delete failed.'
    }
    $generatedDeployAuditReady=$false
    for($generatedDeployAuditWait=0;$generatedDeployAuditWait -lt 30;$generatedDeployAuditWait++) {
        $generatedDeployAuditCount=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot -N -s eforge_enterprise -e "SELECT COUNT(DISTINCT business_type) FROM sys_oper_log WHERE oper_url LIKE '/api/v1/business/fixture/%' AND oper_name='admin' AND status=0 AND business_type IN (1,2,3,5)"
        if([int]$generatedDeployAuditCount -eq 4){$generatedDeployAuditReady=$true;break};Start-Sleep -Milliseconds 200
    }
    Assert-Check $generatedDeployAuditReady 'Actual generated INSERT/UPDATE/DELETE/EXPORT audit did not persist.'
    Assert-Check ((Request '/logout' 'POST' '' $generatedDeployActorHeaders).StatusCode -eq 200) 'Actual generated actor logout failed.'
    Assert-Problem (Request '/api/v1/business/fixture/crud' 'GET' '' $generatedDeployActorHeaders) 401 'AUTHENTICATION_REQUIRED'
    Write-Output 'PASS: actual generated modules in original Boot/JWT/Redis/MyBatis/LogAspect, strict generated HTTP client, no-role/grant isolation/immediate SQL-role withdrawal/logout and persisted mutation/export audit.'
} finally {
    [Environment]::SetEnvironmentVariable('EFORGE_GENERATED_CLIENT_TOKEN',$generatedDeployPreviousToken,'Process')
    if($generatedDeployUserId){Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($generatedDeployUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned generated user cleanup failed.'}
    if($generatedDeployRoleId){Assert-Check ((Request '/api/v1/system/roles' 'DELETE' (@{ids=@($generatedDeployRoleId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned generated role cleanup failed.'}
    if($generatedDeployMenuId){Assert-Check ((Request "/api/v1/system/menus/$generatedDeployMenuId" 'DELETE' '' $authorized).StatusCode -eq 204) 'Owned generated grant menu cleanup failed.'}
}
