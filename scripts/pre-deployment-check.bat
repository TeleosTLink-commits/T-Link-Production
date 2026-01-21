@echo off
REM Pre-Deployment Verification Checklist
REM Major Upgrades Branch - Production Ready

cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║   T-Link Major Upgrades - Pre-Deployment Verification         ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

setlocal enabledelayedexpansion

set checks_passed=0
set checks_failed=0

REM ======================== GIT CHECKS ========================
echo [GIT CHECKS]
if exist c:\T_Link\.git (
    echo [✓] Git repository exists
    set /a checks_passed+=1
) else (
    echo [✗] Git repository NOT found
    set /a checks_failed+=1
)

REM ======================== BACKEND CHECKS ========================
echo.
echo [BACKEND CHECKS]

if exist c:\T_Link\backend\.env (
    echo [✓] Backend .env file exists
    set /a checks_passed+=1
) else (
    echo [✗] Backend .env NOT found
    set /a checks_failed+=1
)

findstr /M "dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com" c:\T_Link\backend\.env >nul
if !errorlevel! equ 0 (
    echo [✓] Backend configured for production database
    set /a checks_passed+=1
) else (
    echo [✗] Backend NOT configured for production database
    set /a checks_failed+=1
)

if exist c:\T_Link\backend\tsconfig.json (
    echo [✓] Backend TypeScript config exists
    set /a checks_passed+=1
) else (
    echo [✗] Backend TypeScript config NOT found
    set /a checks_failed+=1
)

REM ======================== FRONTEND CHECKS ========================
echo.
echo [FRONTEND CHECKS]

if exist c:\T_Link\frontend\.env (
    echo [✓] Frontend .env file exists
    set /a checks_passed+=1
) else (
    echo [✗] Frontend .env NOT found
    set /a checks_failed+=1
)

if exist c:\T_Link\frontend\tsconfig.json (
    echo [✓] Frontend TypeScript config exists
    set /a checks_passed+=1
) else (
    echo [✗] Frontend TypeScript config NOT found
    set /a checks_failed+=1
)

REM ======================== FILE STRUCTURE CHECKS ========================
echo.
echo [FILE STRUCTURE CHECKS]

if exist c:\T_Link\backend\src\routes (
    echo [✓] Backend routes folder exists
    set /a checks_passed+=1
) else (
    echo [✗] Backend routes folder NOT found
    set /a checks_failed+=1
)

if exist c:\T_Link\frontend\src\pages (
    echo [✓] Frontend pages folder exists
    set /a checks_passed+=1
) else (
    echo [✗] Frontend pages folder NOT found
    set /a checks_failed+=1
)

if not exist "c:\T_Link\frontend\src\pages\ManufacturerPortal.footer.css" (
    echo [✓] Orphaned CSS file deleted
    set /a checks_passed+=1
) else (
    echo [✗] Orphaned CSS file still exists
    set /a checks_failed+=1
)

REM ======================== DOCUMENTATION CHECKS ========================
echo.
echo [DOCUMENTATION CHECKS]

if exist c:\T_Link\COMPREHENSIVE_AUDIT_SUMMARY.md (
    echo [✓] Comprehensive audit summary exists
    set /a checks_passed+=1
) else (
    echo [✗] Comprehensive audit summary NOT found
    set /a checks_failed+=1
)

if exist c:\T_Link\CLOUDINARY_DB_MIGRATION_COMPLETE.md (
    echo [✓] Cloudinary DB migration doc exists
    set /a checks_passed+=1
) else (
    echo [✗] Cloudinary DB migration doc NOT found
    set /a checks_failed+=1
)

if exist c:\T_Link\MAJOR_UPGRADES_DEPLOYMENT_PLAN.md (
    echo [✓] Deployment plan exists
    set /a checks_passed+=1
) else (
    echo [✗] Deployment plan NOT found
    set /a checks_failed+=1
)

REM ======================== SUMMARY ========================
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    VERIFICATION SUMMARY                         ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo Passed: %checks_passed%
echo Failed: %checks_failed%
echo.

if %checks_failed% equ 0 (
    echo [SUCCESS] All checks passed! Ready for deployment.
    echo.
    echo Next Steps:
    echo   1. Build backend:    cd c:\T_Link\backend ^&^& npm run build
    echo   2. Build frontend:   cd c:\T_Link\frontend ^&^& npm run build
    echo   3. Commit changes:   git add -A ^&^& git commit -m "Production deployment"
    echo   4. Merge to main:    git checkout main ^&^& git merge major-upgrades
    echo   5. Push to GitHub:   git push origin main
    echo.
    echo Deployments will trigger automatically:
    echo   - Render (backend):  https://dashboard.render.com
    echo   - Vercel (frontend): https://vercel.com/dashboard
    echo.
) else (
    echo [FAILED] Please fix the failed checks before deploying.
    exit /b 1
)

pause
