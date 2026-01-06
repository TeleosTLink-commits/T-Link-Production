# T-Link Deployment Guide

This guide provides step-by-step instructions for deploying the T-Link application to production using Render.com (backend) and Vercel (frontend).

## 📋 Pre-Deployment Checklist

- [ ] PostgreSQL database (local for dev, production hosted)
- [ ] GitHub repository with latest code pushed
- [ ] Authorized emails added to database
- [ ] Environment variables configured
- [ ] Production JWT secret generated

---

## 🚀 Option 1: Quick Deploy (Recommended for Testing)

### Backend: Render.com (Free Tier)

**Step 1: Create Render Account**
1. Go to [https://render.com](https://render.com)
2. Sign up with GitHub

**Step 2: Create PostgreSQL Database**
1. Click "New +" → "PostgreSQL"
2. Name: `tlink-database`
3. Region: Choose closest to your users
4. Instance Type: Free
5. Click "Create Database"
6. **Save the Internal Database URL** (looks like `postgres://user:pass@host/db`)

**Step 3: Deploy Backend**
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Select the `T_Link` repository
4. Configure:
   - **Name**: `tlink-backend`
   - **Root Directory**: `backend`
   - **Environment**: Node
   - **Region**: Same as database
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

5. Add Environment Variables (click "Advanced" → "Add Environment Variable"):
   ```
   NODE_ENV=production
   PORT=5000
   DB_HOST=<from-internal-db-url>
   DB_PORT=5432
   DB_NAME=<from-internal-db-url>
   DB_USER=<from-internal-db-url>
   DB_PASSWORD=<from-internal-db-url>
   JWT_SECRET=<generate-random-32-char-string>
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=https://your-app.vercel.app
   ```

6. Click "Create Web Service"
7. Wait for deployment (5-10 minutes)
8. **Save your backend URL**: `https://tlink-backend.onrender.com`

**Step 4: Run Database Migrations**
1. In Render dashboard, click your database
2. Click "Connect" → "PSQL Command"
3. Copy the connection command
4. In your local terminal:
   ```bash
   # Connect to production database
   psql <paste-connection-string>
   
   # Run migrations
   \i C:/T_Link/database/migrations/001_create_tables.sql
   \i C:/T_Link/database/migrations/002_add_sample_fields.sql
   \i C:/T_Link/database/migrations/003_create_certificates_table.sql
   \i C:/T_Link/database/migrations/004_create_auth_tables.sql
   ```

5. Add your team's authorized emails:
   ```sql
   INSERT INTO authorized_emails (email, role, department, notes) VALUES
   ('yourteam@example.com', 'admin', 'Administration', 'Lead Admin'),
   ('teammate1@example.com', 'manager', 'Operations', 'Operations Manager'),
   ('teammate2@example.com', 'technician', 'Laboratory', 'Lab Tech');
   ```

### Frontend: Vercel (Free Tier)

**Step 1: Create Vercel Account**
1. Go to [https://vercel.com](https://vercel.com)
2. Sign up with GitHub

**Step 2: Deploy Frontend**
1. Click "Add New" → "Project"
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. Add Environment Variable:
   - Key: `VITE_API_URL`
   - Value: `https://tlink-backend.onrender.com/api`

5. Click "Deploy"
6. Wait for deployment (2-3 minutes)
7. **Your app is live!**: `https://tlink-<random>.vercel.app`

**Step 3: Update Backend CORS**
1. Go back to Render backend service
2. Update `FRONTEND_URL` environment variable to your Vercel URL
3. Service will auto-redeploy

---

## 🔧 Option 2: AWS Deployment (Production-Grade)

### Backend: AWS EC2 + RDS

**Prerequisites:**
- AWS Account
- AWS CLI installed
- SSH key pair created

**Step 1: Create RDS PostgreSQL Database**
```bash
# Via AWS Console:
# 1. Go to RDS → Create Database
# 2. Engine: PostgreSQL 15
# 3. Template: Free Tier
# 4. DB Instance: db.t3.micro
# 5. Username: postgres
# 6. Set strong password
# 7. Storage: 20 GB
# 8. Public Access: No
# 9. VPC Security Group: Create new
# 10. Database name: tlink_db
```

**Step 2: Launch EC2 Instance**
```bash
# Ubuntu 22.04 LTS
# Instance Type: t2.micro (Free Tier)
# Security Group: Allow ports 22 (SSH), 443 (HTTPS), 80 (HTTP)
```

**Step 3: Install Dependencies**
```bash
ssh -i your-key.pem ubuntu@<ec2-ip>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx
```

**Step 4: Deploy Backend**
```bash
# Clone repository
git clone https://github.com/yourusername/T_Link.git
cd T_Link/backend

# Install dependencies
npm install

# Create .env file
nano .env
# Paste production environment variables

# Build
npm run build

# Start with PM2
pm2 start dist/server.js --name tlink-backend
pm2 startup
pm2 save
```

**Step 5: Configure Nginx**
```bash
sudo nano /etc/nginx/sites-available/tlink-backend

# Paste:
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/tlink-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com
```

### Frontend: AWS S3 + CloudFront

**Step 1: Build Frontend**
```bash
cd frontend
npm run build
```

**Step 2: Create S3 Bucket**
```bash
# Via AWS Console:
# 1. S3 → Create Bucket
# 2. Name: tlink-frontend
# 3. Uncheck "Block all public access"
# 4. Create bucket
```

**Step 3: Upload Build**
```bash
aws s3 sync dist/ s3://tlink-frontend --delete
```

**Step 4: Configure S3 for Static Hosting**
```bash
# Bucket → Properties → Static website hosting → Enable
# Index document: index.html
# Error document: index.html
```

**Step 5: Create CloudFront Distribution**
```bash
# CloudFront → Create Distribution
# Origin Domain: tlink-frontend.s3.amazonaws.com
# Viewer Protocol Policy: Redirect HTTP to HTTPS
# Default Root Object: index.html
```

---

## 📊 Environment Variables Reference

### Backend (.env)
```bash
# Database
DB_HOST=localhost                    # Production: RDS endpoint or Render internal URL
DB_PORT=5432
DB_NAME=tlink_db
DB_USER=postgres
DB_PASSWORD=<your-secure-password>

# JWT
JWT_SECRET=<random-32-char-string>   # Generate with: openssl rand -hex 32
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=production

# CORS
FRONTEND_URL=https://your-frontend.vercel.app
```

### Frontend (.env)
```bash
VITE_API_URL=https://your-backend.onrender.com/api
# Or for AWS: https://api.yourdomain.com/api
```

---

## 🔐 Security Checklist

- [ ] Strong JWT_SECRET generated (32+ characters, random)
- [ ] Database password is strong and unique
- [ ] HTTPS enabled (SSL certificates)
- [ ] CORS configured to allow only your frontend
- [ ] Database not publicly accessible
- [ ] Environment variables never committed to Git
- [ ] Regular database backups configured
- [ ] Authorized emails list maintained

---

## 🧪 Testing Deployment

### 1. Test Backend Health
```bash
curl https://your-backend.onrender.com/health
# Should return: {"status":"OK","timestamp":"..."}
```

### 2. Test Database Connection
```bash
curl https://your-backend.onrender.com/api/test-methods
# Should return test methods or authentication error
```

### 3. Test Frontend
1. Visit `https://your-app.vercel.app`
2. Try to access dashboard (should redirect to login)
3. Click "Create Account"
4. Enter an authorized email
5. Complete registration
6. Should redirect to dashboard

### 4. Test Authentication Flow
- [ ] Login with credentials
- [ ] Access protected pages
- [ ] Logout
- [ ] Try accessing dashboard without login (should redirect)
- [ ] Try registering with unauthorized email (should fail)

---

## 🚨 Troubleshooting

### Backend won't start
```bash
# Check logs in Render dashboard
# Or in EC2:
pm2 logs tlink-backend

# Common issues:
# - Database connection failed → Check DB_HOST, DB_PASSWORD
# - Port already in use → Change PORT in .env
# - Missing dependencies → Run npm install
```

### Frontend can't connect to backend
```bash
# Check browser console for CORS errors
# Fix: Update FRONTEND_URL in backend .env
# Check VITE_API_URL in frontend .env
```

### Database migration fails
```bash
# Check PostgreSQL connection
psql <connection-string>

# Verify tables exist
\dt

# Re-run specific migration
\i path/to/migration.sql
```

### 401 Unauthorized errors
```bash
# JWT token might be invalid
# Clear localStorage in browser:
localStorage.clear()

# Or regenerate JWT_SECRET and re-login
```

---

## 📈 Monitoring & Maintenance

### Render.com
- Automatic deploys on Git push
- View logs in dashboard
- Free tier sleeps after 15min inactivity
- Upgrade to paid for 24/7 uptime

### Database Backups
```bash
# Render: Automatic daily backups (paid plans)
# Manual backup:
pg_dump <connection-string> > backup.sql
```

### Scaling
- **Render**: Upgrade instance type in dashboard
- **AWS**: Auto-scaling groups, load balancers

---

## 🎯 Quick Start Commands

### Local Development
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Production Deploy (Render + Vercel)
```bash
# Just push to GitHub
git add .
git commit -m "Deploy to production"
git push origin main

# Render and Vercel will auto-deploy
```

---

## 📞 Support

For deployment issues:
1. Check logs (Render dashboard or `pm2 logs`)
2. Verify environment variables
3. Test database connection
4. Check CORS settings

Generated: January 6, 2026
