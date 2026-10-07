# Dot-sourced inside the owned disposable runtime after existing user/role helpers.
$excelIdentityUser=Create-User "xl-$runId" '105'
$excelIdentityRole=Create-Role 'xl'
$excelIdentityUserId='9007199254740993'
$excelIdentityRoleId='9007199254740995'
function Assert-ExcelIdentityCell($reply,[string]$identity,[string]$name){
    Assert-Check ($reply.StatusCode -eq 200 -and $reply.Content -is [byte[]]) 'Identity export must return an actual XLSX binary.'
    $excelIdentityStream=[IO.MemoryStream]::new([byte[]]$reply.Content)
    $excelIdentityZip=[IO.Compression.ZipArchive]::new($excelIdentityStream,[IO.Compression.ZipArchiveMode]::Read)
    try{
        $excelIdentityReader=[IO.StreamReader]::new($excelIdentityZip.GetEntry('xl/worksheets/sheet1.xml').Open())
        try{$excelIdentityXml=$excelIdentityReader.ReadToEnd();$excelIdentitySheet=[xml]$excelIdentityXml}finally{$excelIdentityReader.Dispose()}
        $excelIdentityNamespaces=[Xml.XmlNamespaceManager]::new($excelIdentitySheet.NameTable);$excelIdentityNamespaces.AddNamespace('s','http://schemas.openxmlformats.org/spreadsheetml/2006/main')
        $excelIdentityCell=$excelIdentitySheet.SelectSingleNode('//s:c[@r="A2"]',$excelIdentityNamespaces)
        Assert-Check ($null -ne $excelIdentityCell -and $excelIdentityCell.t -in @('inlineStr','s')) 'Large identity must be a text cell, never an imprecise Excel number.'
        if($excelIdentityCell.t -eq 'inlineStr'){$excelIdentityValue=$excelIdentityCell.InnerText}
        else{
            $excelIdentityStringsReader=[IO.StreamReader]::new($excelIdentityZip.GetEntry('xl/sharedStrings.xml').Open())
            try{$excelIdentityStrings=[xml]$excelIdentityStringsReader.ReadToEnd()}finally{$excelIdentityStringsReader.Dispose()}
            $excelIdentityValue=$excelIdentityStrings.sst.si[[int]$excelIdentityCell.v].InnerText
        }
        Assert-Check ($excelIdentityValue -ceq $identity) 'Workbook lost exact original SQL identity.'
        Assert-Check ($excelIdentityXml.Contains($name)) 'Workbook lost its filtered row text.'
    }finally{$excelIdentityZip.Dispose();$excelIdentityStream.Dispose()}
}
try{
    # Only transform records created by this script; no existing business identity is changed.
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e "UPDATE sys_user SET user_id=$excelIdentityUserId WHERE user_id=$($excelIdentityUser.id); UPDATE sys_user_role SET user_id=$excelIdentityUserId WHERE user_id=$($excelIdentityUser.id); UPDATE sys_user_post SET user_id=$excelIdentityUserId WHERE user_id=$($excelIdentityUser.id); UPDATE sys_role SET role_id=$excelIdentityRoleId WHERE role_id=$($excelIdentityRole.id);"|Out-Null
    $excelIdentityRead=(Request "/api/v1/system/users/$excelIdentityUserId" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($excelIdentityRead.user.id -ceq $excelIdentityUserId) 'Canonical SQL long user identity is not exact.'
    $excelIdentityRoleRead=(Request "/api/v1/system/roles/$excelIdentityRoleId" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($excelIdentityRoleRead.role.id -ceq $excelIdentityRoleId) 'Canonical SQL long role identity is not exact.'
    # Original system filters select complete SQL calendar days, independently of job-log zoned instants.
    Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -uroot eforge_enterprise -e "UPDATE sys_user SET create_time='2026-03-08 23:59:59' WHERE user_id=$excelIdentityUserId; UPDATE sys_role SET create_time='2026-11-01 00:00:00' WHERE role_id=$excelIdentityRoleId;"|Out-Null
    $excelIdentityDayUsers=(Request "/api/v1/system/users?username=$($excelIdentityUser.username)&beginDate=2026-03-08&endDate=2026-03-08" 'GET' '' $authorized).Content|ConvertFrom-Json
    $excelIdentityDayRoles=(Request "/api/v1/system/roles?key=$($excelIdentityRole.key)&beginDate=2026-11-01&endDate=2026-11-01" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($excelIdentityDayUsers.items.Count -eq 1 -and $excelIdentityDayRoles.items.Count -eq 1) 'Original complete SQL calendar-day boundaries excluded an owned midnight/end-day row.'
    $excelIdentityOutsideUsers=(Request "/api/v1/system/users?username=$($excelIdentityUser.username)&beginDate=2026-03-09&endDate=2026-03-09" 'GET' '' $authorized).Content|ConvertFrom-Json
    $excelIdentityOutsideRoles=(Request "/api/v1/system/roles?key=$($excelIdentityRole.key)&beginDate=2026-10-31&endDate=2026-10-31" 'GET' '' $authorized).Content|ConvertFrom-Json
    Assert-Check ($excelIdentityOutsideUsers.items.Count -eq 0 -and $excelIdentityOutsideRoles.items.Count -eq 0) 'Original SQL calendar-day filtering leaked adjacent owned rows.'
    $excelIdentityUserWorkbook=Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort/api/v1/system/users/export?username=$($excelIdentityUser.username)&beginDate=2026-03-08&endDate=2026-03-08" -Method POST -Headers $authorized -SkipHttpErrorCheck
    Assert-ExcelIdentityCell $excelIdentityUserWorkbook $excelIdentityUserId $excelIdentityUser.username
    $excelIdentityRoleWorkbook=Invoke-WebRequest -Uri "http://127.0.0.1:$AppPort/api/v1/system/roles/export?key=$($excelIdentityRole.key)&beginDate=2026-11-01&endDate=2026-11-01" -Method POST -Headers $authorized -SkipHttpErrorCheck
    Assert-ExcelIdentityCell $excelIdentityRoleWorkbook $excelIdentityRoleId $excelIdentityRole.key
    $excelIdentityRetained=Invoke-Docker exec --env "MYSQL_PWD=$testPassword" $mysqlName mysql -N -B -uroot eforge_enterprise -e "SELECT COUNT(*) FROM sys_user WHERE user_id=$excelIdentityUserId AND user_name='$($excelIdentityUser.username)' AND del_flag='0'; SELECT COUNT(*) FROM sys_role WHERE role_id=$excelIdentityRoleId AND role_key='$($excelIdentityRole.key)' AND del_flag='0';"
    Assert-Check (($excelIdentityRetained -join ',') -ceq '1,1') 'Export changed owned SQL rows.'
    Write-Output 'Canonical XLSX identities: actual SQL user/role IDs beyond JS/Excel precision, string JSON detail, complete filtered HTTP workbooks and unchanged rows passed.'
}finally{
    Assert-Check ((Request '/api/v1/system/users' 'DELETE' (@{ids=@($excelIdentityUserId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Long-ID user cleanup failed.'
    Assert-Check ((Request '/api/v1/system/roles' 'DELETE' (@{ids=@($excelIdentityRoleId)}|ConvertTo-Json -Compress) $authorized).StatusCode -eq 204) 'Long-ID role cleanup failed.'
}
