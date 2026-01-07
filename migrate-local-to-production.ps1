# T-Link: Migrate Local Database to Production
# Exports data from local PostgreSQL and imports to Render production database

Write-Host "T-Link Data Migration: Local to Production" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Local Database
$LOCAL_HOST = "localhost"
$LOCAL_USER = "postgres"
$LOCAL_DB = "tlink_db"
$LOCAL_PASSWORD = "Ajwa8770"

# Production Database
$PROD_HOST = "dpg-d5elvvq4d50c73c6k8j0-a.oregon-postgres.render.com"
$PROD_USER = "tlink_user"
$PROD_DB = "tlink_db"
$PROD_PASSWORD = "kr7Tf6WnCuo0txIiwaGy3cEL4Xm3IfYJ"

# Export directory
$EXPORT_DIR = "C:\T_Link\data-export"
if (-not (Test-Path $EXPORT_DIR)) {
    New-Item -ItemType Directory -Path $EXPORT_DIR | Out-Null
}

Write-Host "`n[1/5] Checking local database..." -ForegroundColor Cyan
$env:PGPASSWORD = $LOCAL_PASSWORD

$counts = psql -h $LOCAL_HOST -U $LOCAL_USER -d $LOCAL_DB -t -c @"
SELECT 'COAs: ' || COUNT(*)::text FROM certificates_of_analysis
UNION ALL SELECT 'Samples: ' || COUNT(*)::text FROM sample_inventory
UNION ALL SELECT 'Test Methods: ' || COUNT(*)::text FROM test_methods
UNION ALL SELECT 'SDSs: ' || COUNT(*)::text FROM safety_data_sheets
UNION ALL SELECT 'Shipping Supplies: ' || COUNT(*)::text FROM shipping_supplies;
"@

Write-Host $counts -ForegroundColor Green

Write-Host "`n[2/5] Exporting data from local database..." -ForegroundColor Cyan

# Tables in dependency order
$tables = @(
    "test_methods",
    "certificates_of_analysis",
    "sample_inventory",
    "safety_data_sheets",
    "shipping_supplies"
)

foreach ($table in $tables) {
    Write-Host "  Exporting $table..." -NoNewline
    
    $count = psql -h $LOCAL_HOST -U $LOCAL_USER -d $LOCAL_DB -t -c "SELECT COUNT(*) FROM $table;" 2>$null
    
    if ($LASTEXITCODE -eq 0 -and $count.Trim() -gt 0) {
        pg_dump -h $LOCAL_HOST -U $LOCAL_USER -d $LOCAL_DB `
            --table=$table `
            --data-only `
            --column-inserts `
            --file="$EXPORT_DIR\$table.sql" 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " SUCCESS ($($count.Trim()) rows)" -ForegroundColor Green
        } else {
            Write-Host " FAILED" -ForegroundColor Red
        }
    } else {
        Write-Host " (empty)" -ForegroundColor Yellow
    }
}

Write-Host "`n[3/5] Creating missing tables in production..." -ForegroundColor Cyan
$env:PGPASSWORD = $PROD_PASSWORD

# Create test_method_categories if missing
$create_categories = @"
CREATE TABLE IF NOT EXISTS test_method_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"@

Write-Host "  Creating test_method_categories..." -NoNewline
echo $create_categories | psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " SUCCESS" -ForegroundColor Green
} else {
    Write-Host " (exists)" -ForegroundColor Yellow
}

Write-Host "`n[4/5] Importing data to production..." -ForegroundColor Cyan

foreach ($table in $tables) {
    $file = "$EXPORT_DIR\$table.sql"
    
    if (Test-Path $file) {
        Write-Host "  Importing $table..." -NoNewline
        
        # Truncate table first
        psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -c "TRUNCATE TABLE $table RESTART IDENTITY CASCADE;" 2>$null | Out-Null
        
        # Import data
        psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -f $file 2>$null | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $count = psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -t -c "SELECT COUNT(*) FROM $table;" 2>$null
            Write-Host " SUCCESS ($($count.Trim()) rows)" -ForegroundColor Green
        } else {
            Write-Host " FAILED" -ForegroundColor Red
        }
    }
}

Write-Host "`n[5/5] Verifying production data..." -ForegroundColor Cyan

$prod_counts = psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -t -c @"
SELECT 'Test Methods: ' || COUNT(*)::text FROM test_methods
UNION ALL SELECT 'COAs: ' || COUNT(*)::text FROM certificates_of_analysis
UNION ALL SELECT 'Samples: ' || COUNT(*)::text FROM sample_inventory
UNION ALL SELECT 'SDSs: ' || COUNT(*)::text FROM safety_data_sheets
UNION ALL SELECT 'Shipping Supplies: ' || COUNT(*)::text FROM shipping_supplies;
"@

Write-Host $prod_counts -ForegroundColor Green

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "MIGRATION COMPLETE!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

Write-Host "`nIMPORTANT: File Uploads" -ForegroundColor Yellow
Write-Host "Your COA and SDS PDF files are still in:" -ForegroundColor Yellow
Write-Host "  C:\T_Link\backend\uploads\" -ForegroundColor White
Write-Host "`nThese files are NOT on the production server." -ForegroundColor Yellow
Write-Host "Database records have been created, but files need to be:" -ForegroundColor Yellow
Write-Host "  1. Re-uploaded through the production UI at https://t-link-alpha.vercel.app" -ForegroundColor White
Write-Host "  OR" -ForegroundColor Yellow
Write-Host "  2. Uploaded to cloud storage (Cloudinary/AWS S3)" -ForegroundColor White

Write-Host "`nRefresh your app at: https://t-link-alpha.vercel.app" -ForegroundColor Cyan
