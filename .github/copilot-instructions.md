# T-Link AI Coding Assistant Instructions

## Project Overview
T-Link (Telios Logistics & Information Network) is a **monorepo** laboratory quality management system managing test methods, certificates of analysis (CoA), sample inventory, and shipping logistics. Built for regulated environments with audit trails and version control.

**Stack:** TypeScript, React (Vite), Express, PostgreSQL  
**Structure:** Monorepo with `/backend` and `/frontend` subdirectories

## Architecture & Key Patterns

### Monorepo Commands (Root Level Only)
- **Start entire app:** `npm run dev` (runs both frontend/backend via concurrently)
- **Install all deps:** `npm run install:all`
- Never run `npm install` or `npm run dev` from subdirectories during full-stack work

### Database Connection Pattern
All backend routes create their **own Pool instance** rather than importing from `config/database.ts`:
```typescript
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tlink_db',
  password: process.env.DB_PASSWORD || 'Ajwa8770',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});
```
**Rationale:** Pattern established in [`backend/src/routes/testMethods.ts`](backend/src/routes/testMethods.ts). Maintain consistency when adding new routes.

### File Storage Strategy
- **Local development:** Files stored in `C:\T_Link\storage\{module-name}\` (e.g., `C:\T_Link\storage\test-methods\`)
- **Production:** Cloudinary URLs stored in database `file_path` column
- **Upload handling:** Multer with diskStorage for local, scripts in [`backend/scripts/upload-to-cloudinary.js`](backend/scripts/upload-to-cloudinary.js) for cloud
- When adding file upload features, follow pattern in [`backend/src/routes/testMethods.ts`](backend/src/routes/testMethods.ts#L10-L38)

### Authentication & Authorization
- JWT-based auth with Bearer tokens (see [`backend/src/middleware/auth.ts`](backend/src/middleware/auth.ts))
- Roles: `admin`, `lab_staff`, `logistics`, `manufacturer`
- Frontend stores token in localStorage, axios interceptor attaches to requests ([`frontend/src/services/api.ts`](frontend/src/services/api.ts))
- All protected routes use `authenticate` middleware, role-specific use `authorize(['admin', 'lab_staff'])`

### Version Control for Documents
Test Methods use explicit version control:
- `tm_number` + `version` creates unique combinations (e.g., TM-001 v1.0, v2.0)
- `is_current_version` boolean tracks active version
- When creating versioned document systems, reference [`database/schema_test_methods.sql`](database/schema_test_methods.sql)

## Development Workflows

### Starting the Application
**Network/Multi-device access:** Use `start-network.bat` (starts both servers on `0.0.0.0`)  
**Local dev:** `npm run dev` from root  
**Backend only:** `cd backend && npm run dev`  
**Frontend only:** `cd frontend && npm run dev`

### Database Operations
**Connection:** `psql -h localhost -U postgres -d tlink_db` (password: Ajwa8770)  
**Migrations:** SQL files in `/database/migrations/`, run manually via psql  
**Data import:** CSV import scripts in [`backend/src/scripts/`](backend/src/scripts/) - reference [`importTestMethods.ts`](backend/src/scripts/importTestMethods.ts) for pattern  
**Bulk operations:** PowerShell scripts for export/import (see [`export-and-import-data.ps1`](export-and-import-data.ps1))

### Port Management (Windows PowerShell)
```powershell
# Kill process on port 5000 (backend)
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```
Critical for resolving `EADDRINUSE` errors. More commands in [`POWERSHELL_COMMANDS_GUIDE.md`](POWERSHELL_COMMANDS_GUIDE.md).

## Codebase-Specific Conventions

### Module Organization
Each business domain (test-methods, coa, sample-inventory, shipments) has:
- Database table(s) in [`database/schema.sql`](database/schema.sql)
- Backend route in [`backend/src/routes/{module}.ts`](backend/src/routes/)
- Frontend page in [`frontend/src/pages/{Module}.tsx`](frontend/src/pages/)
- CSV import script (optional) in [`backend/src/scripts/import{Module}.ts`](backend/src/scripts/)

### Frontend Import Pattern
Uses relative imports from `src/`:
```typescript
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
```
Never use `@/` alias despite Vite config - maintain existing pattern.

### Environment Configuration
**Local network IP hardcoded:** `10.0.0.41` in multiple files:
- [`frontend/vite.config.ts`](frontend/vite.config.ts#L14) proxy target
- [`backend/.env`](backend/.env) FRONTEND_URL
- [`start-network.bat`](start-network.bat)
Update all three when IP changes. See [`NETWORK_DEPLOYMENT.md`](NETWORK_DEPLOYMENT.md) for details.

### Error Handling
- Backend uses centralized [`middleware/errorHandler.ts`](backend/src/middleware/errorHandler.ts)
- Frontend has axios interceptor for 401 auto-logout ([`services/api.ts`](frontend/src/services/api.ts#L20-L30))

## Data Import & CSV Patterns
- CSV imports use `csv-parse/sync` library
- Column headers match database schema (snake_case in CSV, mapped to camelCase in code)
- Reference [`backend/src/scripts/importTestMethods.ts`](backend/src/scripts/importTestMethods.ts) for transaction-safe bulk insert pattern
- Template CSVs in root: [`test_methods_template.csv`](test_methods_template.csv), [`Sample inventory.csv`](Sample%20inventory.csv)

## Deployment
**Production:** Render (backend) + Vercel (frontend) - see [`DEPLOYMENT.md`](DEPLOYMENT.md)  
**Network Access:** Local network deployment via batch scripts - see [`NETWORK_DEPLOYMENT.md`](NETWORK_DEPLOYMENT.md)  
**Migration script:** PowerShell-based local → production data sync ([`export-and-import-data.ps1`](export-and-import-data.ps1))

## Critical Context
- **Windows-first environment:** PowerShell scripts, Windows paths (e.g., `C:\T_Link\storage\`)
- **No automatic migrations:** Database changes require manual SQL execution
- **Audit trails:** Most tables have `created_by`, `created_at`, `updated_at` - preserve when adding tables
- **Document expiration:** CoA module has automated 30/60/90 day expiration alerts (see [`database/schema.sql`](database/schema.sql#L95))
- **Manufacturer portal:** External users have limited read-only access via separate routes ([`backend/src/routes/manufacturer.ts`](backend/src/routes/manufacturer.ts))

## When Adding Features
1. **New API endpoint:** Create Pool instance in route file (don't import from config)
2. **New file upload:** Store locally in `C:\T_Link\storage\{module}\`, add Cloudinary script for production
3. **New database table:** Add to [`database/schema.sql`](database/schema.sql), include UUID primary key, timestamps, audit fields
4. **New data import:** Create CSV script in `backend/src/scripts/`, follow importTestMethods pattern
5. **Frontend form:** Use react-toastify for notifications (already imported in Layout), follow existing page patterns
