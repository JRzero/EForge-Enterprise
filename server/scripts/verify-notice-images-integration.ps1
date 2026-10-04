# Dot-sourced by the owned MySQL/Redis fixture; all output stays in its upload root.
function Upload-NoticeImage([string]$path, [hashtable]$headers) {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort/api/v1/system/notices/images" -Method POST -Form @{file=(Get-Item -LiteralPath $path)} -Headers $headers -SkipHttpErrorCheck
    $content=$response.Content
    if ($content -is [byte[]]) {$content=[Text.Encoding]::UTF8.GetString($content)}
    return @{StatusCode=$response.StatusCode;Headers=$response.Headers;Content=$content}
}
$pngUpload=Upload-NoticeImage (Join-Path $repoRoot 'web/tests/fixtures/avatar.png') $authorized
Assert-Check ($pngUpload.StatusCode -eq 201) 'Canonical notice PNG upload failed.'
$pngUrl=($pngUpload.Content|ConvertFrom-Json).imageUrl
Assert-Check ($pngUrl -match '^/profile/upload/notices/[0-9a-f-]{36}\.png$' -and $pngUpload.Headers.Location -eq $pngUrl) 'Notice image response/location is not canonical.'
$servedPng=Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$pngUrl" -SkipHttpErrorCheck
Assert-Check ($servedPng.StatusCode -eq 200 -and ($servedPng.Headers['Content-Type'] -join ';') -like 'image/png*') 'Anonymous notice PNG serving failed.'
$pngBytes=$servedPng.Content
Assert-Check ($pngBytes -is [byte[]] -and $pngBytes[0] -eq 137 -and $pngBytes[1] -eq 80 -and $pngBytes[2] -eq 78 -and $pngBytes[3] -eq 71) 'Notice raster was not normalized to PNG.'
$svgFixture=Join-Path $logDirectory 'notice-image.svg'
Set-Content -LiteralPath $svgFixture -Encoding utf8 -Value '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><defs><linearGradient id="paint"><stop offset="0%" stop-color="red"/></linearGradient></defs><rect width="10" height="10" fill="url(#paint)"/><text x="1" y="5">中文</text><script>alert(1)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">bad</div></foreignObject><use href="https://external.invalid/image"/></svg>'
$svgUpload=Upload-NoticeImage $svgFixture $authorized
Assert-Check ($svgUpload.StatusCode -eq 201) 'Canonical notice SVG upload failed.'
$svgUrl=($svgUpload.Content|ConvertFrom-Json).imageUrl
$servedSvg=Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$svgUrl" -SkipHttpErrorCheck
$svgContent=$servedSvg.Content
if ($svgContent -is [byte[]]) {$svgContent=[Text.Encoding]::UTF8.GetString($svgContent)}
Assert-Check ($servedSvg.StatusCode -eq 200 -and $svgContent.Contains('linearGradient') -and $svgContent.Contains('url(#paint)') -and $svgContent.Contains('中文')) 'Safe SVG appearance data was not preserved.'
Assert-Check ($svgContent -notmatch '(script|onload|foreignObject|external\.invalid)') 'Active/external SVG content survived normalization.'
$invalidImage=Join-Path $logDirectory 'invalid-notice-image.png'
Set-Content -LiteralPath $invalidImage -Encoding utf8 -Value '<html>not an image</html>'
Assert-Problem (Upload-NoticeImage $invalidImage $authorized) 400 'NOTICE_IMAGE_INVALID'
$entitySvg=Join-Path $logDirectory 'entity-notice-image.svg'
Set-Content -LiteralPath $entitySvg -Encoding utf8 -Value '<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///private">]><svg xmlns="http://www.w3.org/2000/svg">&secret;</svg>'
Assert-Problem (Upload-NoticeImage $entitySvg $authorized) 400 'NOTICE_IMAGE_INVALID'
Write-Host 'Notice images: canonical multipart upload, real PNG serving, inert SVG geometry/gradient/text preservation and fake/XXE rejection passed.'
