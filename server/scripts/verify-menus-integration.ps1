# Dot-sourced inside the owned disposable MySQL/Redis integration fixture.
$menuBase='/api/v1/system/menus'
function Menu-Body([string]$key,[string]$name,[string]$parent='0',[string]$type='GROUP') {
    return @{key=$key;name=$name;parentId=$parent;sort=1;type=$type;status='0';visible=$true;routeId=$null;externalUrl=$null;permission='';icon='';remark='integration';groupPath=$(if($type -eq 'GROUP'){$key}else{$null});queryText='';cached=$true}
}
function Menu-Create([hashtable]$body) {
    $response=Request $menuBase 'POST' ($body | ConvertTo-Json -Compress) $authorized
    Assert-Check ($response.StatusCode -eq 201) "Menu fixture creation failed: $($response.Content)"
    $row=$response.Content | ConvertFrom-Json
    Assert-Check ($row.id -is [string] -and $response.Headers.Location -eq "$menuBase/$($row.id)") 'Menu identity/Location must be concrete strings.'
    return $row
}
function Menu-Patch([object]$row) {
    $body=@{};foreach($field in @('key','name','parentId','sort','type','status','visible','routeId','externalUrl','permission','icon','remark','groupPath','queryText','cached')) {$body[$field]=$row.$field};return $body
}
function Menu-Update([string]$id,[hashtable]$body,[hashtable]$headers=$authorized) {return Request "$menuBase/$id" 'PUT' ($body | ConvertTo-Json -Compress) $headers}
$menuRows=@((Request $menuBase 'GET' '' $authorized).Content | ConvertFrom-Json)
Assert-Check ($menuRows.Count -gt 30 -and !$menuRows[0].PSObject.Properties['component'] -and !$menuRows[0].PSObject.Properties['params']) 'Menu projection must include all original nodes without legacy components.'
$routeOptions=@((Request "$menuBase/routes" 'GET' '' $authorized).Content | ConvertFrom-Json)
Assert-Check ($routeOptions.Count -eq $implementedRoutes.Count -and !($routeOptions.id -contains 'account-profile') -and !($routeOptions.id -contains 'role-users')) 'Route options must use the actual packaged navigation registry only.'
Assert-Problem (Request "$menuBase`?status=2" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$menuBase/9223372036854775808" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
$oversizedMenu=Menu-Body "menu-oversized-$runId" 'Oversized';$oversizedMenu.permission='x'*101
Assert-Problem (Request $menuBase 'POST' ($oversizedMenu | ConvertTo-Json -Compress) $authorized) 400 'VALIDATION_ERROR'
$groupBody=Menu-Body "menu-group-$runId" "Menu group-$runId"
$group=Menu-Create $groupBody
$childBody=Menu-Body "menu-child-$runId" "Menu child-$runId" $group.id
$child=Menu-Create $childBody
$leafBody=Menu-Body "menu-leaf-$runId" "Menu leaf-$runId" $child.id 'FUNCTION';$leafBody.permission='system:post:query'
$leaf=Menu-Create $leafBody
$parentChoices=@((Request "$menuBase/options?excludeId=$($group.id)" 'GET' '' $authorized).Content | ConvertFrom-Json)
Assert-Check (!($parentChoices.id -contains $group.id) -and !($parentChoices.id -contains $child.id) -and !($parentChoices.id -contains $leaf.id)) 'Parent options must exclude the complete editing subtree.'
$externalBody=Menu-Body "menu-external-$runId" "External-$runId" '0' 'EXTERNAL';$externalBody.externalUrl='https://example.com/documentation'
$external=Menu-Create $externalBody
Assert-Problem (Request $menuBase 'POST' ($groupBody | ConvertTo-Json -Compress) $authorized) 409 'MENU_KEY_EXISTS'
$nameCollision=Menu-Body "menu-other-$runId" $group.name
Assert-Problem (Request $menuBase 'POST' ($nameCollision | ConvertTo-Json -Compress) $authorized) 409 'MENU_NAME_EXISTS'
$invalid=Menu-Body "menu-invalid-$runId" 'Invalid' '0' 'EXTERNAL';$invalid.externalUrl='javascript:alert(1)'
Assert-Problem (Request $menuBase 'POST' ($invalid | ConvertTo-Json -Compress) $authorized) 400 'VALIDATION_ERROR'
$invalid.externalUrl='https://user:password@example.com'
Assert-Problem (Request $menuBase 'POST' ($invalid | ConvertTo-Json -Compress) $authorized) 400 'VALIDATION_ERROR'
$invalid=Menu-Body "menu-invalid-$runId" 'Invalid' $leaf.id
Assert-Problem (Request $menuBase 'POST' ($invalid | ConvertTo-Json -Compress) $authorized) 400 'VALIDATION_ERROR'
$cycle=Menu-Patch $group;$cycle.parentId=$child.id
Assert-Problem (Menu-Update $group.id $cycle) 409 'MENU_CYCLE'
Assert-Problem (Request "$menuBase/$($group.id)" 'DELETE' '' $authorized) 409 'MENU_HAS_CHILDREN'
$groupBody.name="菜单分组-$runId";$groupBody.sort=17;$groupBody.icon='system';$groupBody.remark='';$groupBody.visible=$false
Assert-Check ((Menu-Update $group.id $groupBody).StatusCode -eq 204) 'Menu group update failed.'
$storedGroup=(Request "$menuBase/$($group.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($storedGroup.name -eq $groupBody.name -and $storedGroup.sort -eq 17 -and $storedGroup.remark -eq '' -and !$storedGroup.visible) 'Menu Unicode/sort/clearing/visibility did not persist.'
$filtered=@((Request "$menuBase`?name=$([uri]::EscapeDataString($groupBody.name))&visible=false&status=0" 'GET' '' $authorized).Content | ConvertFrom-Json)
Assert-Check ($filtered.Count -eq 1 -and $filtered[0].id -eq $group.id) 'Menu filters failed.'
$caseFilter=@((Request "$menuBase`?name=$([uri]::EscapeDataString($child.name.ToUpperInvariant()))" 'GET' '' $authorized).Content | ConvertFrom-Json)
Assert-Check ($caseFilter.Count -eq 1 -and $caseFilter[0].id -eq $child.id) 'Menu name filters must retain the original database collation semantics.'
$sortBody=@{items=@(@{id=$group.id;sort=2},@{id=$child.id;sort=5})}
Assert-Check ((Request "$menuBase/sort" 'PUT' ($sortBody | ConvertTo-Json -Depth 4 -Compress) $authorized).StatusCode -eq 204) 'Menu batch sort failed.'
$sortBody.items[1].id='999999'
Assert-Problem (Request "$menuBase/sort" 'PUT' ($sortBody | ConvertTo-Json -Depth 4 -Compress) $authorized) 404 'MENU_NOT_FOUND'
Assert-Check (((Request "$menuBase/$($group.id)" 'GET' '' $authorized).Content | ConvertFrom-Json).sort -eq 2) 'Invalid sort batch partially wrote a member.'

$postRoute=$menuRows | Where-Object key -eq 'system-posts';$postQuery=$menuRows | Where-Object key -eq 'system-post-query'
$routePatch=Menu-Patch $postRoute;$queryPatch=Menu-Patch $postQuery
function Menu-MetadataNode([object[]]$nodes,[string]$key) {
    foreach($node in $nodes) {
        if($node.key -eq $key){return $node}
        $found=Menu-MetadataNode @($node.children) $key;if($null -ne $found){return $found}
    }
    return $null
}
$menuMetadataPatch=Menu-Patch $postRoute
$menuMetadataPatch.queryText='{"id":"9007199254740999","__proto__":"文字 &?/#","list":["a","b"],"bare":null}'
$menuMetadataPatch.cached=$false
Assert-Check ((Menu-Update $postRoute.id $menuMetadataPatch).StatusCode -eq 204) 'Query/cache fixture update failed.'
$menuMetadataBootstrap=(Request '/api/v1/app/bootstrap' 'GET' '' $authorized).Content | ConvertFrom-Json
$menuMetadataNode=Menu-MetadataNode @($menuMetadataBootstrap.navigation) $postRoute.key
Assert-Check ($menuMetadataNode.type -eq 'ROUTE' -and $menuMetadataNode.queryText -ceq $menuMetadataPatch.queryText -and $menuMetadataNode.cached -is [bool] -and !$menuMetadataNode.cached) 'Real SQL bootstrap must retain exact query text and cache=false.'
Assert-Check (!$menuMetadataNode.PSObject.Properties['component']) 'Metadata must never expose a component resolver.'
$menuMetadataGroup=Menu-MetadataNode @($menuMetadataBootstrap.navigation) 'system'
Assert-Check (!$menuMetadataGroup.PSObject.Properties['queryText'] -and !$menuMetadataGroup.PSObject.Properties['cached']) 'Groups must not have route metadata.'
Assert-Check ((Menu-Update $postRoute.id $routePatch).StatusCode -eq 204) 'Query/cache fixture restoration failed.'
Write-Host 'Navigation metadata: actual SQL query Unicode/long-ID/prototype-key text and cache=false reach authorized bootstrap; groups retain no route/component metadata.'
$badRoute=Menu-Patch $postRoute;$badRoute.routeId='account-profile'
Assert-Problem (Menu-Update $postRoute.id $badRoute) 400 'VALIDATION_ERROR'
$badRoute=Menu-Patch $postRoute;$badRoute.permission='system:user:list'
Assert-Problem (Menu-Update $postRoute.id $badRoute) 400 'VALIDATION_ERROR'
$implementedGenerator=$menuRows | Where-Object key -eq 'tool-generator';Assert-Check ($implementedGenerator.routeId -eq 'tool-generator' -and (Menu-Update $implementedGenerator.id (Menu-Patch $implementedGenerator)).StatusCode -eq 204) 'Implemented generator binding must remain editable with its canonical route.'
$pending=$menuRows | Where-Object key -eq 'tool-form-builder';$pendingPatch=Menu-Patch $pending
Assert-Check (!$pending.routeId -and (Menu-Update $pending.id $pendingPatch).StatusCode -eq 204) 'Existing pending legacy route must remain editable without inventing a React binding.'

$menuRole=Create-Role 'menu-session' @('system','system-posts','system-post-query','system-menus','system-menu-query','system-menu-add','system-menu-edit','system-menu-remove')
$menuUser=Create-User "menu-$runId" '103'
Assert-Check ((Request "$userBase/$($menuUser.id)/roles" 'PUT' (@{roleIds=@($menuRole.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Menu fixture role assignment failed.'
$menuLogin=(Request '/api/v1/auth/login' 'POST' (@{username=$menuUser.username;password='User12345'} | ConvertTo-Json -Compress)).Content | ConvertFrom-Json
$menuHeaders=@{Authorization="Bearer $($menuLogin.accessToken)"}
Assert-Check ((Request '/api/v1/system/posts/1' 'GET' '' $menuHeaders).StatusCode -eq 200) 'Fixture query permission was not granted.'
Assert-Problem (Request "$menuBase/$($external.id)" 'GET' '' $menuHeaders) 403 'ACCESS_DENIED'
$scopeSort=@{items=@(@{id=$postQuery.id;sort=7},@{id=$external.id;sort=8})}
Assert-Problem (Request "$menuBase/sort" 'PUT' ($scopeSort | ConvertTo-Json -Depth 4 -Compress) $menuHeaders) 403 'ACCESS_DENIED'
Assert-Check (((Request "$menuBase/$($postQuery.id)" 'GET' '' $authorized).Content | ConvertFrom-Json).sort -eq $postQuery.sort) 'Cross-scope sort partially mutated a granted node.'
$escalation=Menu-Patch $postQuery;$escalation.permission='system:user:remove'
Assert-Problem (Menu-Update $postQuery.id $escalation $menuHeaders) 403 'ACCESS_DENIED'
$queryPatch.status='1';Assert-Check ((Menu-Update $postQuery.id $queryPatch).StatusCode -eq 204) 'Disabling query permission failed.'
Assert-Problem (Request '/api/v1/system/posts/1' 'GET' '' $menuHeaders) 403 'ACCESS_DENIED'
$queryPatch.status='0';$queryPatch.permission='system:post:export'
Assert-Check ((Menu-Update $postQuery.id $queryPatch).StatusCode -eq 204) 'Changing button permission failed.'
Assert-Problem (Request '/api/v1/system/posts/1' 'GET' '' $menuHeaders) 403 'ACCESS_DENIED'
Assert-Check ((Request '/api/v1/system/posts/export' 'POST' '' $menuHeaders).StatusCode -eq 200) 'Existing session did not gain the committed replacement permission.'
$queryPatch=Menu-Patch $postQuery;Assert-Check ((Menu-Update $postQuery.id $queryPatch).StatusCode -eq 204) 'Restoring query node failed.'
Assert-Check ((Request '/api/v1/system/posts/1' 'GET' '' $menuHeaders).StatusCode -eq 200) 'Existing session did not regain restored query permission.'
$routePatch.status='1';Assert-Check ((Menu-Update $postRoute.id $routePatch).StatusCode -eq 204) 'Disabling route failed.'
Assert-Problem (Request '/api/v1/system/posts' 'GET' '' $menuHeaders) 403 'ACCESS_DENIED'
Assert-Check ((Request '/api/v1/system/posts/1' 'GET' '' $menuHeaders).StatusCode -eq 200) 'Original independent child-button permission semantics changed.'
$routePatch=Menu-Patch $postRoute;Assert-Check ((Menu-Update $postRoute.id $routePatch).StatusCode -eq 204) 'Restoring route failed.'
Assert-Problem (Request "$menuBase/$($postQuery.id)" 'DELETE' '' $authorized) 409 'MENU_IN_USE'
Assert-Check ((Request '/logout' 'POST' '' $menuHeaders).StatusCode -eq 200) 'Menu fixture session cleanup failed.'
Assert-Check ((Request $userBase 'DELETE' (@{ids=@($menuUser.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Menu user fixture cleanup failed.'
Assert-Check ((Request $roleBase 'DELETE' (@{ids=@($menuRole.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Menu role fixture cleanup failed.'

$race=Menu-Body "menu-race-$runId" "Concurrent menu-$runId"
$raceJson=$race | ConvertTo-Json -Compress;$raceUrl="http://127.0.0.1:$AppPort$menuBase"
$raceResults=@(1..8 | ForEach-Object -Parallel {
    $response=Invoke-WebRequest -Uri $using:raceUrl -Method POST -Body $using:raceJson -Headers $using:authorized -ContentType 'application/json' -SkipHttpErrorCheck -TimeoutSec 20
    [pscustomobject]@{Status=$response.StatusCode;Payload=($response.Content | ConvertFrom-Json)}
} -ThrottleLimit 8)
Assert-Check (@($raceResults | Where-Object Status -eq 201).Count -eq 1 -and @($raceResults | Where-Object Status -eq 409).Count -eq 7) 'Concurrent menu creates must have one success and seven conflicts.'
$menuRaceId=($raceResults | Where-Object Status -eq 201).Payload.id
$dbProbe=& docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e "INSERT INTO sys_menu(menu_name,parent_id,order_num,path,menu_type) SELECT menu_name,parent_id,1,'other','M' FROM sys_menu WHERE menu_id=$menuRaceId;" 2>&1
Assert-Check ($LASTEXITCODE -ne 0 -and ($dbProbe -join '') -match '1062') 'Sibling menu-name uniqueness is not enforced by the database.'
foreach($id in @($leaf.id,$child.id,$group.id,$external.id,$menuRaceId)) {Assert-Check ((Request "$menuBase/$id" 'DELETE' '' $authorized).StatusCode -eq 204) 'Menu fixture cleanup failed.'}
Assert-Problem (Request "$menuBase/$($group.id)" 'GET' '' $authorized) 404 'MENU_NOT_FOUND'
Write-Host 'Menu CRUD, Unicode/clearing/filtering/sort, hierarchy/object guards, actual route bindings, concurrent uniqueness and immediate session permission refresh passed.'
