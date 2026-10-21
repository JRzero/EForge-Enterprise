#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('Start', 'Stop', 'Status')][string]$Action = 'Status',
    [string]$ConfigPath,
    [ValidateRange(1024, 65535)][int]$WebPort = 5174
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $repo 'server/eforge-boot/target/local-service'
$stateFile = Join-Path $runtime 'state.json'
$jar = Join-Path $repo 'server/eforge-boot/target/eforge-boot.jar'
$vite = Join-Path $repo 'web/node_modules/vite/bin/vite.js'

function Get-OwnedProcess($record) {
    if (!$record) { return $null }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$record.pid)"
    if (!$process) { return $null }
    $created = ([datetime]$record.created).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    if ($process.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ') -ne $created -or
        !$process.CommandLine.Replace('/', '\').Contains($record.entry.Replace('/', '\'))) {
        throw 'Recorded PID belongs to a different process; refusing to manage it.'
    }
    return $process
}

function Read-State {
    if (Test-Path -LiteralPath $stateFile) {
        return Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    }
    return $null
}

function Stop-Owned($record) {
    $process = Get-OwnedProcess $record
    if ($process) {
        Stop-Process -Id $process.ProcessId
        Wait-Process -Id $process.ProcessId -Timeout 20 -ErrorAction SilentlyContinue
    }
}

function Start-Owned([string]$executable, [string[]]$arguments, [string]$entry, [string]$name) {
    $process = Start-Process $executable -ArgumentList $arguments -WorkingDirectory $repo `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $runtime "$name.log") `
        -RedirectStandardError (Join-Path $runtime "$name-error.log")
    return @{pid=$process.Id; created=$process.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ'); entry=$entry}
}

$state = Read-State
if ($Action -eq 'Status') {
    if (!$state) { Write-Output 'No services recorded by this script.'; return }
    foreach ($name in @('backend', 'frontend')) {
        $process = Get-OwnedProcess $state.$name
        Write-Output "$name : $(if ($process) { 'running' } else { 'stopped' })"
    }
    Write-Output "URL: $($state.url)"
    Write-Output "Logs: $runtime"
    return
}
if ($Action -eq 'Stop') {
    if ($state) {
        $null = Get-OwnedProcess $state.frontend
        $null = Get-OwnedProcess $state.backend
        Stop-Owned $state.frontend
        Stop-Owned $state.backend
        Remove-Item -LiteralPath $stateFile
    }
    Write-Output 'Managed application processes stopped. MySQL and Redis retained.'
    return
}
if ($state) {
    $backend = Get-OwnedProcess $state.backend
    $frontend = Get-OwnedProcess $state.frontend
    if ($backend -and $frontend) { Write-Output "Already running: $($state.url)"; return }
    if ($backend -or $frontend) { throw 'Partial service state. Run Stop before Start.' }
}
if (!$IsWindows) { throw 'This local process manager currently supports Windows PowerShell 7.' }
if (!$ConfigPath) { $ConfigPath = Join-Path $repo '.env.local.ps1' }
if (!(Test-Path -LiteralPath $ConfigPath)) { throw 'Create a trusted .env.local.ps1 configuration; see docs/local-development.md.' }
. $ConfigPath
foreach ($name in @('EFORGE_DB_URL', 'EFORGE_DB_USERNAME', 'EFORGE_DB_PASSWORD', 'EFORGE_TOKEN_SECRET', 'EFORGE_REDIS_HOST', 'EFORGE_REDIS_PORT')) {
    if (![Environment]::GetEnvironmentVariable($name)) { throw "Missing required environment variable: $name" }
}
$apiPort = if ($env:EFORGE_SERVER_PORT) { [int]$env:EFORGE_SERVER_PORT } else { 8080 }
foreach ($port in @($WebPort, $apiPort)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
        throw "Port $port is occupied. Existing services were not stopped."
    }
}
if ($WebPort -eq $apiPort) { throw 'Frontend and backend ports must differ.' }
foreach ($path in @($jar, $vite)) {
    if (!(Test-Path -LiteralPath $path)) { throw "Missing build/dependency: $path" }
}
$java = (Get-Command java -CommandType Application | Select-Object -First 1).Source
$node = (Get-Command node -CommandType Application | Select-Object -First 1).Source
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$env:EFORGE_E2E_BACKEND_URL = "http://127.0.0.1:$apiPort"
$started = @{url="http://127.0.0.1:$WebPort"; backend=$null; frontend=$null}
try {
    $started.backend = Start-Owned $java @('-jar', "`"$jar`"") $jar 'backend'
    $started | ConvertTo-Json | Set-Content -LiteralPath $stateFile
    $started.frontend = Start-Owned $node @("`"$vite`"", "`"$(Join-Path $repo 'web')`"", '--host', '127.0.0.1', '--port', "$WebPort", '--strictPort') $vite 'frontend'
    $started | ConvertTo-Json | Set-Content -LiteralPath $stateFile
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (!(Get-OwnedProcess $started.backend) -or !(Get-OwnedProcess $started.frontend)) { throw 'Application exited during startup.' }
        try {
            $captcha = Invoke-RestMethod "$($started.url)/captchaImage" -TimeoutSec 3
            if ($captcha.code -eq 200) { $ready = $true; break }
        } catch { }
        if ($attempt % 10 -eq 0) { Write-Output 'Waiting for frontend and backend readiness...' }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw 'Readiness timeout.' }
    Write-Output "Ready: $($started.url)"
    Write-Output "Logs: $runtime"
} catch {
    Stop-Owned $started.frontend
    Stop-Owned $started.backend
    Remove-Item -LiteralPath $stateFile -ErrorAction SilentlyContinue
    throw "Local startup failed. Inspect logs in $runtime. $($_.Exception.Message)"
}
