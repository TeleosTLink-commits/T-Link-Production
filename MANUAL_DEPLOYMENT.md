# Manual Deployment Instructions

Since auto-deploy isn't triggering, here's how to manually deploy:

## Render (Backend) - Manual Deployment

1. Go to https://dashboard.render.com
2. Select your **tlink-production-backend** service
3. Click **Manual Deploy** → **Deploy latest commit**
4. Or click **Trigger Deploy** button

**Note:** Backend doesn't need redeployment - only frontend was changed.

## Vercel (Frontend) - Manual Deployment

### Option 1: Via Vercel Dashboard (Easiest)
1. Go to https://vercel.com/dashboard
2. Select your **T-Link** project
3. Go to **Deployments** tab
4. Click **Redeploy** on the latest deployment
5. Or go to **Settings** → **Git** → Click **Redeploy**

### Option 2: Via Vercel CLI
```bash
cd C:\T_Link\frontend
npm install -g vercel
vercel --prod
```

### Option 3: Force Git Push
```bash
cd C:\T_Link
git commit --allow-empty -m "trigger deploy"
git push origin main
```

## Environment Variable Setup (CRITICAL)

### Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select T-Link project
3. **Settings** → **Environment Variables**
4. Add/Update:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://tlink-production-backend.onrender.com/api`
   - **Environments:** Production (check)
5. Click **Save**
6. **Redeploy** the application

## Verify Deployment

### Check Vercel Deployment:
```bash
# Test production frontend
curl https://t-link-production.vercel.app
```

### Check Render Backend:
```bash
# Test backend health
curl https://tlink-production-backend.onrender.com/health
```

## Troubleshooting Git Push

If git push isn't working:

```bash
# Check repository status
git status
git log --oneline -3

# Check remote
git remote -v

# Force add and commit
git add -A
git commit -m "fix: Frontend production configuration"

# Check if there are changes
git diff HEAD

# Force push if needed (use with caution)
git push -f origin main
```

## Quick Local Test

Before deploying, test locally with production URL:

```bash
cd C:\T_Link\frontend
npm run build
npm run preview
```

Open browser to the preview URL and test:
- Login works
- Data loads (not "failed to load")
- Logout redirects to /login

## Files Changed
- ✅ `frontend/.env` - Production backend URL
- ✅ `frontend/.env.production` - Production build config  
- ✅ `frontend/src/components/Layout.tsx` - Logout navigation fix

## Expected Result

After deployment:
1. Visit https://t-link-production.vercel.app
2. Login → Data loads from backend
3. Click Logout → Redirects to /login
4. No "failed to load" errors
