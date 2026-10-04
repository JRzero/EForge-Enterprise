# PowerShell 7. Source is built outside this repository; only versioned package
# artifacts are copied into it. Neither upstream baseline nor sibling checkout changes.
param([string]$SourceRepository = 'https://github.com/JRzero/EForge.git')
$ErrorActionPreference = 'Stop'
$baseline = 'a7b644b724f4264c1ca015ce4c686ca94476d62f'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$buildRoot = Join-Path ([IO.Path]::GetTempPath()) "eforge-pack-$([guid]::NewGuid().ToString('N'))"
$checkout = Join-Path $buildRoot 'source'
$packDirectory = Join-Path $buildRoot 'packages'
$outputDirectory = Join-Path $repoRoot "dependencies/eforge/$baseline"
$previousEnvironment = @{}
New-Item -ItemType Directory -Path $buildRoot, $packDirectory | Out-Null

function Assert-Exit([string]$operation) {
    if ($LASTEXITCODE -ne 0) { throw "$operation failed." }
}
function Invoke-Pnpm([string[]]$CommandArguments) {
    $npmCommand = if ($IsWindows) { 'npm.cmd' } else { 'npm' }
    & $npmCommand exec --yes --package=pnpm@10.0.0 -- pnpm @CommandArguments
    Assert-Exit 'Pinned pnpm command'
}
try {
    $environment = @{
        npm_config_cache = (Join-Path $buildRoot 'npm-cache')
        npm_config_offline = 'false'; npm_config_audit = 'false'; npm_config_fund = 'false'
    }
    foreach ($key in $environment.Keys) {
        $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $environment[$key], 'Process')
    }
    & git clone --quiet --no-checkout -- $SourceRepository $checkout
    Assert-Exit 'Upstream clone'
    & git -C $checkout checkout --quiet --detach $baseline
    Assert-Exit 'Pinned checkout'
    $actualCommit = (& git -C $checkout rev-parse HEAD).Trim()
    if ($actualCommit -ne $baseline) { throw 'Upstream commit does not match the architecture baseline.' }
    $workspace = Get-Content -Raw (Join-Path $checkout 'package.json') | ConvertFrom-Json
    if ($workspace.packageManager -ne 'pnpm@10.0.0') { throw 'Unexpected upstream package manager.' }
    Push-Location $checkout
    try {
        Invoke-Pnpm @('install', '--frozen-lockfile', '--reporter=append-only', '--store-dir', (Join-Path $buildRoot 'pnpm-store'))
        Invoke-Pnpm @('--recursive', '--filter', '@eforge/app...', '--filter', '@eforge/data...', '--filter', '@eforge/forms...', '--filter', '@eforge/schema-contract', 'run', 'build')
        $selected = @('app', 'core', 'data', 'forms', 'patterns', 'schema-contract', 'tokens', 'ui')
        $artifacts = @()
        foreach ($package in $selected) {
            $packagePath = Join-Path $checkout "packages/$package"
            $packageJson = Get-Content -Raw (Join-Path $packagePath 'package.json') | ConvertFrom-Json
            Push-Location $packagePath
            try { Invoke-Pnpm @('pack', '--pack-destination', $packDirectory) } finally { Pop-Location }
            $filename = "eforge-$package-$($packageJson.version).tgz"
            $artifact = Join-Path $packDirectory $filename
            if (!(Test-Path -LiteralPath $artifact)) { throw "Missing packed artifact: $filename" }
            & python (Join-Path $PSScriptRoot 'normalize-package-artifact.py') $artifact
            Assert-Exit 'Canonical package archive encoding'
            $artifacts += [ordered]@{ name = $packageJson.name; version = $packageJson.version; file = $filename
                sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifact).Hash.ToLowerInvariant() }
        }
    }
    finally { Pop-Location }
    $manifest = [ordered]@{
        repository = 'https://github.com/JRzero/EForge'; commit = $baseline
        packageManager = 'pnpm@10.0.0'; node = (& node --version).Trim()
        archiveFormat = 'sorted-ustar-gzip9-mtime0-v1'
        upstreamLockSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $checkout 'pnpm-lock.yaml')).Hash.ToLowerInvariant()
        artifacts = $artifacts
    }
    if (Test-Path -LiteralPath (Join-Path $outputDirectory 'manifest.json')) {
        $existing = Get-Content -Raw (Join-Path $outputDirectory 'manifest.json') | ConvertFrom-Json
        foreach ($artifact in $artifacts) {
            $old = $existing.artifacts | Where-Object name -EQ $artifact.name
            if (!$old -or $old.sha256 -ne $artifact.sha256) {
                throw "Artifact changed for the pinned baseline: $($artifact.name). Existing artifacts were preserved."
            }
        }
    }
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    foreach ($artifact in $artifacts) { Copy-Item -LiteralPath (Join-Path $packDirectory $artifact.file) -Destination $outputDirectory }
    Copy-Item -LiteralPath (Join-Path $checkout 'LICENSE') -Destination (Join-Path $repoRoot 'dependencies/eforge/LICENSE')
    [IO.File]::WriteAllText((Join-Path $outputDirectory 'manifest.json'),
        ($manifest | ConvertTo-Json -Depth 5) + "`n", [Text.UTF8Encoding]::new($false))
    Write-Output "Prepared $($artifacts.Count) versioned EForge packages at $outputDirectory."
}
finally {
    foreach ($key in $previousEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key], 'Process') }
    $resolvedBuildRoot = [IO.Path]::GetFullPath($buildRoot)
    $expectedParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if ((Split-Path -Parent $resolvedBuildRoot) -ne $expectedParent -or (Split-Path -Leaf $resolvedBuildRoot) -notmatch '^eforge-pack-[a-f0-9]{32}$') {
        throw 'Refusing cleanup outside the task-specific temporary build directory.'
    }
    Remove-Item -LiteralPath $resolvedBuildRoot -Recurse -Force
}
