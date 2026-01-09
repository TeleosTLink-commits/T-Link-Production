# Script to populate file paths from local storage
$env:PGPASSWORD='illvriAUF5XcsXFPFuPeuK8YfQplyCJz'

# Get test method files
$testMethodFiles = Get-ChildItem -Path "C:\T_Link\storage\test-methods" -File | ForEach-Object { $_.FullName }
$sdsFiles = Get-ChildItem -Path "C:\T_Link\storage\sample-documents" -File | Where-Object { $_.Name -like "*sds*" -or $_.Name -like "*SDS*" } | ForEach-Object { $_.FullName }
$coaFiles = Get-ChildItem -Path "C:\T_Link\storage\sample-documents" -File | Where-Object { -not ($_.Name -like "*sds*" -or $_.Name -like "*SDS*") } | ForEach-Object { $_.FullName }

Write-Host "Found $($testMethodFiles.Count) test method files"
Write-Host "Found $($sdsFiles.Count) SDS files"
Write-Host "Found $($coaFiles.Count) CoA files"

# Update test methods
$i = 0
$testMethodIds = psql -h dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com -U tlink_user -d tlink_db_zlsw -At -c "SELECT id FROM test_methods ORDER BY created_at LIMIT $($testMethodFiles.Count)" | Where-Object { $_ }

$testMethodIds | ForEach-Object {
  if ($i -lt $testMethodFiles.Count) {
    $id = $_
    $path = $testMethodFiles[$i]
    psql -h dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com -U tlink_user -d tlink_db_zlsw -c "UPDATE test_methods SET file_path = '$path' WHERE id = '$id'" | Out-Null
    Write-Host "Updated test method $id with $path"
    $i++
  }
}

# Update SDS files
$i = 0
$sdsIds = psql -h dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com -U tlink_user -d tlink_db_zlsw -At -c "SELECT id FROM samples WHERE sds_file_path IS NULL OR sds_file_path = '' ORDER BY created_at LIMIT $($sdsFiles.Count)" | Where-Object { $_ }

$sdsIds | ForEach-Object {
  if ($i -lt $sdsFiles.Count) {
    $id = $_
    $path = $sdsFiles[$i]
    psql -h dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com -U tlink_user -d tlink_db_zlsw -c "UPDATE samples SET sds_file_path = '$path' WHERE id = '$id'" | Out-Null
    Write-Host "Updated sample $id SDS with $path"
    $i++
  }
}

# Update CoA files
$i = 0
$coaIds = psql -h dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com -U tlink_user -d tlink_db_zlsw -At -c "SELECT id FROM samples WHERE coa_file_path IS NULL OR coa_file_path = '' ORDER BY created_at LIMIT $($coaFiles.Count)" | Where-Object { $_ }

$coaIds | ForEach-Object {
  if ($i -lt $coaFiles.Count) {
    $id = $_
    $path = $coaFiles[$i]
    psql -h dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com -U tlink_user -d tlink_db_zlsw -c "UPDATE samples SET coa_file_path = '$path' WHERE id = '$id'" | Out-Null
    Write-Host "Updated sample $id CoA with $path"
    $i++
  }
}

Write-Host "File path updates complete"
