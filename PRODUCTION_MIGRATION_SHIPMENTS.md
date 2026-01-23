# Shipment Samples Migration - Production Deployment

## Issue
The shipment request feature is failing with a 500 error because the `shipment_samples` table doesn't exist in the production database.

## Solution
Run the migration script on the production database (Render).

---

## Option 1: Run Migration via Render Shell (RECOMMENDED)

1. **Go to Render Dashboard**
   - Navigate to: https://dashboard.render.com
   - Select your backend service: `tlink-production-backend`

2. **Open Shell**
   - Click on "Shell" tab in the left sidebar
   - This opens a terminal connected to your running backend instance

3. **Run Migration Command**
   ```bash
   node production-migrate-shipments.js
   ```

4. **Verify Output**
   You should see:
   ```
   🔄 Starting shipment_samples migration...
   
   Step 1: Checking if shipment_samples table exists...
   Step 2: Creating shipment_samples table...
   ✓ shipment_samples table created
   
   Step 3: Creating indexes...
   ✓ Indexes created
   
   Step 4: Updating shipments table status constraint...
   ✓ Status constraint updated
   
   ✅ Migration completed successfully!
   ```

5. **Test Shipment Request**
   - Try creating a shipment request from the frontend
   - Should now work without 500 error

---

## Option 2: Run SQL Migration via Render Database Dashboard

1. **Access Database**
   - Go to Render Dashboard > Databases
   - Select your PostgreSQL database: `tlink_production_db`

2. **Open Query Console**
   - Click "Query" or "Console" tab

3. **Copy and Paste SQL**
   - Open: `database/migrations/RUN_ON_PRODUCTION_add_shipment_samples.sql`
   - Copy entire contents
   - Paste into query console

4. **Execute**
   - Click "Run" or "Execute"
   - Wait for completion message

5. **Restart Backend Service**
   - Go back to backend service
   - Click "Manual Deploy" > "Clear build cache & deploy"
   - Or just restart the service

---

## Option 3: Run Migration via Local Connection to Production DB

1. **Get Production Database URL**
   - From Render Dashboard > Database > Connection String
   - Copy the External Database URL

2. **Set Environment Variable Locally**
   ```powershell
   $env:DATABASE_URL = "your-production-database-url-here"
   $env:NODE_ENV = "production"
   ```

3. **Run Migration Script**
   ```powershell
   cd backend
   node production-migrate-shipments.js
   ```

4. **Verify**
   - Check output for success message
   - Test shipment creation on production site

---

## Verification

After running migration, verify in database:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'shipment_samples'
);

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipment_samples' 
ORDER BY ordinal_position;

-- Check status constraint
SELECT con.conname, pg_get_constraintdef(con.oid) as definition 
FROM pg_constraint con 
JOIN pg_class rel ON rel.oid = con.conrelid 
WHERE rel.relname = 'shipments' 
AND con.contype = 'c' 
AND con.conname LIKE '%status%';
```

---

## What This Migration Does

1. **Creates `shipment_samples` table**
   - Junction table linking shipments to multiple samples
   - Allows 1 shipment to contain up to 10 samples
   - Tracks quantity requested for each sample

2. **Adds indexes**
   - Speeds up queries by shipment_id
   - Speeds up queries by sample_id

3. **Updates status constraint**
   - Adds `'initiated'` as valid shipment status
   - Preserves all existing status values

---

## Troubleshooting

**Error: "relation 'shipment_samples' already exists"**
- Migration already run, no action needed
- Verify table exists with verification queries above

**Error: "permission denied"**
- Ensure DATABASE_URL is correct
- Check that database user has CREATE TABLE permissions

**Error: "connection refused"**
- Check DATABASE_URL format
- Ensure SSL settings are correct for production
- Try from Render Shell instead

**Still getting 500 error after migration**
- Restart the backend service on Render
- Check backend logs for new error details
- Verify migration ran successfully with verification queries

---

## Post-Migration

After successful migration:
1. ✅ Test creating a new shipment request
2. ✅ Test with multiple samples (2-10)
3. ✅ Verify email notifications are sent
4. ✅ Check that shipment appears in "My Shipments"
5. ✅ Verify hazmat detection works (>=30ml)

---

## Need Help?

If migration fails or shipment requests still don't work:
1. Check backend logs on Render
2. Run verification queries to check table state
3. Try restarting backend service
4. Contact support with error logs
