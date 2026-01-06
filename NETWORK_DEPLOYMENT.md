# T-Link Network Deployment Guide

## Your Network Configuration

**Your Computer IP:** `10.0.0.41`  
**Backend Server:** `http://10.0.0.41:5000`  
**Frontend Server:** `http://10.0.0.41:3000`

---

## Quick Start

### Option 1: Use the Startup Script (Easiest)
1. Double-click `start-network.bat` in the `c:\T_Link` folder
2. Two command windows will open (backend and frontend)
3. Wait ~30 seconds for both servers to start
4. Share the URL with others: **http://10.0.0.41:3000**

### Option 2: Manual Start
Open two PowerShell windows:

**Window 1 - Backend:**
```powershell
cd c:\T_Link\backend
npm run dev
```

**Window 2 - Frontend:**
```powershell
cd c:\T_Link\frontend
npm run dev
```

---

## Access Instructions for Other Users

### For Users on Your Network

**They can access T-Link at:**
```
http://10.0.0.41:3000
```

**Login Credentials:**
- Username: `admin`
- Password: `admin123`

**OR**
- Username: `lab_user`
- Password: `admin123`

**OR**
- Username: `logistics_user`
- Password: `admin123`

### Requirements for Users
- Must be on the **same WiFi/network** as your computer (10.0.0.41)
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Your computer (the server) must be powered on and running T-Link

---

## Firewall Configuration

✅ **Windows Firewall:** Already configured for Node.js
✅ **Network Access:** Configured for 0.0.0.0 (all network interfaces)

If users can't connect, verify:
1. Your computer's firewall allows connections on ports 3000 and 5000
2. Both users are on the same network
3. Your router doesn't have client isolation enabled (common on guest WiFi)

### Manual Firewall Rule (if needed)
Run in PowerShell as Administrator:
```powershell
# Allow port 3000 (Frontend)
New-NetFirewallRule -DisplayName "T-Link Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Allow port 5000 (Backend)
New-NetFirewallRule -DisplayName "T-Link Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

---

## Troubleshooting

### Users Can't Connect

**1. Verify servers are running:**
```powershell
netstat -ano | findstr ":3000"
netstat -ano | findstr ":5000"
```
Should show both ports as LISTENING.

**2. Check your IP hasn't changed:**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}
```
If IP changed, update:
- `c:\T_Link\backend\.env` (API_URL and FRONTEND_URL)
- `c:\T_Link\frontend\vite.config.ts` (proxy target)
- Restart servers

**3. Test from your computer first:**
Open browser to `http://10.0.0.41:3000` on your own computer (not localhost)

**4. Check router settings:**
- Guest network isolation may block device-to-device communication
- Some routers have "AP Isolation" enabled - disable it
- Corporate networks may block this - use on home/office network

### API Calls Fail

**Check CORS configuration:**
`c:\T_Link\backend\src\server.ts` should have:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://10.0.0.41:3000',
  credentials: true,
}));
```

### Slow Performance

- Database queries should be fast on local network
- Check network congestion
- Ensure PostgreSQL is running locally (not over network)

---

## Network Security Considerations

### Current Setup (Development)
- ⚠️ No HTTPS (traffic is unencrypted)
- ⚠️ Default passwords (should be changed)
- ⚠️ Debug mode enabled
- ✅ Only accessible on local network (not internet)

### Recommended Before Production Use

1. **Change Default Passwords:**
```sql
-- Connect to database
psql -U postgres -d tlink_db

-- Update passwords
UPDATE users SET password = crypt('NEW_PASSWORD', gen_salt('bf')) WHERE username = 'admin';
```

2. **Enable HTTPS:** Use a reverse proxy like nginx with SSL certificates

3. **Update JWT Secret:** Change in `.env` file to a strong random value

4. **Disable Debug Mode:** Set `NODE_ENV=production`

5. **Add User Authentication:** Consider SSO, 2FA for sensitive data

---

## Static IP Configuration (Optional)

To prevent IP changes, set a static IP on your computer:

1. Open **Control Panel** → **Network and Sharing Center**
2. Click your network connection → **Properties**
3. Select **Internet Protocol Version 4 (TCP/IPv4)** → **Properties**
4. Choose **Use the following IP address:**
   - IP address: `10.0.0.41`
   - Subnet mask: `255.255.255.0` (usually)
   - Default gateway: Your router's IP (usually `10.0.0.1`)
   - DNS: `8.8.8.8` (Google) or your router's IP

---

## Stopping the Servers

### If using start-network.bat:
Close the two command windows

### If running manually:
Press `Ctrl+C` in each PowerShell window

### Force stop if needed:
```powershell
# Find and kill Node processes
Get-Process node | Stop-Process -Force
```

---

## Access URLs Summary

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend (Users access here)** | http://10.0.0.41:3000 | Main application UI |
| **Backend API** | http://10.0.0.41:5000 | REST API (called by frontend) |
| **Health Check** | http://10.0.0.41:5000/health | Verify backend is running |
| **Database** | localhost:5432 | PostgreSQL (local only) |

---

## What Was Changed

### Backend Configuration
- ✅ `.env` - Updated FRONTEND_URL and API_URL to use 10.0.0.41
- ✅ `.env` - Added HOST=0.0.0.0 to listen on all network interfaces
- ✅ `server.ts` - Updated to bind to HOST variable

### Frontend Configuration
- ✅ `vite.config.ts` - Added host: '0.0.0.0' for network access
- ✅ `vite.config.ts` - Updated proxy target to 10.0.0.41:5000

### New Files
- ✅ `start-network.bat` - One-click startup script
- ✅ `NETWORK_DEPLOYMENT.md` - This guide

---

## Example: Sharing with a Colleague

**You (on your computer):**
1. Double-click `start-network.bat`
2. Wait for both servers to start (~30 seconds)
3. Verify by opening http://10.0.0.41:3000 in YOUR browser

**Your Colleague (on their computer):**
1. Connect to the same WiFi network
2. Open browser to http://10.0.0.41:3000
3. Login with admin/admin123
4. Start using T-Link!

**Note:** Your computer must stay on and running for them to access the application.

---

## Reverting to Localhost Only

If you want to go back to localhost-only access:

1. Update `c:\T_Link\backend\.env`:
   ```
   API_URL=http://localhost:5000
   FRONTEND_URL=http://localhost:3000
   HOST=127.0.0.1
   ```

2. Update `c:\T_Link\frontend\vite.config.ts`:
   ```typescript
   server: {
     port: 3000,
     proxy: {
       '/api': {
         target: 'http://localhost:5000',
         changeOrigin: true,
       },
     },
   },
   ```

3. Restart both servers

---

## Support

If you encounter issues, check:
1. Both servers are running (green success messages)
2. Your IP hasn't changed (run IP check command)
3. Firewall allows connections
4. Both devices are on same network
5. Browser console (F12) for error messages

The Sample Inventory module and all other features work exactly the same over the network!
