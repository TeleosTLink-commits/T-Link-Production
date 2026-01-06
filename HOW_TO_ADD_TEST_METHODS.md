# How to Add Your 21 Test Methods - Step by Step

## Option 1: Quick CSV Import (Recommended)

### Step 1: Prepare Your CSV File
1. Open the template: `c:\T_Link\test_methods_template.csv`
2. Save it as: `c:\T_Link\test_methods.csv`
3. Fill in your 21 test methods using the template format

**CSV Columns:**
```
Legacy Number, Legacy Lab Source, Original Title, Method Type, Purpose, Scope, Equipment, Reagents, Procedure, Acceptance Criteria, Status, Verification Status, Notes
```

**Example Row:**
```
DOW-GC-123, Dow Chemical Lab, GC Headspace Analysis, GC-HS, Volatile organic compound analysis, Aqueous and solid samples, GC with headspace sampler, Internal standard solution, Headspace equilibration and injection, Calibration R² > 0.995, draft, pending, Historical Dow method
```

### Step 2: Import the CSV
```powershell
cd c:\T_Link\backend
npm run import:test-methods
```

**What happens:**
- Script reads your CSV
- Imports all 21 methods to database
- Creates initial version history for each
- Shows success/error summary

### Step 3: View in Browser
1. Start the server (if not running):
   ```powershell
   cd c:\T_Link
   .\start-network.bat
   ```
2. Open: http://10.0.0.41:3000
3. Click "Test Methods" in sidebar
4. You'll see all 21 methods!

---

## Option 2: Add Manually Through UI

### Step 1: Start the Application
```powershell
cd c:\T_Link
.\start-network.bat
```

### Step 2: Login
- Open: http://10.0.0.41:3000
- Login: `admin` / `admin123`

### Step 3: Add Each Test Method
1. Click "Test Methods" in sidebar
2. Click "+ Add Test Method" button
3. Fill in the form:

**Required Fields:**
- **Original Title**: The method name as it came from the lab

**Optional but Important:**
- **Legacy Number**: Whatever number it has now (e.g., "TM-001", "LAB-A-2019-05")
- **Legacy Lab Source**: Which lab it came from (e.g., "Telios Legacy", "External Lab A")
- **Method Type**: GC-FID, HPLC-UV, etc.
- **Category**: Select from dropdown (GC, HPLC, Titration, etc.)
- **Purpose**: What is this method used for?
- **Procedure**: The actual steps

4. Click "Add Test Method"
5. Repeat 20 more times!

---

## What to Put in Each Field

### Identification Section:
- **Legacy Number**: Whatever number the method has now
  - Examples: `TM-001`, `DOW-GC-123`, `LAB-A-2019-05`
  - Leave blank if it has no number
  
- **Legacy Lab Source**: Where it came from
  - Examples: `Telios Legacy`, `Dow Chemical Lab`, `External Lab A`
  
- **Original Title**: The method name (REQUIRED)
  - Example: `GC Headspace Analysis for VOCs`

### Official Section (Leave blank for now):
- **Official T-Link Number**: Leave empty
- **Official Title**: Leave empty
- *(You'll fill these later after verification)*

### Classification:
- **Category**: Pick from dropdown
  - Gas Chromatography
  - Liquid Chromatography
  - Titration
  - Spectroscopy
  - etc.
  
- **Method Type**: Specific technique
  - Examples: `GC-FID`, `HPLC-UV`, `GC-MS`, `Titration`

### Status (usually leave as defaults):
- **Status**: `draft`
- **Verification Status**: `pending`

### Method Details (fill what you have):
- **Purpose**: What the method tests for
- **Scope**: What samples it applies to
- **Equipment**: List of instruments needed
- **Reagents**: Chemicals required
- **Procedure**: The actual steps
- **Acceptance Criteria**: What results are acceptable
  - Example: `RSD < 5%, Recovery 95-105%`

---

## After Import - What to Do Next

### 1. Review Methods
- Click 👁️ (eye icon) to view details
- Check if all information imported correctly

### 2. Verify Methods (when ready)
- Click ✓ icon
- Add verification notes
- This changes status to "verified"

### 3. Standardize Methods (gradually over time)
- Click 🏷️ icon
- Enter official number: `TM-GC-001`, `TM-HPLC-001`, etc.
- This assigns your official T-Link numbering

### 4. Edit if Needed
- Click ✏️ (edit icon)
- Update any fields
- Changes are saved in version history

---

## Quick Reference

**Start Servers:**
```powershell
cd c:\T_Link
.\start-network.bat
```

**Import CSV:**
```powershell
cd c:\T_Link\backend
npm run import:test-methods
```

**Access App:**
- URL: http://10.0.0.41:3000
- Login: admin / admin123
- Go to: Test Methods

**Search/Filter:**
- Search box: type anything (number, title, lab source)
- Filter by: Status, Verification, Category, Standardized/Legacy

---

## Tips

✅ **Don't worry about perfect data** - you can edit everything later

✅ **Legacy numbers can be messy** - the system handles any format

✅ **Leave official numbers blank** - assign them after you verify the methods

✅ **CSV is faster** - if you have data in a spreadsheet, use CSV import

✅ **Version history tracks everything** - you can see all changes over time

✅ **Files can be added later** - drag PDFs into the upload area (feature coming)

---

## Need Help?

**CSV not importing?**
- Check commas in your data (use quotes if titles have commas)
- Make sure file is saved as `test_methods.csv` in `c:\T_Link\`

**Can't see methods?**
- Refresh browser
- Check filters (make sure not filtering out everything)
- Check backend is running (green console output)

**Want to start over?**
```sql
-- Connect to database and run:
DELETE FROM test_method_versions;
DELETE FROM test_methods;
```
