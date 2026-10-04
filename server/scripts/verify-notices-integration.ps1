# Runs only within the owned disposable database/session fixture.
$noticeBase='/api/v1/system/notices'
function Notice-Create([hashtable]$body) {
    $response=Request $noticeBase 'POST' ($body|ConvertTo-Json -Compress) $authorized
    Assert-Check ($response.StatusCode -eq 201) "Notice creation failed: $($response.Content)"
    return $response.Content|ConvertFrom-Json
}
Assert-Problem (Request "$noticeBase/feed") 401 'AUTHENTICATION_REQUIRED'
Assert-Problem (Request "$noticeBase/1") 401 'AUTHENTICATION_REQUIRED'
$noticeRows=@()
for($index=0;$index -lt 7;$index++) {
    $noticeRows+=Notice-Create @{title="公告-$runId-$index";type='2';content='<p><strong>中文 &amp; rich text</strong></p>';status=$(if($index -eq 6){'1'}else{'0'});remark='待清空'}
}
$first=$noticeRows[0]
Assert-Check ($first.id -is [string] -and $first.content.Contains('<strong>中文')) 'Notice string IDs/rich HTML were not preserved.'
$page=(Request "$noticeBase`?title=$runId&author=admin&type=2&pageSize=1" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($page.total -eq 7 -and $page.items.Count -eq 1 -and $page.items[0].id -eq $noticeRows[6].id -and !$page.PSObject.Properties['rows']) 'Notice paging/filter/order/projection failed.'
$feed=(Request "$noticeBase/feed" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($feed.items.Count -eq 5 -and $feed.unreadCount -eq 5 -and $feed.items[0].id -eq $noticeRows[5].id -and @($feed.items|Where-Object id -eq $noticeRows[6].id).Count -eq 0) 'Notice feed must return five newest active items only.'
$visibleIds=@($feed.items|ForEach-Object id)
Assert-Check ((Request "$noticeBase/read" 'POST' (@{ids=@($visibleIds[0],$visibleIds[0])}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Notice mark read failed.'
Assert-Check ((Request "$noticeBase/read" 'POST' (@{ids=@($visibleIds[0])}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Notice repeated mark read failed.'
$readCount=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT COUNT(*) FROM sys_notice_read WHERE notice_id=$($visibleIds[0]) AND user_id=1;"
Assert-Check ($readCount -eq '1') 'Read state must be idempotent in actual MySQL.'
$legacyFeed=(Request '/system/notice/listTop' 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($legacyFeed.unreadCount -eq 4 -and $legacyFeed.data[0].isRead) 'Compatibility feed must observe canonical per-user read state.'
Assert-Problem (Request "$noticeBase/read" 'POST' (@{ids=@($first.id,'2147483647')}|ConvertTo-Json -Compress) $authorized) 404 'NOTICE_NOT_FOUND'
$firstReadCount=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT COUNT(*) FROM sys_notice_read WHERE notice_id=$($first.id) AND user_id=1;"
Assert-Check ($firstReadCount -eq '0') 'Failed read batch partially marked another notice.'
$readerPage=(Request "$noticeBase/$($visibleIds[0])/readers?search=admin" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($readerPage.total -eq 1 -and $readerPage.items[0].userId -ceq '1' -and $readerPage.items[0].username -eq 'admin' -and $readerPage.items[0].readAt) "Notice reader projection/search failed: $($readerPage|ConvertTo-Json -Depth 5 -Compress)"
Assert-Check ((Request "$noticeBase/read" 'POST' (@{ids=$visibleIds}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Notice mark visible all read failed.'
Assert-Check (((Request "$noticeBase/feed" 'GET' '' $authorized).Content|ConvertFrom-Json).unreadCount -eq 0) 'Feed unread count must cover visible five, matching upstream.'
Assert-Problem (Request $noticeBase 'DELETE' (@{ids=@($visibleIds[0],'2147483647')}|ConvertTo-Json -Compress) $authorized) 404 'NOTICE_NOT_FOUND'
# Force notice deletion to fail after read rows have been removed; both must roll back.
try {
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e "CREATE TRIGGER notice_delete_failure BEFORE DELETE ON sys_notice FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='owned fixture fault';" | Out-Null
    Assert-Problem (Request $noticeBase 'DELETE' (@{ids=@($visibleIds[0])}|ConvertTo-Json -Compress) $authorized) 500 'INTERNAL_ERROR'
} finally {
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e 'DROP TRIGGER IF EXISTS notice_delete_failure;' | Out-Null
}
$afterFailure=(Request "$noticeBase/$($visibleIds[0])/readers" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($afterFailure.total -eq 1 -and (Request "$noticeBase/$($visibleIds[0])" 'GET' '' $authorized).StatusCode -eq 200) 'Database fault did not roll back notice/read deletion together.'
$update=@{title=$first.title;type='1';content='';status='1';remark=''}|ConvertTo-Json -Compress
Assert-Check ((Request "$noticeBase/$($first.id)" 'PUT' $update $authorized).StatusCode -eq 204) 'Notice update failed.'
$updated=(Request "$noticeBase/$($first.id)" 'GET' '' $authorized).Content|ConvertFrom-Json
Assert-Check ($updated.content -eq '' -and $updated.remark -eq '' -and $updated.type -eq '1' -and $updated.status -eq '1') 'Notice content/remark clearing or type/status failed.'
Assert-Check ((Request $noticeBase 'DELETE' (@{ids=@($noticeRows|ForEach-Object id)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Notice batch cleanup failed.'
$ids=($noticeRows|ForEach-Object id) -join ','
$remaining=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT COUNT(*) FROM sys_notice_read WHERE notice_id IN ($ids);"
Assert-Check ($remaining -eq '0') 'Notice deletion retained read records.'
Write-Host 'Notice CRUD, rich text/clearing, filters/paging, newest-five feed, per-user idempotent reads, compatibility, readers, full batch guards and actual transaction rollback passed.'
