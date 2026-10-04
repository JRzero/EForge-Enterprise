# Actual OSHI/JVM sampling inside the owned disposable authentication environment.
$serverMonitorPath='/api/v1/monitor/server'
Assert-Problem (Request $serverMonitorPath) 401 'AUTHENTICATION_REQUIRED'
$serverSampleResponse=Request $serverMonitorPath 'GET' '' $authorized
Assert-Check ($serverSampleResponse.StatusCode -eq 200) 'Actual canonical server sampling failed.'
$serverSample=$serverSampleResponse.Content|ConvertFrom-Json
Assert-Check (!!$serverSample.sampledAt -and !$serverSample.PSObject.Properties['data'] -and $serverSample.cpu.coreCount -gt 0) 'Canonical server projection/sampling timestamp or CPU count is invalid.'
Assert-Check ($serverSample.memory.totalGiB -gt 0 -and $serverSample.jvm.totalMiB -gt 0 -and !!$serverSample.jvm.version -and !!$serverSample.jvm.startedAt -and !!$serverSample.host.name) 'Actual memory/JVM/host projection is incomplete.'
foreach($percent in @($serverSample.cpu.userPercent,$serverSample.cpu.systemPercent,$serverSample.cpu.idlePercent,$serverSample.cpu.waitPercent,$serverSample.memory.usagePercent,$serverSample.jvm.usagePercent)) {
    Assert-Check ($percent -ge 0 -and $percent -le 100) 'Actual server percentages must be finite and within their original range.'
}
Assert-Check ($serverSample.disks.Count -gt 0) 'Actual server disk sampling is empty.'
foreach($disk in $serverSample.disks) {Assert-Check (!!$disk.mount -and !!$disk.totalSize -and $disk.usagePercent -ge 0 -and $disk.usagePercent -le 100) 'Actual disk formatting/mount/usage projection is invalid.'}
$legacyServerResponse=Request '/monitor/server' 'GET' '' $authorized
Assert-Check ($legacyServerResponse.StatusCode -eq 200) 'Existing server monitor compatibility endpoint failed.'
$legacyServer=$legacyServerResponse.Content|ConvertFrom-Json
Assert-Check ($legacyServer.code -eq 200 -and $legacyServer.data.cpu.cpuNum -eq $serverSample.cpu.coreCount -and $legacyServer.data.mem.total -eq $serverSample.memory.totalGiB -and $legacyServer.data.jvm.version -eq $serverSample.jvm.version -and $legacyServer.data.sys.computerName -eq $serverSample.host.name) 'Canonical projection changed original stable host identity or binary memory units.'
$serverUsername="sm$runId"
$serverUserBody=@{user=@{username=$serverUsername;displayName='无权限监控验证';departmentId='103';email='';phone='';sex='2';status='0';roleIds=@();postIds=@()};password='User12345'}|ConvertTo-Json -Depth 6 -Compress
$serverCreated=Request '/api/v1/system/users' 'POST' $serverUserBody $authorized
Assert-Check ($serverCreated.StatusCode -eq 201) 'Owned server-monitor account creation failed.'
$serverUserId=($serverCreated.Content|ConvertFrom-Json).id
try {
    $serverLogin=Request '/api/v1/auth/login' 'POST' (@{username=$serverUsername;password='User12345'}|ConvertTo-Json -Compress)
    Assert-Check ($serverLogin.StatusCode -eq 200) 'Owned server-monitor login failed.'
    $serverToken=($serverLogin.Content|ConvertFrom-Json).accessToken
    Assert-Problem (Request $serverMonitorPath 'GET' '' @{Authorization="Bearer $serverToken"}) 403 'ACCESS_DENIED'
} finally {Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($serverUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Owned server-monitor account cleanup failed.'}
Write-Host 'Server monitor: real OSHI CPU/RAM/JVM/host/disk sampling, canonical binary units, percentage bounds, original compatibility and no-role authorization passed.'
