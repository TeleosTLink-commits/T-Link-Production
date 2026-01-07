# T-Link Production Data Import Script
# Purpose: Import production data to Render PostgreSQL database
# Usage: .\import-production-data-final.ps1

# Production Database Configuration
$DB_HOST = "dpg-d5elvvq4d50c73c6k8j0-a.oregon-postgres.render.com"
$DB_PORT = "5432"
$DB_NAME = "tlink_db"
$DB_USER = "tlink_user"
$DB_PASSWORD = "kr7Tf6WnCuo0txIiwaGy3cEL4Xm3IfYJ"

# SQL Script Path
$IMPORT_SCRIPT = "C:\T_Link\data-export\production_import.sql"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "T-Link Production Data Import" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if PSQL is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERROR: psql (PostgreSQL client) not found in PATH" -ForegroundColor Red
    Write-Host "Please install PostgreSQL client tools or add psql to PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Database Configuration:" -ForegroundColor Yellow
Write-Host "  Host: $DB_HOST" -ForegroundColor Gray
Write-Host "  Database: $DB_NAME" -ForegroundColor Gray
Write-Host "  User: $DB_USER" -ForegroundColor Gray
Write-Host ""

# Test connection
Write-Host "Testing database connection..." -ForegroundColor Cyan
try {
    $PGPASSWORD = $DB_PASSWORD
    $env:PGPASSWORD = $DB_PASSWORD
    
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Connection successful" -ForegroundColor Green
    } else {
        Write-Host "✗ Connection failed" -ForegroundColor Red
        Write-Host "Please check credentials and network connectivity" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Connection error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if SQL file exists
if (-not (Test-Path $IMPORT_SCRIPT)) {
    Write-Host "ERROR: Import script not found at $IMPORT_SCRIPT" -ForegroundColor Red
    exit 1
}

Write-Host "Import Script: $IMPORT_SCRIPT" -ForegroundColor Yellow
$fileSize = (Get-Item $IMPORT_SCRIPT).Length / 1KB
Write-Host "File Size: $([Math]::Round($fileSize, 2)) KB" -ForegroundColor Yellow
Write-Host ""

# Confirm before import
Write-Host "WARNING: This will import data into production database!" -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Type 'IMPORT' to proceed or 'CANCEL' to abort"

if ($confirmation -ne "IMPORT") {
    Write-Host "Import cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Starting import..." -ForegroundColor Cyan

# Execute import script
try {
    # Save password to environment for psql
    $env:PGPASSWORD = $DB_PASSWORD
    
    # Execute the SQL file
    $output = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $IMPORT_SCRIPT 2>&1
    
    Write-Host $output
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Import completed successfully" -ForegroundColor Green
        Write-Host ""
        
        # Verify counts
        Write-Host "Verifying data..." -ForegroundColor Cyan
        $verifyOutput = psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c `
            "SELECT 
                (SELECT COUNT(*) FROM test_methods) as test_methods,
                (SELECT COUNT(*) FROM certificates_of_analysis) as coas,
                (SELECT COUNT(*) FROM shipping_supplies) as supplies;" 2>&1
        
        Write-Host $verifyOutput
        
        Write-Host ""
        Write-Host "✓ Data import complete!" -ForegroundColor Green
        Write-Host "✓ Frontend should now display data from: https://t-link-l41i.vercel.app" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Visit https://t-link-l41i.vercel.app and login" -ForegroundColor Gray
        Write-Host "2. Check Dashboard for Test Methods, CoAs, and Supplies counts" -ForegroundColor Gray
        Write-Host "3. Verify API endpoints:" -ForegroundColor Gray
        Write-Host "   - https://tlink-backend.onrender.com/api/test-methods/stats" -ForegroundColor Gray
        Write-Host "   - https://tlink-backend.onrender.com/api/coa/stats" -ForegroundColor Gray
        Write-Host "   - https://tlink-backend.onrender.com/api/sample-inventory/stats" -ForegroundColor Gray
        
    } else {
        Write-Host ""
        Write-Host "✗ Import failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Error during import: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear password from environment
    $env:PGPASSWORD = ""
}
