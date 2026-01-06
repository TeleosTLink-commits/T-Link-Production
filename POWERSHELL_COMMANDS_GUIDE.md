# PowerShell Commands Guide for T_Link Development

## 🚀 Starting the Application

### Start Both Frontend and Backend Servers
```powershell
cd c:\T_Link
npm run dev
```
**Description:** Starts both the frontend (port 3000) and backend (port 5000) servers simultaneously in development mode with hot-reload.

### Start Frontend Only
```powershell
cd c:\T_Link\frontend
npm run dev
```
**Description:** Starts only the React frontend on port 3000 using Vite.

### Start Backend Only
```powershell
cd c:\T_Link\backend
npm run dev
```
**Description:** Starts only the Express backend on port 5000 using nodemon with TypeScript.

---

## 🔌 Port Management

### Check What's Running on a Port
```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen
```
**Description:** Shows which process is listening on port 5000. Replace 5000 with any port number.

### Get Full Details of Port Usage
```powershell
Get-NetTCPConnection -LocalPort 5000 | Select-Object LocalAddress, LocalPort, State, OwningProcess
```
**Description:** Displays detailed information about connections on port 5000 including process ID.

### Kill Process on a Specific Port
```powershell
Get-NetTCPConnection -LocalPort 5000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```
**Description:** Finds and forcefully terminates any process using port 5000. Use this when you get `EADDRINUSE` errors.

### List All Listening Ports
```powershell
Get-NetTCPConnection -State Listen | Sort-Object LocalPort | Select-Object LocalPort, OwningProcess | Format-Table
```
**Description:** Shows all ports currently being listened to on your system, sorted by port number.

---

## 💾 Database Operations

### Connect to PostgreSQL Database
```powershell
psql -h localhost -U postgres -d tlink_db
```
**Description:** Opens an interactive PostgreSQL session for the tlink_db database. You'll be prompted for password (Ajwa8770).

### Run a Database Migration
```powershell
psql -h localhost -U postgres -d tlink_db -f "c:\T_Link\database\migrations\your_migration_file.sql"
```
**Description:** Executes a SQL migration file against the tlink_db database.

### View Database Environment Variables
```powershell
Get-Content "c:\T_Link\backend\.env" | Select-String -Pattern "DB_"
```
**Description:** Shows all database-related environment variables from the .env file.

### Backup Database
```powershell
pg_dump -h localhost -U postgres -d tlink_db -F c -b -v -f "c:\T_Link\backups\tlink_db_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').backup"
```
**Description:** Creates a complete backup of the tlink_db database with timestamp in filename.

### Restore Database from Backup
```powershell
pg_restore -h localhost -U postgres -d tlink_db -v "c:\T_Link\backups\your_backup_file.backup"
```
**Description:** Restores a database from a backup file.

---

## 📦 NPM & Package Management

### Install All Dependencies
```powershell
cd c:\T_Link
npm install
```
**Description:** Installs all dependencies for both frontend and backend as defined in package.json files.

### Install a New Package
```powershell
npm install package-name
```
**Description:** Installs a package and adds it to dependencies in package.json.

### Install Development Package
```powershell
npm install --save-dev package-name
```
**Description:** Installs a package as a development dependency.

### Update All Packages
```powershell
npm update
```
**Description:** Updates all packages to their latest versions within the semver ranges specified in package.json.

### Check for Outdated Packages
```powershell
npm outdated
```
**Description:** Shows which packages have newer versions available.

### Clean Install (Fresh Start)
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```
**Description:** Deletes node_modules and package-lock.json, then reinstalls everything fresh. Use when dependencies are corrupted.

---

## 📁 File & Directory Operations

### Navigate to Project Directory
```powershell
cd c:\T_Link
```
**Description:** Changes current directory to the T_Link project root.

### List Files in Directory
```powershell
Get-ChildItem
# Or use the alias:
ls
```
**Description:** Lists all files and folders in the current directory.

### List Files with Details
```powershell
Get-ChildItem | Format-Table Name, Length, LastWriteTime
```
**Description:** Shows files with size and last modified date in a table format.

### Search for Files by Name
```powershell
Get-ChildItem -Recurse -Filter "*.tsx" | Select-Object FullName
```
**Description:** Recursively finds all .tsx files in the current directory and subdirectories.

### Read File Contents
```powershell
Get-Content "c:\T_Link\backend\.env"
```
**Description:** Displays the entire contents of a file.

### Read Specific Lines from File
```powershell
Get-Content "c:\T_Link\backend\src\routes\sampleInventory.ts" | Select-Object -First 20
```
**Description:** Shows only the first 20 lines of a file. Use `-Last 20` for last 20 lines.

### Search Within Files
```powershell
Select-String -Path "c:\T_Link\backend\src\routes\*.ts" -Pattern "multer"
```
**Description:** Searches for the word "multer" in all .ts files in the routes directory.

### Create Directory
```powershell
New-Item -ItemType Directory -Path "c:\T_Link\new_folder"
```
**Description:** Creates a new directory.

### Copy Files
```powershell
Copy-Item "c:\T_Link\file.txt" -Destination "c:\T_Link\backup\file.txt"
```
**Description:** Copies a file to another location.

### Delete Files/Folders
```powershell
Remove-Item "c:\T_Link\file.txt"
Remove-Item -Recurse "c:\T_Link\folder"  # For folders
```
**Description:** Deletes a file or folder. Use `-Recurse` for folders with contents.

---

## 🔄 Git Operations

### Check Git Status
```powershell
git status
```
**Description:** Shows modified files, staged changes, and current branch.

### View Recent Commits
```powershell
git log --oneline -10
```
**Description:** Shows the last 10 commits in a condensed format.

### Create New Branch
```powershell
git checkout -b feature/new-feature-name
```
**Description:** Creates and switches to a new branch.

### Stage All Changes
```powershell
git add .
```
**Description:** Stages all modified and new files for commit.

### Commit Changes
```powershell
git commit -m "Your commit message here"
```
**Description:** Commits staged changes with a message.

### Push to Remote
```powershell
git push origin branch-name
```
**Description:** Pushes commits to the remote repository.

### Pull Latest Changes
```powershell
git pull origin main
```
**Description:** Fetches and merges latest changes from the main branch.

### View Changed Files
```powershell
git diff --name-only
```
**Description:** Lists all files that have been modified.

### Discard Local Changes
```powershell
git checkout -- filename.ts  # Single file
git checkout -- .            # All files
```
**Description:** Discards uncommitted changes in files.

---

## 🧪 Testing & Debugging

### Run TypeScript Type Check
```powershell
cd c:\T_Link\backend
npx tsc --noEmit
```
**Description:** Checks for TypeScript errors without generating output files.

### Check Node Version
```powershell
node --version
```
**Description:** Shows the installed Node.js version.

### Check NPM Version
```powershell
npm --version
```
**Description:** Shows the installed npm version.

### View Process List
```powershell
Get-Process | Where-Object {$_.ProcessName -like "*node*"}
```
**Description:** Lists all running Node.js processes.

### Kill All Node Processes
```powershell
Get-Process node | Stop-Process -Force
```
**Description:** Forcefully terminates all Node.js processes. Use with caution!

### Monitor File Changes
```powershell
Get-ChildItem c:\T_Link\frontend\src -Recurse | Select-Object FullName, LastWriteTime | Sort-Object LastWriteTime -Descending | Select-Object -First 10
```
**Description:** Shows the 10 most recently modified files in the src directory.

---

## 🛠️ Environment & Configuration

### View All Environment Variables
```powershell
Get-ChildItem Env:
```
**Description:** Lists all environment variables in the current session.

### View Specific Environment Variable
```powershell
$env:NODE_ENV
```
**Description:** Shows the value of a specific environment variable (e.g., NODE_ENV).

### Set Environment Variable (Current Session)
```powershell
$env:NODE_ENV = "development"
```
**Description:** Sets an environment variable for the current PowerShell session only.

### View .env File Contents
```powershell
Get-Content "c:\T_Link\backend\.env"
```
**Description:** Displays the contents of the .env file.

---

## 📊 System Information

### Check Disk Space
```powershell
Get-PSDrive C | Select-Object Used, Free
```
**Description:** Shows used and free space on C: drive.

### Check Memory Usage
```powershell
Get-Process | Sort-Object -Property WS -Descending | Select-Object -First 10 ProcessName, @{Name="Memory(MB)";Expression={[math]::Round($_.WS/1MB, 2)}}
```
**Description:** Shows top 10 processes by memory usage.

### Get System Information
```powershell
Get-ComputerInfo | Select-Object CsName, OsName, OsVersion, OsArchitecture
```
**Description:** Displays basic system information.

---

## 🔍 Helpful Shortcuts

### Clear Terminal
```powershell
Clear-Host
# Or use the alias:
cls
```
**Description:** Clears the terminal screen.

### Get Command History
```powershell
Get-History
```
**Description:** Shows recently executed commands in the current session.

### Run Previous Command
```powershell
Invoke-History -Id 5  # Replace 5 with the command ID from Get-History
```
**Description:** Re-runs a command from your history.

### Find Command Documentation
```powershell
Get-Help Get-ChildItem -Full
```
**Description:** Shows detailed help for any PowerShell command.

---

## 🚨 Emergency Commands

### Force Quit Stuck Application
```powershell
Stop-Process -Name "node" -Force
```
**Description:** Forcefully terminates a process by name.

### Kill Process by PID
```powershell
Stop-Process -Id 12345 -Force
```
**Description:** Kills a process by its Process ID (replace 12345 with actual PID).

### Restart Backend Only (After Code Changes)
```powershell
# If running in separate terminal, just Ctrl+C and then:
cd c:\T_Link\backend
npm run dev
```
**Description:** Stops and restarts just the backend server.

---

## 📝 Common Workflows

### Full Application Restart
```powershell
# Kill all node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Navigate to project
cd c:\T_Link

# Start servers
npm run dev
```
**Description:** Complete restart of the entire application.

### Update After Git Pull
```powershell
git pull origin main
npm install  # Install any new dependencies
npm run dev  # Start the application
```
**Description:** Standard workflow after pulling code changes from Git.

### Database Reset and Migrate
```powershell
# Backup first!
pg_dump -h localhost -U postgres -d tlink_db -F c -f "c:\T_Link\backups\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').backup"

# Run migration
psql -h localhost -U postgres -d tlink_db -f "c:\T_Link\database\migrations\your_migration.sql"
```
**Description:** Safe database migration with backup.

---

## 💡 Tips

1. **Use Tab Completion**: Start typing a command or path and press `Tab` to autocomplete
2. **Command History**: Press `↑` and `↓` arrows to cycle through previous commands
3. **Stop Running Process**: Press `Ctrl+C` to stop a running process in the terminal
4. **Multiple Terminals**: Keep separate terminals open for frontend, backend, and general commands
5. **Aliases**: Create shortcuts for frequently used commands in your PowerShell profile

---

## 🎯 Quick Reference Card

| Task | Command |
|------|---------|
| Start app | `npm run dev` |
| Kill port 5000 | `Get-NetTCPConnection -LocalPort 5000 \| % {Stop-Process -Id $_.OwningProcess -Force}` |
| Connect to DB | `psql -h localhost -U postgres -d tlink_db` |
| Run migration | `psql -h localhost -U postgres -d tlink_db -f "path\to\migration.sql"` |
| Install packages | `npm install` |
| Check git status | `git status` |
| Clear terminal | `cls` |
| View .env | `Get-Content .env` |

---

**Last Updated:** January 5, 2026
**Project:** T_Link Laboratory Management System
**Database:** tlink_db (PostgreSQL)
**Ports:** Frontend (3000), Backend (5000)
