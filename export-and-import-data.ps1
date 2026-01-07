# T-Link: Export Local Data and Import to Production
# This script exports data from your local database and imports it to Render production

Write-Host "T-Link Data Migration Script" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Local Database Connection (PostgreSQL on localhost)
$LOCAL_HOST = "localhost"
$LOCAL_PORT = "5432"
$LOCAL_DB = "tlink_db"
$LOCAL_USER = "postgres"
Write-Host "`nEnter your LOCAL database password:" -ForegroundColor Yellow
$LOCAL_PASSWORD = Read-Host -AsSecureString
$LOCAL_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($LOCAL_PASSWORD)
)

# Production Database Connection (Render)
$PROD_HOST = "dpg-d5elvvq4d50c73c6k8j0-a.oregon-postgres.render.com"
$PROD_PORT = "5432"
$PROD_DB = "tlink_db"
$PROD_USER = "tlink_user"
$PROD_PASSWORD = "kr7Tf6WnCuo0txIiwaGy3cEL4Xm3IfYJ"

# Export directory
$EXPORT_DIR = "C:\T_Link\data-export"
if (-not (Test-Path $EXPORT_DIR)) {
    New-Item -ItemType Directory -Path $EXPORT_DIR | Out-Null
    Write-Host "`nCreated export directory: $EXPORT_DIR" -ForegroundColor Green
}

Write-Host "`nStep 1: Exporting data from LOCAL database..." -ForegroundColor Cyan

# Tables to export (in order for foreign key dependencies)
$tables = @(
    "test_method_categories",
    "test_methods",
    "certificates_of_analysis",
    "sample_inventory",
    "safety_data_sheets",
    "shipping_supplies"
)

$env:PGPASSWORD = $LOCAL_PASSWORD_PLAIN

foreach ($table in $tables) {
    Write-Host "  Exporting $table..." -NoNewline
    
    # Check if table exists and has data
    $count = psql -h $LOCAL_HOST -U $LOCAL_USER -d $LOCAL_DB -t -c "SELECT COUNT(*) FROM $table;" 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        $count = $count.Trim()
        
        if ([int]$count -gt 0) {
            # Export data as INSERT statements
            pg_dump -h $LOCAL_HOST -U $LOCAL_USER -d $LOCAL_DB `
                --table=$table `
                --data-only `
                --column-inserts `
                --file="$EXPORT_DIR\$table.sql" 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host " SUCCESS ($count rows)" -ForegroundColor Green
            } else {
                Write-Host " FAILED - Export failed" -ForegroundColor Red
            }
        } else {
            Write-Host " (empty, skipped)" -ForegroundColor Yellow
        }
    } else {
        Write-Host " (table not found, skipped)" -ForegroundColor Yellow
    }
}

Write-Host "`nStep 2: Creating missing tables in PRODUCTION..." -ForegroundColor Cyan

$env:PGPASSWORD = $PROD_PASSWORD

# Create test_method_categories table if it doesn't exist
$create_categories = @"
CREATE TABLE IF NOT EXISTS test_method_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"@

Write-Host "  Creating test_method_categories table..." -NoNewline
echo $create_categories | psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " SUCCESS" -ForegroundColor Green
} else {
    Write-Host " (already exists or error)" -ForegroundColor Yellow
}

Write-Host "`nStep 3: Importing data to PRODUCTION database..." -ForegroundColor Cyan

foreach ($table in $tables) {
    $file = "$EXPORT_DIR\$table.sql"
    
    if (Test-Path $file) {
        Write-Host "  Importing $table..." -NoNewline
        
        # First, truncate the table (careful! this deletes existing data)
        psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -c "TRUNCATE TABLE $table CASCADE;" 2>$null
        
        # Import the data
        psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -f $file 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            # Get count
            $count = psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -t -c "SELECT COUNT(*) FROM $table;"
            $count = $count.Trim()
            Write-Host " SUCCESS ($count rows)" -ForegroundColor Green
        } else {
            Write-Host " FAILED - Import failed" -ForegroundColor Red
        }
    }
}

Write-Host "`nStep 4: Verifying production data..." -ForegroundColor Cyan

$verify_queries = @(
    @{Name="Test Methods"; Query="SELECT COUNT(*) FROM test_methods;"},
    @{Name="COAs"; Query="SELECT COUNT(*) FROM certificates_of_analysis;"},
    @{Name="Samples"; Query="SELECT COUNT(*) FROM sample_inventory;"},
    @{Name="SDSs"; Query="SELECT COUNT(*) FROM safety_data_sheets;"},
    @{Name="Shipping Supplies"; Query="SELECT COUNT(*) FROM shipping_supplies;"}
)

foreach ($check in $verify_queries) {
    $result = psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB -t -c $check.Query 2>$null
    if ($LASTEXITCODE -eq 0) {
        $count = $result.Trim()
        Write-Host ("  {0,-20} : {1} records" -f $check.Name, $count) -ForegroundColor Green
    }
}

Write-Host "`nMigration complete!" -ForegroundColor Green
Write-Host "Refresh your app at: https://t-link-alpha.vercel.app" -ForegroundColor Cyan
