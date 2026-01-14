#!/usr/bin/env pwsh
# Apply Migration 006 - Manufacturer Portal Schema Upgrade
# This script applies the migration to the PostgreSQL database

$migrationFile = "database/migrations/006_upgrade_manufacturer_portal_schema.sql"
$dbUser = "postgres"
$dbHost = "localhost"
$dbName = "tlink_db"
$dbPassword = "Ajwa8770"
$dbPort = 5432

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Applying Migration 006" -ForegroundColor Cyan
Write-Host "Manufacturer Portal Schema Upgrade" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if migration file exists
if (-not (Test-Path $migrationFile)) {
    Write-Host "ERROR: Migration file not found at $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Migration file: $migrationFile" -ForegroundColor Green
Write-Host "Target database: $dbName@$dbHost" -ForegroundColor Green
Write-Host ""

# Create backup before migration
$backupFile = "database/backups/tlink_db_before_migration_006_$(Get-Date -Format 'yyyyMMdd_HHmmss').bak"
$backupDir = Split-Path $backupFile
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

Write-Host "Creating backup..." -ForegroundColor Yellow
$env:PGPASSWORD = $dbPassword
& pg_dump -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $backupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backup created: $backupFile" -ForegroundColor Green
} else {
    Write-Host "✗ Backup failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Applying migration..." -ForegroundColor Yellow

# Apply the migration
$env:PGPASSWORD = $dbPassword
& psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $migrationFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Migration applied successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "New Tables Created:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  • dangerous_goods_declarations" -ForegroundColor Yellow
    Write-Host "  • sample_sds_documents" -ForegroundColor Yellow
    Write-Host "  • email_notifications" -ForegroundColor Yellow
    Write-Host "  • support_requests" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Shipments Table Updated with:" -ForegroundColor Cyan
    Write-Host "  • Manufacturer portal fields" -ForegroundColor Yellow
    Write-Host "  • FedEx API integration fields" -ForegroundColor Yellow
    Write-Host "  • Email notification tracking" -ForegroundColor Yellow
    Write-Host "  • Hazmat flagging columns" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Status: Ready for development!" -ForegroundColor Green
} else {
    Write-Host "✗ Migration failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To restore from backup, run:" -ForegroundColor Yellow
    Write-Host "psql -h localhost -U postgres -d tlink_db < $backupFile" -ForegroundColor Cyan
    exit 1
}

# Clear the password variable
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
