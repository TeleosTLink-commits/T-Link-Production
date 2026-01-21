# Script to populate file paths from local storage
# IMPORTANT: Set environment variables before running this script:
# $env:DB_PASSWORD='your_database_password'
# $env:DB_HOST='your_database_host'
# $env:DB_USER='your_database_user'
# $env:DB_NAME='your_database_name'

# Check if required environment variables are set
if (-not $env:DB_PASSWORD) {
  Write-Error "DB_PASSWORD environment variable is not set"
  exit 1
}

$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "tlink_db" }

$env:PGPASSWORD = $env:DB_PASSWORD

# Get test method files
$testMethodFiles = Get-ChildItem -Path "C:\T_Link\storage\test-methods" -File | ForEach-Object { $_.FullName }
$sdsFiles = Get-ChildItem -Path "C:\T_Link\storage\sample-documents" -File | Where-Object { $_.Name -like "*sds*" -or $_.Name -like "*SDS*" } | ForEach-Object { $_.FullName }
$coaFiles = Get-ChildItem -Path "C:\T_Link\storage\sample-documents" -File | Where-Object { -not ($_.Name -like "*sds*" -or $_.Name -like "*SDS*") } | ForEach-Object { $_.FullName }

Write-Host "Found $($testMethodFiles.Count) test method files"
Write-Host "Found $($sdsFiles.Count) SDS files"
Write-Host "Found $($coaFiles.Count) CoA files"

# Update test methods
$i = 0
$testMethodIds = psql -h $DB_HOST -U $DB_USER -d $DB_NAME -At -c "SELECT id FROM test_methods ORDER BY created_at LIMIT $($testMethodFiles.Count)" | Where-Object { $_ }

$testMethodIds | ForEach-Object {
  if ($i -lt $testMethodFiles.Count) {
    $id = $_
    $path = $testMethodFiles[$i]
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "UPDATE test_methods SET file_path = '$path' WHERE id = '$id'" | Out-Null
    Write-Host "Updated test method $id with $path"
    $i++
  }
}

# Update SDS files
$i = 0
$sdsIds = psql -h $DB_HOST -U $DB_USER -d $DB_NAME -At -c "SELECT id FROM samples WHERE sds_file_path IS NULL OR sds_file_path = '' ORDER BY created_at LIMIT $($sdsFiles.Count)" | Where-Object { $_ }

$sdsIds | ForEach-Object {
  if ($i -lt $sdsFiles.Count) {
    $id = $_
    $path = $sdsFiles[$i]
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "UPDATE samples SET sds_file_path = '$path' WHERE id = '$id'" | Out-Null
    Write-Host "Updated sample $id SDS with $path"
    $i++
  }
}

# Update CoA files
$i = 0
$coaIds = psql -h $DB_HOST -U $DB_USER -d $DB_NAME -At -c "SELECT id FROM samples WHERE coa_file_path IS NULL OR coa_file_path = '' ORDER BY created_at LIMIT $($coaFiles.Count)" | Where-Object { $_ }

$coaIds | ForEach-Object {
  if ($i -lt $coaFiles.Count) {
    $id = $_
    $path = $coaFiles[$i]
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "UPDATE samples SET coa_file_path = '$path' WHERE id = '$id'" | Out-Null
    Write-Host "Updated sample $id CoA with $path"
    $i++
  }
}

Write-Host "File path updates complete"
