# T-Link Major Upgrades - Implementation Guide

**Status:** ✅ Phase 1 Complete - Database Schema Ready  
**Branch:** `dev-major-upgrades`  
**Date:** January 14, 2026

---

## Phase 1: Database Schema Updates ✅ COMPLETE

### Migration Applied: 006_upgrade_manufacturer_portal_schema.sql

#### New Tables Created:

1. **dangerous_goods_declarations**
   - Tracks hazmat/flammable shipments requiring DG forms
   - Links to shipments via FK
   - Stores UN numbers, hazard class, warning label tracking
   - Approval workflow fields for lab staff

2. **sample_sds_documents**
   - Associates Safety Data Sheets (SDS) with samples/lots
   - Tracks revision dates and supplier info
   - Supports multiple SDS per lot (is_current flag)

3. **email_notifications**
   - Audit trail for all automated emails sent
   - Tracks shipment creation, processing, shipped, delivered notifications
   - Supports retry logic with error_message field

4. **support_requests**
   - Tech support and lab support form submissions
   - Routes emails to appropriate recipients (jhunzie@ or eboak@)
   - Status tracking (open, in_progress, resolved, closed)

#### Shipments Table Enhanced:

**Manufacturer Portal Fields:**
- `manufacturer_user_id` - Links to user who requested shipment
- `company_id` - Manufacturer company (FK to manufacturer_companies)
- `first_name`, `last_name` - Recipient details
- `recipient_phone` - Contact number
- `scheduled_ship_date` - When manufacturer expects shipment

**Email Notification Fields:**
- `email_notification_sent` - Boolean flag
- `email_notification_sent_at` - Timestamp of notification

**FedEx Integration Fields:**
- `fedex_address_validation_result` - JSONB with validation response
- `fedex_quote_amount` - Decimal for shipping cost
- `fedex_label_format` - Label type (ZPL, PDF, etc.)
- `fedex_api_errors` - JSONB for error logging

**Hazmat Compliance Fields:**
- `is_hazmat` - Flag for quantities >= 30ml
- `requires_dg_declaration` - True if DG forms needed
- `dg_declaration_id` - FK to dangerous_goods_declarations

**Status Update:**
- Changed from: `('pending', 'in_progress', 'shipped', 'delivered', 'cancelled')`
- Changed to: `('initiated', 'processing', 'shipped', 'delivered', 'cancelled')`

#### Indexes Created:
- All new tables have indexes on foreign keys and frequently queried fields
- Shipments table indexed for manufacturer_user, hazmat status, dg_required, scheduled_date lookups

---

## Phase 2: Backend API Endpoints (NEXT)

### Implementation Order:

#### Part 1: Authentication & User Management
1. **POST `/api/auth/manufacturer/signup`**
   - Input: email, password, first_name, last_name, company_name
   - Create user with manufacturer role
   - Create/link to manufacturer_company
   - Return JWT token
   - Restrict to authorized email list

2. **POST `/api/auth/login`** (Existing - verify works for manufacturers)

3. **POST `/api/auth/logout`** (Existing)

#### Part 2: Manufacturer Portal Endpoints
4. **POST `/api/shipments/request`** - Submit Shipment Request
   ```json
   {
     "first_name": "John",
     "last_name": "Doe",
     "company_name": "Teleos Affiliate",
     "delivery_address": "123 Main St",
     "sample_name": "Sample XYZ",
     "lot_number": "LOT-2026-001",
     "quantity_requested": 50,
     "quantity_unit": "ml",
     "scheduled_ship_date": "2026-01-20"
   }
   ```
   - Create shipment record with status='initiated'
   - Trigger email notification to user
   - Return shipment details with request_id

5. **GET `/api/shipments/my-requests`** - View User's Shipments
   - Query shipments where manufacturer_user_id = current_user
   - Return: Date, Items, Status, Tracking Number

6. **GET `/api/coa/search?lot_number=LOT-001`** - CoA Lookup
   - Search samples table for matching lot_number
   - Return CoA PDF path if exists
   - Restrict to read-only for manufacturers

7. **GET `/api/inventory/search?sample_name=Sample%20XYZ`** - Inventory Search
   - Query samples table
   - Return: sample_name, current_quantity, unit
   - Restrict to authorized samples only

8. **POST `/api/support/tech-support`** - Tech Support Form
   ```json
   {
     "subject": "Portal Issue",
     "message": "...",
     "submitted_by_email": "user@company.com",
     "submitted_by_name": "John Doe"
   }
   ```
   - Send email to jhunzie@ajwalabs.com
   - Create support_request record

9. **POST `/api/support/lab-support`** - Lab Support Form
   ```json
   {
     "subject": "Shipment Question",
     "message": "...",
     "submitted_by_email": "user@company.com",
     "submitted_by_name": "John Doe"
   }
   ```
   - Send email to eboak@ajwalabs.com
   - Create support_request record

#### Part 3: Internal Lab Staff Endpoints
10. **GET `/api/shipments/processing/:shipment_id`** - Get Processing Details
    - Auto-lookup sample by lot_number
    - Calculate: current_inventory, requested_amount, projected_remaining
    - Return SDS documents for the lot
    - Check is_hazmat flag

11. **GET `/api/supplies/inventory`** - View Supplies
    - Return all shipping_supplies with current quantities
    - Highlight low_stock items

12. **POST `/api/shipments/processing/:shipment_id/update-supplies`** - Record Supply Usage
    ```json
    {
      "supplies_used": [
        { "supply_id": "uuid", "quantity_used": 5 },
        { "supply_id": "uuid", "quantity_used": 2 }
      ]
    }
    ```
    - Create entries in shipment_supplies_used
    - Decrement supply_transactions (usage)

13. **POST `/api/shipments/processing/:shipment_id/flag-hazmat`** - Flag Hazmat
    - Auto-check if quantity_requested >= 30ml
    - Set is_hazmat=true, requires_dg_declaration=true
    - Return template for DG form generation

#### Part 4: Email Service
14. **Setup Email Service** (backend/src/services/emailService.ts)
    - Use Nodemailer or SendGrid
    - Templates for:
      - Shipment confirmation (to manufacturer)
      - Shipment processing notification
      - Shipment shipped notification (with tracking)
      - Shipment delivered notification
      - Support request received (to lab staff)
    - Queue failed emails for retry

#### Part 5: FedEx API Integration
15. **FedEx Address Validation Service** (backend/src/services/fedexService.ts)
    - Validate address before label generation
    - Return corrected address or error

16. **FedEx Ship Service** - Label Generation
    - Accept package details from processing view
    - Call FedEx Ship API
    - Receive: shipping cost, tracking number, label (PDF/ZPL)
    - Update shipment: tracking_number, fedex_quote_amount, shipping_label_path, status='shipped'

17. **FedEx Track Service** - Delivery Tracking
    - Implement job to poll active tracking numbers (status != 'delivered')
    - When status='Delivered', update shipment status='delivered'
    - Optional: webhook for real-time updates

---

## Phase 3: Frontend Components (TO DO)

### Manufacturer Portal Pages:

1. **SignUp.tsx** - Manufacturer Registration
   - Form: email, password, confirm_password, first_name, last_name, company_name
   - Email validation against authorized_emails
   - Submit to POST /api/auth/manufacturer/signup

2. **ManufacturerDashboard.tsx** - Main Portal
   - Navigation: CoA Lookup, Inventory Search, My Shipments, Support
   - Welcome message with company name
   - Quick access buttons

3. **CoALookup.tsx** - Certificate Search
   - Search field: lot_number
   - Results table with CoA PDF download link
   - "Download" button triggers file download

4. **InventorySearch.tsx** - Sample Availability
   - Search field: sample_name
   - Results: Sample Name, Available Quantity, Unit
   - Real-time search

5. **ShipmentRequest.tsx** - Request New Shipment
   - Form fields: first_name, last_name, company_name, delivery_address, sample_name, lot_number, quantity_requested, scheduled_ship_date
   - Submit to POST /api/shipments/request
   - Success: Display shipment request ID and confirmation

6. **MyShipments.tsx** - Shipment Dashboard
   - Table columns: Date Created, Items, Status (Initiated/Processing/Shipped/Delivered), Tracking Number
   - Filter by status
   - Click row to view details

7. **TechSupport.tsx** - Tech Support Form
   - Subject, Message fields
   - Auto-populate user email
   - Submit to POST /api/support/tech-support

8. **LabSupport.tsx** - Lab Support Form
   - Subject, Message fields
   - Auto-populate user email
   - Submit to POST /api/support/lab-support

### Internal Lab Staff Pages:

9. **ProcessingDashboard.tsx** - Pending Requests
   - List of shipments with status='initiated'
   - Columns: Date, Manufacturer, Sample, Lot, Quantity Requested
   - Click to open ProcessingView

10. **ProcessingView.tsx** - Process Individual Request
    - Display request details
    - Auto-lookup: Sample info, Current Inventory, Projected Remaining
    - Display: SDS documents (with download)
    - Supply Management dropdown (UN Boxes, Dry Ice, Coolers)
    - Quantity input for each supply used
    - Hazmat flag (auto-set if quantity >= 30ml)
    - If hazmat: Show DG Declaration form template
    - "Generate Shipment" button:
      - Validate address (FedEx)
      - Generate label (FedEx)
      - Update status to 'shipped'
      - Assign tracking number

11. **SupplyInventory.tsx** - Supply Management
    - Table: Supply Name, Type, Current Qty, Low Stock Threshold, Status
    - "Restock" button for low items
    - View transaction history

12. **HazmatWarning.tsx** - Hazmat Handling UI
    - Shows when quantity >= 30ml
    - Display UN number input
    - Show DG form template
    - "Print Warning Labels" button
    - Checkbox: "User confirms warning labels printed"

---

## File Structure to Create:

```
backend/src/
├── services/
│   ├── emailService.ts         (NEW)
│   ├── fedexService.ts         (NEW)
│   └── hazmatService.ts        (NEW - 30ml rule logic)
├── routes/
│   ├── manufacturer.ts         (NEW - portal endpoints)
│   ├── manufacturerAuth.ts     (NEW - signup/login)
│   ├── processingShipments.ts  (NEW - lab staff workflow)
│   └── shipments.ts            (UPDATE - add new endpoints)
└── middleware/
    └── manufacturerAuth.ts     (NEW - read-only role check)

frontend/src/
├── pages/
│   ├── manufacturer/
│   │   ├── ManufacturerDashboard.tsx (NEW)
│   │   ├── SignUp.tsx               (NEW)
│   │   ├── CoALookup.tsx            (NEW)
│   │   ├── InventorySearch.tsx      (NEW)
│   │   ├── ShipmentRequest.tsx      (NEW)
│   │   ├── MyShipments.tsx          (NEW)
│   │   ├── TechSupport.tsx          (NEW)
│   │   └── LabSupport.tsx           (NEW)
│   └── internal/
│       ├── ProcessingDashboard.tsx  (NEW)
│       ├── ProcessingView.tsx       (NEW)
│       ├── SupplyInventory.tsx      (NEW)
│       └── HazmatWarning.tsx        (NEW)
└── services/
    └── manufacturerApi.ts      (NEW - API calls)
```

---

## Database Migration Notes:

**Backup Location:** `database/backups/tlink_db_before_migration_006_20260114_151903.bak`

**Existing Data Migration (if applicable):**
```sql
-- Update old shipment statuses to new values
UPDATE shipments SET status = 'processing' WHERE status = 'in_progress';
UPDATE shipments SET status = 'initiated' WHERE status = 'pending';
```

---

## Next Steps:

1. ✅ Database schema created - Migration 006 applied
2. 📋 Proceed with Part 1 Backend (Auth endpoints)
3. 📋 Proceed with Part 2 Backend (Portal endpoints)
4. 📋 Implement Email Service
5. 📋 Integrate FedEx APIs
6. 📋 Build Frontend UI

**Ready to start Part 2: Backend Implementation?**
