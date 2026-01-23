# Email Configuration - T-Link Support Forms

## ✅ Configuration Complete

### Email Service Setup
- **Email Provider**: Gmail SMTP
- **Sender Email**: teleostlink@gmail.com
- **App Password**: yzeybrcemspdtcyf (configured in .env)

### Environment Variables (.env)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=teleostlink@gmail.com
SMTP_PASSWORD=yzeybrcemspdtcyf
EMAIL_FROM=teleostlink@gmail.com
```

### Support Email Recipients
- **Tech Support**: jhunzie@ajwalabs.com (set via TECH_SUPPORT_EMAIL)
- **Lab Support**: eboak@ajwalabs.com (set via LAB_SUPPORT_EMAIL)

### API Endpoints Created

#### Manufacturer Portal Support
- **POST** `/api/manufacturer/support/tech-support` - Tech support requests from manufacturers
- **POST** `/api/manufacturer/support/lab-support` - Lab support requests from manufacturers

#### Internal Staff Support
- **POST** `/api/internal/support/tech-support` - Tech support requests from internal staff
- **POST** `/api/internal/support/lab-support` - Lab support requests from internal staff

### Email Features
1. **Support Team Notification** - Email sent to support team with request details
2. **Sender Confirmation** - Confirmation email sent to requester
3. **Database Logging** - All requests saved to support_requests table
4. **HTML Email Templates** - Professional formatted emails with:
   - Sender information
   - Subject and message
   - Request ID for tracking
   - Expected response time
   - Contact information

### Files Modified
1. **Backend**:
   - `backend/.env` - Added Gmail SMTP configuration
   - `backend/src/routes/internalSupport.ts` - NEW: Internal staff support routes
   - `backend/src/server.ts` - Registered internal support routes

2. **Frontend**:
   - `frontend/src/pages/manufacturer/SupportForms.tsx` - Updated to detect user role and use correct endpoint

### Database Table
```sql
support_requests (
    id UUID PRIMARY KEY,
    user_id UUID,  -- Internal staff user
    manufacturer_user_id UUID,  -- Manufacturer user
    support_type VARCHAR(50),  -- 'tech_support' or 'lab_support'
    subject TEXT,
    message TEXT,
    recipient_email VARCHAR(255),
    status VARCHAR(50),  -- 'open', 'in_progress', 'resolved', 'closed'
    submitted_by_email VARCHAR(255),
    submitted_by_name VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

### Testing
To test the email functionality:

1. **Manufacturer Portal**:
   - Log in as a manufacturer user
   - Navigate to /manufacturer/support
   - Select Tech Support or Lab Support
   - Fill out form and submit

2. **Internal Dashboard**:
   - Log in as an internal staff user
   - Navigate to /internal/support
   - Select Tech Support or Lab Support
   - Fill out form and submit

3. **Verify**:
   - Check that support team receives email at jhunzie@ajwalabs.com or eboak@ajwalabs.com
   - Check that requester receives confirmation email
   - Check support_requests table for logged entry

### Email Flow
```
User Submits Form
    ↓
API Endpoint Receives Request
    ↓
Insert into support_requests table
    ↓
Send Email to Support Team (jhunzie/eboak)
    ↓
Send Confirmation Email to Requester
    ↓
Return Success Response
```

### Security Notes
- Gmail App Password (not regular password) is used for security
- Credentials stored in .env file (not committed to git)
- Rate limiting applied to prevent abuse
- Authentication required for all support endpoints
- Input validation on subject and message fields

### Troubleshooting
If emails are not sending:
1. Check .env file has correct SMTP credentials
2. Verify teleostlink@gmail.com has "Less secure app access" enabled or App Password is valid
3. Check backend logs for email errors
4. Verify SMTP_HOST and SMTP_PORT are correct
5. Test connection to smtp.gmail.com:587

### Gmail App Password Setup (for reference)
1. Enable 2-Step Verification on Google Account
2. Go to Google Account > Security > App Passwords
3. Generate new app password for "Mail" and "Windows Computer"
4. Use generated 16-character password in .env file

## Status: ✅ READY FOR TESTING
