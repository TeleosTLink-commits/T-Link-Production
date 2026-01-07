# T-Link Production Data Import Script
Write-Host "Starting T-Link Production Data Import..." -ForegroundColor Green
Write-Host ""

$env:PGPASSWORD = 'kr7Tf6WnCuo0txIiwaGy3cEL4Xm3IfYJ'
$DB_HOST = 'dpg-d5elvvq4d50c73c6k8j0-a.oregon-postgres.render.com'
$DB_USER = 'tlink_user'
$DB_NAME = 'tlink_db'
$env:PAGER = ''

function Run-SQLFile {
    param([string]$FilePath, [string]$Description)
    Write-Host "Importing: $Description..." -ForegroundColor Cyan
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath -Raw
        $content | psql -h $DB_HOST -U $DB_USER -d $DB_NAME -q
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   Success!" -ForegroundColor Green
        } else {
            Write-Host "   Warning: Some errors occurred" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   File not found, skipping" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "Connecting to production database..." -ForegroundColor Yellow
Write-Host ""

Run-SQLFile "C:\T_Link\database\tm1.sql" "Test Methods Part 1"
Run-SQLFile "C:\T_Link\database\tm2.sql" "Test Methods Part 2"
Run-SQLFile "C:\T_Link\database\tm3.sql" "Test Methods Part 3"
Run-SQLFile "C:\T_Link\database\seed.sql" "Seed Data"

Write-Host "Import complete!" -ForegroundColor Green
Write-Host "Checking counts..." -ForegroundColor Yellow
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM test_methods;"

$env:PGPASSWORD = $null
Write-Host "Done! Refresh your app." -ForegroundColor Green
