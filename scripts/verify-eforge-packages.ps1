# PowerShell 7. Verify consumption without access to any EForge source checkout.
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$baseline = 'a7b644b724f4264c1ca015ce4c686ca94476d62f'
$artifactRoot = Join-Path $repoRoot "dependencies/eforge/$baseline"
$manifest = Get-Content -Raw (Join-Path $artifactRoot 'manifest.json') | ConvertFrom-Json
if ($manifest.commit -ne $baseline -or $manifest.artifacts.Count -ne 8) { throw 'Unexpected artifact manifest.' }
foreach ($artifact in $manifest.artifacts) {
    if ($artifact.file -notmatch '^eforge-[a-z-]+-0\.1\.0\.tgz$') { throw 'Unexpected artifact filename.' }
    $path = Join-Path $artifactRoot $artifact.file
    if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() -ne $artifact.sha256) {
        throw "Artifact integrity mismatch: $($artifact.name)"
    }
    $packedJson = (& tar -xOf $path package/package.json) -join "`n"
    if ($LASTEXITCODE -ne 0 -or $packedJson -match 'workspace:') { throw "Invalid packed manifest: $($artifact.name)" }
    $packed = $packedJson | ConvertFrom-Json
    if ($packed.name -ne $artifact.name -or $packed.version -ne $artifact.version) { throw 'Packed identity mismatch.' }
}
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) "eforge-consumer-$([guid]::NewGuid().ToString('N'))"
$consumerRoot = Join-Path $temporaryRoot 'verification/eforge-consumer'
$temporaryArtifacts = Join-Path $temporaryRoot "dependencies/eforge/$baseline"
$cacheBefore = [Environment]::GetEnvironmentVariable('npm_config_cache', 'Process')
$offlineBefore = [Environment]::GetEnvironmentVariable('npm_config_offline', 'Process')
try {
    New-Item -ItemType Directory -Path $consumerRoot, $temporaryArtifacts | Out-Null
    foreach ($artifact in $manifest.artifacts) { Copy-Item -LiteralPath (Join-Path $artifactRoot $artifact.file) -Destination $temporaryArtifacts }
    foreach ($file in @('package.json', 'package-lock.json', 'tsconfig.json', 'index.html', 'main.ts', 'runtime.test.mjs')) {
        Copy-Item -LiteralPath (Join-Path $repoRoot "verification/eforge-consumer/$file") -Destination $consumerRoot
    }
    [Environment]::SetEnvironmentVariable('npm_config_cache', (Join-Path $temporaryRoot 'npm-cache'), 'Process')
    [Environment]::SetEnvironmentVariable('npm_config_offline', 'false', 'Process')
    $npmCommand = if ($IsWindows) { 'npm.cmd' } else { 'npm' }
    Push-Location $consumerRoot
    try {
        & $npmCommand ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Clean consumer installation failed.' }
        foreach ($task in @('typecheck', 'test', 'build')) {
            & $npmCommand run $task
            if ($LASTEXITCODE -ne 0) { throw "Consumer $task failed." }
        }
    } finally { Pop-Location }
    Write-Output 'PASS: artifact integrity, clean locked installation, public types, runtime contracts and browser bundle.'
} finally {
    [Environment]::SetEnvironmentVariable('npm_config_cache', $cacheBefore, 'Process')
    [Environment]::SetEnvironmentVariable('npm_config_offline', $offlineBefore, 'Process')
    $resolvedRoot = [IO.Path]::GetFullPath($temporaryRoot)
    $expectedParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if ((Split-Path -Parent $resolvedRoot) -ne $expectedParent -or (Split-Path -Leaf $resolvedRoot) -notmatch '^eforge-consumer-[a-f0-9]{32}$') {
        throw 'Refusing cleanup outside the task-specific consumer directory.'
    }
    if (Test-Path -LiteralPath $resolvedRoot) { Remove-Item -LiteralPath $resolvedRoot -Recurse -Force }
}
