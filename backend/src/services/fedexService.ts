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
  stateOrProvinceCode: string;
  postalCode: string;
  countryCode?: string;
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
  emergencyContact?: string;
  quantity?: number;
  quantityUnits?: string;
}

interface ShipmentLabelRequest {
  fromAddress: AddressValidationInput;
  toAddress: AddressValidationInput;
  weight: number;
  weightUnit: 'LB' | 'KG';
  service: 'GROUND_HOME_DELIVERY' | 'FEDEX_GROUND' | 'OVERNIGHT_EXPRESS' | 'EXPRESS_SAVER' | 'FEDEX_EXPRESS_SAVER' | 'PRIORITY_OVERNIGHT';
  packageValue: number;
  isHazmat?: boolean;
  hazmatDetails?: HazmatDetails;
}

interface ShipmentLabelResult {
  trackingNumber: string;
  label: string; // Base64 encoded PDF
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
        {
          grant_type: 'client_credentials',
          client_id: FEDEX_API_KEY,
          client_secret: FEDEX_SECRET_KEY,
        },
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
          state: address.stateOrProvinceCode,
          zip: address.postalCode,
          country: address.countryCode || 'US',
        },
      };
    }

    try {
      const token = await this.getAuthToken();
      console.log('FedEx auth token obtained, calling address validation API...');

      const response = await axios.post(
        `${FEDEX_API_BASE_URL}/address/v1/addresses/resolve`,
        {
          addressesToValidate: [
            {
              address: {
                streetLines: [address.street],
                city: address.city,
                stateOrProvinceCode: address.stateOrProvinceCode,
                postalCode: address.postalCode,
                countryCode: address.countryCode || 'US',
              },
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
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
            state: resolved.stateOrProvinceCode || address.stateOrProvinceCode,
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
            state: address.stateOrProvinceCode,
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
          state: address.stateOrProvinceCode,
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
            state: address.stateOrProvinceCode,
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
      const mockCost = request.weight * (request.service === 'OVERNIGHT_EXPRESS' ? 45 : 12);
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
        // Determine the correct special service type based on service
        const isGround = request.service.includes('GROUND');
        const hazmatServiceType = isGround ? 'HAZARDOUS_MATERIALS' : 'DANGEROUS_GOODS';
        
        packageSpecialServices = {
          specialServiceTypes: [hazmatServiceType],
          dangerousGoodsDetail: {
            offeror: process.env.LAB_HAZMAT_OFFEROR || 'AJWA Labs LLC',
            emergencyContactNumber: request.hazmatDetails.emergencyContact || process.env.LAB_EMERGENCY_PHONE || '1-800-555-0199',
            regulation: 'DOT',
            accessibility: 'ACCESSIBLE',
            options: ['HAZARDOUS_MATERIALS'],
            containers: [
              {
                containerType: 'PACKAGE',
                hazardousCommodities: [
                  {
                    description: {
                      id: request.hazmatDetails.unNumber,
                      sequenceNumber: 1,
                      packingGroup: request.hazmatDetails.packingGroup || 'II',
                      properShippingName: request.hazmatDetails.properShippingName,
                      hazardClass: request.hazmatDetails.hazardClass,
                    },
                    quantity: {
                      amount: request.hazmatDetails.quantity || 1,
                      units: request.hazmatDetails.quantityUnits || 'ML',
                    },
                  },
                ],
              },
            ],
          },
        };
      } else if (request.isHazmat) {
        // Basic hazmat without details
        packageSpecialServices = {
          specialServiceTypes: ['DANGEROUS_GOODS'],
        };
      }

      // Create shipment request
      const shipmentPayload: any = {
        labelResponseOptions: 'URL_ONLY',
        requestedShipment: {
          shipper: {
            contact: {
              personName: process.env.LAB_CONTACT_NAME || 'Lab Shipping',
              phoneNumber: process.env.LAB_PHONE || '2255551234',
              companyName: process.env.LAB_COMPANY_NAME || 'AJWA Labs LLC',
            },
            address: {
              streetLines: [request.fromAddress.street],
              city: request.fromAddress.city,
              stateOrProvinceCode: request.fromAddress.stateOrProvinceCode,
              postalCode: request.fromAddress.postalCode,
              countryCode: request.fromAddress.countryCode || 'US',
            },
          },
          recipients: [
            {
              contact: {
                personName: 'Recipient',
                phoneNumber: '0000000000',
              },
              address: {
                streetLines: [request.toAddress.street],
                city: request.toAddress.city,
                stateOrProvinceCode: request.toAddress.stateOrProvinceCode,
                postalCode: request.toAddress.postalCode,
                countryCode: request.toAddress.countryCode || 'US',
              },
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

      // Log only non-sensitive metadata (no PII or full payloads)
      console.log('FedEx shipment request initiated:', {
        service: request.service,
        isHazmat: request.isHazmat || false,
        weight: request.weight,
        weightUnit: request.weightUnit
      });

      const response = await axios.post(
        `${FEDEX_API_BASE_URL}/ship/v1/shipments`,
        shipmentPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-locale': 'en_US',
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

        return {
          trackingNumber,
          label: shipment.pieceResponses?.[0]?.labelDownloadUrl || '',
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
      console.error('FedEx shipment creation error:', error.response?.data || error.message);
      
      // In sandbox mode, return mock data if the API fails
      if (FEDEX_API_BASE_URL?.includes('sandbox')) {
        console.warn('FedEx sandbox API error - returning mock label data');
        const mockTrackingNumber = `MOCK${Date.now()}`;
        const mockCost = request.service === 'GROUND_HOME_DELIVERY' ? 15.99 : 29.99;
        const mockDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        
        return {
          trackingNumber: mockTrackingNumber,
          label: 'MOCK_LABEL_BASE64',
          cost: mockCost,
          estimatedDelivery: mockDelivery,
        };
      }
      
      return {
        trackingNumber: '',
        label: '',
        cost: 0,
        estimatedDelivery: '',
        error: error.response?.data?.errors?.[0]?.message || error.message || 'Shipment label generation failed',
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
        daysToAdd = 1;
        break;
      case 'EXPRESS_SAVER':
        daysToAdd = 2;
        break;
      case 'GROUND_HOME_DELIVERY':
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
    // If FedEx credentials are not configured, return mock rate
    if (!FEDEX_API_KEY || !FEDEX_SECRET_KEY) {
      console.warn('FedEx API credentials not configured. Using mock rate.');
      const mockRate = request.weight * (request.service === 'OVERNIGHT_EXPRESS' ? 45 : 12);
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
              address: {
                streetLines: [request.fromAddress.street],
                city: request.fromAddress.city,
                stateOrProvinceCode: request.fromAddress.stateOrProvinceCode,
                postalCode: request.fromAddress.postalCode,
                countryCode: request.fromAddress.countryCode || 'US',
              },
            },
            recipients: [
              {
                address: {
                  streetLines: [request.toAddress.street],
                  city: request.toAddress.city,
                  stateOrProvinceCode: request.toAddress.stateOrProvinceCode,
                  postalCode: request.toAddress.postalCode,
                  countryCode: request.toAddress.countryCode || 'US',
                },
              },
            ],
            shipDatestamp: new Date().toISOString().split('T')[0],
            serviceType: request.service,
            packages: [
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
      return {
        rate: 0,
        error: error.message || 'Rate calculation failed',
      };
    }
  }
}

export default new FedExService();
