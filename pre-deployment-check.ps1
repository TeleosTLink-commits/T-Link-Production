# Pre-Deployment Verification Script for Major Upgrades Branch
# This script verifies all systems are ready for production deployment

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   T-Link Major Upgrades - Pre-Deployment Verification         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$checks_passed = 0
$checks_failed = 0
$warnings = @()

# Helper functions
function Test-Check {
    param([string]$CheckName, [scriptblock]$TestBlock)
    Write-Host "🔍 Checking: $CheckName..." -NoNewline
    try {
        $result = & $TestBlock
        if ($result -eq $true) {
            Write-Host " PASS" -ForegroundColor Green
            $script:checks_passed++
        } else {
            Write-Host " FAIL: $result" -ForegroundColor Red
            $script:checks_failed++
        }
    }
    catch {
        Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $script:checks_failed++
    }
}

function Test-Warning {
    param([string]$WarningText)
    $script:warnings += $WarningText
}

# ============================================================================
# 1. GIT CHECKS
# ============================================================================
Write-Host "`n📦 GIT REPOSITORY CHECKS" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

Test-Check "Git repository exists" {
    (Test-Path "c:\T_Link\.git") -eq $true
}

Test-Check "Current branch is major-upgrades or ready to merge" {
    $branch = git -C c:\T_Link branch --show-current 2>$null
    ($branch -eq "major-upgrades" -or $branch -eq "main") -eq $true
}

Test-Check "Git status clean (no uncommitted changes)" {
    $status = git -C c:\T_Link status --porcelain 2>$null
    [string]::IsNullOrWhiteSpace($status)
}

# ============================================================================
# 2. BACKEND CHECKS
# ============================================================================
Write-Host "`n🔧 BACKEND CONFIGURATION CHECKS" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

Test-Check "Backend .env exists" {
    Test-Path "c:\T_Link\backend\.env"
}

Test-Check "Backend .env has production database host" {
    $env_content = Get-Content "c:\T_Link\backend\.env" -Raw
    $env_content -match "dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com"
}

Test-Check "Backend .env has production database name" {
    $env_content = Get-Content "c:\T_Link\backend\.env" -Raw
    $env_content -match "tlink_db_zlsw"
}

Test-Check "Backend .env has Cloudinary credentials" {
    $env_content = Get-Content "c:\T_Link\backend\.env" -Raw
    ($env_content -match "CLOUDINARY_CLOUD_NAME") -and ($env_content -match "CLOUDINARY_API_KEY")
}

Test-Check "Backend package.json has correct scripts" {
    $pkg = Get-Content "c:\T_Link\backend\package.json" | ConvertFrom-Json
    ($pkg.scripts.build -ne $null) -and ($pkg.scripts.test -ne $null)
}

Test-Check "Backend TypeScript config exists" {
    Test-Path "c:\T_Link\backend\tsconfig.json"
}

# ============================================================================
# 3. FRONTEND CHECKS
# ============================================================================
Write-Host "`n🎨 FRONTEND CONFIGURATION CHECKS" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

Test-Check "Frontend .env exists" {
    Test-Path "c:\T_Link\frontend\.env"
}

Test-Check "Frontend .env has API URL configured" {
    $env_content = Get-Content "c:\T_Link\frontend\.env" -Raw
    $env_content -match "VITE_API_URL"
}

Test-Check "Frontend package.json has correct scripts" {
    $pkg = Get-Content "c:\T_Link\frontend\package.json" | ConvertFrom-Json
    ($pkg.scripts.build -ne $null) -and ($pkg.scripts.test -ne $null)
}

Test-Check "Frontend TypeScript config exists" {
    Test-Path "c:\T_Link\frontend\tsconfig.json"
}

Test-Check "Vite config exists" {
    Test-Path "c:\T_Link\frontend\vite.config.ts"
}

# ============================================================================
# 4. DATABASE CHECKS
# ============================================================================
Write-Host "`n🗄️  DATABASE CONFIGURATION CHECKS" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

Test-Check "Database config file exists" {
    Test-Path "c:\T_Link\backend\src\config\database.ts"
}

Test-Check "Database migrations folder exists" {
    Test-Path "c:\T_Link\database\migrations"
}

Test-Check "Database schema files present" {
    (Test-Path "c:\T_Link\database\schema.sql") -or (Test-Path "c:\T_Link\database\schema_*.sql")
}

# ============================================================================
# 5. FILE STRUCTURE CHECKS
# ============================================================================
Write-Host "`n📁 FILE STRUCTURE CHECKS" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

Test-Check "Backend src/routes folder exists" {
    Test-Path "c:\T_Link\backend\src\routes"
}

Test-Check "Frontend src/pages folder exists" {
    Test-Path "c:\T_Link\frontend\src\pages"
}

Test-Check "Orphaned ManufacturerPortal.footer.css deleted" {
    -not (Test-Path "c:\T_Link\frontend\src\pages\ManufacturerPortal.footer.css")
}

# ============================================================================
# 6. DOCUMENTATION CHECKS
# ============================================================================
Write-Host "`n📚 DOCUMENTATION CHECKS" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

Test-Check "COMPREHENSIVE_AUDIT_SUMMARY.md exists" {
    Test-Path "c:\T_Link\COMPREHENSIVE_AUDIT_SUMMARY.md"
}

Test-Check "CLOUDINARY_DB_MIGRATION_COMPLETE.md exists" {
    Test-Path "c:\T_Link\CLOUDINARY_DB_MIGRATION_COMPLETE.md"
}

Test-Check "MAJOR_UPGRADES_DEPLOYMENT_PLAN.md exists" {
    Test-Path "c:\T_Link\MAJOR_UPGRADES_DEPLOYMENT_PLAN.md"
}

Test-Check "MULTI_SAMPLE_SHIPMENTS.md exists" {
    Test-Path "c:\T_Link\MULTI_SAMPLE_SHIPMENTS.md"
}

# ============================================================================
# 7. DEPENDENCIES CHECK
# ============================================================================
Write-Host "`n📦 DEPENDENCIES VALIDATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

Test-Check "Backend has required packages listed" {
    $pkg = Get-Content "c:\T_Link\backend\package.json" | ConvertFrom-Json
    ($pkg.dependencies.'express' -ne $null) -and ($pkg.dependencies.'pg' -ne $null)
}

Test-Check "Frontend has required packages listed" {
    $pkg = Get-Content "c:\T_Link\frontend\package.json" | ConvertFrom-Json
    ($pkg.dependencies.'react' -ne $null) -and ($pkg.dependencies.'react-router-dom' -ne $null)
}

# ============================================================================
# 8. DEPLOYMENT CONFIGURATION CHECKS
# ============================================================================
Write-Host "`n🚀 DEPLOYMENT CONFIGURATION CHECKS" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

Test-Check "Render deployment config present" {
    (Test-Path "c:\T_Link\backend\Procfile") -or (Test-Path "c:\T_Link\vercel.json")
}

Test-Check "Vercel deployment config present" {
    (Test-Path "c:\T_Link\vercel.json") -and (Test-Path "c:\T_Link\frontend\vercel.json")
}

# ============================================================================
# 9. ENVIRONMENT VARIABLES VALIDATION
# ============================================================================
Write-Host "`n🔐 ENVIRONMENT VARIABLES VALIDATION" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Yellow

$backend_env = Get-Content "c:\T_Link\backend\.env" -Raw

Test-Check "JWT_SECRET configured" {
    $backend_env -match "JWT_SECRET=.{32,}"
}

Test-Check "Database credentials configured" {
    ($backend_env -match "DB_HOST=") -and ($backend_env -match "DB_USER=") -and ($backend_env -match "DB_PASSWORD=")
}

Test-Check "Database SSL enabled for production" {
    $backend_env -match "DB_SSL=true"
}

Test-Check "Node environment set to development" {
    $backend_env -match "NODE_ENV=development"
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    VERIFICATION SUMMARY                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "✅ PASSED: $checks_passed" -ForegroundColor Green
Write-Host "❌ FAILED: $checks_failed" -ForegroundColor Red

if ($warnings.Count -gt 0) {
    Write-Host "`n⚠️  WARNINGS:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "   • $warning" -ForegroundColor Yellow
    }
}

# ============================================================================
# RECOMMENDATIONS
# ============================================================================
if ($checks_failed -eq 0) {
    Write-Host "`n🎉 ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host "`nNext Steps:" -ForegroundColor Green
    Write-Host "  1. Run local build verification:" -ForegroundColor Green
    Write-Host "     cd c:\T_Link\backend ; npm install ; npm run build" -ForegroundColor Green
    Write-Host "     cd c:\T_Link\frontend ; npm install ; npm run build" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host "  2. Commit changes:" -ForegroundColor Green
    Write-Host "     git add -A ; git commit -m 'Production deployment: Major Upgrades Branch'" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host "  3. Merge to main branch:" -ForegroundColor Green
    Write-Host "     git checkout main ; git merge major-upgrades ; git push origin main" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host "  4. Monitor deployments:" -ForegroundColor Green
    Write-Host "     Render: https://dashboard.render.com" -ForegroundColor Green
    Write-Host "     Vercel: https://vercel.com/dashboard" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host "  5. Verify production:" -ForegroundColor Green
    Write-Host "     See MAJOR_UPGRADES_DEPLOYMENT_PLAN.md for detailed verification steps" -ForegroundColor Green
} else {
    Write-Host "`n❌ SOME CHECKS FAILED" -ForegroundColor Red
    Write-Host "`nPlease fix the failed checks before proceeding with deployment." -ForegroundColor Red
    exit 1
}

Write-Host "`n" -ForegroundColor Cyan
