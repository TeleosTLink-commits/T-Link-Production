# T-Link System Overview

**T-Link (Teleos Logistics & Information Network)** is a full-stack web application for **Teleos** that unifies laboratory quality management, sample inventory, and specialized (hazardous-materials) shipping logistics into one secure platform, plus an external portal for manufacturers.

---

## 1. Architecture Overview

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript, Vite 7, React Router 6, Zustand (state), Recharts, react-toastify, Vercel Analytics |
| **Backend** | Node.js 18+, Express 4, TypeScript, deployed with `ts-node`/`tsc` |
| **Database** | PostgreSQL 14+ (`tlink_db`), `pg` connection pool (max 20, SSL auto-enabled for remote/production) |
| **File storage** | Cloudinary (documents/labels), local `/uploads` fallback |
| **Auth** | JWT (24h expiry) + bcrypt password hashing, role-based access control |
| **External API** | FedEx REST API (address validation, rate quotes, hazmat/international label generation) |
| **Email/Jobs** | Nodemailer (SMTP) + `node-cron` scheduled jobs |

A three-repo-in-one monorepo: the root `package.json` orchestrates `backend/` and `frontend/` via `concurrently`.

---

## 2. Deployment & Custom Domain

- **Custom domain:** `https://app.teleostlink.com` (whitelisted as a CORS origin in `backend/src/server.ts`).
- **Frontend hosting:** **Vercel** — configured via `frontend/vercel.json` and the root `vercel.json`. Known Vercel URLs: `t-link-production.vercel.app`, `t-link-l41i.vercel.app`, `t-link-vv3r.vercel.app`. SPA rewrites route everything to `index.html`.
- **Backend hosting:** **Render.com** — deployed via a deploy hook in `deploy-to-render.ps1` (service `srv-d5g4ap2li9vc738tbi40`).
- **API base URLs:**
  - Vercel rewrites proxy `/api/*` → `https://t-link-backend.onrender.com`
  - Frontend code default (`frontend/src/services/api.ts`) and tests use `https://tlink-production-backend.onrender.com/api`
  - Overridable via the `VITE_API_URL` environment variable.
- **Security headers** set at both edge (Vercel) and app layer (Helmet): CSP, HSTS (1yr, preload), `X-Frame-Options`, `nosniff`, referrer policy.

---

## 3. Backend — API Routes

Registered in `backend/src/server.ts` (order matters — specific routes first):

| Mount | File | Purpose |
|-------|------|---------|
| `/api/auth` | `routes/auth.ts` | Internal user login/register/me (rate-limited) |
| `/api/auth/manufacturer` | `routes/manufacturerAuth.ts` | Manufacturer login/signup |
| `/api/test-methods` | `routes/testMethods.ts` | Test Method (TM) docs + version control |
| `/api/inventory` | `routes/inventory.ts` | Freezer/sample inventory |
| `/api/sample-inventory` | `routes/sampleInventory.ts` | Sample quantity tracking (also serves CoA functionality) |
| `/api/shipments` | `routes/shipments.ts` | Shipment requests, status, supplies, hazards |
| `/api/manufacturer` | `routes/manufacturerPortal.ts` | Manufacturer-facing portal endpoints |
| `/api/processing` | `routes/processingShipments.ts` | Internal lab shipment processing |
| `/api/fedex` | `routes/fedex.ts` | FedEx address validation, rates, labels |
| `/api/manufacturer-admin` | `routes/manufacturer.ts` | Admin management of manufacturer companies |
| `/api/admin` | `routes/admin.ts` | System administration |
| `/api/internal` | `routes/internalSupport.ts` | Internal support forms |

Plus health/diagnostic endpoints: `/health`, `/health/cloudinary`, `/health/cloudinary/ping`.

### Services (`backend/src/services`)
- **fedexService.ts** — FedEx OAuth, address validation, hazmat unit normalization (g→kg, ML/L/LB/OZ), street-line splitting (35-char limit), international customs/commodity handling.
- **notificationService.ts** — Nodemailer email + three cron jobs: CoA expiration check (8 AM), low inventory (9 AM), low supplies (10 AM).
- **emailService.ts** — Email templating/dispatch.
- **pdfExtractionService.ts** — PDF/OCR parsing (`pdf-parse`, `tesseract.js`) for document data extraction.

### Middleware (`backend/src/middleware`)
`auth.ts` (JWT verify + RBAC), `rateLimiter.ts` (API + stricter auth limiter), `errorHandler.ts`, `fileValidation.ts`, `sanitization.ts` (sanitize-html), `validation.ts`/`validators.ts` (Joi + express-validator), `securityLogger.ts`.

---

## 4. Database Schema

Defined in `database/schema.sql`, with migrations under `database/migrations` (auth tables, manufacturer portal upgrade, etc.). Key tables:

- **Users/Auth:** `users`, `manufacturer_companies`, `manufacturer_users`
- **Quality Library:** `test_methods` (versioned), `sops`, `document_audit_log`
- **Inventory:** `freezers`, `freezer_shelves`, `samples`, `sample_transactions`, `inventory_alerts`
- **Logistics:** `shipping_supplies`, `supply_transactions`, `chemical_hazards`, `shipments`, `shipment_chain_of_custody`, `shipment_supplies_used`
- **System:** `notifications`, plus `certificates_of_analysis` / `coa_expiration_notifications`

**Automated DB triggers** auto-update CoA/sample/supply status by expiration or quantity, and maintain timestamps.

---

## 5. Frontend — Pages & Roles

Routing in `frontend/src/App.tsx`. Auth token is decoded client-side to determine role and redirect.

**Internal staff (Admin / Lab / Logistics):**
- Dashboard, Test Methods, Sample Inventory, Shipments
- Internal ops: Processing Dashboard/View, Tracking View, Supply Inventory, Hazmat Warning, Admin Panel

**Manufacturer portal:**
- Sign-up, Dashboard, CoA Lookup, Inventory Search, Shipment Request, My Shipments, Support Forms

Shared components: `Layout`, `ProtectedRoute`, `NotificationBell`, `HelpButton`, `ShareWithUserModal`.

---

## 6. Functional Modules

1. **Digital Quality Library** — Test Methods with version control & audit trails; Certificates of Analysis by lot number; automated 30/60/90-day expiration alerts.
2. **Precision Inventory** — Real-time sample volume tracking, freezer/shelf location, low-inventory alerts, full transaction history.
3. **Logistics & Shipment Command Center** — Shipping-supply inventory, automated hazmat/international compliance labeling via FedEx, shipment request workflow, chain-of-custody tracking, hazard classification.
4. **Manufacturer Access Portal** — Secure external read-only CoA access, sample availability checks, shipment requests (up to 10 samples with inventory check), incoming shipment tracking.

---

## 7. Security Posture

JWT auth with production-enforced ≥32-char secret; bcrypt hashing; RBAC (admin/lab/logistics/manufacturer); rate limiting; Helmet CSP/HSTS; CORS allow-list; SQL-injection-safe parameterized queries; XML/DOCTYPE request blocking (entity-expansion DoS protection); file-upload validation; input sanitization; complete audit logging. Startup **fails fast** if required production environment variables (JWT, DB, Cloudinary) are missing. Detailed documentation lives in `docs/SECURITY_ASSESSMENT_REPORT.md` and related security files.

---

## 8. Automated Jobs

The system runs scheduled `node-cron` jobs (in `notificationService.ts`):

- **CoA Expiration Alerts** — Daily at 8:00 AM
- **Low Inventory Alerts** — Daily at 9:00 AM
- **Low Shipping Supplies Alerts** — Daily at 10:00 AM

Email delivery is handled via Nodemailer using configured SMTP credentials.
