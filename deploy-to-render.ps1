# Manual deployment script for Render
# Usage: .\deploy-to-render.ps1

$RENDER_DEPLOY_HOOK = "https://api.render.com/deploy/srv-d5g4ap2li9vc738tbi40?key=Pn-x5UQ37kA"

Write-Host "Triggering Render deployment..." -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $RENDER_DEPLOY_HOOK -Method POST
    Write-Host "✅ Deployment triggered successfully!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Yellow
    Write-Host "Check your Render dashboard for deployment progress."
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
}
