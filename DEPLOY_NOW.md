# Quick Deployment Checklist - T-Link

## Step 1: Create GitHub Repository (2 minutes)

1. Go to https://github.com/new
2. Repository name: `T_Link`
3. Keep it **Private** (recommended) or Public
4. **Do NOT** initialize with README (we already have one)
5. Click "Create repository"

## Step 2: Push Your Code (1 minute)

Copy the commands from GitHub (they'll look like this, but use YOUR username):

```bash
cd c:\T_Link
git remote add origin https://github.com/YOUR-USERNAME/T_Link.git
git branch -M main
git push -u origin main
```

Enter your GitHub credentials when prompted.

## Step 3: Deploy Backend to Render.com (5 minutes)

### 3a. Create Database
1. Go to https://render.com (sign up with GitHub)
2. Click **"New +"** → **"PostgreSQL"**
3. Settings:
   - Name: `tlink-database`
   - Region: **Oregon (US West)** (or closest to you)
   - Database: `tlink_db`
   - User: `tlink_user`
   - PostgreSQL Version: **15**
   - Instance Type: **Free**
4. Click **"Create Database"**
5. **SAVE THIS INFO** (will appear after creation):
   - **Internal Database URL** (starts with `postgres://`)
   - **External Database URL** (for local connection)

### 3b. Run Migrations on Production Database
1. Copy the **External Database URL** from Render
2. In your local terminal:
```bash
# Connect to production database
$env:DATABASE_URL='<paste-external-url-here>'
psql $env:DATABASE_URL

# Run all migrations (copy/paste each command):
\i C:/T_Link/database/schema.sql
\i C:/T_Link/database/migrations/004_create_auth_tables.sql
\i C:/T_Link/database/migrations/create_shipping_supplies.sql
\i C:/T_Link/database/migrations/add_coa_sds_file_columns.sql

# Import sample data:
\copy shipping_supplies(un_box_type,inner_packing_type,dot_sp_number,item_number,purchased_from,price_per_unit,count) FROM 'C:/T_Link/Shipping_supplies_inventory.csv' WITH CSV HEADER;

# Add authorized users:
INSERT INTO authorized_emails (email, role, department, notes) VALUES
('jhunzie@ajwalabs.com', 'admin', 'Administration', 'Admin User'),
('eboak@ajwalabs.com', 'admin', 'Administration', 'Admin User'),
('mstanghellini@trical.com', 'admin', 'Administration', 'Admin User'),
('rxuan@ajwalabs.com', 'viewer', 'General', 'Standard User');

# Exit:
\q
```

### 3c. Deploy Backend Service
1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Click **"Build and deploy from a Git repository"**
3. Connect your GitHub account (authorize if needed)
4. Select **`T_Link`** repository
5. Configure:
   - **Name**: `tlink-backend`
   - **Region**: Same as database (Oregon)
   - **Root Directory**: `backend`
   - **Environment**: **Node**
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**

6. Click **"Advanced"** → Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=5000
   JWT_SECRET=tlink-super-secret-jwt-key-change-me-123456789
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=https://TEMP.vercel.app
   ```

7. Add Database Variables (get from Internal Database URL):
   - Click your database → Copy **Internal Database URL**
   - It looks like: `postgres://user:pass@host:5432/dbname`
   - Parse it and add:
   ```
   DB_HOST=<host-from-internal-url>
   DB_PORT=5432
   DB_NAME=tlink_db
   DB_USER=<user-from-internal-url>
   DB_PASSWORD=<password-from-internal-url>
   ```

8. Click **"Create Web Service"**
9. Wait 5-10 minutes for deployment
10. **SAVE YOUR BACKEND URL**: `https://tlink-backend.onrender.com`

## Step 4: Deploy Frontend to Vercel (2 minutes)

1. Go to https://vercel.com (sign up with GitHub)
2. Click **"Add New"** → **"Project"**
3. Import **`T_Link`** repository
4. Configure:
   - **Framework Preset**: **Vite**
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)

5. Add Environment Variable:
   - Key: `VITE_API_URL`
   - Value: `https://tlink-backend.onrender.com/api`

6. Click **"Deploy"**
7. Wait 2-3 minutes
8. **YOUR APP IS LIVE!** Vercel will show you the URL: `https://tlink-xyz.vercel.app`

## Step 5: Update Backend CORS (1 minute)

1. Go back to Render → Your backend service
2. Click **"Environment"** tab
3. Edit `FRONTEND_URL` variable
4. Change from `TEMP.vercel.app` to your actual Vercel URL
5. Click **"Save Changes"** (backend will redeploy automatically)

## Step 6: Test! 🎉

1. Visit your Vercel URL: `https://tlink-xyz.vercel.app`
2. Click **"Create Account"**
3. Enter: `jhunzie@ajwalabs.com`
4. Should show: ✅ Email authorized! Role: **admin**
5. Fill in name and password
6. Click **"Create Account"**
7. Should redirect to Dashboard!
8. Share the URL with your team!

---

## Your Deployment URLs (fill in after deployment):

- **Frontend**: https://________________.vercel.app
- **Backend**: https://tlink-backend.onrender.com
- **Database**: (Render PostgreSQL - internal only)

## Share with Team:

Send this message to jhunzie@ajwalabs.com, eboak@ajwalabs.com, mstanghellini@trical.com, rxuan@ajwalabs.com:

```
T-Link is now live! 🚀

Access the platform here: https://YOUR-APP.vercel.app

To get started:
1. Click "Create Account"
2. Enter your email (must be: jhunzie@ajwalabs.com, eboak@ajwalabs.com, mstanghellini@trical.com, or rxuan@ajwalabs.com)
3. Create a password (minimum 8 characters)
4. You're in!

Your role will be automatically assigned based on your email.
```

---

## Troubleshooting:

**Backend won't start?**
- Check Render logs (click "Logs" tab)
- Verify all environment variables are set
- Ensure database is running

**Frontend shows connection error?**
- Verify `VITE_API_URL` is correct in Vercel
- Check backend is running (visit backend URL + `/health`)
- Verify CORS: backend `FRONTEND_URL` matches your Vercel URL

**Can't register?**
- Clear browser cache/cookies
- Check email spelling (must match exactly)
- Verify authorized_emails were inserted in database

---

**Estimated Total Time**: 15-20 minutes
**Cost**: $0 (both Free tiers)
**Uptime**: Backend sleeps after 15min inactivity on free tier (wakes on first request)
