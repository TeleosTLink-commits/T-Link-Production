# T-Link Production Quick Reference

## 🌐 Live URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | https://t-link-production.vercel.app | Web application for labs |
| **Backend API** | https://tlink-production-backend.onrender.com | REST API endpoints |
| **Database** | dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com:5432 | PostgreSQL (Render) |
| **Files** | https://res.cloudinary.com/di7yyu1mx/ | Cloudinary CDN |

---

## 👤 Test Credentials

```
Admin Account:
- Email: admin@example.com
- Password: admin123
- Role: admin

Lab Staff Account:
- Email: labstaff@example.com
- Password: labstaff123
- Role: lab_staff

Logistics Account:
- Email: logistics@example.com
- Password: logistics123
- Role: logistics

Manufacturer Account:
- Email: manufacturer@example.com
- Password: manufacturer123
- Role: manufacturer
```

---

## 🔐 Database Connection

```powershell
# Connect to Render PostgreSQL
psql -h dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com `
     -U tlink_user `
     -d tlink_db_zlsw `
     -p 5432
```

**Password:** illvriAUF5XcsXFPFuPeuK8YfQplyCJz

**Connection String:** 
```
postgresql://tlink_user:illvriAUF5XcsXFPFuPeuK8YfQplyCJz@dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com:5432/tlink_db_zlsw?sslmode=require
```

---

## 🐳 Environment Variables (Set on Render)

```
NODE_ENV=production
PORT=5000
DB_HOST=dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com
DB_USER=tlink_user
DB_PASSWORD=illvriAUF5XcsXFPFuPeuK8YfQplyCJz
DB_NAME=tlink_db_zlsw
DB_PORT=5432
DB_SSL=true
JWT_SECRET=[generated-secret-key]
CLOUDINARY_CLOUD_NAME=di7yyu1mx
CLOUDINARY_API_KEY=733869953499621
CLOUDINARY_API_SECRET=S4ASfISu4o4Br1r3fchP0SiIko4
FRONTEND_URL=https://t-link-production.vercel.app
```

---

## 📊 Key Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Test Methods | 18 | ✅ All on Cloudinary |
| Sample Records | 31 | ✅ In database |
| User Accounts | 4 | ✅ Active |
| Database Tables | 24 | ✅ Migrated |
| Files Uploaded | 18 | ✅ Cloudinary |

---

## 🚀 Common Operations

### Check Deployment Status
```bash
npm run verify:production
```

### Upload New Files to Cloudinary
```bash
npm run upload:cloudinary:production
```

### View Backend Logs (Render)
1. Go to https://dashboard.render.com
2. Select T-Link backend service
3. View logs in real-time

### View Frontend Logs (Vercel)
1. Go to https://vercel.com/dashboard
2. Select T-Link production deployment
3. View build/runtime logs

### Test API Endpoint
```bash
curl -X GET https://tlink-production-backend.onrender.com/health
```

---

## ⚠️ Common Issues & Solutions

### "401 Unauthorized" on File Download
- Check localStorage for auth token
- Clear browser cache and login again
- Verify token hasn't expired (24h limit)

### Backend Taking Long to Respond
- Render spins down free tier after 15min inactivity
- First request after sleep takes 30-60 seconds
- Subsequent requests are instant

### "FATAL: password authentication failed"
- Double-check database credentials
- Verify SSL mode is enabled
- Connection string should have `?sslmode=require`

### Cloudinary Files Return 401
- Files exist (checked with HEAD request)
- Download via `/api/test-methods/{id}/download` endpoint
- Endpoint redirects to Cloudinary public URL

---

## 🔄 Deployment Checklist

- [x] Backend deployed to Render
- [x] Frontend deployed to Vercel
- [x] Database migrated to Render PostgreSQL
- [x] 18 test methods uploaded to Cloudinary
- [x] CORS configured for production
- [x] SSL/TLS enabled
- [x] Authentication system verified
- [x] File downloads tested
- [x] All verification tests passing
- [x] Git repository committed & pushed

---

## 📚 Additional Resources

- **GitHub Repo:** https://github.com/TeleosTLink-commits/T-Link-Production
- **Render Dashboard:** https://dashboard.render.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Cloudinary Console:** https://cloudinary.com/console
- **Full Docs:** See `PRODUCTION_DEPLOYMENT_SUMMARY.md`

---

## ✅ Production Ready

T-Link is fully operational and serving labs globally with:
- Zero-latency file delivery via Cloudinary CDN
- Auto-scaling backend on Render
- Global frontend distribution via Vercel
- Enterprise-grade PostgreSQL database

**Status:** 🟢 PRODUCTION OPERATIONAL
