# T-Link Production Data Import Script
# This script imports all missing data into your production database

Write-Host "🚀 Starting T-Link Production Data Import..." -ForegroundColor Green
Write-Host ""

# Database connection details
$env:PGPASSWORD = 'kr7Tf6WnCuo0txIiwaGy3cEL4Xm3IfYJ'
$DB_HOST = 'dpg-d5elvvq4d50c73c6k8j0-a.oregon-postgres.render.com'
$DB_USER = 'tlink_user'
$DB_NAME = 'tlink_db'
$env:PAGER = ''

# Function to run SQL file
function Run-SQLFile {
    param([string]$FilePath, [string]$Description)
    
    Write-Host "📊 Importing: $Description..." -ForegroundColor Cyan
    
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath -Raw
        $content | psql -h $DB_HOST -U $DB_USER -d $DB_NAME -q
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Success!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Warning: Some errors occurred" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⏭️  File not found, skipping: $FilePath" -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host "Connecting to production database..." -ForegroundColor Yellow
Write-Host "Database: $DB_NAME @ $DB_HOST" -ForegroundColor Gray
Write-Host ""

# Import test methods data
Run-SQLFile "C:\T_Link\database\tm1.sql" "Test Methods Part 1"
Run-SQLFile "C:\T_Link\database\tm2.sql" "Test Methods Part 2"
Run-SQLFile "C:\T_Link\database\tm3.sql" "Test Methods Part 3"

# Import any other schema files if they exist
Run-SQLFile "C:\T_Link\database\seed.sql" "Seed Data"

Write-Host "✨ Import complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Verifying data..." -ForegroundColor Yellow

# Check counts
$checkQuery = @"
SELECT 
    (SELECT COUNT(*) FROM test_methods) as test_methods,
    (SELECT COUNT(*) FROM certificates_of_analysis) as coas,
    (SELECT COUNT(*) FROM shipping_supplies) as shipping_supplies;
"@

Write-Host ""
Write-Host "Database counts:" -ForegroundColor Cyan
$checkQuery | psql -h $DB_HOST -U $DB_USER -d $DB_NAME

Write-Host ""
Write-Host "🎉 All done! Refresh your T-Link app to see the data." -ForegroundColor Green

# Clean up
$env:PGPASSWORD = $null
