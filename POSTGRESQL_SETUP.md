# PostgreSQL Setup Guide for T-Link

This guide will walk you through installing and configuring PostgreSQL for the T-Link application on Windows.

## Step 1: Install PostgreSQL

### Option A: Download Official Installer (Recommended)

1. **Download PostgreSQL:**
   - Go to https://www.postgresql.org/download/windows/
   - Click "Download the installer" from EnterpriseDB
   - Download the latest version (PostgreSQL 15 or 16 recommended)

2. **Run the Installer:**
   - Double-click the downloaded `.exe` file
   - Click "Next" through the welcome screen

3. **Installation Directory:**
   - Default is fine: `C:\Program Files\PostgreSQL\16`
   - Click "Next"

4. **Select Components:**
   - ✅ PostgreSQL Server (required)
   - ✅ pgAdmin 4 (recommended - GUI tool)
   - ✅ Command Line Tools (required)
   - ✅ Stack Builder (optional)
   - Click "Next"

5. **Data Directory:**
   - Default is fine: `C:\Program Files\PostgreSQL\16\data`
   - Click "Next"

6. **Set Password:**
   - **IMPORTANT:** Set a password for the PostgreSQL superuser (postgres)
   - **Remember this password** - you'll need it later!
   - Example: `postgres123` (use a strong password in production)
   - Click "Next"

7. **Port:**
   - Default port: `5432` (leave as is unless you have conflicts)
   - Click "Next"

8. **Locale:**
   - Default locale is fine
   - Click "Next"

9. **Complete Installation:**
   - Click "Next" to review settings
   - Click "Next" to start installation
   - Wait for installation to complete
   - Uncheck "Stack Builder" at the end
   - Click "Finish"

### Option B: Using Chocolatey (Advanced)

If you have Chocolatey package manager:

```powershell
choco install postgresql --params '/Password:postgres123'
```

## Step 2: Verify PostgreSQL Installation

1. **Open PowerShell as Administrator**

2. **Check PostgreSQL Service:**
   ```powershell
   Get-Service -Name postgresql*
   ```
   You should see the service running.

3. **Test PostgreSQL Connection:**
   ```powershell
   # Navigate to PostgreSQL bin directory
   cd "C:\Program Files\PostgreSQL\16\bin"
   
   # Connect to PostgreSQL
   .\psql -U postgres
   ```

4. **Enter the password** you set during installation

5. **You should see:**
   ```
   postgres=#
   ```

6. **Exit psql:**
   ```sql
   \q
   ```

## Step 3: Add PostgreSQL to System PATH (Optional but Recommended)

This allows you to run `psql` from any directory.

1. **Open System Environment Variables:**
   - Press `Win + X` → "System"
   - Click "Advanced system settings"
   - Click "Environment Variables"

2. **Edit PATH:**
   - Under "System variables", find "Path"
   - Click "Edit"
   - Click "New"
   - Add: `C:\Program Files\PostgreSQL\16\bin`
   - Click "OK" on all dialogs

3. **Restart PowerShell** to apply changes

4. **Test from any directory:**
   ```powershell
   psql --version
   ```

## Step 4: Create T-Link Database

### Option A: Using Command Line (psql)

1. **Open PowerShell**

2. **Connect to PostgreSQL:**
   ```powershell
   psql -U postgres
   ```

3. **Enter your password**

4. **Create the database:**
   ```sql
   CREATE DATABASE tlink_db;
   ```

5. **Verify database was created:**
   ```sql
   \l
   ```
   You should see `tlink_db` in the list.

6. **Exit:**
   ```sql
   \q
   ```

### Option B: Using pgAdmin (GUI)

1. **Launch pgAdmin 4** (installed with PostgreSQL)

2. **Connect to Server:**
   - Expand "Servers" in the left panel
   - Right-click "PostgreSQL 16"
   - Enter your password
   - Check "Save password"

3. **Create Database:**
   - Right-click "Databases"
   - Select "Create" → "Database..."
   - Database name: `tlink_db`
   - Owner: `postgres`
   - Click "Save"

## Step 5: Configure T-Link Backend

1. **Navigate to backend folder:**
   ```powershell
   cd c:\T_Link\backend
   ```

2. **Copy environment template:**
   ```powershell
   Copy-Item .env.example .env
   ```

3. **Edit `.env` file** (use Notepad, VS Code, or any text editor):
   ```powershell
   notepad .env
   ```

4. **Update database configuration:**
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=tlink_db
   DB_USER=postgres
   DB_PASSWORD=postgres123    # Use your actual password here!
   ```

5. **Update other required settings:**
   ```env
   JWT_SECRET=change_this_to_a_random_long_string_in_production
   SMTP_USER=your_email@example.com
   SMTP_PASSWORD=your_email_password
   ```

6. **Save the file**

## Step 6: Run Database Migrations

1. **Make sure you're in the backend directory:**
   ```powershell
   cd c:\T_Link\backend
   ```

2. **Install dependencies** (if not done already):
   ```powershell
   npm install
   ```

3. **Run migrations to create all tables:**
   ```powershell
   npm run db:migrate
   ```

   You should see:
   ```
   ✅ Database schema created successfully
   ```

4. **Seed the database with sample data:**
   ```powershell
   npm run db:seed
   ```

   You should see:
   ```
   ✅ Database seeded successfully
   📝 Default login credentials:
      Admin: admin / admin123
      Lab Staff: lab_user / admin123
      Logistics: logistics_user / admin123
   ```

## Step 7: Verify Database Setup

### Using psql:

```powershell
# Connect to tlink_db
psql -U postgres -d tlink_db

# List all tables
\dt

# Check users table
SELECT username, email, role FROM users;

# Exit
\q
```

### Using pgAdmin:

1. **Launch pgAdmin 4:**
   - Find pgAdmin 4 in your Start Menu (search for "pgAdmin")
   - Double-click to open
   - pgAdmin will open in your default web browser (it's a web-based application)

2. **First-Time Setup (if prompted):**
   - You may be asked to set a master password for pgAdmin itself
   - This is different from your PostgreSQL password
   - This password protects your saved database credentials
   - Set it and remember it

3. **Expand the Server Tree:**
   - In the left sidebar, you'll see "Servers"
   - Click the arrow (▶) next to "Servers" to expand it
   - You should see "PostgreSQL 16" (or your version number)

4. **Connect to PostgreSQL Server:**
   - Click on "PostgreSQL 16"
   - A password dialog will appear
   - Enter the password you set during PostgreSQL installation (e.g., `postgres123`)
   - ✅ Check "Save password" to avoid entering it every time
   - Click "OK"

5. **Navigate to Your Database:**
   - Expand "PostgreSQL 16" by clicking the arrow
   - Expand "Databases" (you'll see several databases)
   - Find "tlink_db" in the list
   - Expand "tlink_db"
   - Expand "Schemas"
   - Expand "public" (this is the default schema)
   - Click on "Tables"

6. **View All Tables:**
   - In the main panel (right side), you should now see a list of all tables
   - Look for tables like:
     - users
     - test_methods
     - test_method_versions
     - certificates_of_analysis
     - samples
     - sample_transactions
     - freezers
     - shipment_requests
     - manufacturer_companies
     - And many more...
   - If you see 25+ tables, your migration was successful! ✅

7. **View Table Data:**
   - In the left sidebar, expand "Tables" under "public"
   - Right-click on "users" table
   - Select "View/Edit Data" → "All Rows"
   - A new tab will open showing the table contents in a spreadsheet-like view
   - You should see your default users:
     - admin (role: admin)
     - lab_user (role: lab_staff)
     - logistics_user (role: logistics)

8. **Inspect Table Structure:**
   - Right-click on any table (e.g., "samples")
   - Select "Properties"
   - Click on "Columns" tab to see all column names, data types, and constraints
   - Click on "Constraints" tab to see primary keys, foreign keys, and unique constraints
   - Click on "Triggers" tab to see any triggers (e.g., updated_at timestamp triggers)

9. **Run Custom Queries:**
   - Click on "Tools" in the top menu
   - Select "Query Tool"
   - A new SQL editor tab will open
   - Try some queries:
     ```sql
     -- Count total samples
     SELECT COUNT(*) as total_samples FROM samples;
     
     -- View all freezer locations
     SELECT * FROM freezers ORDER BY freezer_name;
     
     -- Check expired CoAs (with manufacturer name)
     SELECT 
       coa.lot_number, 
       coa.product_name,
       mc.company_name as manufacturer,
       coa.expiration_date,
       coa.status
     FROM certificates_of_analysis coa
     LEFT JOIN manufacturer_companies mc ON coa.manufacturer_id = mc.id
     WHERE coa.expiration_date < CURRENT_DATE
     ORDER BY coa.expiration_date;
     
     -- Check CoAs expiring soon (within 30 days)
     SELECT 
       coa.lot_number, 
       coa.product_name,
       mc.company_name as manufacturer,
       coa.expiration_date,
       CURRENT_DATE - coa.expiration_date as days_until_expiry
     FROM certificates_of_analysis coa
     LEFT JOIN manufacturer_companies mc ON coa.manufacturer_id = mc.id
     WHERE coa.expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
     ORDER BY coa.expiration_date;
     ```
   - Click the ▶ (Execute) button or press F5 to run the query
   - Results appear in the "Data Output" panel below

10. **Useful pgAdmin Features:**
    - **Dashboard:** 
      - In the left sidebar, click directly on "tlink_db" (the database name)
      - The main panel will switch to show the Dashboard tab
      - You'll see database statistics, active sessions, and performance graphs
      - If you don't see the Dashboard tab, look for tabs at the top of the main panel (Dashboard, Properties, SQL, Statistics, etc.)
    - **Backup:** Right-click "tlink_db" → "Backup..." to create a database backup
    - **Restore:** Right-click "tlink_db" → "Restore..." to restore from a backup file
    - **ERD Tool:** Right-click "tlink_db" → "ERD For Database" to visualize table relationships (requires additional setup)
    - **Import/Export:** Right-click a table → "Import/Export Data..." to load CSV files

11. **Verify Key Tables Have Data:**
    - **users:** Should have 3 default users
    - **manufacturer_companies:** Should have sample manufacturers (Sigma-Aldrich, Fisher Scientific, VWR)
    - **freezers:** Should have sample freezer locations
    - **hazard_classes:** Should have UN hazard classifications
    - If these tables are empty, you need to run: `npm run db:seed`

12. **View Database Statistics:**
    - Click on "tlink_db" in the left sidebar
    - Look for tabs in the main panel: **Dashboard**, **Properties**, **SQL**, **Statistics**, **Dependencies**
    - **Dashboard tab** shows:
      - Server Activity (active connections)
      - Database size and statistics
      - Session Activity graphs
      - Transaction throughput
    - **Statistics tab** shows:
      - Table count
      - Total database size
      - Index size and count
      - Tuple statistics (rows inserted/updated/deleted)

**pgAdmin Tips:**
- Right-click almost anything for context menu options
- Use Ctrl+F to search within query results
- Use Ctrl+Space in Query Tool for SQL autocomplete
- Check "Tools" → "Preferences" to customize pgAdmin appearance and behavior
- Pin frequently used databases by right-clicking and selecting "Disconnect Server" → then reconnect to keep them at the top

## Common Issues & Solutions

### Issue 1: "psql: command not found"

**Solution:** PostgreSQL bin directory not in PATH
```powershell
# Use full path instead
& "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres
```

### Issue 2: "password authentication failed for user postgres"

**Solution:** Wrong password or user doesn't exist
- Double-check your password
- Reset password:
  ```powershell
  # As Windows admin
  & "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres
  ALTER USER postgres PASSWORD 'new_password';
  ```

### Issue 3: "could not connect to server: Connection refused"

**Solution:** PostgreSQL service not running
```powershell
# Check service status
Get-Service -Name postgresql*

# Start service if stopped
Start-Service -Name postgresql-x64-16

# Or restart
Restart-Service -Name postgresql-x64-16
```

### Issue 4: "port 5432 already in use"

**Solution:** Another process is using port 5432
```powershell
# Find what's using the port
netstat -ano | findstr :5432

# Either stop that process or change PostgreSQL port in postgresql.conf
```

### Issue 5: "database tlink_db already exists"

**Solution:** Database exists but might be empty or corrupted
```powershell
# Connect to postgres database
psql -U postgres

# Drop and recreate
DROP DATABASE tlink_db;
CREATE DATABASE tlink_db;
\q

# Re-run migrations
cd c:\T_Link\backend
npm run db:migrate
npm run db:seed
```

### Issue 6: Migration fails with "relation already exists"

**Solution:** Tables partially created
```powershell
# Connect to database
psql -U postgres -d tlink_db

# Drop all tables (CAUTION: This deletes all data!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
\q

# Re-run migrations
npm run db:migrate
npm run db:seed
```

## Testing the Database Connection

Create a test file to verify connection:

**test-db-connection.js:**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'tlink_db',
  user: 'postgres',
  password: 'postgres123', // Your password
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
  } else {
    console.log('✅ Connection successful!');
    console.log('Server time:', res.rows[0].now);
  }
  pool.end();
});
```

Run it:
```powershell
node test-db-connection.js
```

## Useful PostgreSQL Commands

```sql
-- List all databases
\l

-- Connect to a database
\c tlink_db

-- List all tables
\dt

-- Describe a table structure
\d users

-- Show all users
SELECT * FROM users;

-- Count records
SELECT COUNT(*) FROM samples;

-- Drop database (CAUTION!)
DROP DATABASE tlink_db;

-- Create new user
CREATE USER tlink_app WITH PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE tlink_db TO tlink_app;

-- Quit
\q
```

## Managing PostgreSQL Service

```powershell
# Check status
Get-Service postgresql-x64-16

# Start service
Start-Service postgresql-x64-16

# Stop service
Stop-Service postgresql-x64-16

# Restart service
Restart-Service postgresql-x64-16

# Set to start automatically
Set-Service -Name postgresql-x64-16 -StartupType Automatic
```

## Production Recommendations

1. **Create dedicated database user** instead of using `postgres`:
   ```sql
   CREATE USER tlink_user WITH PASSWORD 'strong_password_here';
   GRANT ALL PRIVILEGES ON DATABASE tlink_db TO tlink_user;
   ```

2. **Update `.env`** to use new user:
   ```env
   DB_USER=tlink_user
   DB_PASSWORD=strong_password_here
   ```

3. **Enable SSL connections** in production

4. **Set up regular backups:**
   ```powershell
   pg_dump -U postgres tlink_db > backup.sql
   ```

5. **Restrict network access** (postgresql.conf and pg_hba.conf)

## Next Steps

Once PostgreSQL is set up and migrations are complete:

1. **Start the backend server:**
   ```powershell
   cd c:\T_Link\backend
   npm run dev
   ```

2. **Access the application:**
   - Backend API: http://localhost:5000
   - Frontend (after starting): http://localhost:3000

3. **Login with default credentials:**
   - Username: `admin`
   - Password: `admin123`

---

Need help? Check the PostgreSQL documentation: https://www.postgresql.org/docs/
