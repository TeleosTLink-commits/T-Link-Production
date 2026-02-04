# FedEx API Integration Documentation

## T-Link Laboratory Information Management System

### FedEx Shipping Integration - Complete Technical Guide

**Document Version:** 1.0  
**Last Updated:** February 4, 2026  
**Status:** PRODUCTION ENABLED ✅

---

## Table of Contents

1. [Overview](#overview)
2. [FedEx Account Details](#fedex-account-details)
3. [API Configuration](#api-configuration)
4. [How FedEx APIs Work](#how-fedex-apis-work)
5. [T-Link Integration Architecture](#t-link-integration-architecture)
6. [API Endpoints in T-Link](#api-endpoints-in-t-link)
7. [User Instructions](#user-instructions)
8. [Service Types Available](#service-types-available)
9. [Hazardous Materials Shipping](#hazardous-materials-shipping)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)
12. [Maintenance & Monitoring](#maintenance--monitoring)

---

## Overview

T-Link integrates with FedEx's RESTful APIs to provide automated shipping functionality for laboratory samples. This integration enables:

- **Address Validation** - Verify recipient addresses before shipping
- **Label Generation** - Create FedEx shipping labels automatically
- **Rate Quotes** - Get shipping costs before committing
- **Package Tracking** - Monitor shipment status in real-time
- **Hazmat Shipping** - Support for dangerous goods (chemicals/samples)

### Integration Benefits

| Feature | Benefit |
| ------- | ------- |
| Automated Labels | No manual data entry into FedEx Ship Manager |
| Pre-validated Addresses | Reduces delivery failures |
| Cost Visibility | See shipping costs before shipping |
| Tracking Integration | Status updates within T-Link |
| Audit Trail | Complete shipping history in database |

---

## FedEx Account Details

### Production Account Information

| Field | Value |
| ----- | ----- |
| **Account Number** | 205144284 |
| **Company Name** | AJWA ANALYTICAL LABORATORIES |
| **Billing Address** | 8100 Arroyo Cir, Gilroy, CA 95020 |
| **Ship From Address** | 8100 Arroyo Cir, Gilroy, CA 95020 |
| **API Environment** | PRODUCTION |
| **API Base URL** | <https://apis.fedex.com> |

### API Credentials

⚠️ **SECURITY NOTE:** API credentials are stored in environment variables and should NEVER be committed to source control.

| Variable | Description |
| -------- | ----------- |
| `FEDEX_API_KEY` | OAuth Client ID for authentication |
| `FEDEX_SECRET_KEY` | OAuth Client Secret for authentication |
| `FEDEX_ACCOUNT_NUMBER` | FedEx billing account number |
| `FEDEX_API_BASE_URL` | Production API endpoint |

---

## API Configuration

### Environment Variables

The FedEx integration requires the following environment variables in your `.env` file or Render dashboard:

```bash
# FedEx API Configuration (PRODUCTION MODE)
FEDEX_API_BASE_URL=https://apis.fedex.com
FEDEX_ACCOUNT_NUMBER=205144284
FEDEX_BILL_TO_ACCOUNT=205144284
FEDEX_API_KEY=l7f29c816a106f41c58ae0d8cdbce2011c
FEDEX_SECRET_KEY=57d6e3028ba8405797999271be955d10

# Lab Shipping Address (Ship FROM address)
LAB_ADDRESS_STREET=8100 Arroyo Cir
LAB_ADDRESS_CITY=Gilroy
LAB_ADDRESS_STATE=CA
LAB_ADDRESS_ZIP=95020
LAB_ADDRESS_COUNTRY=US
```

### Render Dashboard Configuration

Environment variables must be configured in Render for production:

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select **tlink-production-backend**
3. Navigate to **Environment** tab
4. Add/Update all FedEx variables
5. Click **Save Changes** (triggers automatic redeploy)

---

## How FedEx APIs Work

### Authentication Flow

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   T-Link    │────▶│ FedEx OAuth │────▶│ Access Token│
│   Backend   │     │   Endpoint  │     │  (1 hour)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       │         ┌─────────────────────────────┘
       ▼         ▼
┌──────────────────────────────┐
│  API Calls with Bearer Token  │
│  (Ship, Rate, Track, Address) │
└──────────────────────────────┘
```

1. **OAuth Token Request**: T-Link sends `client_id` and `client_secret` to FedEx
2. **Token Response**: FedEx returns an access token valid for 1 hour
3. **Token Caching**: T-Link caches the token and reuses until expiration
4. **API Calls**: All subsequent calls include the token in `Authorization: Bearer <token>`

### API Endpoints Used

| FedEx API | Endpoint | Purpose |
| --------- | -------- | ------- |
| **OAuth** | `/oauth/token` | Get access token |
| **Address Validation** | `/address/v1/addresses/resolve` | Validate/correct addresses |
| **Ship** | `/ship/v1/shipments` | Create shipment & generate label |
| **Rate** | `/rate/v1/rates/quotes` | Get shipping cost quote |
| **Track** | `/track/v1/trackingnumbers` | Get tracking updates |

### Request/Response Flow Example

**Creating a Shipment Label:**

```text
Request → FedEx Ship API
{
  accountNumber: { value: "205144284" },
  requestedShipment: {
    shipper: { ... },
    recipients: [{ ... }],
    serviceType: "FEDEX_GROUND",
    packagingType: "YOUR_PACKAGING",
    labelSpecification: { imageType: "PDF" },
    requestedPackageLineItems: [{ weight: { value: 2, units: "LB" } }]
  }
}

Response ← FedEx Ship API
{
  output: {
    transactionShipments: [{
      masterTrackingNumber: "888482457869",
      pieceResponses: [{
        labelDownloadUrl: "https://..."
      }],
      shipmentRating: {
        totalNetCharge: 15.99
      }
    }]
  }
}
```

---

## T-Link Integration Architecture

### System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      T-Link Frontend                         │
│                    (React + TypeScript)                      │
│                    Vercel Deployment                         │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      T-Link Backend                          │
│                   (Express.js + Node.js)                     │
│                    Render Deployment                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   FedEx Routes                        │   │
│  │              /api/fedex/validate-address              │   │
│  │              /api/fedex/generate-label                │   │
│  │              /api/fedex/get-rate                      │   │
│  │              /api/fedex/tracking/:trackingNumber      │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                             │                                │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │                 FedEx Service Layer                   │   │
│  │        (Token caching, API calls, error handling)     │   │
│  └─────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FedEx REST APIs                           │
│                  https://apis.fedex.com                      │
│                                                              │
│     OAuth  •  Ship  •  Rate  •  Track  •  Address           │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
| ---- | ------- |
| `backend/src/services/fedexService.ts` | Core FedEx API integration service |
| `backend/src/routes/fedex.ts` | Express routes for FedEx endpoints |
| `backend/.env` | Environment variables (local) |

### Service Layer (`fedexService.ts`)

The FedEx service is a singleton class that handles:

1. **Token Management**: Caches OAuth tokens with automatic refresh
2. **Address Validation**: Calls FedEx Address Validation API
3. **Label Generation**: Creates shipments and returns label URLs
4. **Rate Quotes**: Gets shipping cost estimates
5. **Tracking**: Retrieves shipment tracking information
6. **Hazmat Support**: Handles dangerous goods documentation

---

## API Endpoints in T-Link

### POST `/api/fedex/validate-address`

Validates a shipping address before creating a label.

**Request Body:**

```json
{
  "street": "8100 Arroyo Cir",
  "city": "Gilroy",
  "stateOrProvinceCode": "CA",
  "postalCode": "95020",
  "countryCode": "US"
}
```

**Response:**

```json
{
  "valid": true,
  "correctedAddress": {
    "street": "8100 ARROYO CIR",
    "city": "GILROY",
    "state": "CA",
    "zip": "95020-4619",
    "country": "US"
  }
}
```

### POST `/api/fedex/generate-label`

Creates a FedEx shipment and generates a shipping label.

**Request Body:**

```json
{
  "shipmentId": 123,
  "fromAddress": {
    "street": "8100 Arroyo Cir",
    "city": "Gilroy",
    "stateOrProvinceCode": "CA",
    "postalCode": "95020",
    "countryCode": "US"
  },
  "toAddress": {
    "street": "123 Test Street",
    "city": "Memphis",
    "stateOrProvinceCode": "TN",
    "postalCode": "38118",
    "countryCode": "US"
  },
  "weight": 2,
  "weightUnit": "LB",
  "service": "FEDEX_GROUND",
  "isHazmat": false
}
```

**Response:**

```json
{
  "success": true,
  "tracking_number": "888482457869",
  "label_url": "https://www.fedex.com/label/...",
  "shipping_cost": 15.99,
  "estimated_delivery": "2026-02-10"
}
```

### POST `/api/fedex/get-rate`

Gets a shipping rate quote without creating a shipment.

**Request Body:**

```json
{
  "fromAddress": { ... },
  "toAddress": { ... },
  "weight": 2,
  "weightUnit": "LB",
  "service": "FEDEX_GROUND"
}
```

**Response:**

```json
{
  "rate": 15.99,
  "currency": "USD"
}
```

### GET `/api/fedex/tracking/:trackingNumber`

Gets tracking information for a shipment.

**Response:**

```json
{
  "trackingNumber": "888482457869",
  "status": "in_transit",
  "location": "Memphis",
  "timestamp": "2026-02-04T17:00:00Z",
  "estimatedDelivery": "2026-02-07T18:00:00Z"
}
```

---

## User Instructions

### For Lab Staff (Creating Shipments)

1. **Navigate to Shipments**: Go to the Shipments section in T-Link
2. **Create New Shipment**: Click "Create Shipment" or select pending samples
3. **Enter Recipient Address**:
   - Address will be auto-validated by FedEx
   - If invalid, you'll see correction suggestions
4. **Select Service Type**: Choose from available FedEx services
5. **Review Cost**: Shipping cost is displayed before confirmation
6. **Generate Label**: Click "Generate Label" to create shipment
7. **Print Label**: Download and print the PDF label
8. **Affix Label**: Attach label to package
9. **Schedule Pickup**: Use scheduled pickup or drop at FedEx location

### For Administrators

1. **Monitor Shipments**: View all shipments in Admin dashboard
2. **Track Packages**: Click tracking number for real-time updates
3. **View Costs**: Shipping costs are tracked per shipment
4. **Void Labels**: If needed, void unused labels in FedEx Ship Manager

### Important Notes for Users

⚠️ **Address Validation**: Always verify the corrected address suggested by FedEx

⚠️ **Weight Accuracy**: Enter accurate package weight - underestimating may result in additional charges

⚠️ **Hazmat Shipping**: For hazardous materials, ensure proper UN numbers and classification are selected

⚠️ **Business Hours**: FedEx pickup is only available during business hours (check your scheduled pickup times)

⚠️ **Label Validity**: Labels are valid for 7 days from creation date

---

## Service Types Available

| Service Code | Display Name | Typical Delivery |
| ------------ | ------------ | ---------------- |
| `FEDEX_GROUND` | FedEx Ground | 1-5 business days |
| `GROUND_HOME_DELIVERY` | FedEx Home Delivery | 1-5 business days (residential) |
| `FEDEX_EXPRESS_SAVER` | FedEx Express Saver | 3 business days |
| `FEDEX_2_DAY` | FedEx 2Day | 2 business days |
| `FEDEX_2_DAY_AM` | FedEx 2Day AM | 2 business days (morning) |
| `PRIORITY_OVERNIGHT` | FedEx Priority Overnight | Next business day AM |
| `STANDARD_OVERNIGHT` | FedEx Standard Overnight | Next business day PM |
| `FIRST_OVERNIGHT` | FedEx First Overnight | Next business day (earliest) |

### Service Selection Guidelines

| Sample Type | Recommended Service | Reason |
| ----------- | ------------------- | ------ |
| Routine Samples | FedEx Ground | Cost-effective |
| Time-Sensitive | FedEx 2Day | Balanced speed/cost |
| Urgent Testing | Priority Overnight | Fastest delivery |
| Temperature-Sensitive | Priority Overnight + Cold Pack | Minimize transit time |

---

## Hazardous Materials Shipping

T-Link supports FedEx hazmat shipping for chemical samples that require special handling.

### Required Information for Hazmat

| Field | Description | Example |
| ----- | ----------- | ------- |
| UN Number | UN identification number | UN1230 |
| Proper Shipping Name | Official name of material | Methanol |
| Hazard Class | DOT hazard classification | 3 (Flammable Liquid) |
| Packing Group | Severity level (I, II, III) | II |
| Emergency Contact | 24-hour phone number | 1-800-555-0199 |
| Quantity | Amount being shipped | 500 ML |

### Hazmat Service Restrictions

- **Ground**: Uses `HAZARDOUS_MATERIALS` service type
- **Express/Air**: Uses `DANGEROUS_GOODS` service type (IATA regulations)
- Some materials may be restricted from air transport

### Documentation Generated

- Shipping Label with hazmat markings
- OP-900 Form (for ground shipments)
- Dangerous Goods Declaration (for air shipments)

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
| ----- | ----- | -------- |
| "Authentication failed" | Invalid or expired credentials | Verify API key and secret in environment variables |
| "Account unauthorized" | Ship API not enabled | Contact FedEx Developer Support |
| "Address validation failed" | Invalid address format | Check address fields for typos |
| "Rate not available" | Service not available for route | Try a different service type |
| "Label generation failed" | Missing required fields | Verify all address and weight fields |

### Error Messages

| Error Code | Meaning | Action |
| ---------- | ------- | ------ |
| `SHIPMENT.ACCOUNTNUMBER.UNAUTHORIZED` | Account not authorized for Ship API | Contact FedEx to enable Ship API |
| `ADDRESS.VALIDATION.FAILURE` | Address cannot be validated | Verify address is correct |
| `RATE.NOT.AVAILABLE` | No rate for requested service | Select different service |
| `SERVICE.NOT.AVAILABLE` | Service unavailable for route | Use alternate service |

### Debug Mode

To enable detailed logging for troubleshooting:

```bash
# In .env file
NODE_ENV=development
```

This enables verbose API logging (⚠️ disable in production for security).

---

## Security Considerations

### Credential Protection

1. **Never commit credentials to Git** - Use `.env` files and `.gitignore`
2. **Environment variables only** - Store credentials in Render dashboard
3. **Rotate credentials periodically** - Update keys every 6-12 months
4. **Monitor usage** - Check FedEx Developer Portal for unusual activity

### Data Protection

1. **PII in logs** - Addresses are not logged in production
2. **Token caching** - Tokens stored in memory only, not persisted
3. **HTTPS only** - All API calls use encrypted connections
4. **Input sanitization** - Tracking numbers are sanitized before logging

### Access Control

1. **Authentication required** - All FedEx routes require T-Link authentication
2. **Role-based access** - Only authorized users can generate labels
3. **Audit logging** - All shipment actions are recorded

---

## Maintenance & Monitoring

### Regular Checks

| Task | Frequency | Purpose |
| ---- | --------- | ------- |
| Verify credentials | Monthly | Ensure tokens are valid |
| Check error logs | Weekly | Identify recurring issues |
| Review shipping costs | Monthly | Budget monitoring |
| Update dependencies | Quarterly | Security patches |

### FedEx API Updates

FedEx periodically updates their APIs. Monitor:

- [FedEx Developer Portal](https://developer.fedex.com) for announcements
- API version changes (currently using v1)
- Deprecated endpoint notices

### Health Monitoring

The backend exposes a health endpoint:

```text
GET https://tlink-production-backend.onrender.com/health

Response: { "status": "OK", "timestamp": "2026-02-04T17:00:00Z" }
```

### Backup Procedures

- Environment variables should be documented securely
- FedEx account recovery requires contacting FedEx support
- Keep API credentials in a secure password manager

---

## Support Contacts

### FedEx Support

| Department | Contact | Use For |
| ---------- | ------- | ------- |
| Developer Support | <websupport@fedex.com> | API issues |
| Technical Hotline | 1-877-339-2774 | Urgent API problems |
| Account Support | 1-800-463-3339 | Billing, account issues |

### T-Link Support

- **Technical Issues**: Contact system administrator
- **Shipping Questions**: Contact lab manager
- **Documentation**: See `/docs` folder in repository

---

## Appendix: API Response Codes

| HTTP Code | Meaning |
| --------- | ------- |
| 200 | Success |
| 400 | Bad request (missing/invalid data) |
| 401 | Unauthorized (invalid token) |
| 403 | Forbidden (account not authorized) |
| 404 | Not found (invalid endpoint) |
| 500 | Server error (FedEx or T-Link) |

---

*This document is maintained by the T-Link development team. For updates, contact the system administrator.*
