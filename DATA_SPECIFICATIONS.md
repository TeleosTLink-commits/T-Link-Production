# T-Link Data Specifications Guide

This document outlines the data format, requirements, and setup instructions for each module of the T-Link system.

---

## Table of Contents
1. [Test Methods Module](#1-test-methods-module)
2. [Certificates of Analysis (CoA) Module](#2-certificates-of-analysis-coa-module)
3. [Inventory & Freezer Management Module](#3-inventory--freezer-management-module)
4. [Shipments & Logistics Module](#4-shipments--logistics-module)
5. [Manufacturer Portal](#5-manufacturer-portal)
6. [General Guidelines](#6-general-guidelines)

---

## 1. Test Methods Module

### Purpose
Manage test method documents with full version control, approval workflow, and audit trail.

### Required Information

#### A. Test Method Document Details
```
- TM Number: Unique identifier (e.g., "TM-001", "TM-2024-015")
- Version: Version number (e.g., "1.0", "2.1", "3.0")
- Title: Descriptive title (e.g., "HPLC Analysis of Compound X")
- Description: Detailed description of what the method does
- Document File: PDF, DOC, or DOCX file containing the full method
- Status: active, superseded, or archived
- Effective Date: When this version becomes active
- Created By: User who uploaded it
- Approved By: User who approved it (optional initially)
- Approval Date: When it was approved (optional initially)
```

#### B. File Naming Convention
```
Format: TM-{NUMBER}_v{VERSION}_{TITLE}.{ext}
Examples:
  - TM-001_v1.0_HPLC_Compound_X.pdf
  - TM-015_v2.1_LC-MS_Analysis.pdf
  - TM-023_v1.0_Dissolution_Test.docx
```

#### C. Data Format Requirements

**Spreadsheet Format (for bulk import):**
```
| TM_Number | Version | Title                    | Description              | File_Path                     | Status   | Effective_Date | Created_By_Email      |
|-----------|---------|--------------------------|--------------------------|-------------------------------|----------|----------------|-----------------------|
| TM-001    | 1.0     | HPLC Analysis Compound X | Standard HPLC method...  | uploads/TM-001_v1.0_HPLC.pdf | active   | 2024-01-15     | admin@telios.com      |
| TM-002    | 1.0     | LC-MS Purity Test        | Mass spec purity check...| uploads/TM-002_v1.0_LCMS.pdf | active   | 2024-02-01     | lab@telios.com        |
```

**JSON Format (for API):**
```json
{
  "tm_number": "TM-001",
  "version": "1.0",
  "title": "HPLC Analysis of Compound X",
  "description": "Standard HPLC method for quantification of Compound X in pharmaceutical samples",
  "file": "[File Upload Object]",
  "status": "active",
  "effective_date": "2024-01-15",
  "notes": "Initial release"
}
```

#### D. Setup Instructions

**Step 1: Organize Your Test Methods**
- Gather all existing test method documents (PDF, Word, etc.)
- Assign unique TM numbers if not already numbered
- Determine current version for each (usually start at 1.0)
- Identify which methods are currently active

**Step 2: Create a Master Spreadsheet**
- Use Excel or Google Sheets
- Include all columns listed above
- Fill in metadata for each document
- Save as CSV for import

**Step 3: Prepare File Storage**
- Create folder: `C:\T_Link_Data\TestMethods\`
- Rename files using the naming convention
- Organize by TM number (optional subfolders)

**Step 4: Validation Checklist**
- [ ] All TM numbers are unique
- [ ] All files are PDF or DOCX format
- [ ] All file paths are correct and accessible
- [ ] All effective dates are valid dates (YYYY-MM-DD)
- [ ] All created_by emails match existing users in system
- [ ] No duplicate TM_Number + Version combinations

**Example File Structure:**
```
C:\T_Link_Data\TestMethods\
├── TM-001_v1.0_HPLC_Compound_X.pdf
├── TM-002_v1.0_LC-MS_Purity.pdf
├── TM-003_v1.0_Dissolution_Test.pdf
└── test_methods_import.csv
```

---

## 2. Certificates of Analysis (CoA) Module

### Purpose
Track certificates of analysis by lot number with expiration monitoring and manufacturer linkage.

### Required Information

#### A. CoA Details
```
- Lot Number: Unique lot identifier (e.g., "LOT-2024-001", "BATCH-A12345")
- Product Name: Name of the product/chemical
- Manufacturer: Company that produced it (must match manufacturer_companies table)
- Issue Date: When CoA was issued
- Expiration Date: When product expires
- CoA File: PDF file of the certificate
- CAS Number: Chemical Abstract Service number (if applicable)
- Grade/Purity: Product grade (e.g., "ACS Grade", "99.5% Pure")
- Storage Conditions: How to store (e.g., "Store at -20°C", "Room temperature")
- Notes: Additional information
```

#### B. File Naming Convention
```
Format: CoA_{LOT_NUMBER}_{PRODUCT_NAME}.pdf
Examples:
  - CoA_LOT-2024-001_Acetonitrile.pdf
  - CoA_BATCH-A12345_Methanol_HPLC_Grade.pdf
  - CoA_XYZ-987_Sodium_Chloride.pdf
```

#### C. Data Format Requirements

**Spreadsheet Format:**
```
| Lot_Number    | Product_Name          | Manufacturer      | Issue_Date | Expiration_Date | File_Path                          | CAS_Number | Grade        | Storage_Conditions | Notes                |
|---------------|-----------------------|-------------------|------------|-----------------|-------------------------------------|------------|--------------|--------------------|--------------------|
| LOT-2024-001  | Acetonitrile          | Sigma-Aldrich     | 2024-01-15 | 2025-01-15      | uploads/CoA_LOT-2024-001_ACN.pdf   | 75-05-8    | HPLC Grade   | Room temperature   | For chromatography |
| BATCH-A12345  | Methanol              | Fisher Scientific | 2024-02-01 | 2025-02-01      | uploads/CoA_BATCH-A12345_MeOH.pdf  | 67-56-1    | ACS Grade    | Flammable cabinet  | Keep sealed        |
```

**JSON Format:**
```json
{
  "lot_number": "LOT-2024-001",
  "product_name": "Acetonitrile",
  "manufacturer_name": "Sigma-Aldrich",
  "issue_date": "2024-01-15",
  "expiration_date": "2025-01-15",
  "file": "[File Upload Object]",
  "cas_number": "75-05-8",
  "grade": "HPLC Grade",
  "storage_conditions": "Room temperature",
  "notes": "For chromatography use"
}
```

#### D. Setup Instructions

**Step 1: Gather Manufacturer Information**
- List all chemical/reagent manufacturers you work with
- Collect contact information for each
- This will populate the `manufacturer_companies` table

**Manufacturer Spreadsheet:**
```
| Company_Name      | Contact_Email          | Contact_Phone   | Address                    |
|-------------------|------------------------|-----------------|----------------------------|
| Sigma-Aldrich     | support@sigma.com      | 1-800-123-4567  | 123 Chemical Lane, MO      |
| Fisher Scientific | info@fisher.com        | 1-800-234-5678  | 456 Science Dr, NH         |
| VWR International | service@vwr.com        | 1-800-345-6789  | 789 Lab Way, PA            |
```

**Step 2: Organize CoA Files**
- Gather all PDF certificates
- Extract lot number from each certificate
- Note expiration dates

**Step 3: Create CoA Master List**
- Spreadsheet with all CoA details
- Ensure manufacturer names match exactly with manufacturer list
- Verify all dates are in YYYY-MM-DD format

**Step 4: Prepare File Storage**
```
C:\T_Link_Data\CoA\
├── CoA_LOT-2024-001_Acetonitrile.pdf
├── CoA_LOT-2024-002_Methanol.pdf
├── CoA_LOT-2024-003_Ethanol.pdf
├── coa_import.csv
└── manufacturers.csv
```

**Step 5: Validation Checklist**
- [ ] All lot numbers are unique
- [ ] All CoA files are PDF format
- [ ] All manufacturer names match manufacturer list exactly
- [ ] Issue dates are before expiration dates
- [ ] All dates in YYYY-MM-DD format
- [ ] CAS numbers are valid (if provided)
- [ ] All files are accessible and not corrupted

**Important Notes:**
- **Expiration Alerts**: System will automatically send alerts 90, 60, and 30 days before expiration
- **Status Auto-Update**: System automatically updates status to "expiring_soon" or "expired"
- **Manufacturer Links**: Each CoA must be linked to a manufacturer from the manufacturers table

---

## 3. Inventory & Freezer Management Module

### Purpose
Track chemical samples with dynamic volume tracking, freezer locations, and transaction history.

### Required Information

#### A. Freezer/Storage Location Setup

**First, define your physical storage locations:**

```
| Freezer_Name | Location           | Temperature_Range | Capacity_Description        | Is_Active |
|--------------|--------------------|--------------------|----------------------------|-----------|
| Freezer-A    | Lab Room 101       | -80°C to -70°C     | 4 shelves, 50 boxes total  | true      |
| Freezer-B    | Lab Room 102       | -20°C to -10°C     | 3 shelves, 30 boxes total  | true      |
| Cabinet-C    | Chemical Storage   | Room Temperature   | 5 shelves                  | true      |
```

**Then define shelves/positions within each freezer:**

```
| Freezer_Name | Shelf_Number | Position_Description           |
|--------------|--------------|--------------------------------|
| Freezer-A    | Shelf-1      | Top shelf, left side           |
| Freezer-A    | Shelf-2      | Top shelf, right side          |
| Freezer-A    | Shelf-3      | Middle shelf                   |
| Freezer-B    | Shelf-1      | Bottom shelf                   |
```

#### B. Sample Inventory Details

```
- Sample Name: Descriptive name
- Sample Code: Unique identifier (e.g., "SMPL-2024-001", "CHEM-A-123")
- Chemical Name: Actual chemical name
- CAS Number: Chemical identifier (optional)
- Initial Volume: Starting volume with unit (e.g., "500 mL", "100 g")
- Current Volume: Remaining volume (automatically calculated)
- Volume Unit: mL, L, g, kg, units
- Concentration: If applicable (e.g., "1.0 M", "10 mg/mL")
- Lot Number: Associated CoA lot number (links to CoA module)
- Container Type: Bottle, vial, box, etc.
- Freezer Location: Which freezer
- Shelf/Position: Specific location within freezer
- Expiration Date: When sample expires
- Minimum Stock Level: Alert threshold
- Storage Conditions: Special requirements
- Notes: Additional information
```

#### C. Data Format Requirements

**Freezer Setup Spreadsheet:**
```
freezers_import.csv:
Freezer_Name,Location,Temperature_Range,Capacity_Description,Is_Active
Freezer-A,Lab Room 101,-80°C to -70°C,4 shelves, 50 boxes total,true
Freezer-B,Lab Room 102,-20°C to -10°C,3 shelves, 30 boxes total,true

freezer_shelves_import.csv:
Freezer_Name,Shelf_Number,Position_Description
Freezer-A,Shelf-1,Top shelf, left side
Freezer-A,Shelf-2,Top shelf, right side
Freezer-B,Shelf-1,Bottom shelf
```

**Sample Inventory Spreadsheet:**
```
| Sample_Code   | Sample_Name        | Chemical_Name  | CAS_Number | Initial_Volume | Volume_Unit | Concentration | Lot_Number   | Freezer_Name | Shelf_Number | Container_Type | Expiration_Date | Min_Stock_Level | Storage_Conditions | Notes           |
|---------------|--------------------|----------------|------------|----------------|-------------|---------------|--------------|--------------|--------------|----------------|-----------------|-----------------|-------------------|-----------------|
| SMPL-2024-001 | Acetonitrile Stock | Acetonitrile   | 75-05-8    | 1000           | mL          | N/A           | LOT-2024-001 | Cabinet-C    | Shelf-1      | Glass Bottle   | 2025-01-15      | 200             | Room temperature  | HPLC Grade      |
| SMPL-2024-002 | Standard Solution  | Methanol       | 67-56-1    | 500            | mL          | 1.0 M         | BATCH-A12345 | Freezer-B    | Shelf-1      | Amber Bottle   | 2025-02-01      | 100             | -20°C             | Light sensitive |
```

**JSON Format:**
```json
{
  "sample_code": "SMPL-2024-001",
  "sample_name": "Acetonitrile Stock",
  "chemical_name": "Acetonitrile",
  "cas_number": "75-05-8",
  "initial_volume": 1000,
  "current_volume": 1000,
  "volume_unit": "mL",
  "concentration": "N/A",
  "lot_number": "LOT-2024-001",
  "freezer_id": "[UUID from freezers table]",
  "shelf_id": "[UUID from shelves table]",
  "container_type": "Glass Bottle",
  "expiration_date": "2025-01-15",
  "minimum_stock_level": 200,
  "storage_conditions": "Room temperature",
  "notes": "HPLC Grade"
}
```

#### D. Volume Transaction Types

When you checkout/use samples, record:
```
- Transaction Type: checkout, return, adjustment, expired
- Volume Amount: How much was taken/returned
- Performed By: User who did it
- Date/Time: Automatically recorded
- Purpose: Why (e.g., "HPLC analysis batch #123")
- Reference: Link to test method or project
```

#### E. Setup Instructions

**Step 1: Map Physical Storage**
1. Walk through your lab and document all storage locations
2. Draw a diagram if helpful
3. Label each freezer/cabinet with a unique name
4. Number shelves/sections within each

**Step 2: Create Freezer Setup Files**
```
C:\T_Link_Data\Inventory\Setup\
├── freezers.csv
├── shelves.csv
└── diagram.pdf (optional - photo/sketch of layout)
```

**Step 3: Inventory Your Samples**
1. Go through each freezer/storage location
2. Record every sample/chemical
3. Note current volume (measure if needed)
4. Check expiration dates
5. Assign unique sample codes if not already coded

**Step 4: Create Sample Inventory File**
```
C:\T_Link_Data\Inventory\
├── samples_import.csv
└── photos\ (optional - photos of samples)
```

**Step 5: Validation Checklist**
- [ ] All freezer names are unique
- [ ] All sample codes are unique
- [ ] All freezer references in samples exist in freezers list
- [ ] All shelf references exist in shelves list
- [ ] Initial volumes are positive numbers
- [ ] Volume units are consistent (mL, L, g, kg, units)
- [ ] Minimum stock levels are reasonable (less than initial volume)
- [ ] All lot numbers match CoA records (if applicable)
- [ ] All expiration dates are in YYYY-MM-DD format

**Important Business Rules:**
- **Dynamic Volume**: When you checkout 50mL, current_volume automatically decreases by 50mL
- **Low Stock Alerts**: System alerts when current_volume < minimum_stock_level
- **Cannot Overdraw**: System prevents checking out more than current_volume
- **Transaction History**: All volume changes are logged and auditable
- **Barcode/QR Integration**: Each sample can have a barcode for scanning

---

## 4. Shipments & Logistics Module

### Purpose
Manage hazardous material shipments with proper classification, chain of custody, and supply tracking.

### Required Information

#### A. Hazard Classification Setup

**First, populate your hazard classifications (UN codes):**

```
| Hazard_Class | UN_Number | Description                    | Packing_Group | Label_Required | Special_Instructions                |
|--------------|-----------|--------------------------------|---------------|----------------|-------------------------------------|
| Class 3      | UN1170    | Flammable Liquid (Ethanol)     | II            | Flammable      | Keep away from heat/sparks          |
| Class 6.1    | UN2810    | Toxic Liquid (Methanol)        | I             | Toxic          | Avoid inhalation                    |
| Class 8      | UN1789    | Corrosive (Hydrochloric Acid)  | II            | Corrosive      | Wear protective equipment           |
```

#### B. Shipping Supply Inventory

```
| Supply_Name           | Category      | Quantity_In_Stock | Minimum_Stock_Level | Unit  | Cost_Per_Unit | Reorder_From     | Notes                    |
|-----------------------|---------------|-------------------|---------------------|-------|---------------|------------------|--------------------------|
| Small Cardboard Box   | Packaging     | 50                | 10                  | boxes | $2.50         | Uline            | For small samples        |
| Hazmat Labels (Class3)| Labels        | 200               | 50                  | sheets| $0.25         | Fisher Scientific| Flammable labels         |
| Bubble Wrap           | Packaging     | 5                 | 2                   | rolls | $15.00        | Amazon           | 12" wide roll            |
| Absorbent Pads        | Safety        | 100               | 20                  | pads  | $1.00         | VWR              | Spill containment        |
```

#### C. Shipment Request Details

```
- Shipment Number: Auto-generated unique ID (e.g., "SHIP-2024-001")
- Request Date: When shipment was requested
- Requested By: User creating the shipment
- Ship To: Destination information (name, address, contact)
- Ship From: Your facility information
- Carrier: FedEx, UPS, DHL, etc.
- Service Level: Ground, 2-Day, Overnight, etc.
- Expected Ship Date: When to ship
- Actual Ship Date: When actually shipped (filled later)
- Tracking Number: Carrier tracking number (filled after shipping)
- Status: requested, prepared, shipped, delivered, cancelled
- Total Weight: Combined weight of all items
- Special Instructions: Delivery requirements
```

#### D. Shipment Items (samples being shipped)

```
For each item in a shipment:
- Sample Code: Reference to inventory sample
- Quantity: How much is being shipped
- Volume/Weight: Amount with unit
- Hazard Class: UN classification (if hazardous)
- Container Type: What it's packaged in
- Temperature Requirements: Ambient, frozen, refrigerated, dry ice
```

#### E. Chain of Custody Documentation

```
- Relinquished By: Person releasing custody
- Received By: Person accepting custody
- Date/Time: When custody transferred
- Condition: Condition of samples upon receipt
- Seal Intact: Yes/No
- Temperature Upon Receipt: If applicable
- Comments: Any issues or notes
```

#### F. Data Format Requirements

**Hazard Classes Spreadsheet:**
```
hazard_classes.csv:
Hazard_Class,UN_Number,Description,Packing_Group,Label_Required,Special_Instructions
Class 3,UN1170,Flammable Liquid (Ethanol),II,Flammable,Keep away from heat/sparks
Class 6.1,UN2810,Toxic Liquid (Methanol),I,Toxic,Avoid inhalation
```

**Shipping Supplies Spreadsheet:**
```
shipping_supplies.csv:
Supply_Name,Category,Quantity_In_Stock,Minimum_Stock_Level,Unit,Cost_Per_Unit,Reorder_From,Notes
Small Cardboard Box,Packaging,50,10,boxes,2.50,Uline,For small samples
Hazmat Labels (Class3),Labels,200,50,sheets,0.25,Fisher Scientific,Flammable labels
```

**Shipment Request Spreadsheet:**
```
shipments.csv:
Shipment_Number,Request_Date,Requested_By_Email,Ship_To_Name,Ship_To_Address,Ship_To_City,Ship_To_State,Ship_To_Zip,Ship_To_Country,Carrier,Service_Level,Expected_Ship_Date,Status,Special_Instructions
SHIP-2024-001,2024-03-15,logistics@telios.com,ABC Laboratory,123 Science Blvd,Boston,MA,02101,USA,FedEx,Ground,2024-03-20,requested,Deliver to receiving dock
```

**Shipment Items Spreadsheet:**
```
shipment_items.csv:
Shipment_Number,Sample_Code,Quantity,Volume,Volume_Unit,Hazard_Class,Container_Type,Temperature_Requirements
SHIP-2024-001,SMPL-2024-001,1,100,mL,Class 3,Sealed Vial,Ambient
SHIP-2024-001,SMPL-2024-005,2,50,mL,Class 6.1,Amber Bottle,Refrigerated
```

#### G. Setup Instructions

**Step 1: Hazard Classification Research**
1. Identify all chemicals you commonly ship
2. Look up UN numbers and hazard classifications
3. Document packing requirements for each
4. Keep MSDS/SDS sheets for reference

**Step 2: Inventory Shipping Supplies**
1. Count current stock of all shipping materials
2. Determine minimum levels for alerts
3. Document suppliers and costs
4. Set up reorder procedures

**Step 3: Define Shipping Locations**
```
Your facility information:
- Facility Name
- Full Address
- Contact Person
- Phone Number
- Email
- Shipping Dock Hours
```

```
Common destination list:
- Customer/Partner Organizations
- Addresses
- Contact Information
- Special Delivery Instructions
```

**Step 4: Create Data Files**
```
C:\T_Link_Data\Shipments\
├── hazard_classes.csv
├── shipping_supplies.csv
├── shipping_locations.csv
└── templates\
    ├── chain_of_custody_form.pdf
    └── packing_list_template.pdf
```

**Step 5: Validation Checklist**
- [ ] All UN numbers are valid and properly classified
- [ ] All supply minimum levels are realistic
- [ ] All addresses are complete with zip codes
- [ ] All hazard classes have proper labels specified
- [ ] All sample codes reference existing inventory items
- [ ] Shipping volumes don't exceed available inventory
- [ ] All required fields are filled

**Important Business Rules:**
- **Inventory Deduction**: Shipping a sample reduces inventory current_volume
- **Hazmat Labels**: System auto-generates proper labels based on UN classification
- **Low Supply Alerts**: System alerts when supplies < minimum level
- **Chain of Custody**: Required for all shipments (regulatory compliance)
- **Temperature Tracking**: If shipped with dry ice/cold pack, track temperature
- **Cannot Ship**: System prevents shipping more than available inventory

---

## 5. Manufacturer Portal

### Purpose
Provide read-only external access for manufacturer users to view their CoAs and reference standards.

### Required Information

#### A. Manufacturer Company Setup

Already covered in CoA module, but ensure you have:

```
- Company Name: Official manufacturer name
- Contact Email: Primary contact
- Contact Phone: Main phone number
- Address: Full business address
- Is Active: Whether they currently supply to you
- Account Number: Your account # with them (optional)
- Website: Company website (optional)
- Notes: Any special terms or notes
```

#### B. Manufacturer User Accounts

```
- Username: Login username
- Email: User's email (must be manufacturer domain)
- First Name: User first name
- Last Name: User last name
- Company: Linked manufacturer company
- Role: Always "manufacturer" for external users
- Is Active: Can enable/disable access
- Phone: User's direct phone (optional)
```

#### C. Access Permissions

Manufacturer users can:
- **View Only**: Their company's CoAs
- **Download**: PDF copies of their CoAs
- **Search**: By lot number, product, date range
- **No Edit/Delete**: Read-only access only

Manufacturer users **cannot**:
- See other manufacturers' data
- Access inventory or shipment information
- Modify any data
- Upload new documents

#### D. Data Format Requirements

**Manufacturer Users Spreadsheet:**
```
manufacturer_users.csv:
Username,Email,First_Name,Last_Name,Company_Name,Role,Is_Active,Phone
jsmith_sigma,jsmith@sigmaaldrich.com,John,Smith,Sigma-Aldrich,manufacturer,true,555-0101
ajones_fisher,ajones@fishersci.com,Alice,Jones,Fisher Scientific,manufacturer,true,555-0102
```

#### E. Setup Instructions

**Step 1: Confirm Manufacturer Companies**
- Review manufacturer_companies list from CoA setup
- Ensure all active suppliers are included
- Verify contact information is current

**Step 2: Identify External Users**
- Contact each manufacturer
- Request user information for portal access
- Confirm email domains match company
- Collect phone numbers for 2FA (optional)

**Step 3: Define Access Policies**
```
Document your policies:
- Who can request manufacturer portal access?
- How are accounts approved?
- Password requirements
- Session timeout settings
- Account deactivation procedures
```

**Step 4: Create Welcome Documentation**
```
Prepare for manufacturers:
- Login instructions
- How to search for CoAs
- How to download documents
- Contact information for support
- FAQ document
```

**Step 5: Validation Checklist**
- [ ] All manufacturer user emails use manufacturer domain
- [ ] All users linked to existing manufacturer company
- [ ] All accounts set to "manufacturer" role
- [ ] No duplicate usernames or emails
- [ ] All manufacturer companies have at least contact info

**Important Security Rules:**
- **Email Domain Validation**: Email must match manufacturer company domain
- **Read-Only Enforced**: System prevents any write operations
- **Data Filtering**: Users only see their company's CoAs
- **Audit Logging**: All manufacturer access is logged
- **Session Management**: Auto-logout after inactivity
- **No Bulk Download**: Limit to individual document downloads

---

## 6. General Guidelines

### File Formats

**Accepted File Types:**
- **Documents**: PDF (preferred), DOC, DOCX
- **Data Import**: CSV, Excel (.xlsx)
- **Images**: JPG, PNG (for reference photos)

**File Size Limits:**
- **Individual Documents**: Max 25 MB
- **Bulk Imports**: Max 100 MB CSV file
- **Photos**: Max 5 MB per image

### Date Format
**Always use**: `YYYY-MM-DD` (ISO 8601)
- Correct: `2024-03-15`
- Incorrect: `03/15/2024`, `15-Mar-2024`

### Naming Conventions

**Be Consistent:**
- Use underscores or hyphens, not spaces
- Use descriptive but concise names
- Include version numbers where applicable
- Use uppercase for codes/IDs

**Examples:**
```
Good:
  - TM-001_v1.0_HPLC_Method.pdf
  - CoA_LOT-2024-001_Acetonitrile.pdf
  - SMPL-2024-015

Bad:
  - test method version 1.pdf
  - coa file.PDF
  - sample 15
```

### Data Quality Rules

**Required vs. Optional:**
- **Always Required**: ID numbers, names, dates, status
- **Often Required**: Descriptions, file paths, units
- **Sometimes Optional**: Notes, phone numbers, secondary contacts

**Validation Rules:**
- No leading/trailing spaces in text fields
- Consistent capitalization (especially for lookups)
- Valid email format for email fields
- Numeric fields don't contain text
- Dates in correct format
- Foreign keys match existing records

### Bulk Import Best Practices

**Before Importing:**
1. **Backup**: Export current data as backup
2. **Validate**: Check CSV file in Excel/text editor
3. **Test**: Import a few rows first to test
4. **Verify**: Check data appears correctly
5. **Full Import**: Import remaining data

**CSV File Formatting:**
- Use UTF-8 encoding
- Include header row with exact column names
- Enclose text with commas in quotes
- Use consistent delimiters (comma preferred)
- Remove empty rows at end

**Common Import Errors:**
```
❌ "Foreign key violation" → Referenced record doesn't exist yet
   Fix: Import referenced table first (e.g., manufacturers before CoAs)

❌ "Duplicate key" → ID/code already exists
   Fix: Ensure unique IDs, or update existing records instead

❌ "Invalid date format" → Date not in YYYY-MM-DD
   Fix: Format all dates consistently

❌ "NULL value in required field" → Missing required data
   Fix: Fill in all required columns
```

### Data Migration Strategy

**Recommended Order:**
1. **Users** - Set up internal users first
2. **Manufacturer Companies** - Before CoAs
3. **Test Methods** - Independent module
4. **Certificates of Analysis** - After manufacturers
5. **Freezers/Shelves** - Before inventory
6. **Sample Inventory** - After freezers and CoAs
7. **Hazard Classes** - Before shipments
8. **Shipping Supplies** - Before shipments
9. **Shipments** - After inventory and supplies
10. **Manufacturer Users** - After manufacturer companies

### Support Documentation

**Create These Documents:**
```
C:\T_Link_Data\Documentation\
├── standard_operating_procedures.pdf
├── user_training_guide.pdf
├── data_entry_checklist.pdf
├── troubleshooting_guide.pdf
└── contact_list.pdf
```

**Include:**
- Who is responsible for each module
- How often to update data
- Backup procedures
- Error reporting process
- Contact information for IT support

---

## Quick Reference - Data Collection Checklist

### ✅ Test Methods
- [ ] Gather all test method documents
- [ ] Assign TM numbers and versions
- [ ] Create metadata spreadsheet
- [ ] Rename files with standard naming
- [ ] Identify approvers

### ✅ Certificates of Analysis
- [ ] Create manufacturer list with contacts
- [ ] Collect all CoA PDF files
- [ ] Extract lot numbers and expiration dates
- [ ] Create CoA metadata spreadsheet
- [ ] Link each CoA to manufacturer

### ✅ Inventory Management
- [ ] Map all freezers/storage locations
- [ ] Create freezer and shelf lists
- [ ] Inventory all samples
- [ ] Measure current volumes
- [ ] Assign sample codes
- [ ] Set minimum stock levels

### ✅ Shipments & Logistics
- [ ] Research UN hazard classifications
- [ ] Create hazard class reference list
- [ ] Inventory shipping supplies
- [ ] Set minimum supply levels
- [ ] Document shipping locations
- [ ] Create chain of custody template

### ✅ Manufacturer Portal
- [ ] Confirm manufacturer company details
- [ ] Request user information from manufacturers
- [ ] Create manufacturer user accounts
- [ ] Prepare welcome documentation
- [ ] Define access policies

---

## Next Steps

Once you have gathered and organized all data according to these specifications:

1. **Validate Your Data**: Use the checklists in each section
2. **Prepare CSV Files**: Format data in CSV files for import
3. **Organize Files**: Place documents in structured folders
4. **Review with Team**: Ensure completeness and accuracy
5. **Contact Me**: I will then develop the functionality for each module

**Questions to Consider:**
- Do you need additional fields not covered here?
- Are there specific workflows unique to your lab?
- Do you have regulatory requirements to incorporate?
- What reports will you need to generate?

Let me know when you're ready to proceed with development, or if you need clarification on any data requirements!
