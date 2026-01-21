import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './ProcessingView.css';

interface ShipmentDetails {
  id: string;
  shipment_number: string;
  manufacturer_name: string;
  manufacturer_email: string;
  company_name: string;
  chemical_name: string;
  lot_number: string;
  amount_shipped: string;
  unit: string;
  available_quantity: string;
  cas_number: string;
  concentration: string;
  has_dow_sds: boolean;
  sds_file_path: string;
  recipient_name: string;
  first_name: string;
  last_name: string;
  destination_address: string;
  destination_city: string;
  destination_state: string;
  destination_zip: string;
  destination_country: string;
  recipient_phone: string;
  scheduled_ship_date: string;
  is_hazmat: boolean;
  requires_dg_declaration: boolean;
  sds_documents: Array<{
    id: string;
    file_name: string;
    file_path: string;
    revision_date: string;
  }>;
}

interface Supply {
  id: string;
  supply_name: string;
  supply_type: string;
  current_quantity: number;
  unit: string;
}

const ProcessingView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [shipment, setShipment] = useState<ShipmentDetails | null>(null);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  // Form state
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'LB' | 'KG'>('LB');
  const [service, setService] = useState('GROUND_HOME_DELIVERY');
  const [packageValue, setPackageValue] = useState('100');
  const [isHazmat, setIsHazmat] = useState(false);
  const [suppliesUsed, setSuppliesUsed] = useState<{ [key: string]: number }>({});
  
  // Address validation
  const [addressValidated, setAddressValidated] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  
  // Editable address fields
  const [editableAddress, setEditableAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'US'
  });

  // Rate quote
  const [rateQuote, setRateQuote] = useState<number | null>(null);
  const [gettingRate, setGettingRate] = useState(false);

  useEffect(() => {
    if (id) {
      fetchShipmentDetails();
      fetchSupplies();
    }
  }, [id]);

  useEffect(() => {
    if (shipment) {
      // Auto-detect hazmat based on quantity >= 30ml
      const quantity = parseFloat(shipment.amount_shipped);
      if (quantity >= 30 && shipment.unit.toLowerCase().includes('ml')) {
        setIsHazmat(true);
      }
      
      // Initialize editable address fields from shipment data
      setEditableAddress({
        street: shipment.destination_address || '',
        city: shipment.destination_city || '',
        state: shipment.destination_state || '',
        zip: shipment.destination_zip || '',
        country: shipment.destination_country || 'US'
      });
    }
  }, [shipment]);

  const fetchShipmentDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/processing/${id}`);
      setShipment(response.data.data || response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch shipment details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplies = async () => {
    try {
      const response = await api.get('/processing/supplies');
      const suppliesArray = Array.isArray(response.data) ? response.data : (response.data.data || response.data.supplies || []);
      setSupplies(suppliesArray);
    } catch (err: any) {
      console.error('Failed to fetch supplies:', err);
    }
  };

  const handleValidateAddress = async () => {
    if (!shipment) return;

    setValidating(true);
    try {
      const response = await api.post('/processing/validate-address', {
        street: editableAddress.street,
        city: editableAddress.city,
        state: editableAddress.state,
        zip: editableAddress.zip,
        country: editableAddress.country,
      });

      setValidationResult(response.data.data);
      setAddressValidated(response.data.data.valid);
      
      if (!response.data.data.valid) {
        setError('Address validation failed. Please review the address.');
      } else {
        setError('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Address validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleGetRate = async () => {
    if (!shipment || !weight) {
      setError('Please enter package weight');
      return;
    }

    setGettingRate(true);
    try {
      const response = await api.post('/processing/get-rate', {
        toAddress: {
          street: shipment.destination_address,
          city: shipment.destination_city,
          state: shipment.destination_state,
          zip: shipment.destination_zip,
          country: shipment.destination_country || 'US',
        },
        weight,
        weightUnit,
        service,
        packageValue,
        isHazmat,
      });

      setRateQuote(response.data.data.rate);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get rate quote');
    } finally {
      setGettingRate(false);
    }
  };

  const handleGenerateLabel = async () => {
    if (!shipment || !weight) {
      setError('Please enter package weight');
      return;
    }

    if (!addressValidated) {
      setError('Please validate the delivery address first');
      return;
    }

    setProcessing(true);
    try {
      const suppliesArray = Object.entries(suppliesUsed)
        .filter(([_, qty]) => qty > 0)
        .map(([supply_id, quantity]) => ({ supply_id, quantity }));

      const response = await api.post('/processing/generate-label', {
        shipmentId: id,
        weight,
        weightUnit,
        service,
        packageValue,
        isHazmat,
        suppliesUsed: suppliesArray,
      });

      alert(`Label Generated Successfully!\n\nTracking Number: ${response.data.data.trackingNumber}\nCost: $${response.data.data.cost.toFixed(2)}\nEstimated Delivery: ${response.data.data.estimatedDelivery}`);
      
      // Download label
      window.open(response.data.data.labelPath, '_blank');
      
      // Navigate back to dashboard
      navigate('/internal/processing-dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate shipping label');
    } finally {
      setProcessing(false);
    }
  };

  const handleSupplyChange = (supplyId: string, quantity: number) => {
    setSuppliesUsed((prev) => ({
      ...prev,
      [supplyId]: quantity,
    }));
  };

  if (loading) {
    return (
      <div className="processing-view">
        <div className="processing-loading">Loading shipment details...</div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="processing-view">
        <div className="processing-error">Shipment not found</div>
      </div>
    );
  }

  const projectedRemaining = parseFloat(shipment.available_quantity) - parseFloat(shipment.amount_shipped);

  return (
    <div className="processing-view">
      {/* Header */}
      <div className="procview-header">
        <div className="procview-header-content">
          <button className="procview-back-btn" onClick={() => navigate('/internal/processing-dashboard')}>
            ← Back to Dashboard
          </button>
          <div className="procview-title-section">
            <h1 className="procview-title">Process Shipment</h1>
            <span className="procview-shipment-number">{shipment.shipment_number}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="procview-content">
        {error && <div className="procview-error">{error}</div>}

        {/* Shipment Details Card */}
        <div className="procview-card">
          <div className="procview-card-header">
            <h2>Shipment Details</h2>
          </div>
          <div className="procview-card-body">
            <div className="procview-details-grid">
              <div className="detail-item">
                <label>Manufacturer</label>
                <div>{shipment.manufacturer_name} ({shipment.company_name})</div>
              </div>
              <div className="detail-item">
                <label>Email</label>
                <div>{shipment.manufacturer_email}</div>
              </div>
              <div className="detail-item">
                <label>Chemical</label>
                <div><strong>{shipment.chemical_name}</strong></div>
              </div>
              <div className="detail-item">
                <label>Lot Number</label>
                <div>{shipment.lot_number}</div>
              </div>
              <div className="detail-item">
                <label>Requested Quantity</label>
                <div>{shipment.amount_shipped} {shipment.unit}</div>
              </div>
              <div className="detail-item">
                <label>Available</label>
                <div>{shipment.available_quantity}</div>
              </div>
              <div className="detail-item">
                <label>Projected Remaining</label>
                <div className={projectedRemaining < 0 ? 'text-danger' : projectedRemaining < 10 ? 'text-warning' : 'text-success'}>
                  {projectedRemaining.toFixed(2)} {shipment.unit}
                </div>
              </div>
              <div className="detail-item">
                <label>Scheduled Ship Date</label>
                <div>{new Date(shipment.scheduled_ship_date).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Address Card */}
        <div className="procview-card">
          <div className="procview-card-header">
            <h2>Delivery Address</h2>
            <button
              className="procview-btn-secondary"
              onClick={handleValidateAddress}
              disabled={validating}
            >
              {validating ? 'Validating...' : addressValidated ? 'Validated' : 'Validate Address'}
            </button>
          </div>
          <div className="procview-card-body">
            <div className="procview-address">
              <div><strong>{shipment.recipient_name}</strong></div>
              
              <div className="procview-address-form">
                <label>
                  Street Address:
                  <input 
                    type="text" 
                    value={editableAddress.street}
                    onChange={(e) => setEditableAddress({...editableAddress, street: e.target.value})}
                    placeholder="Street address"
                  />
                </label>
                
                <label>
                  City:
                  <input 
                    type="text" 
                    value={editableAddress.city}
                    onChange={(e) => setEditableAddress({...editableAddress, city: e.target.value})}
                    placeholder="City"
                  />
                </label>
                
                <div className="procview-address-row">
                  <label>
                    State:
                    <input 
                      type="text" 
                      value={editableAddress.state}
                      onChange={(e) => setEditableAddress({...editableAddress, state: e.target.value})}
                      placeholder="State"
                      maxLength={2}
                    />
                  </label>
                  
                  <label>
                    ZIP Code:
                    <input 
                      type="text" 
                      value={editableAddress.zip}
                      onChange={(e) => setEditableAddress({...editableAddress, zip: e.target.value})}
                      placeholder="ZIP"
                    />
                  </label>
                  
                  <label>
                    Country:
                    <input 
                      type="text" 
                      value={editableAddress.country}
                      onChange={(e) => setEditableAddress({...editableAddress, country: e.target.value})}
                      placeholder="Country"
                    />
                  </label>
                </div>
              </div>
              
              {shipment.recipient_phone && <div>Phone: {shipment.recipient_phone}</div>}
            </div>

            {validationResult && !validationResult.valid && validationResult.correctedAddress && (
              <div className="procview-address-suggestion">
                <h4>Suggested Corrected Address:</h4>
                <div>{validationResult.correctedAddress.street}</div>
                <div>{validationResult.correctedAddress.city}, {validationResult.correctedAddress.state} {validationResult.correctedAddress.zip}</div>
              </div>
            )}
          </div>
        </div>

        {/* SDS Documents */}
        {shipment.sds_documents && shipment.sds_documents.length > 0 && (
          <div className="procview-card">
            <div className="procview-card-header">
              <h2>Safety Data Sheets (SDS)</h2>
            </div>
            <div className="procview-card-body">
              <div className="sds-list">
                {shipment.sds_documents.map((sds) => (
                  <div key={sds.id} className="sds-item">
                    <span>File: {sds.file_name}</span>
                    <span className="sds-date">Rev: {new Date(sds.revision_date).toLocaleDateString()}</span>
                    <a href={sds.file_path} target="_blank" rel="noopener noreferrer" className="procview-btn-link">
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Package Details */}
        <div className="procview-card">
          <div className="procview-card-header">
            <h2>Package Details</h2>
          </div>
          <div className="procview-card-body">
            <div className="procview-form-grid">
              <div className="form-group">
                <label>Weight *</label>
                <div className="input-group">
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0.0"
                  />
                  <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as 'LB' | 'KG')}>
                    <option value="LB">LB</option>
                    <option value="KG">KG</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Shipping Service *</label>
                <select value={service} onChange={(e) => setService(e.target.value)}>
                  <option value="GROUND_HOME_DELIVERY">Ground (5 days)</option>
                  <option value="EXPRESS_SAVER">2-Day Express</option>
                  <option value="OVERNIGHT_EXPRESS">Overnight</option>
                </select>
              </div>

              <div className="form-group">
                <label>Package Value ($)</label>
                <input
                  type="number"
                  value={packageValue}
                  onChange={(e) => setPackageValue(e.target.value)}
                  placeholder="100"
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={isHazmat}
                    onChange={(e) => setIsHazmat(e.target.checked)}
                  />
                  Hazardous Materials (≥30ml)
                </label>
              </div>
            </div>

            {isHazmat && (
              <div className="procview-hazmat-warning">
                HAZMAT: <strong>HAZMAT SHIPMENT</strong> - Dangerous Goods Declaration required. UN Box and proper labeling must be used.
              </div>
            )}

            <button
              className="procview-btn-info"
              onClick={handleGetRate}
              disabled={gettingRate || !weight}
            >
              {gettingRate ? 'Calculating...' : 'Get Rate Quote'}
            </button>

            {rateQuote !== null && (
              <div className="procview-rate-display">
                <strong>Estimated Shipping Cost:</strong> ${rateQuote.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Supplies Used */}
        <div className="procview-card">
          <div className="procview-card-header">
            <h2>Shipping Supplies Used</h2>
          </div>
          <div className="procview-card-body">
            <div className="supplies-grid">
              {supplies.map((supply) => (
                <div key={supply.id} className="supply-item">
                  <label>
                    {supply.supply_name} ({supply.current_quantity} {supply.unit} available)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={supply.current_quantity}
                    value={suppliesUsed[supply.id] || 0}
                    onChange={(e) => handleSupplyChange(supply.id, parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Label Button */}
        <div className="procview-actions">
          <button
            className="procview-btn-primary large"
            onClick={handleGenerateLabel}
            disabled={processing || !addressValidated || !weight}
          >
            {processing ? 'Generating Label...' : 'Generate FedEx Label & Ship'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProcessingView;
