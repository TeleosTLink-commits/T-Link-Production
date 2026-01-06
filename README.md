# T-Link: Telios Logistics & Information Network

**Centralized Quality, Inventory, & Logistics Management**

T-Link is a comprehensive database solution designed for Telios, integrating laboratory quality data, real-time inventory tracking, and specialized shipping logistics into one secure, accessible platform.

## 🎯 Features

### Module 1: Digital Quality Library
- **Test Methods (TM)** with smart version control and audit trails
- **Standard Operating Procedures (SOPs)** document management
- **Certificates of Analysis (CoA)** with lot number tracking
- **Automated expiration alerts** (30, 60, 90 days)
- Complete document audit logging

### Module 2: Precision Inventory & Freezer Management
- **Dynamic volume tracking** with real-time subtraction
- **Low-inventory alerts** with customizable thresholds
- **Precise location tracking** (freezer/shelf level)
- Sample integrity monitoring
- Complete transaction history

### Module 3: Logistics & Shipment Command Center
- **Shipping supply inventory** management
- **Automated compliance labeling** for hazardous materials
- **Shipment request workflow** with notifications
- **Complete chain of custody** tracking
- Hazard classification and handling instructions

### Module 4: Manufacturer Access Portal
- **Secure external portal** for manufacturers
- **Read-only CoA access** by lot number
- **Reference standard lookup**
- **Shipment tracking** for incoming deliveries

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+
- **Git** (optional)

## 🚀 Installation

### 1. Clone or Navigate to Project

```powershell
cd c:\T_Link
```

### 2. Install Dependencies

```powershell
# Install all dependencies (root, backend, frontend)
npm run install:all
```

Or install separately:

```powershell
# Root dependencies
npm install

# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 3. Database Setup

#### Create PostgreSQL Database

```powershell
# Using psql or pgAdmin, create the database
createdb tlink_db
```

Or via PostgreSQL CLI:
```sql
CREATE DATABASE tlink_db;
```

#### Configure Environment Variables

Create `backend/.env` file (copy from `.env.example`):

```env
# Server Configuration
NODE_ENV=development
PORT=5000
API_URL=http://localhost:5000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tlink_db
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=24h

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@telios.com
SMTP_PASSWORD=your_email_password
EMAIL_FROM=noreply@telios.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Notification Settings
EXPIRATION_WARNING_DAYS=30,60,90
SHIPMENT_NOTIFICATION_EMAIL=logistics@telios.com
```

#### Run Database Migrations

```powershell
cd backend
npm run db:migrate
```

#### Seed Sample Data (Optional)

```powershell
npm run db:seed
```

This creates default users:
- **Admin**: `admin` / `admin123`
- **Lab Staff**: `lab_user` / `admin123`
- **Logistics**: `logistics_user` / `admin123`

### 4. Create Upload Directories

```powershell
cd backend
mkdir uploads
mkdir uploads\test_methods
mkdir uploads\coa
mkdir uploads\sops
mkdir logs
```

## 🏃 Running the Application

### Development Mode (Both Frontend & Backend)

```powershell
# From root directory
npm run dev
```

This runs:
- Backend API on `http://localhost:5000`
- Frontend on `http://localhost:3000`

### Run Separately

**Backend only:**
```powershell
cd backend
npm run dev
```

**Frontend only:**
```powershell
cd frontend
npm run dev
```

## 🔐 Default Login Credentials

After seeding the database:

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Lab Staff | `lab_user` | `admin123` |
| Logistics | `logistics_user` | `admin123` |

**⚠️ Change these passwords in production!**

## 📁 Project Structure

```
T_Link/
├── backend/
│   ├── src/
│   │   ├── config/          # Database & logger configuration
│   │   ├── middleware/      # Auth, error handling
│   │   ├── routes/          # API endpoints
│   │   │   ├── auth.ts
│   │   │   ├── testMethods.ts
│   │   │   ├── coa.ts
│   │   │   ├── inventory.ts
│   │   │   ├── shipments.ts
│   │   │   └── manufacturer.ts
│   │   ├── services/        # Notification service
│   │   ├── database/        # Migrations & seeds
│   │   └── server.ts        # Express server
│   ├── uploads/             # File storage
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client
│   │   ├── store/           # Zustand state management
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── database/
│   ├── schema.sql           # Complete database schema
│   └── seed.sql             # Sample data
└── package.json
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new user (admin only)
- `GET /api/auth/me` - Get current user

### Test Methods
- `GET /api/test-methods` - List all test methods
- `GET /api/test-methods/:id` - Get specific test method
- `POST /api/test-methods` - Create new test method (with file upload)
- `GET /api/test-methods/:tmNumber/versions` - Get version history
- `PATCH /api/test-methods/:id/set-current` - Set current version

### Certificates of Analysis
- `GET /api/coa` - List all CoAs
- `GET /api/coa/lot/:lotNumber` - Get CoA by lot number
- `POST /api/coa` - Create new CoA (with file upload)
- `GET /api/coa/alerts/expiring` - Get expiring CoAs

### Inventory
- `GET /api/inventory` - List all samples
- `GET /api/inventory/:id` - Get specific sample
- `POST /api/inventory` - Add new sample
- `POST /api/inventory/:id/checkout` - Checkout sample (subtract volume)
- `GET /api/inventory/:id/transactions` - Get transaction history
- `GET /api/inventory/alerts/low-inventory` - Get low inventory alerts
- `GET /api/inventory/freezers/all` - List all freezers

### Shipments
- `GET /api/shipments` - List all shipments
- `GET /api/shipments/:id` - Get specific shipment
- `POST /api/shipments` - Create shipment request
- `PATCH /api/shipments/:id/status` - Update shipment status
- `POST /api/shipments/:id/supplies` - Record supplies used
- `GET /api/shipments/supplies/all` - List shipping supplies
- `GET /api/shipments/hazards/all` - List hazard classifications

### Manufacturer Portal
- `GET /api/manufacturer/company/info` - Get company info
- `GET /api/manufacturer/reference-standards` - List CoAs for manufacturer
- `GET /api/manufacturer/coa/:lotNumber` - Get specific CoA
- `GET /api/manufacturer/coa/:lotNumber/download` - Download CoA
- `GET /api/manufacturer/shipments` - List shipments to manufacturer

## 🔔 Automated Notifications

The system runs scheduled jobs for:

- **CoA Expiration Alerts** - Daily at 8:00 AM
- **Low Inventory Alerts** - Daily at 9:00 AM
- **Low Shipping Supplies** - Daily at 10:00 AM

Configure email settings in `.env` to enable notifications.

## 🛡️ Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- SQL injection prevention
- CORS protection
- Helmet.js security headers
- Complete audit trail logging

## 🏗️ Database Schema Highlights

### Key Tables
- **users** - User authentication and roles
- **manufacturer_companies** - External manufacturer data
- **test_methods** - TM documents with version control
- **certificates_of_analysis** - CoA tracking
- **samples** - Inventory with location tracking
- **sample_transactions** - Complete usage history
- **shipments** - Logistics tracking
- **shipment_chain_of_custody** - Complete audit trail
- **shipping_supplies** - Supply inventory
- **notifications** - System alerts

### Automated Triggers
- Auto-update CoA status based on expiration
- Auto-update sample status based on volume
- Auto-update supply status based on quantity
- Timestamp updates on all records

## 📊 Production Deployment

### Build Frontend

```powershell
cd frontend
npm run build
```

### Build Backend

```powershell
cd backend
npm run build
```

### Start Production Server

```powershell
cd backend
npm start
```

### Environment Variables for Production

Update `.env` with production values:
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Configure production database
- Set up proper SMTP credentials
- Enable HTTPS

## 🧪 Development Tips

### Testing API with cURL

```powershell
# Login
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"admin123\"}"

# Get test methods (with token)
curl http://localhost:5000/api/test-methods -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Management

```powershell
# Reset database
psql -U postgres -d tlink_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-run migrations
cd backend
npm run db:migrate
npm run db:seed
```

## 🤝 Support

For issues or questions:
1. Check the logs in `backend/logs/`
2. Verify database connection
3. Ensure all environment variables are set
4. Check that PostgreSQL is running

## 📝 License

Proprietary - Telios Corporation

---

**Built with:**
- TypeScript
- Node.js / Express
- React
- PostgreSQL
- Vite

**Version:** 1.0.0
