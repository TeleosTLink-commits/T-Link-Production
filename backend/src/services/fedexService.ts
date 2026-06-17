import axios from 'axios';
import { Pool } from 'pg';

// FedEx API configuration
const FEDEX_API_BASE_URL = process.env.FEDEX_API_BASE_URL || 'https://apis.fedex.com';
const FEDEX_API_KEY = process.env.FEDEX_API_KEY;
const FEDEX_SECRET_KEY = process.env.FEDEX_SECRET_KEY;
const FEDEX_ACCOUNT_NUMBER = process.env.FEDEX_ACCOUNT_NUMBER;

interface AddressValidationInput {
  street: string;
  city: string;
  stateOrProvinceCode?: string;
  postalCode: string;
  countryCode?: string;
}

// Countries that don't require state/province codes
const COUNTRIES_WITHOUT_STATES = [
  'NL', // Netherlands
  'BE', // Belgium
  'DK', // Denmark
  'FI', // Finland
  'IE', // Ireland
  'NO', // Norway
  'PT', // Portugal
  'SE', // Sweden
  'AT', // Austria
  'SG', // Singapore
  'IL', // Israel
  'NZ', // New Zealand (uses regions but not required)
];

/**
 * Helper function to determine if a country requires state/province
 */
function requiresState(countryCode?: string): boolean {
  if (!countryCode) return true;
  return !COUNTRIES_WITHOUT_STATES.includes(countryCode.toUpperCase());
}

/**
 * Normalize a hazmat quantity + unit into FedEx-accepted hazmat unit codes.
 * FedEx valid codes: G (Gallons), L (Liters), ML (Milliliters), KG (Kilograms),
 * LB (Pounds), OZ (Ounces). Note: FedEx does NOT accept grams directly, so
 * grams are converted to kilograms.
 */
function normalizeHazmatUnits(
  amount: number | undefined,
  units: string | undefined
): { amount: number; units: string } {
  const safeAmount = typeof amount === 'number' && amount > 0 ? amount : 1;
  const u = (units || 'KG').trim().toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams') return { amount: safeAmount / 1000, units: 'KG' };
  if (u === 'ml' || u === 'milliliter' || u === 'milliliters') return { amount: safeAmount, units: 'ML' };
  if (u === 'l' || u === 'liter' || u === 'liters') return { amount: safeAmount, units: 'L' };
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return { amount: safeAmount, units: 'KG' };
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') return { amount: safeAmount, units: 'LB' };
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return { amount: safeAmount, units: 'OZ' };
  if (u === 'gal' || u === 'gallon' || u === 'gallons') return { amount: safeAmount, units: 'G' };
  return { amount: safeAmount, units: 'KG' };
}

/**
 * Split a street address into lines of max 35 characters (FedEx limit).
 * FedEx allows up to 2 street lines of 35 chars each.
 */
function splitStreetLines(street: string): string[] {
  if (!street) return [''];
  const trimmed = street.trim();
  if (trimmed.length <= 35) return [trimmed];
  
  // Try to split at a natural break point (space, comma) near the 35-char mark
  let splitIndex = trimmed.lastIndexOf(' ', 35);
  if (splitIndex <= 0) splitIndex = trimmed.lastIndexOf(',', 35);
  if (splitIndex <= 0) splitIndex = 35; // Hard split if no natural break
  
  const line1 = trimmed.substring(0, splitIndex).trim();
  const line2 = trimmed.substring(splitIndex).trim().substring(0, 35); // Cap line 2 at 35 too
  return line2 ? [line1, line2] : [line1];
}

interface AddressValidationResult {
  valid: boolean;
  correctedAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  error?: string;
  warning?: string;
}

interface HazmatDetails {
  unNumber: string;
  properShippingName: string;
  hazardClass: string;
  packingGroup?: string;
  technicalName?: string;
  emergencyContact?: string;
  quantity?: number;
  quantityUnits?: string;
}

interface CommodityItem {
  description: string;
  countryOfManufacture?: string;
  quantity?: number;
  quantityUnits?: string;
  unitPrice?: number;
  weight?: number;
  weightUnit?: 'LB' | 'KG';
  harmonizedCode?: string;
  numberOfPieces?: number;
}

interface CustomsInfo {
  termsOfSale?: 'FOB' | 'CFR_OR_CPT' | 'CIF_OR_CIP' | 'EXW' | 'DDP';
  purpose?: 'SAMPLE' | 'GIFT' | 'NOT_SOLD' | 'SOLD' | 'PERSONAL_EFFECTS' | 'REPAIR_AND_RETURN' | 'PERSONAL_USE';
  dutiesPaymentType?: 'SENDER' | 'RECIPIENT' | 'THIRD_PARTY';
  totalCustomsValue?: number;
  currency?: string;
}

interface ContactInfo {
  personName?: string;
  phoneNumber?: string;
  companyName?: string;
}

interface ShipmentLabelRequest {
  fromAddress: AddressValidationInput;
  toAddress: AddressValidationInput;
  recipientContact?: ContactInfo;
  weight: number;
  weightUnit: 'LB' | 'KG';
  service: 'GROUND_HOME_DELIVERY' | 'FEDEX_GROUND' | 'OVERNIGHT_EXPRESS' | 'EXPRESS_SAVER' | 'FEDEX_EXPRESS_SAVER' | 'PRIORITY_OVERNIGHT' | 'STANDARD_OVERNIGHT' | 'INTERNATIONAL_PRIORITY' | 'INTERNATIONAL_ECONOMY' | 'INTERNATIONAL_FIRST' | 'INTERNATIONAL_GROUND';
  packageValue: number;
  isHazmat?: boolean;
  hazmatDetails?: HazmatDetails;
  commodities?: CommodityItem[];
  customs?: CustomsInfo;
}

interface ShipmentLabelResult {
  trackingNumber: string;
  label: string; // Base64 encoded PDF
  commercialInvoice?: string; // Base64 encoded PDF (international shipments only)
  cost: number;
  estimatedDelivery: string;
  error?: string;
}

interface TrackingUpdate {
  trackingNumber: string;
  status: 'processing' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';
  location: string;
  timestamp: string;
  estimatedDelivery?: string;
}

class FedExService {
  private authToken: string | null = null;
  private tokenExpiresAt: number = 0;

  /**
   * Get FedEx OAuth token for API authentication
   */
  private async getAuthToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.authToken && Date.now() < this.tokenExpiresAt) {
      return this.authToken;
    }

    try {
      const response = await axios.post(
        `${FEDEX_API_BASE_URL}/oauth/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: FEDEX_API_KEY || '',
          client_secret: FEDEX_SECRET_KEY || '',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.authToken = response.data.access_token;
      // Set expiration to 1 hour from now (token typically valid for 1 hour)
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

      if (!this.authToken) {
        throw new Error('FedEx authentication failed: no token received');
      }
      return this.authToken;
    } catch (error: any) {
      throw new Error(`FedEx authentication failed: ${error.message}`);
    }
  }

  /**
   * Validate a delivery address using FedEx Address Validation API
   */
  async validateAddress(address: AddressValidationInput): Promise<AddressValidationResult> {
    // If FedEx credentials are not configured, return mock validation
    if (!FEDEX_API_KEY || !FEDEX_SECRET_KEY) {
      console.warn('FedEx API credentials not configured. Using mock validation.');
      return {
        valid: true,
        correctedAddress: {
          street: address.street,
          city: address.city,
          state: address.stateOrProvinceCode || '',
          zip: address.postalCode,
          country: address.countryCode || 'US',
        },
      };
    }

    try {
      const token = await this.getAuthToken();
      console.log('FedEx auth token obtained, calling address validation API...');

      // Build address object, conditionally including stateOrProvinceCode
      const addressPayload: any = {
        streetLines: [address.street],
        city: address.city,
        postalCode: address.postalCode,
        countryCode: address.countryCode || 'US',
      };

      // Only include state if country requires it or if provided
      if (address.stateOrProvinceCode && requiresState(address.countryCode)) {
        addressPayload.stateOrProvinceCode = address.stateOrProvinceCode;
      }

      const response = await axios.post(
        `${FEDEX_API_BASE_URL}/address/v1/addresses/resolve`,
        {
          addressesToValidate: [
            {
              address: addressPayload,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
            'x-customer-transaction-id': `tlink-addr-${Date.now()}`,
          },
        }
      );

      // Debug logging - only log non-sensitive data in production
      if (process.env.NODE_ENV !== 'production') {
        console.log('FedEx address validation response:', JSON.stringify(response.data, null, 2));
      }

      if (response.data.output?.resolvedAddresses && response.data.output.resolvedAddresses.length > 0) {
        const resolved = response.data.output.resolvedAddresses[0];

        return {
          valid: true,
          correctedAddress: {
            street: resolved.streetLinesToken?.[0] || address.street,
            city: resolved.city || address.city,
            state: resolved.stateOrProvinceCode || address.stateOrProvinceCode || '',
            zip: resolved.postalCode || address.postalCode,
            country: resolved.countryCode || 'US',
          },
        };
      }

      // Check for parsed address even if not fully resolved
      if (response.data.output?.parsedAddresses && response.data.output.parsedAddresses.length > 0) {
        console.log('Address parsed but not fully resolved, treating as valid');
        return {
          valid: true,
          correctedAddress: {
            street: address.street,
            city: address.city,
            state: address.stateOrProvinceCode || '',
            zip: address.postalCode,
            country: address.countryCode || 'US',
          },
        };
      }

      return {
        valid: true,
        correctedAddress: {
          street: address.street,
          city: address.city,
          state: address.stateOrProvinceCode || '',
          zip: address.postalCode,
          country: address.countryCode || 'US',
        },
      };
    } catch (error: any) {
      console.error('FedEx address validation error:', error.response?.data || error.message);
      // In sandbox mode, if the API fails, still allow processing with a warning
      if (FEDEX_API_BASE_URL?.includes('sandbox')) {
        console.warn('FedEx sandbox API error - returning valid with warning');
        return {
          valid: true,
          correctedAddress: {
            street: address.street,
            city: address.city,
            state: address.stateOrProvinceCode || '',
            zip: address.postalCode,
            country: address.countryCode || 'US',
          },
          warning: 'Address validation skipped (sandbox mode)',
        };
      }
      return {
        valid: false,
        error: error.response?.data?.errors?.[0]?.message || error.message || 'Address validation failed',
      };
    }
  }

  /**
   * Generate shipment label and get shipping cost
   */
  async generateShipmentLabel(request: ShipmentLabelRequest): Promise<ShipmentLabelResult> {
    // If FedEx credentials are not configured, return mock label
    if (!FEDEX_API_KEY || !FEDEX_SECRET_KEY) {
      console.warn('FedEx API credentials not configured. Using mock label.');
      const mockTrackingNumber = `MOCK${Date.now().toString().slice(-10)}`;
      const isInternational = request.service.startsWith('INTERNATIONAL');
      const isOvernight = request.service.includes('OVERNIGHT') || request.service === 'INTERNATIONAL_FIRST';
      const mockCost = request.weight * (isOvernight ? 45 : isInternational ? 35 : 12);
      const mockDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      
      return {
        trackingNumber: mockTrackingNumber,
        label: 'MOCK_LABEL_BASE64', // In production, this would be actual PDF data
        cost: mockCost,
        estimatedDelivery: mockDelivery,
      };
    }

    try {
      const token = await this.getAuthToken();

      // Build hazmat special services if applicable
      let packageSpecialServices: any = undefined;
      if (request.isHazmat && request.hazmatDetails) {
        const isGround = request.service.includes('GROUND');
        const h = request.hazmatDetails;

        // Normalize quantity units to FedEx-accepted hazmat unit codes.
        // Note: FedEx uses 'G' for Gallons (not grams). Grams are converted to KG.
        const { amount: hazAmount, units: hazUnits } = normalizeHazmatUnits(h.quantity, h.quantityUnits);

        // Normalize UN/NA identifier (FedEx expects e.g. "UN1263")
        let normalizedId: string | undefined;
        if (h.unNumber) {
          const raw = String(h.unNumber).trim().toUpperCase().replace(/\s+/g, '');
          normalizedId = raw.startsWith('UN') || raw.startsWith('NA') ? raw : `UN${raw}`;
        }

        const description: any = {
          sequenceNumber: 1,
          properShippingName: h.properShippingName,
          hazardClass: String(h.hazardClass || ''),
        };
        if (normalizedId) description.id = normalizedId;
        if (h.packingGroup) description.packingGroup = String(h.packingGroup).toUpperCase();
        if (h.technicalName) description.technicalName = h.technicalName;

        const commodity = {
          description,
          quantity: { amount: hazAmount, units: hazUnits, quantityType: 'NET' },
          innerReceptacles: [
            { quantity: { amount: hazAmount, units: hazUnits, quantityType: 'NET' } },
          ],
          options: { labelTextType: 'STANDARD' },
        };

        if (isGround) {
          // Domestic ground: 49 CFR / DOT regulation, HAZARDOUS_MATERIALS service
          packageSpecialServices = {
            specialServiceTypes: ['HAZARDOUS_MATERIALS'],
            hazardousCommoditiesDetail: {
              regulation: 'DOT',
              hazardousCommodities: [commodity],
            },
          };
        } else {
          // Express / air: IATA regulation, DANGEROUS_GOODS service.
          // Note: accessibility is REQUIRED. Do not pass an options array
          // unless you are explicitly declaring battery / ORM-D / etc.
          packageSpecialServices = {
            specialServiceTypes: ['DANGEROUS_GOODS'],
            dangerousGoodsDetail: {
              regulation: 'IATA',
              accessibility: 'INACCESSIBLE',
              hazardousCommodities: [commodity],
            },
          };
        }
      } else if (request.isHazmat) {
        // Flagged hazmat without commodity details — minimal payload.
        // FedEx will likely reject this without commodity info; surface upstream.
        const isGround = request.service.includes('GROUND');
        packageSpecialServices = {
          specialServiceTypes: [isGround ? 'HAZARDOUS_MATERIALS' : 'DANGEROUS_GOODS'],
        };
      }

      // Create shipment request
      const shipmentPayload: any = {
        labelResponseOptions: 'LABEL',
        requestedShipment: {
          shipper: {
            contact: {
              personName: process.env.LAB_CONTACT_NAME || 'AJWA Analytical Laboratories',
              phoneNumber: process.env.LAB_PHONE || '4088425000',
              companyName: process.env.LAB_COMPANY_NAME || 'AJWA Analytical Laboratories',
            },
            address: (() => {
              const addr: any = {
                streetLines: splitStreetLines(request.fromAddress.street),
                city: request.fromAddress.city,
                postalCode: request.fromAddress.postalCode,
                countryCode: request.fromAddress.countryCode || 'US',
              };
              // Only include state if country requires it or if provided
              if (request.fromAddress.stateOrProvinceCode && requiresState(request.fromAddress.countryCode)) {
                addr.stateOrProvinceCode = request.fromAddress.stateOrProvinceCode;
              }
              return addr;
            })(),
          },
          recipients: [
            {
              contact: {
                personName: request.recipientContact?.personName || 'Recipient',
                phoneNumber: request.recipientContact?.phoneNumber || '0000000000',
                ...(request.recipientContact?.companyName ? { companyName: request.recipientContact.companyName } : {}),
              },
              address: (() => {
                const addr: any = {
                  streetLines: splitStreetLines(request.toAddress.street),
                  city: request.toAddress.city,
                  postalCode: request.toAddress.postalCode,
                  countryCode: request.toAddress.countryCode || 'US',
                };
                // Only include state if country requires it or if provided
                if (request.toAddress.stateOrProvinceCode && requiresState(request.toAddress.countryCode)) {
                  addr.stateOrProvinceCode = request.toAddress.stateOrProvinceCode;
                }
                return addr;
              })(),
            },
          ],
          shipDatestamp: new Date().toISOString().split('T')[0],
          serviceType: request.service,
          packagingType: 'YOUR_PACKAGING',
          pickupType: 'USE_SCHEDULED_PICKUP',
          shippingChargesPayment: {
            paymentType: 'SENDER',
          },
          labelSpecification: {
            labelFormatType: 'COMMON2D',
            imageType: 'PDF',
            labelStockType: 'PAPER_4X6',
            resolution: 600,
          },
          requestedPackageLineItems: [
            {
              weight: {
                units: request.weightUnit,
                value: request.weight,
              },
              declaredValue: {
                amount: request.packageValue,
                currency: 'USD',
              },
              packageSpecialServices,
            },
          ],
        },
        accountNumber: {
          value: FEDEX_ACCOUNT_NUMBER,
        },
      };

      // Add shipping documents specification for hazmat (OP-900 form for Ground)
      if (request.isHazmat && request.hazmatDetails) {
        shipmentPayload.requestedShipment.shippingDocumentSpecification = {
          shippingDocumentTypes: ['LABEL'],
          // For production, you would add: 'DANGEROUS_GOODS_SHIPPERS_DECLARATION', 'OP_900'
        };
      }

      // International shipments: build customsClearanceDetail and request a
      // commercial invoice PDF document. FedEx requires this for any non-domestic
      // shipment (toCountry !== shipperCountry, or service starts with INTERNATIONAL).
      const isInternationalShipment =
        request.service.startsWith('INTERNATIONAL') ||
        (request.toAddress.countryCode &&
          request.fromAddress.countryCode &&
          request.toAddress.countryCode.toUpperCase() !== request.fromAddress.countryCode.toUpperCase()) ||
        (request.toAddress.countryCode && request.toAddress.countryCode.toUpperCase() !== 'US');

      if (isInternationalShipment) {
        const currency = request.customs?.currency || 'USD';
        const purpose = request.customs?.purpose || 'SAMPLE';
        const termsOfSale = request.customs?.termsOfSale || 'FOB';

        const inputCommodities = request.commodities && request.commodities.length > 0
          ? request.commodities
          : [{
              description: 'Cosmetic raw material sample (not for resale)',
              countryOfManufacture: 'US',
              quantity: 1,
              quantityUnits: 'EA',
              unitPrice: request.packageValue || 1,
              weight: request.weight,
              weightUnit: request.weightUnit,
              numberOfPieces: 1,
            }];

        const commodities = inputCommodities.map((c) => {
          const qty = c.quantity ?? 1;
          const unitPrice = c.unitPrice ?? 1;
          const lineCustomsValue = +(unitPrice * qty).toFixed(2);
          const item: any = {
            description: c.description,
            countryOfManufacture: c.countryOfManufacture || 'US',
            quantity: qty,
            quantityUnits: c.quantityUnits || 'EA',
            unitPrice: { amount: unitPrice, currency },
            customsValue: { amount: lineCustomsValue, currency },
            numberOfPieces: c.numberOfPieces ?? 1,
          };
          if (typeof c.weight === 'number' && c.weight > 0) {
            item.weight = { units: c.weightUnit || request.weightUnit, value: c.weight };
          }
          if (c.harmonizedCode) item.harmonizedCode = c.harmonizedCode;
          return item;
        });

        const totalCustomsValue =
          request.customs?.totalCustomsValue ??
          commodities.reduce((acc: number, c: any) => acc + (c.customsValue?.amount || 0), 0);

        shipmentPayload.requestedShipment.customsClearanceDetail = {
          dutiesPayment: { paymentType: request.customs?.dutiesPaymentType || 'SENDER' },
          commercialInvoice: { termsOfSale, purpose },
          commodities,
          totalCustomsValue: { amount: +totalCustomsValue.toFixed(2), currency },
        };

        // Merge / set shippingDocumentSpecification to also request commercial invoice
        const existingDocSpec =
          shipmentPayload.requestedShipment.shippingDocumentSpecification || {};
        const existingTypes: string[] = existingDocSpec.shippingDocumentTypes || [];
        const mergedTypes = Array.from(new Set([...existingTypes, 'COMMERCIAL_INVOICE']));
        shipmentPayload.requestedShipment.shippingDocumentSpecification = {
          ...existingDocSpec,
          shippingDocumentTypes: mergedTypes,
          commercialInvoiceDetail: {
            documentFormat: {
              stockType: 'PAPER_LETTER',
              docType: 'PDF',
            },
          },
        };
      }

      // Log request details for debugging (no sensitive data)
      console.log('[FedEx Label] Request details:', {
        service: request.service,
        isHazmat: request.isHazmat || false,
        weight: request.weight,
        weightUnit: request.weightUnit,
        fromCity: request.fromAddress.city,
        fromState: request.fromAddress.stateOrProvinceCode,
        fromZip: request.fromAddress.postalCode,
        fromCountry: request.fromAddress.countryCode || 'US',
        toCity: request.toAddress.city,
        toState: request.toAddress.stateOrProvinceCode,
        toZip: request.toAddress.postalCode,
        toCountry: request.toAddress.countryCode || 'US',
      });

      const response = await axios.post(
        `${FEDEX_API_BASE_URL}/ship/v1/shipments`,
        shipmentPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
            'x-customer-transaction-id': `tlink-ship-${Date.now()}`,
          },
        }
      );

      if (response.data.output && response.data.output.transactionShipments?.[0]) {
        const shipment = response.data.output.transactionShipments[0];
        const trackingNumber = shipment.masterTrackingNumber || shipment.trackingNumber;

        // Extract cost from rates
        let cost = 0;
        if (shipment.shipmentRating?.shipmentRateDetails?.[0]?.totalNetCharge) {
          cost = shipment.shipmentRating.shipmentRateDetails[0].totalNetCharge;
        }

        // Calculate estimated delivery (typically 1-5 business days depending on service)
        const estimatedDelivery = this.calculateEstimatedDelivery(request.service);

        // FedEx returns label data in pieceResponses[].packageDocuments[].encodedLabel
        // when labelResponseOptions === 'LABEL'. Fall back to other common field names
        // for resilience across API versions.
        const piece = shipment.pieceResponses?.[0];
        const labelData =
          piece?.packageDocuments?.[0]?.encodedLabel ||
          piece?.packageDocuments?.[0]?.url ||
          piece?.labelDownloadUrl ||
          '';

        // Commercial invoice (international shipments) is returned in
        // shipmentDocuments[] alongside the label. Each document has a
        // contentType such as 'COMMERCIAL_INVOICE' and an encodedLabel field.
        let commercialInvoice = '';
        const docs: any[] = shipment.shipmentDocuments || [];
        for (const doc of docs) {
          const t = (doc.contentType || doc.type || '').toString().toUpperCase();
          if (t.includes('COMMERCIAL_INVOICE')) {
            commercialInvoice = doc.encodedLabel || doc.url || '';
            break;
          }
        }

        return {
          trackingNumber,
          label: labelData,
          commercialInvoice: commercialInvoice || undefined,
          cost,
          estimatedDelivery,
        };
      }

      return {
        trackingNumber: '',
        label: '',
        cost: 0,
        estimatedDelivery: '',
        error: 'Failed to generate shipping label',
      };
    } catch (error: any) {
      console.error('[FedEx Label] API error details:', JSON.stringify(error.response?.data || error.message, null, 2));
      console.error('[FedEx Label] HTTP status:', error.response?.status);
      
      // Log specific FedEx error codes for debugging
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach((err: any) => {
          console.error(`[FedEx Label] Error: code=${err.code}, message=${err.message}, parameterList=${JSON.stringify(err.parameterList)}`);
        });
      }
      
      // Fall back to mock label data when FedEx API fails
      // This ensures shipments can still be processed while FedEx integration is being resolved
      // SAFETY: This silent fallback masks real credential/account issues. Only enable it
      // when FEDEX_ALLOW_MOCK_FALLBACK=true is explicitly set. By default, surface the
      // real FedEx error so the user can fix it (e.g. update credentials in Render).
      if (process.env.FEDEX_ALLOW_MOCK_FALLBACK !== 'true') {
        const apiError =
          error.response?.data?.errors?.[0]?.message ||
          error.response?.data?.errors?.[0]?.code ||
          error.message ||
          'Unknown FedEx API error';
        return {
          trackingNumber: '',
          label: '',
          cost: 0,
          estimatedDelivery: '',
          error: `FedEx API error: ${apiError}`,
        };
      }

      console.warn('FedEx API error - falling back to mock label data for shipment processing');
      const mockTrackingNumber = `TLINK${Date.now().toString().slice(-10)}`;
      const isIntl = request.service.startsWith('INTERNATIONAL');
      const isExpress = request.service.includes('OVERNIGHT') || request.service === 'INTERNATIONAL_FIRST';
      const mockCost = request.weight * (isExpress ? 45 : isIntl ? 35 : 12);
      const mockDelivery = this.calculateEstimatedDelivery(request.service);
      
      return {
        trackingNumber: mockTrackingNumber,
        label: '', // No actual label PDF in fallback mode
        cost: mockCost,
        estimatedDelivery: mockDelivery,
        error: undefined, // Don't propagate error so the shipment still processes
      };
    }
  }

  /**
   * Get tracking information for a shipment
   */
  async getTrackingInfo(trackingNumber: string): Promise<TrackingUpdate | null> {
    try {
      const token = await this.getAuthToken();

      const response = await axios.post(
        `${FEDEX_API_BASE_URL}/track/v1/trackingnumbers`,
        {
          trackingInfo: [
            {
              trackingNumberInfo: {
                trackingNumber,
              },
            },
          ],
          includeDetailedScans: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }
      );

      if (response.data.output?.completeTrackResults?.[0]?.trackResults?.[0]) {
        const tracking = response.data.output.completeTrackResults[0].trackResults[0];
        const latestStatus = tracking.scanEvents?.[0];

        const statusMap: { [key: string]: TrackingUpdate['status'] } = {
          'On FedEx vehicle for delivery': 'out_for_delivery',
          'Delivered': 'delivered',
          'In transit': 'in_transit',
          'Package information received': 'processing',
          'Exception': 'exception',
        };

        return {
          trackingNumber,
          status: statusMap[latestStatus?.eventDescription] || 'in_transit',
          location: latestStatus?.locationAddress?.city || 'Unknown',
          timestamp: latestStatus?.eventTimestamp || new Date().toISOString(),
          estimatedDelivery: tracking.dateAndTime?.find((d: any) => d.type === 'ESTIMATED_DELIVERY')?.dateTime,
        };
      }

      return null;
    } catch (error: any) {
      // Sanitize tracking number to prevent log injection
      const safeTrackingNumber = String(trackingNumber).replace(/[^a-zA-Z0-9-]/g, '');
      console.error(`FedEx tracking error for ${safeTrackingNumber}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate estimated delivery date based on service type
   */
  private calculateEstimatedDelivery(service: string): string {
    const today = new Date();
    let daysToAdd = 3; // Default for ground

    switch (service) {
      case 'OVERNIGHT_EXPRESS':
      case 'PRIORITY_OVERNIGHT':
      case 'STANDARD_OVERNIGHT':
        daysToAdd = 1;
        break;
      case 'EXPRESS_SAVER':
      case 'FEDEX_EXPRESS_SAVER':
        daysToAdd = 3;
        break;
      case 'INTERNATIONAL_FIRST':
        daysToAdd = 2;
        break;
      case 'INTERNATIONAL_PRIORITY':
        daysToAdd = 3;
        break;
      case 'INTERNATIONAL_ECONOMY':
        daysToAdd = 6;
        break;
      case 'INTERNATIONAL_GROUND':
        daysToAdd = 10;
        break;
      case 'GROUND_HOME_DELIVERY':
      case 'FEDEX_GROUND':
      default:
        daysToAdd = 5;
    }

    const deliveryDate = new Date(today);
    let businessDaysAdded = 0;

    while (businessDaysAdded < daysToAdd) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      const dayOfWeek = deliveryDate.getDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDaysAdded++;
      }
    }

    return deliveryDate.toISOString().split('T')[0];
  }

  /**
   * Get shipping rate quote without creating a shipment
   */
  async getShippingRate(request: ShipmentLabelRequest): Promise<{ rate: number; error?: string }> {
    // Note: For rate quotes, we also handle countries without states
    // If FedEx credentials are not configured, return mock rate
    if (!FEDEX_API_KEY || !FEDEX_SECRET_KEY) {
      console.warn('FedEx API credentials not configured. Using mock rate.');
      const isInternational = request.service.startsWith('INTERNATIONAL');
      const isOvernight = request.service.includes('OVERNIGHT') || request.service === 'INTERNATIONAL_FIRST';
      const mockRate = request.weight * (isOvernight ? 45 : isInternational ? 35 : 12);
      return { rate: mockRate };
    }

    try {
      const token = await this.getAuthToken();

      const response = await axios.post(
        `${FEDEX_API_BASE_URL}/rate/v1/rates/quotes`,
        {
          accountNumber: {
            value: FEDEX_ACCOUNT_NUMBER,
          },
          requestedShipment: {
            shipper: {
              address: (() => {
                const addr: any = {
                  streetLines: splitStreetLines(request.fromAddress.street),
                  city: request.fromAddress.city,
                  postalCode: request.fromAddress.postalCode,
                  countryCode: request.fromAddress.countryCode || 'US',
                };
                if (request.fromAddress.stateOrProvinceCode && requiresState(request.fromAddress.countryCode)) {
                  addr.stateOrProvinceCode = request.fromAddress.stateOrProvinceCode;
                }
                return addr;
              })(),
            },
            recipient: {
              address: (() => {
                const addr: any = {
                  streetLines: splitStreetLines(request.toAddress.street),
                  city: request.toAddress.city,
                  postalCode: request.toAddress.postalCode,
                  countryCode: request.toAddress.countryCode || 'US',
                };
                if (request.toAddress.stateOrProvinceCode && requiresState(request.toAddress.countryCode)) {
                  addr.stateOrProvinceCode = request.toAddress.stateOrProvinceCode;
                }
                return addr;
              })(),
            },
            shipDatestamp: new Date().toISOString().split('T')[0],
            serviceType: request.service,
            requestedPackageLineItems: [
              {
                weight: {
                  units: request.weightUnit,
                  value: request.weight,
                },
              },
            ],
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
          },
        }
      );

      if (response.data.output?.rateReplyDetails?.[0]?.ratedShipmentDetails?.[0]) {
        const rate = response.data.output.rateReplyDetails[0].ratedShipmentDetails[0];
        return {
          rate: rate.totalNetCharge || rate.totalBaseCharge || 0,
        };
      }

      return {
        rate: 0,
        error: 'Could not calculate rate',
      };
    } catch (error: any) {
      console.error('[FedEx Rate] API error details:', JSON.stringify(error.response?.data || error.message, null, 2));
      console.error('[FedEx Rate] HTTP status:', error.response?.status);
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach((err: any) => {
          console.error(`[FedEx Rate] Error: code=${err.code}, message=${err.message}, parameterList=${JSON.stringify(err.parameterList)}`);
        });
      }
      // Fall back to mock rate on API failure
      console.warn('[FedEx Rate] Falling back to estimated rate calculation');
      const isInternational = request.service.startsWith('INTERNATIONAL');
      const isOvernight = request.service.includes('OVERNIGHT') || request.service === 'INTERNATIONAL_FIRST';
      const fallbackRate = request.weight * (isOvernight ? 45 : isInternational ? 35 : 12);
      return {
        rate: fallbackRate,
        error: 'Using estimated rate (FedEx API unavailable)',
      };
    }
  }
}

export default new FedExService();
