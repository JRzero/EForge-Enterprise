# Runs inside the owning disposable auth integration fixture. Never touches a user's database.
$postBase = '/api/v1/system/posts'
Assert-Problem (Request $postBase) 401 'AUTHENTICATION_REQUIRED'
Assert-Problem (Request "$postBase`?page=0" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$postBase`?pageSize=101" 'GET' '' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request $postBase 'POST' '{}' $authorized) 400 'VALIDATION_ERROR'
Assert-Problem (Request "$postBase/9223372036854775807" 'GET' '' $authorized) 404 'POST_NOT_FOUND'
Assert-Problem (Request $postBase 'DELETE' '{"ids":["1"]}' $authorized) 409 'POST_IN_USE'
$postCode = "test-$runId"
$postBody = @{ code=$postCode; name="验证岗位-$runId"; sort=7; status='0'; remark='实际持久化验证' } | ConvertTo-Json -Compress
$createdPostResponse = Request $postBase 'POST' $postBody $authorized
Assert-Check ($createdPostResponse.StatusCode -eq 201) 'Creating a post must return HTTP 201.'
$createdPost = $createdPostResponse.Content | ConvertFrom-Json
Assert-Check ($createdPost.id -is [string] -and ($createdPostResponse.Headers.Location -join '') -eq "$postBase/$($createdPost.id)") 'Post identity and Location are incorrect.'
Assert-Problem (Request $postBase 'POST' $postBody $authorized) 409 'POST_CODE_EXISTS'
$duplicateNameBody = @{ code="$postCode-other"; name=$createdPost.name; sort=0; status='0' } | ConvertTo-Json -Compress
Assert-Problem (Request $postBase 'POST' $duplicateNameBody $authorized) 409 'POST_NAME_EXISTS'
$pageResponse = Request "$postBase`?code=$postCode&page=1&pageSize=1" 'GET' '' $authorized
$postPage = $pageResponse.Content | ConvertFrom-Json
Assert-Check ($postPage.total -eq 1 -and $postPage.items.Count -eq 1 -and $postPage.items[0].id -eq $createdPost.id -and !$postPage.PSObject.Properties['rows']) 'Filtered typed paging is incorrect.'
$updatedBody = @{ code=$postCode; name=$createdPost.name; sort=12; status='1'; remark='' } | ConvertTo-Json -Compress
$updatedPostResponse = Request "$postBase/$($createdPost.id)" 'PUT' $updatedBody $authorized
Assert-Check ($updatedPostResponse.StatusCode -eq 200) 'Updating a post failed.'
$storedPost = (Request "$postBase/$($createdPost.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
Assert-Check ($storedPost.sort -eq 12 -and $storedPost.status -eq '1' -and $storedPost.remark -eq '') 'Post edit or remark clearing did not persist.'
$exportFile = Join-Path $logDirectory 'posts-export.xlsx'
Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$postBase/export?code=$postCode&status=1" -Method POST -Headers $authorized -OutFile $exportFile | Out-Null
$archive = [IO.Compression.ZipFile]::OpenRead($exportFile)
try {
    $reader = [IO.StreamReader]::new($archive.GetEntry('xl/worksheets/sheet1.xml').Open())
    try { $sheet = $reader.ReadToEnd() } finally { $reader.Dispose() }
    Assert-Check ($sheet.Contains($postCode) -and $sheet.Contains('停用')) 'Exported workbook must contain the filtered post and converted status.'
} finally { $archive.Dispose() }
Assert-Problem (Request $postBase 'DELETE' (@{ids=@($createdPost.id,'9223372036854775807')} | ConvertTo-Json -Compress) $authorized) 404 'POST_NOT_FOUND'
Assert-Check ((Request "$postBase/$($createdPost.id)" 'GET' '' $authorized).StatusCode -eq 200) 'Missing batch member must not partially delete existing posts.'
$secondBody = @{ code="$postCode-second"; name="第二岗位-$runId"; sort=0; status='0' } | ConvertTo-Json -Compress
$secondPost = (Request $postBase 'POST' $secondBody $authorized).Content | ConvertFrom-Json
$removed = Request $postBase 'DELETE' (@{ids=@($createdPost.id,$secondPost.id,$createdPost.id)} | ConvertTo-Json -Compress) $authorized
Assert-Check ($removed.StatusCode -eq 204) 'Batch deletion must succeed with deduplicated IDs.'
Assert-Problem (Request "$postBase/$($createdPost.id)" 'GET' '' $authorized) 404 'POST_NOT_FOUND'
Assert-Problem (Request "$postBase/$($secondPost.id)" 'GET' '' $authorized) 404 'POST_NOT_FOUND'
$concurrentBody = @{code="$postCode-race"; name="并发岗位-$runId"; sort=0; status='0'} | ConvertTo-Json -Compress
$concurrentUrl = "http://127.0.0.1:$AppPort$postBase"
$concurrentResults = @(1..8 | ForEach-Object -Parallel {
    $response = Invoke-WebRequest -Uri $using:concurrentUrl -Method POST -Body $using:concurrentBody `
        -Headers $using:authorized -ContentType 'application/json' -SkipHttpErrorCheck -TimeoutSec 20
    [pscustomobject]@{Status=$response.StatusCode; Payload=($response.Content | ConvertFrom-Json)}
} -ThrottleLimit 8)
Assert-Check (@($concurrentResults | Where-Object Status -eq 201).Count -eq 1 -and @($concurrentResults | Where-Object Status -eq 409).Count -eq 7) 'Concurrent duplicate creates must produce one success and seven safe conflicts.'
$concurrentId = ($concurrentResults | Where-Object Status -eq 201).Payload.id
Assert-Check ((Request $postBase 'DELETE' (@{ids=@($concurrentId)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Concurrent fixture cleanup failed.'
Write-Host 'Post CRUD, paging, validation, uniqueness, deletion protection and XLSX content verification passed.'
