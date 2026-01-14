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
}

interface ShipmentLabelRequest {
  fromAddress: AddressValidationInput;
  toAddress: AddressValidationInput;
  weight: number;
  weightUnit: 'LB' | 'KG';
  service: 'GROUND_HOME_DELIVERY' | 'OVERNIGHT_EXPRESS' | 'EXPRESS_SAVER';
  packageValue: number;
  isHazmat?: boolean;
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

      return this.authToken;
    } catch (error: any) {
      throw new Error(`FedEx authentication failed: ${error.message}`);
    }
  }

  /**
   * Validate a delivery address using FedEx Address Validation API
   */
  async validateAddress(address: AddressValidationInput): Promise<AddressValidationResult> {
    try {
      const token = await this.getAuthToken();

      const response = await axios.post(
        `${FEDEX_API_BASE_URL}/street-address/v1/validate`,
        {
          inEffectAsOfTimestamp: new Date().toISOString(),
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
          },
        }
      );

      if (response.data.output && response.data.output.length > 0) {
        const result = response.data.output[0];

        if (result.resolvedAddress) {
          return {
            valid: true,
            correctedAddress: {
              street: result.resolvedAddress.streetLines?.join(' ') || address.street,
              city: result.resolvedAddress.city || address.city,
              state: result.resolvedAddress.stateOrProvinceCode || address.stateOrProvinceCode,
              zip: result.resolvedAddress.postalCode || address.postalCode,
              country: result.resolvedAddress.countryCode || 'US',
            },
          };
        } else if (result.undeliverableDetail) {
          return {
            valid: false,
            error: result.undeliverableDetail.description || 'Address is not deliverable',
          };
        }
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
      return {
        valid: false,
        error: error.message || 'Address validation failed',
      };
    }
  }

  /**
   * Generate shipment label and get shipping cost
   */
  async generateShipmentLabel(request: ShipmentLabelRequest): Promise<ShipmentLabelResult> {
    try {
      const token = await this.getAuthToken();

      // Create shipment request
      const shipmentPayload = {
        labelResponseOptions: 'URL_ONLY',
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
              packageSpecialServices: request.isHazmat
                ? {
                    specialServiceTypes: ['DANGEROUS_GOODS'],
                  }
                : undefined,
            },
          ],
          rateRequestType: ['ACCOUNT'],
        },
      };

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
      return {
        trackingNumber: '',
        label: '',
        cost: 0,
        estimatedDelivery: '',
        error: error.message || 'Shipment label generation failed',
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
      console.error(`FedEx tracking error for ${trackingNumber}:`, error.message);
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
