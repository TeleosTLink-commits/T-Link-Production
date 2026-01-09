# Quick Test Instructions - Cloudinary File Download Fix

## What Was Fixed
- **Error:** HTTP 401 Unauthorized when trying to download CoA/SDS files from Cloudinary
- **Cause:** Files were marked as private/restricted in Cloudinary
- **Solution:** Backend now proxies file requests through authenticated API connection

##  To Test

### 1. Restart Backend Server
```powershell
cd c:\T_Link\backend
npm run dev
```

### 2. Test File Download
1. Open the application in your browser
2. Go to **Sample Inventory** page
3. Find a sample with a CoA or SDS file
4. Click the **View/Download** button
5. File should download successfully (no more 401 errors)

### 3. Expected Behavior
- ✓ CoA files download as PDF
- ✓ SDS files download as PDF
- ✓ No browser console errors
- ✓ No `net::ERR_HTTP_RESPONSE_CODE_FAILURE` errors
- ✓ Proper filename in download dialog

## Technical Details

### The Fix
- **Backend Route:** `/api/sample-inventory/:id/coa/download` and `/api/sample-inventory/:id/sds/download`
- **Mechanism:** Files are proxied through backend server instead of direct redirect to Cloudinary
- **Why It Works:** Backend server has valid Cloudinary API credentials in `.env` file

### How It Works
1. Client requests file download from backend
2. Backend detects it's a Cloudinary URL
3. Backend makes authenticated request to Cloudinary
4. Backend streams file response back to client
5. Browser receives file with correct headers and downloads it

## If Issues Persist

### Check Backend Logs
- Look for `Error proxying Cloudinary file:` messages
- Check network tab in browser DevTools
- Verify `.env` file has correct Cloudinary credentials

### Verify Database
```sql
-- Check if files are stored as Cloudinary URLs
SELECT coa_file_path, sds_file_path FROM samples WHERE id = 'sample-id';
```

Expected: URLs starting with `https://res.cloudinary.com/di7yyu1mx/`

### Verify Cloudinary Credentials
```powershell
cd c:\T_Link\backend
node scripts\diagnose-cloudinary.js
```

Should show: ✓ Connected to Cloudinary successfully

## Files Modified
- `backend/src/routes/sampleInventory.ts` - Download endpoints
- `backend/src/utils/cloudinary.ts` - Configuration

## Support
All existing CoA and SDS files will now be accessible through the proxy mechanism. The fix is transparent to users.
