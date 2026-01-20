# Major Upgrades Branch - Production Deployment Plan
**Date:** January 20, 2026  
**Status:** Ready for Deployment  
**Target:** Merge to main and deploy to production

---

## 🎯 Deployment Overview

The **Major Upgrades Branch** contains three major features:
1. ✅ **Manufacturer Portal** - Customer-facing dashboard for CoA lookup, inventory search, shipment tracking
2. ✅ **Multi-Sample Shipments** - Support for 1-10 items per shipment (previously 1 only)
3. ✅ **Enhanced Logistics** - FedEx integration, hazmat warnings, improved processing workflow

**Database:** Already connected to production (tlink_db_zlsw)  
**File Storage:** Already connected to production Cloudinary  
**Status:** Code complete, tested, ready to merge

---

## 📋 Pre-Deployment Checklist

### ✅ Code & Configuration
- [x] `.env` updated with production database credentials
- [x] `.env.example` updated for team consistency
- [x] Cloudinary credentials configured
- [x] FedEx API keys configured (sandbox/production)
- [x] SMTP/Email configuration ready
- [x] JWT secrets configured
- [x] All routes properly registered in server.ts
- [x] All frontend components in use (no orphaned files)
- [x] No duplicate route definitions
- [x] No CSS conflicts

### ✅ Testing Completed
- [x] System audit completed (COMPREHENSIVE_AUDIT_SUMMARY.md)
- [x] All 12 backend routes verified functional
- [x] All 27 frontend components verified working
- [x] Multi-sample shipment workflow tested
- [x] Manufacturer portal access verified
- [x] File upload/download via Cloudinary verified
- [x] Authentication flow tested
- [x] Database connection pooling optimized

### ✅ Build & Performance
- [x] TypeScript strict mode - no errors
- [x] Vite build configuration optimized
- [x] Frontend bundle optimized for Vercel
- [x] Backend optimized for Render
- [x] Database connection pooling (20 max connections)
- [x] Query optimization complete
- [x] CORS properly configured

### ✅ Security
- [x] RBAC (role-based access control) implemented
- [x] JWT authentication 24h expiration
- [x] Password hashing with bcrypt
- [x] SQL injection prevention (parameterized queries)
- [x] Helmet security headers configured
- [x] HTTPS/SSL enforced for production
- [x] Environment variables secured (not in git)
- [x] Cloudinary API credentials protected

### ✅ Documentation
- [x] COMPREHENSIVE_AUDIT_SUMMARY.md - Complete audit
- [x] CLOUDINARY_DB_MIGRATION_COMPLETE.md - DB setup verified
- [x] MULTI_SAMPLE_SHIPMENTS.md - Feature documentation
- [x] MAJOR_UPGRADES_COMPLETE.md - Implementation details
- [x] API documentation complete
- [x] Database schema documented

---

## 🚀 Deployment Steps

### Phase 1: Pre-Deployment Verification (Local)

#### 1.1 Build & Test Locally
```powershell
cd c:\T_Link\backend
npm install
npm run build    # Should complete with no errors
npm run test     # Run all tests
npm run dev      # Starts on port 5000, connects to production DB

# In another terminal
cd c:\T_Link\frontend
npm install
npm run build    # Should complete with no errors
npm run test     # Run all tests
npm run dev      # Starts on port 5173
```

**Expected Results:**
- ✅ Backend builds successfully
- ✅ Frontend builds successfully
- ✅ No TypeScript errors
- ✅ No test failures
- ✅ No console errors in browser

#### 1.2 Test Production Endpoints (with local backend)
```powershell
# Test backend connectivity
curl http://localhost:5000/health

# Test frontend build
cd c:\T_Link\frontend
npm run preview  # Opens preview build

# Test authentication
curl -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@example.com","password":"password"}'

# Test sample inventory
curl http://localhost:5000/api/sample-inventory `
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Phase 2: Code Merge to Main Branch

#### 2.1 Prepare for Merge
```powershell
cd c:\T_Link

# Ensure branch is up to date
git fetch origin
git status

# Verify all changes are committed
git add -A
git commit -m "Production deployment: Major Upgrades Branch complete"

# Check current branch
git branch
# Should show: * major-upgrades (or your branch name)
```

#### 2.2 Create Pull Request (GitHub)
1. Go to GitHub repository
2. Click "New Pull Request"
3. Set:
   - **Base:** `main` (production branch)
   - **Compare:** `major-upgrades` (feature branch)
4. Title: "feat: Production deployment - Major Upgrades (Manufacturer Portal + Multi-Sample Shipments + Enhanced Logistics)"
5. Description:
   ```markdown
   ## Major Upgrades - Production Deployment
   
   ### Features Included
   - ✅ Manufacturer Portal (customer-facing dashboard)
   - ✅ Multi-Sample Shipments (1-10 items per shipment)
   - ✅ Enhanced Logistics Workflow
   
   ### Changes
   - 45+ backend files (routes, services, middleware)
   - 27 frontend components
   - 15 database migrations
   - Security hardening
   
   ### Testing
   - ✅ System audit completed
   - ✅ All routes tested
   - ✅ File storage via Cloudinary verified
   - ✅ Database connection verified
   
   ### Deployment
   - Database: Production (tlink_db_zlsw)
   - Storage: Cloudinary (di7yyu1mx)
   - No breaking changes to existing API
   
   See COMPREHENSIVE_AUDIT_SUMMARY.md and CLOUDINARY_DB_MIGRATION_COMPLETE.md
   ```
6. Request review from team lead/DevOps
7. Wait for approval

#### 2.3 Merge to Main
Once approved:
```powershell
cd c:\T_Link

# Switch to main branch
git checkout main

# Pull latest changes
git pull origin main

# Merge feature branch
git merge major-upgrades

# Push to origin (triggers auto-deploy)
git push origin main
```

**Auto-Deploy Triggers:**
- ✅ Render backend auto-deploys on push to main
- ✅ Vercel frontend auto-deploys on push to main
- No manual deployment needed if GitHub integration is active

---

### Phase 3: Production Deployment (Render + Vercel)

#### 3.1 Monitor Render Backend Deployment
After git push to main:

1. Go to https://dashboard.render.com
2. Select **tlink-production-backend** service
3. Watch **Logs** tab for deployment progress
4. Wait for: "✓ Deployment successful"
5. Expected deployment time: 3-5 minutes

**Render Dashboard Checks:**
```powershell
# Monitor in real-time
curl https://tlink-production-backend.onrender.com/health
# Expected: {"status": "ok", "timestamp": "..."}
```

#### 3.2 Monitor Vercel Frontend Deployment
After git push to main:

1. Go to https://vercel.com/dashboard
2. Select **T-Link** project
3. Watch **Deployments** tab for new deployment
4. Wait for: "✓ Ready" status
5. Expected deployment time: 1-2 minutes

**Vercel Dashboard Checks:**
```powershell
# Test production frontend
curl https://t-link-production.vercel.app
# Expected: HTML response (no errors)
```

#### 3.3 Verify Production Endpoints
Once both deployments complete:

```powershell
# Test backend health
curl https://tlink-production-backend.onrender.com/health
# Expected: {"status": "ok"}

# Test frontend load
curl https://t-link-production.vercel.app
# Expected: HTML (no 5xx errors)

# Test API connectivity
curl -X GET "https://tlink-production-backend.onrender.com/api/sample-inventory" `
  -H "Authorization: Bearer VALID_TOKEN"
# Expected: 200 OK or 401 Unauthorized (not 5xx errors)

# Test Cloudinary file access
curl -I "https://res.cloudinary.com/di7yyu1mx/image/upload/tlink/test-methods/..."
# Expected: 200 OK (file accessible)
```

---

### Phase 4: Post-Deployment Testing & Verification

#### 4.1 Smoke Tests (Quick validation)

**Test Login Flow:**
1. Go to https://t-link-production.vercel.app
2. Click "Login"
3. Enter test credentials (from admin panel)
4. Should redirect to dashboard
5. ✅ Pass if: No error messages, dashboard loads

**Test Manufacturer Portal:**
1. Go to https://t-link-production.vercel.app/manufacturer
2. Click "Sign Up" or "Login as Manufacturer"
3. Fill out form and submit
4. Should see manufacturer dashboard
5. ✅ Pass if: Portal loads, navigation works

**Test Multi-Sample Shipment:**
1. Go to https://t-link-production.vercel.app/internal/processing
2. Click "Create Shipment"
3. Add 3-5 samples (multi-sample feature)
4. Submit shipment
5. ✅ Pass if: Shipment created successfully, no errors

**Test File Download:**
1. Go to sample inventory or CoA lookup
2. Click "Download File"
3. Should download from Cloudinary
4. ✅ Pass if: File downloads correctly, content readable

#### 4.2 Functional Tests (Comprehensive)

**Create Test Shipment with Multiple Samples:**
```
1. Login as lab_staff user
2. Navigate to Processing Dashboard
3. Create new shipment
4. Add 5 samples (multi-sample test)
5. Verify all samples attached
6. Generate FedEx label
7. Submit shipment
✅ Expected: Shipment created, samples linked, label generated
```

**Test Manufacturer Portal Features:**
```
1. Logout and login as manufacturer
2. Search for sample by lot number
3. View CoA and SDS files
4. Check shipment history
5. Submit support request
✅ Expected: All features work, files download
```

**Test File Upload:**
```
1. Login as admin
2. Go to Test Methods or Sample Inventory
3. Upload a PDF file
4. Verify file uploaded to Cloudinary
5. Download file to verify
✅ Expected: File uploads, stores in Cloudinary, downloads correctly
```

#### 4.3 Performance Tests

**Backend Performance:**
```powershell
# Measure API response time
Measure-Command {
  curl -s https://tlink-production-backend.onrender.com/api/sample-inventory | Out-Null
}
# Expected: < 500ms
```

**Frontend Performance:**
```powershell
# Check Vercel analytics dashboard
# Go to https://vercel.com/dashboard > T-Link > Analytics
# Expected:
#   - Average response time: < 100ms
#   - Core Web Vitals: All green
```

---

## 🛡️ Rollback Plan

If critical issues occur post-deployment:

### Option 1: Quick Rollback (via GitHub)

```powershell
cd c:\T_Link

# Identify last stable commit
git log --oneline main | head -5

# Revert to previous commit
git revert HEAD --no-edit
git push origin main

# Or force revert specific commit
git revert COMMIT_HASH --no-edit
git push origin main
```

**Auto-triggers:**
- Render auto-redeploys on new push to main
- Vercel auto-redeploys on new push to main
- Rollback completes in 3-5 minutes

### Option 2: Manual Rollback (via Dashboards)

**Render Backend:**
1. Go to https://dashboard.render.com
2. Select **tlink-production-backend**
3. Go to **Deployments** tab
4. Find last successful deployment
5. Click **Redeploy** on that commit

**Vercel Frontend:**
1. Go to https://vercel.com/dashboard
2. Select **T-Link** project
3. Go to **Deployments** tab
4. Find last successful deployment
5. Click **Redeploy**

---

## 📊 Deployment Success Criteria

**All of the following must be true:**

✅ Backend health check returns 200 OK  
✅ Frontend loads without 5xx errors  
✅ User can login successfully  
✅ Sample inventory loads and displays  
✅ Manufacturer portal accessible  
✅ Multi-sample shipment creation works  
✅ File upload/download via Cloudinary works  
✅ Database queries complete < 1s  
✅ No critical errors in logs  
✅ HTTPS/SSL working for all endpoints  

---

## 🔍 Monitoring Post-Deployment

### Daily Checks (First Week)
- ✅ Monitor Render logs for errors: https://dashboard.render.com
- ✅ Monitor Vercel logs for errors: https://vercel.com/dashboard
- ✅ Check Cloudinary storage: https://cloudinary.com/console
- ✅ Monitor database performance: Render PostgreSQL dashboard
- ✅ Check error rates: application logs

### Weekly Checks (Ongoing)
- ✅ Review API response times
- ✅ Check database backup status
- ✅ Monitor storage usage (Cloudinary)
- ✅ Review security logs
- ✅ Check for failed file uploads

### Contact Info for Issues
- **Render Support:** https://dashboard.render.com/help
- **Vercel Support:** https://vercel.com/support
- **Cloudinary Support:** https://cloudinary.com/support
- **PostgreSQL Monitoring:** Via Render dashboard

---

## 📝 Deployment Checklist

- [ ] All code committed to major-upgrades branch
- [ ] Local build successful (npm run build)
- [ ] Local tests passing (npm run test)
- [ ] Production database verified (tlink_db_zlsw)
- [ ] Cloudinary credentials verified
- [ ] Pull request created and reviewed
- [ ] Merge approval received
- [ ] Feature branch merged to main
- [ ] Git push to main completed
- [ ] Render deployment logs monitored
- [ ] Vercel deployment logs monitored
- [ ] Production health check passes
- [ ] Login tested successfully
- [ ] All major features tested
- [ ] File upload/download tested
- [ ] Manufacturer portal tested
- [ ] Multi-sample shipment tested
- [ ] Smoke tests passed
- [ ] Functional tests passed
- [ ] Performance acceptable
- [ ] No critical errors in logs
- [ ] Team notified of deployment
- [ ] User communication sent (if needed)

---

## 🎉 Deployment Complete!

Once all checks pass:

✅ **Production deployment successful**  
✅ **Major Upgrades now live**  
✅ **Customers can access manufacturer portal**  
✅ **Multi-sample shipments enabled**  
✅ **Enhanced logistics workflow active**  

---

## 📞 Post-Deployment Support

### If Issues Occur:
1. Check logs: Render + Vercel dashboards
2. Review recent changes: git log main
3. Test endpoints: curl commands above
4. Consider rollback if critical
5. Contact team lead

### Documentation References:
- [Comprehensive Audit](COMPREHENSIVE_AUDIT_SUMMARY.md)
- [Cloudinary DB Migration](CLOUDINARY_DB_MIGRATION_COMPLETE.md)
- [Major Upgrades Complete](MAJOR_UPGRADES_COMPLETE.md)
- [Multi-Sample Shipments](MULTI_SAMPLE_SHIPMENTS.md)
- [Manual Deployment](MANUAL_DEPLOYMENT.md)
- [Production Deployment Summary](PRODUCTION_DEPLOYMENT_SUMMARY.md)

---

**Deployment Plan Created:** January 20, 2026  
**Status:** Ready for Deployment  
**Next Step:** Execute Phase 1 (local verification) then proceed to merge

---

## Quick Start Commands

**Entire Deployment Flow:**
```powershell
# 1. Local verification
cd c:\T_Link\backend
npm install && npm run build && npm run test
cd ..\frontend
npm install && npm run build && npm run test

# 2. Merge to main (if tests pass)
cd c:\T_Link
git checkout main
git pull origin main
git merge major-upgrades
git push origin main

# 3. Monitor deployments
# Render: https://dashboard.render.com
# Vercel: https://vercel.com/dashboard

# 4. Verify production
curl https://tlink-production-backend.onrender.com/health
curl https://t-link-production.vercel.app
```

**Expected total time:** 15-20 minutes from code merge to production deployment complete.
