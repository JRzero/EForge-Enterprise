# Dot-sourced after the user and identity helpers in the disposable auth fixture.
# Check a real multipart request and unchanged SQL, not just the reader in isolation.
function ImportFile-Request([string]$kind, [string]$path) {
    $endpoint = if ($kind -eq 'canonical') { "$userBase/import?updateExisting=true" } else { '/system/user/importData?updateSupport=true' }
    $form = if ($path) { @{file=(Get-Item -LiteralPath $path)} } else { @{missing='file'} }
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort$endpoint" -Method POST -Form $form -Headers $authorized -SkipHttpErrorCheck -TimeoutSec 30
    $content = $response.Content
    if ($content -is [byte[]]) { $content = [Text.Encoding]::UTF8.GetString($content) }
    return @{StatusCode=$response.StatusCode;Content=$content;Headers=$response.Headers;Result=($content | ConvertFrom-Json)}
}
function ImportFile-Snapshot([string]$id) {
    return Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql --default-character-set=utf8mb4 -N -B -uroot eforge_enterprise -e "SELECT JSON_OBJECT('nickname',nick_name,'department',dept_id,'status',status,'email',email,'phone',phonenumber,'passwordFingerprint',SHA2(password,256),'roles',(SELECT GROUP_CONCAT(role_id ORDER BY role_id) FROM sys_user_role WHERE user_id=$id),'posts',(SELECT GROUP_CONCAT(post_id ORDER BY post_id) FROM sys_user_post WHERE user_id=$id)) FROM sys_user WHERE user_id=$id;"
}
function ImportFile-Rejected($response, [string]$kind, [string]$code) {
    if ($kind -eq 'canonical') { Assert-Problem $response 400 $code }
    else {
        $legacyCode = if ($code -eq 'USER_IMPORT_EMPTY') { 500 } else { 400 }
        Assert-Check ($response.StatusCode -eq 200 -and $response.Result.code -eq $legacyCode) 'Legacy invalid workbooks must use a controlled validation envelope.'
        if ($code -eq 'USER_IMPORT_EMPTY') { Assert-Check ($response.Result.msg -eq '导入用户数据不能为空！') 'Legacy empty data must retain its existing validation message.' }
        Assert-Check ($response.Result.msg -notmatch 'org\.apache|java\.|Exception|StackTrace') 'Legacy file rejection leaked a parser exception.'
    }
}

$importFileUser = $null
try {
    $importFileUser = Create-User "uf-$runId" '103'
    $importFileRow = @('103',$importFileUser.username,'Unexpected file write','','','未知','正常')
    $importFileValid = User-Workbook "file-valid-$runId" @(,$importFileRow)
    $importFileWrongExtension = Join-Path $logDirectory "file-extension-$runId.txt"
    $importFileWrongSignature = Join-Path $logDirectory "file-signature-$runId.xls"
    Copy-Item -LiteralPath $importFileValid -Destination $importFileWrongExtension
    Copy-Item -LiteralPath $importFileValid -Destination $importFileWrongSignature
    $importFileBroken = Join-Path $logDirectory "file-broken-$runId.xlsx"
    [IO.File]::WriteAllText($importFileBroken, 'This is not a spreadsheet.')
    $importFileZero = Join-Path $logDirectory "file-zero-$runId.xlsx"
    [IO.File]::WriteAllBytes($importFileZero, [byte[]]::new(0))
    $importFileEmpty = User-Workbook "file-empty-$runId" @()
    $importFileHeaderInput = Join-Path $logDirectory "file-header-$runId.json"
    $importFileHeader = Join-Path $logDirectory "file-header-$runId.xlsx"
    @{rows=@(,$importFileRow);headers=@('部门编号','错误表头','用户名称','用户邮箱','手机号码','用户性别','账号状态')} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $importFileHeaderInput -Encoding utf8
    & node (Join-Path $repoRoot 'web/scripts/create-user-workbook-fixture.mjs') $importFileHeader $importFileHeaderInput
    Assert-Check ($LASTEXITCODE -eq 0) 'Preparing the missing-column workbook failed.'

    $importFileOverRows = [object[]]::new(1001)
    for ($index = 0; $index -lt $importFileOverRows.Length; $index++) { $importFileOverRows[$index] = @('','','','','','','') }
    $importFileOverRows[0] = $importFileRow
    $importFileOver = User-Workbook "file-over-rows-$runId" $importFileOverRows
    # The raw body exceeds Spring's multipart limit. This is a separate boundary
    # from the reader's own bounded stream, since no controller can receive it.
    $importFileOversize = Join-Path $logDirectory "file-oversize-$runId.xlsx"
    [IO.File]::WriteAllBytes($importFileOversize, [byte[]]::new(10 * 1024 * 1024 + 1))

    foreach ($importFileKind in @('canonical','legacy')) {
        $importFileBefore = ImportFile-Snapshot $importFileUser.id
        $importFileMissing = ImportFile-Request $importFileKind ''
        if ($importFileKind -eq 'canonical') { Assert-Problem $importFileMissing 400 'VALIDATION_ERROR' }
        else { ImportFile-Rejected $importFileMissing $importFileKind 'USER_IMPORT_FILE_INVALID' }
        Assert-Check ((ImportFile-Snapshot $importFileUser.id) -ceq $importFileBefore) 'A missing multipart file modified the target user.'
        foreach ($importFileCase in @(
            @{file=$importFileWrongExtension;code='USER_IMPORT_FILE_INVALID'},
            @{file=$importFileWrongSignature;code='USER_IMPORT_FILE_INVALID'},
            @{file=$importFileBroken;code='USER_IMPORT_FILE_INVALID'},
            @{file=$importFileZero;code='USER_IMPORT_FILE_INVALID'},
            @{file=$importFileEmpty;code='USER_IMPORT_EMPTY'},
            @{file=$importFileHeader;code='USER_IMPORT_FILE_INVALID'},
            @{file=$importFileOver;code='USER_IMPORT_TOO_LARGE'})) {
            ImportFile-Rejected (ImportFile-Request $importFileKind $importFileCase.file) $importFileKind $importFileCase.code
            Assert-Check ((ImportFile-Snapshot $importFileUser.id) -ceq $importFileBefore) 'A rejected workbook partially updated SQL before file validation completed.'
        }
        $importFileTransport = ImportFile-Request $importFileKind $importFileOversize
        if ($importFileKind -eq 'canonical') { Assert-Problem $importFileTransport 413 'HTTP_413' }
        else { Assert-Check ($importFileTransport.StatusCode -eq 200 -and $importFileTransport.Result.code -eq 500) 'The legacy container upload limit changed its existing envelope.' }
        Assert-Check ((ImportFile-Snapshot $importFileUser.id) -ceq $importFileBefore) 'The container-rejected upload modified the target user.'

        # Keep 1,000 physical data rows, with only the final row populated, to prove
        # the inclusive row-position boundary without writing 1,000 fixture users.
        $importFileLimitRows = [object[]]::new(1000)
        for ($index = 0; $index -lt $importFileLimitRows.Length; $index++) { $importFileLimitRows[$index] = @('','','','','','','') }
        $importFileNickname = "Accepted $importFileKind"
        $importFileLimitRows[999] = @('103',$importFileUser.username,$importFileNickname,'','','未知','正常')
        $importFileLimit = User-Workbook "file-limit-$importFileKind-$runId" $importFileLimitRows
        $importFileAccepted = ImportFile-Request $importFileKind $importFileLimit
        if ($importFileKind -eq 'canonical') {
            Assert-Check ($importFileAccepted.StatusCode -eq 200 -and $importFileAccepted.Result.updated -eq 1 -and $importFileAccepted.Result.failed -eq 0 -and $importFileAccepted.Result.total -eq 1) 'A valid workbook at the row limit must import exactly its nonempty row.'
        }
        else { Assert-Check ($importFileAccepted.StatusCode -eq 200 -and $importFileAccepted.Result.code -eq 200) 'Legacy import rejected a valid workbook at the row limit.' }
        $importFileSaved = (Request "$userBase/$($importFileUser.id)" 'GET' '' $authorized).Content | ConvertFrom-Json
        Assert-Check ($importFileSaved.user.displayName -ceq $importFileNickname) 'The boundary workbook did not persist its valid final row.'
        Write-Output "User import file ${importFileKind}: multipart limits, extension/signature/corruption/header/empty rejection, whole-file 1001-row rejection without SQL changes and inclusive 1000-row acceptance passed."
    }
}
finally {
    if ($importFileUser) { Assert-Check ((Request $userBase 'DELETE' (@{ids=@($importFileUser.id)} | ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'User import file fixture cleanup failed.' }
}
