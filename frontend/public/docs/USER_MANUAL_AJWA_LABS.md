# T-Link User Manual - Ajwa Labs (Internal Staff)

**Version:** 1.0  
**Last Updated:** January 27, 2026  
**Application URL:** <https://t-link-production.vercel.app>

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Sample Inventory Management](#3-sample-inventory-management)
4. [Test Methods Library](#4-test-methods-library)
5. [Shipment Logistics](#5-shipment-logistics)
6. [Processing Dashboard](#6-processing-dashboard)
7. [Supply Inventory](#7-supply-inventory)
8. [Support System](#8-support-system)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Getting Started

### 1.1 Accessing T-Link

1. Open your web browser and navigate to: **<https://t-link-production.vercel.app>**
2. You will see the T-Link login page with the company logo

### 1.2 Logging In

1. Enter your **Email Address** (must be pre-authorized by an administrator)
2. Enter your **Password**
3. Click **Sign In**

> **Note:** After 5 failed login attempts, your account will be temporarily locked for 15 minutes for security.

### 1.3 User Roles

| Role | Access Level |
| --- | --- |
| **Lab Staff** | Sample Inventory, Test Methods, Shipment Creation |
| **Admin** | All Lab Staff functions + User management |

### 1.4 First-Time Login

If this is your first login:

1. Your email must be in the authorized users list (contact Admin)
2. Navigate to **Create Account** on the login page
3. Complete the registration form
4. Your account will be active immediately

---

## 2. Dashboard Overview

After logging in, you'll see the **T-Link Dashboard** with three main action buttons:

| Button | Function |
| --- | --- |
| **Test Methods** | Manage testing procedures and documentation |
| **Sample Inventory** | Track chemical samples, CoAs, and SDS documents |
| **Shipment Logistics** | Create and manage outbound shipments |

### Navigation

- **Contact Support** - Top right corner, opens support request form
- **Sign Out** - Top right corner, securely logs you out

---

## 3. Sample Inventory Management

### 3.1 Accessing Sample Inventory

From the Dashboard, click **Sample Inventory**.

### 3.2 Dashboard Statistics

At the top of the page, you'll see real-time statistics:

- **Total Samples** - All samples in the system
- **Active Samples** - Currently active inventory
- **Expired Samples** - Samples past expiration date
- **Expiring in 30/60/90 Days** - Early warning indicators
- **With CoA** - Samples with Certificate of Analysis attached
- **With SDS** - Samples with Safety Data Sheet attached

### 3.3 Searching and Filtering

**Search Box:** Enter chemical name, lot number, or CAS number to filter results.

**Status Filter:** Filter by:

- All
- Active
- Expired
- Depleted
- On Hold

**Sorting:** Click any column header to sort ascending/descending:

- Chemical Name
- Lot Number
- Received Date
- Expiration Date
- Status

### 3.4 Adding a New Sample

1. Click **+ Add Sample** button
2. Fill in the required fields:

| Field | Description | Required |
| --- | --- | --- |
| Chemical Name | Full name of the chemical | Yes |
| Lot Number | Unique lot identifier | Yes |
| Received Date | Date sample was received | Yes |
| Quantity | Amount in stock | Yes |
| Concentration | Percentage or ratio | No |
| CAS Number | Chemical Abstracts Service number | No |
| Certification Date | Date of original certification | No |
| Recertification Date | Date of recertification (if applicable) | No |
| Expiration Date | When the sample expires | Recommended |
| UN Number | DOT hazmat identifier (e.g., UN1993) | For HazMat |
| Hazard Class | DOT hazard classification (1-9) | For HazMat |
| Packing Group | I, II, or III | For HazMat |
| Proper Shipping Name | Official DOT shipping name | For HazMat |
| HS Code | Harmonized System code for customs | For International |
| Notes | Additional information | No |

1. **Attach Files:**
    - Click **Choose CoA File** to upload Certificate of Analysis (PDF)
    - Click **Choose SDS File** to upload Safety Data Sheet (PDF)

2. Click **Save Sample**

### 3.5 Editing a Sample

1. Locate the sample in the list
2. Click the **Edit** button (pencil icon)
3. Modify any fields as needed
4. Click **Save Changes**

### 3.6 Viewing/Downloading Documents

- **View CoA:** Click the **CoA** button next to the sample
- **View SDS:** Click the **SDS** button next to the sample
- Documents open in a new browser tab

### 3.7 Expiration Badges

Samples display colored badges based on expiration status:

- 🟢 **Valid** - More than 90 days until expiration
- 🔵 **Expires in X days** - 60-90 days remaining
- 🟡 **Expires in X days** - 30-60 days remaining
- 🔴 **Expires in X days** - Less than 30 days
- 🔴 **Expired** - Past expiration date

---

## 4. Test Methods Library

### 4.1 Accessing Test Methods

From the Dashboard, click **Test Methods**.

### 4.2 Viewing Test Methods

The library displays all test methods with:

- **TM Number** - Unique identifier (e.g., TM-001)
- **Title** - Test method name
- **Version** - Current version number
- **Status** - Active, Draft, or Archived
- **Document** - Attached PDF file

### 4.3 Adding a New Test Method

1. Click **+ Add Test Method**
2. Fill in the form:

| Field | Description |
| --- | --- |
| TM Number | Unique test method ID (e.g., TM-042) |
| Title | Descriptive title of the test method |
| Version | Version number (e.g., 1.0, 2.1) |
| Description | Detailed description of the procedure |
| Status | Active, Draft, or Archived |
| Is Current Version | Check if this is the active version |

1. **Upload Document:** Click **Choose File** to attach the test method PDF
2. Click **Save**

### 4.4 Editing Test Methods

1. Click **Edit** button on any test method row
2. Modify fields as needed
3. Upload a new document if the procedure has changed
4. Click **Save Changes**

### 4.5 Viewing Documents

Click **View Document** to open the test method PDF in a new tab.

### 4.6 Archiving Test Methods

When a test method is superseded:

1. Click **Edit** on the old version
2. Change Status to **Archived**
3. Uncheck **Is Current Version**
4. Save changes

---

## 5. Shipment Logistics

### 5.1 Accessing Shipments

From the Dashboard, click **Shipment Logistics**.

### 5.2 Shipment Overview

The page displays four tabs:

- **All** - All shipments
- **Processing** - Pending shipments
- **Shipped** - Completed shipments
- **Shipping Supplies** - Manage shipping supplies inventory

### 5.3 Creating a New Shipment

1. Click **+ Create Shipment**
2. **Select Samples:**
    - Choose a sample from the dropdown
    - Enter the amount to ship
    - Click **+ Add Another Sample** for multi-sample shipments (up to 10)

3. **Enter Recipient Information:**

| Field | Description |
| --- | --- |
| Recipient Name | Full name of recipient |
| Company | Company name (optional) |
| Phone | Contact phone number |
| Street Address | Delivery address |
| City | Delivery city |
| State | State/Province |
| ZIP Code | Postal code |
| Country | Default: USA |

1. **HazMat Information** (auto-populated from sample):
    - UN Number
    - Hazard Class
    - Packing Group
    - Proper Shipping Name
    - Emergency Contact Phone (required for HazMat)

2. **Shipping Options:**
    - **Is International** - Check for international shipments
    - **Notes** - Special instructions

3. Click **Create Shipment**

### 5.4 Required Supplies Indicator

When creating a shipment, the system automatically calculates required packaging:

- **< 30g:** 4GV/X 2.9/S/23 box
- **30-100g:** 4GV/X 4.0/S/25 box
- **> 100g:** 4GV/X 10/S/25 box

### 5.5 Shipping Supplies Tab

Click the **Shipping Supplies** tab to access the full shipping supplies management interface:

- View all shipping supplies and current stock levels
- See reorder warnings (yellow = low, red = reorder needed)
- Add new supply items
- Edit existing supply details
- Restock supplies as needed
- Track supply usage history

---

## 6. Processing Dashboard

### 6.1 Accessing the Processing Dashboard

From Shipment Logistics, click **Processing Dashboard** or navigate to a pending shipment.

### 6.2 Dashboard Overview

The Processing Dashboard shows:

- **Pending Requests** - Total shipments awaiting processing
- **HazMat Shipments** - Shipments requiring DG declaration
- **Due Soon** - Shipments due within 2 days

### 6.3 Processing a Shipment

1. Click **Process** next to a pending shipment
2. The **Processing View** opens with full shipment details

### 6.4 Processing View Workflow

#### Step 1: Review Shipment Details

- Manufacturer information
- Sample details (chemical, lot number, quantity)
- Recipient address
- HazMat classification (if applicable)

#### Step 2: Print SDS Documents

- If SDS is available, a prompt appears to print
- Click **Print SDS** to open documents in new tabs
- Print each document for inclusion in the shipment

#### Step 3: Validate Address

1. Review/edit the destination address
2. Click **Validate Address**
3. FedEx verifies the address and returns corrections if needed
4. Accept the validated address

#### Step 4: Get Rate Quote

1. Enter package weight (in LB or KG)
2. Select service type:
    - Ground Home Delivery
    - FedEx Ground
    - Express Saver
    - Priority Overnight
3. Enter package value (for insurance)
4. Click **Get Rate Quote**
5. Review the quoted shipping cost

#### Step 5: Generate Shipping Label

1. Review all information
2. Click **Generate FedEx Label**
3. The system:
    - Creates the shipment with FedEx
    - Generates the shipping label
    - Updates tracking number
    - Deducts supplies from inventory

#### Step 6: Print Shipping Label

- Click **Print Label** when prompted
- The PDF opens in a new tab for printing

#### Step 7: Print HazMat Labels (if applicable)

- For HazMat shipments, you'll be prompted to print:
  - DOT hazard class diamond labels
  - UN number labels
- Click **Print HazMat Labels** to generate printable labels

#### Step 8: Record Supplies Used

- Select which supplies were used for this shipment
- Enter quantities
- Click **Record Supplies**
- Inventory is automatically updated

### 6.5 HazMat Shipment Indicators

HazMat shipments display:

- **HAZMAT** badge in red
- Hazard class symbol and name
- UN Number
- Packing Group
- Required emergency contact

---

## 7. Supply Inventory

### 7.1 Viewing Supplies

Access from Shipment Logistics → **Shipping Supplies** tab

### 7.2 Adding a New Supply

1. Click **+ Add New Supply** button (located below the "Shipping Supplies Inventory" table header)
2. Fill in the required fields:

| Field | Description | Required |
| --- | --- | --- |
| Supply Name | Name of the supply item | Yes |
| Category | Type of supply (e.g., Boxes, Labels) | Yes |
| Current Stock | Initial quantity in stock | Yes |
| Reorder Level | Stock level that triggers reorder warning | Yes |
| Unit | Unit of measurement (e.g., each, roll) | No |
| Notes | Additional information | No |

1. Click **Save Supply**

### 7.3 Supply Categories

The system tracks:

- **4GV Boxes** (various sizes)
- **Absorbent Materials**
- **Vermiculite**
- **Labels and Tape**
- **Shipping Pouches**

### 7.4 Stock Status Indicators

| Color | Status | Action |
| --- | --- | --- |
| 🟢 Green | In Stock | None needed |
| 🟡 Yellow | Low Stock | Plan reorder |
| 🔴 Red | Reorder Needed | Order immediately |

### 7.5 Restocking Supplies

1. Click **Restock** next to a supply item
2. Enter the quantity to add
3. Click **Confirm**
4. Stock level is updated

---

## 8. Support System

### 8.1 Accessing Support

Click **Contact Support** in the top-right corner of any page.

### 8.2 Support Types

#### Technical Support (<jhunzie@ajwalabs.com>)

- Portal access issues
- Login problems
- Software bugs
- Network issues

#### Lab Support (<eboak@ajwalabs.com>)

- Sample preparation questions
- Testing procedures
- Lab documentation
- CoA/SDS inquiries

### 8.3 Submitting a Request

1. Select support type (Technical or Lab)
2. Enter a descriptive subject
3. Provide detailed message (minimum 10 characters)
4. Click **Submit Request**
5. Confirmation email is sent to you and the support team

---

## 9. Troubleshooting

### Common Issues

#### Cannot Login

- Verify email is spelled correctly
- Check for CAPS LOCK
- After 5 failed attempts, wait 15 minutes
- Contact admin for password reset

#### Session Expired

- Sessions expire after inactivity
- Log in again to continue

#### Document Won't Download

- Check popup blocker settings
- Try right-click → "Open in new tab"
- Clear browser cache

#### Shipment Label Not Generating

- Verify address is validated first
- Check all required fields are filled
- Ensure weight is entered
- Try a different service type

#### FedEx Rate Quote Error

- Validate the destination address
- Check ZIP code matches city/state
- Verify package weight is reasonable

### Browser Requirements

For best experience, use:

- Google Chrome (recommended)
- Microsoft Edge
- Mozilla Firefox
- Safari (Mac)

### Getting Help

1. Check this manual first
2. Use the in-app **Contact Support** feature
3. Email: <jhunzie@ajwalabs.com> (Technical) or <eboak@ajwalabs.com> (Lab)

---

**© 2026 Ajwa Labs - T-Link Sample Management System**  
*Developed by AAL Digital Development*
