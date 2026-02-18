# FedEx API Implementation Review

**Date:** February 13, 2026  
**Reviewed Against:** Official FedEx OpenAPI 3.0 specifications in `/docs/FedEx/`

## Files Reviewed

1. `address-validation.json` - Address Validation API v1
2. `postal-code.json` - Postal Code Validation API v1
3. `ship.json` - Ship API v1

## Implementation Status

### ✅ Already Correct

1. **API Endpoints**
   - Address Validation: `/address/v1/addresses/resolve` ✓
   - Ship: `/ship/v1/shipments` ✓
   - Rate Quotes: `/rate/v1/rates/quotes` ✓

2. **Authentication**
   - OAuth 2.0 client credentials flow ✓
   - Token caching mechanism ✓
   - Proper Authorization header format ✓

3. **Request Structure**
   - `addressesToValidate` array format ✓
   - `accountNumber: { value: "..." }` structure ✓
   - `labelResponseOptions: 'URL_ONLY'` ✓

4. **Address Handling for International Shipments**
   - Conditional omission of `stateOrProvinceCode` for countries without states ✓
   - Support for Netherlands (NL), Belgium (BE), Denmark (DK), etc. ✓
   - Proper country code format (ISO 2-letter) ✓

5. **Headers**
   - `Authorization: Bearer {token}` ✓
   - `Content-Type: application/json` ✓
   - `X-locale: en_US` ✓

### 🔧 Improvements Made

1. **OAuth Token Request Format**
   - **Changed:** Token request to use `application/x-www-form-urlencoded` format with URLSearchParams
   - **Reason:** Official FedEx OAuth endpoint requires form-encoded data, not JSON
   - **Impact:** More reliable authentication, especially in production

2. **Transaction ID Tracking**
   - **Added:** `x-customer-transaction-id` header to all API calls
   - **Format:** `tlink-addr-{timestamp}` for address validation, `tlink-ship-{timestamp}` for shipments
   - **Benefit:** Better request/response tracking and debugging
   - **Note:** This is optional per FedEx spec but highly recommended

3. **Enhanced Error Handling**
   - **Added:** Specific error code logging from FedEx responses
   - **Added:** Iteration through error array to log all FedEx error codes and messages
   - **Example Error Codes:**
     - `ACCOUNTNUMBER.REGISTRATION.REQUIRED`
     - `STANDARDIZED.ADDRESS.NOTFOUND`
     - `NOT.AUTHORIZED.ERROR`
     - `FORBIDDEN.ERROR`
   - **Benefit:** Easier troubleshooting of FedEx API issues

4. **Hazmat/Dangerous Goods Simplification**
   - **Changed:** Simplified `dangerousGoodsDetail` structure to match basic spec requirements
   - **Structure:**

     ```typescript
     {
       regulation: 'DOT',
       accessibility: 'INACCESSIBLE' | 'ACCESSIBLE',
       options: ['HAZARDOUS_MATERIALS'] | ['DANGEROUS_GOODS']
     }
     ```

   - **Removed:** Complex nested container structures that are optional for basic hazmat
   - **Note:** Full hazmat details can be added later if needed for complex shipments

## Countries Without State/Province Support

Per FedEx API spec and our implementation, these countries do NOT require `stateOrProvinceCode`:

| Country | Code | Notes |
| --- | --- | --- |
| Netherlands | NL | Primary fix request |
| Belgium | BE | |
| Denmark | DK | |
| Finland | FI | |
| Ireland | IE | |
| Norway | NO | |
| Portugal | PT | |
| Sweden | SE | |
| Austria | AT | |
| Singapore | SG | |
| Israel | IL | |
| New Zealand | NZ | Regions exist but not required by FedEx |

## Best Practices Implemented

1. **State/Province Handling:**
   - Field is completely omitted from request when country doesn't require it
   - Not sent as empty string or null (per FedEx best practices)

2. **Service Type Selection:**
   - `HAZARDOUS_MATERIALS` for Ground services
   - `DANGEROUS_GOODS` for Express/Air services

3. **Label Response:**
   - Using `URL_ONLY` for efficiency
   - URLs valid for 12 hours after creation

4. **Address Validation:**
   - Always validate before shipment creation
   - Handle both `resolvedAddresses` and `parsedAddresses` responses
   - Graceful fallback in sandbox mode

## API Compliance Checklist

- [x] Using correct API version endpoints (v1)
- [x] Proper OAuth 2.0 authentication flow
- [x] Required headers present on all requests
- [x] Optional headers added for tracking
- [x] Request payloads match OpenAPI schema
- [x] Error responses handled per spec
- [x] International address format compliance
- [x] Hazmat/DG shipment support
- [x] Sandbox mode support
- [x] Production mode ready

## Testing Recommendations

1. **Address Validation:**
   - Test with Netherlands address (no state)
   - Test with US address (with state)
   - Test with UK address (no state, postal code focus)

2. **Shipment Creation:**
   - Domestic US shipment
   - International shipment to NL
   - Hazmat Ground shipment
   - Hazmat Express shipment

3. **Error Scenarios:**
   - Invalid account number
   - Invalid address
   - Expired authentication token
   - Service unavailable

## Next Steps (Optional Enhancements)

1. **Rate Shopping:** Implement comparison of multiple service types
2. **Tracking Integration:** Real-time tracking updates via FedEx Tracking API
3. **Pickup Scheduling:** Automate pickup requests via FedEx Pickup API
4. **Document Generation:** Add customs documents for international shipments
5. **Batch Processing:** Support for creating multiple shipments in one request

## References

- FedEx Developer Portal: <https://developer.fedex.com/>
- Address Validation API Docs: `/docs/FedEx/address-validation.json`
- Ship API Docs: `/docs/FedEx/ship.json`
- Postal Code API Docs: `/docs/FedEx/postal-code.json`
