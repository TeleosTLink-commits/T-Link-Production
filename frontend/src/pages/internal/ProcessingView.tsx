import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './ProcessingView.css';

interface SampleInfo {
  id: string;
  chemical_name: string;
  lot_number: string;
  quantity: string;
  cas_number: string;
  un_number: string;
  hazard_class: string;
  packing_group: string;
  proper_shipping_name: string;
  sds_file_path: string;
  sds_file_name: string;
  coa_file_path: string;
  coa_file_name: string;
}

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
  // HazMat fields from samples
  samples?: SampleInfo[];
  un_number?: string;
  hazard_class?: string;
  packing_group?: string;
  proper_shipping_name?: string;
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

// DOT Hazard Class Labels mapping
const HAZARD_CLASS_LABELS: { [key: string]: { name: string; color: string; symbol: string } } = {
  '1': { name: 'Explosives', color: '#FF6600', symbol: '💥' },
  '2.1': { name: 'Flammable Gas', color: '#FF0000', symbol: '🔥' },
  '2.2': { name: 'Non-Flammable Gas', color: '#00FF00', symbol: '⬤' },
  '2.3': { name: 'Toxic Gas', color: '#FFFFFF', symbol: '☠️' },
  '3': { name: 'Flammable Liquid', color: '#FF0000', symbol: '🔥' },
  '4.1': { name: 'Flammable Solid', color: '#FF0000', symbol: '🔥' },
  '4.2': { name: 'Spontaneously Combustible', color: '#FF0000', symbol: '🔥' },
  '4.3': { name: 'Dangerous When Wet', color: '#0000FF', symbol: '💧' },
  '5.1': { name: 'Oxidizer', color: '#FFFF00', symbol: '⭕' },
  '5.2': { name: 'Organic Peroxide', color: '#FFFF00', symbol: '⭕' },
  '6.1': { name: 'Toxic', color: '#FFFFFF', symbol: '☠️' },
  '6.2': { name: 'Infectious Substance', color: '#FFFFFF', symbol: '☣️' },
  '7': { name: 'Radioactive', color: '#FFFF00', symbol: '☢️' },
  '8': { name: 'Corrosive', color: '#000000', symbol: '⚗️' },
  '9': { name: 'Miscellaneous Dangerous Goods', color: '#FFFFFF', symbol: '⚠️' },
};

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
  
  // Printing state
  const [showSdsPrintPrompt, setShowSdsPrintPrompt] = useState(false);
  const [showLabelPrintPrompt, setShowLabelPrintPrompt] = useState(false);
  const [showHazmatLabelPrompt, setShowHazmatLabelPrompt] = useState(false);
  const [generatedLabel, setGeneratedLabel] = useState<{ trackingNumber: string; labelPath: string; cost: number } | null>(null);
  const [sdsPrinted, setSdsPrinted] = useState(false);
  
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
      // Auto-detect hazmat based on UN number or hazard class, or quantity >= 30ml
      const quantity = parseFloat(shipment.amount_shipped);
      const hasHazmatInfo = shipment.un_number || shipment.hazard_class || 
        (shipment.samples && shipment.samples.some(s => s.un_number || s.hazard_class));
      
      if (hasHazmatInfo || (quantity >= 30 && shipment.unit.toLowerCase().includes('ml'))) {
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
      
      // Show SDS print prompt if SDS documents are available
      const hasSds = (shipment.sds_documents && shipment.sds_documents.length > 0) ||
        shipment.sds_file_path ||
        (shipment.samples && shipment.samples.some(s => s.sds_file_path));
      
      if (hasSds && !sdsPrinted) {
        setShowSdsPrintPrompt(true);
      }
    }
  }, [shipment, sdsPrinted]);

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

  // Print SDS documents
  const handlePrintSds = () => {
    if (!shipment) return;
    
    // Collect all SDS URLs
    const sdsUrls: string[] = [];
    
    if (shipment.sds_documents) {
      shipment.sds_documents.forEach(sds => sdsUrls.push(sds.file_path));
    }
    if (shipment.sds_file_path) {
      sdsUrls.push(shipment.sds_file_path);
    }
    if (shipment.samples) {
      shipment.samples.forEach(sample => {
        if (sample.sds_file_path) sdsUrls.push(sample.sds_file_path);
      });
    }
    
    // Open each SDS in a new tab for printing
    sdsUrls.forEach(url => {
      window.open(url, '_blank');
    });
    
    setSdsPrinted(true);
    setShowSdsPrintPrompt(false);
  };

  // Print shipping label
  const handlePrintLabel = () => {
    if (generatedLabel?.labelPath) {
      window.open(generatedLabel.labelPath, '_blank');
      setShowLabelPrintPrompt(false);
      
      // If hazmat, show hazmat label prompt
      if (isHazmat) {
        setShowHazmatLabelPrompt(true);
      } else {
        // Navigate back if not hazmat
        navigate('/internal/processing-dashboard');
      }
    }
  };

  // Print hazmat warning labels
  const handlePrintHazmatLabels = () => {
    if (!shipment) return;
    
    // Get hazard classes for this shipment
    const hazardClasses: string[] = [];
    
    if (shipment.hazard_class) {
      hazardClasses.push(shipment.hazard_class);
    }
    if (shipment.samples) {
      shipment.samples.forEach(sample => {
        if (sample.hazard_class && !hazardClasses.includes(sample.hazard_class)) {
          hazardClasses.push(sample.hazard_class);
        }
      });
    }
    
    // Open the hazmat label print page
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Hazmat Warning Labels - ${shipment.shipment_number}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .label-container { display: flex; flex-wrap: wrap; gap: 20px; }
              .hazmat-label {
                width: 100mm;
                height: 100mm;
                border: 3px solid black;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                page-break-inside: avoid;
                transform: rotate(45deg);
                margin: 50px;
              }
              .hazmat-label .symbol { font-size: 48px; }
              .hazmat-label .class-name { font-size: 14px; font-weight: bold; margin-top: 10px; }
              .hazmat-label .class-number { font-size: 24px; font-weight: bold; }
              .un-label {
                width: 100mm;
                height: 50mm;
                border: 2px solid black;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                font-weight: bold;
                page-break-inside: avoid;
                margin: 20px;
              }
              @media print {
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="no-print">
              <h2>Hazmat Warning Labels for Shipment ${shipment.shipment_number}</h2>
              <p>Print these labels and affix to the package.</p>
              <button onclick="window.print()">Print Labels</button>
              <hr/>
            </div>
            <div class="label-container">
              ${hazardClasses.map(hc => {
                const labelInfo = HAZARD_CLASS_LABELS[hc] || HAZARD_CLASS_LABELS['9'];
                return `
                  <div class="hazmat-label" style="background-color: ${labelInfo.color};">
                    <div class="symbol">${labelInfo.symbol}</div>
                    <div class="class-name">${labelInfo.name}</div>
                    <div class="class-number">Class ${hc}</div>
                  </div>
                `;
              }).join('')}
              ${shipment.un_number ? `
                <div class="un-label">
                  UN ${shipment.un_number}
                </div>
              ` : ''}
              ${shipment.samples?.filter(s => s.un_number).map(sample => `
                <div class="un-label">
                  UN ${sample.un_number}
                </div>
              `).join('') || ''}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
    
    setShowHazmatLabelPrompt(false);
    navigate('/internal/processing-dashboard');
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
        // Include hazmat details for FedEx API
        hazmatDetails: isHazmat ? {
          unNumber: shipment.un_number || shipment.samples?.[0]?.un_number,
          hazardClass: shipment.hazard_class || shipment.samples?.[0]?.hazard_class,
          packingGroup: shipment.packing_group || shipment.samples?.[0]?.packing_group,
          properShippingName: shipment.proper_shipping_name || shipment.samples?.[0]?.proper_shipping_name || shipment.chemical_name,
        } : undefined,
      });

      // Store the generated label info
      setGeneratedLabel({
        trackingNumber: response.data.data.trackingNumber,
        labelPath: response.data.data.labelPath,
        cost: response.data.data.cost,
      });
      
      // Show label print prompt instead of navigating away
      setShowLabelPrintPrompt(true);
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

  // Get hazmat info for display
  const hazmatInfo = {
    unNumber: shipment.un_number || shipment.samples?.[0]?.un_number,
    hazardClass: shipment.hazard_class || shipment.samples?.[0]?.hazard_class,
    packingGroup: shipment.packing_group || shipment.samples?.[0]?.packing_group,
    properShippingName: shipment.proper_shipping_name || shipment.samples?.[0]?.proper_shipping_name,
  };

  return (
    <div className="processing-view">
      {/* SDS Print Prompt Modal */}
      {showSdsPrintPrompt && (
        <div className="procview-modal-overlay">
          <div className="procview-modal">
            <div className="procview-modal-header">
              <h3>📋 Print Safety Data Sheets</h3>
            </div>
            <div className="procview-modal-body">
              <p>Before processing this shipment, you should print the Safety Data Sheet(s) for the following sample(s):</p>
              <ul className="sds-checklist">
                <li key="primary-sample"><strong>{shipment.chemical_name}</strong> - Lot: {shipment.lot_number}</li>
                {shipment.samples?.map(sample => (
                  <li key={sample.id}><strong>{sample.chemical_name}</strong> - Lot: {sample.lot_number}</li>
                ))}
              </ul>
              <p className="modal-note">The SDS must be included with the shipment for regulatory compliance.</p>
            </div>
            <div className="procview-modal-footer">
              <button className="procview-btn-secondary" onClick={() => setShowSdsPrintPrompt(false)}>
                Skip for Now
              </button>
              <button className="procview-btn-primary" onClick={handlePrintSds}>
                Print SDS Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Print Prompt Modal */}
      {showLabelPrintPrompt && generatedLabel && (
        <div className="procview-modal-overlay">
          <div className="procview-modal">
            <div className="procview-modal-header success">
              <h3>✅ Label Generated Successfully!</h3>
            </div>
            <div className="procview-modal-body">
              <div className="label-success-info">
                <p><strong>Tracking Number:</strong> {generatedLabel.trackingNumber}</p>
                <p><strong>Shipping Cost:</strong> ${generatedLabel.cost.toFixed(2)}</p>
              </div>
              <p>Please print the shipping label and affix it to the package.</p>
            </div>
            <div className="procview-modal-footer">
              <button className="procview-btn-primary" onClick={handlePrintLabel}>
                Print Shipping Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hazmat Labels Print Prompt Modal */}
      {showHazmatLabelPrompt && (
        <div className="procview-modal-overlay">
          <div className="procview-modal hazmat">
            <div className="procview-modal-header warning">
              <h3>⚠️ Hazardous Materials Warning Labels Required</h3>
            </div>
            <div className="procview-modal-body">
              <p>This is a <strong>HAZMAT shipment</strong>. You must print and affix the following warning labels:</p>
              <div className="hazmat-labels-preview">
                {hazmatInfo.hazardClass && (
                  <div className="hazmat-label-preview">
                    <span className="label-icon">
                      {HAZARD_CLASS_LABELS[hazmatInfo.hazardClass]?.symbol || '⚠️'}
                    </span>
                    <span>Class {hazmatInfo.hazardClass}: {HAZARD_CLASS_LABELS[hazmatInfo.hazardClass]?.name || 'Dangerous Goods'}</span>
                  </div>
                )}
                {hazmatInfo.unNumber && (
                  <div className="un-label-preview">
                    <span className="label-icon">📦</span>
                    <span>UN {hazmatInfo.unNumber}</span>
                  </div>
                )}
              </div>
              <p className="modal-note warning">
                <strong>DOT Requirement:</strong> These labels must be clearly visible on the outside of the package.
              </p>
            </div>
            <div className="procview-modal-footer">
              <button className="procview-btn-secondary" onClick={() => {
                setShowHazmatLabelPrompt(false);
                navigate('/internal/processing-dashboard');
              }}>
                Skip (Labels Already Available)
              </button>
              <button className="procview-btn-warning" onClick={handlePrintHazmatLabels}>
                Print Hazmat Labels
              </button>
            </div>
          </div>
        </div>
      )}

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

        {/* HazMat Information Card - Only show if hazmat info exists */}
        {(hazmatInfo.unNumber || hazmatInfo.hazardClass) && (
          <div className="procview-card hazmat-card">
            <div className="procview-card-header hazmat-header">
              <h2>⚠️ Hazardous Materials Information</h2>
            </div>
            <div className="procview-card-body">
              <div className="hazmat-info-grid">
                {hazmatInfo.unNumber && (
                  <div className="hazmat-detail-item">
                    <label>UN Number</label>
                    <div className="hazmat-value">UN {hazmatInfo.unNumber}</div>
                  </div>
                )}
                {hazmatInfo.properShippingName && (
                  <div className="hazmat-detail-item">
                    <label>Proper Shipping Name</label>
                    <div className="hazmat-value">{hazmatInfo.properShippingName}</div>
                  </div>
                )}
                {hazmatInfo.hazardClass && (
                  <div className="hazmat-detail-item">
                    <label>Hazard Class</label>
                    <div className="hazmat-value">
                      <span className="hazard-class-badge" style={{ 
                        backgroundColor: HAZARD_CLASS_LABELS[hazmatInfo.hazardClass]?.color || '#666',
                        color: ['#FFFF00', '#00FF00', '#FFFFFF'].includes(HAZARD_CLASS_LABELS[hazmatInfo.hazardClass]?.color || '') ? '#000' : '#fff'
                      }}>
                        {HAZARD_CLASS_LABELS[hazmatInfo.hazardClass]?.symbol} Class {hazmatInfo.hazardClass}
                      </span>
                      <span className="hazard-class-name">{HAZARD_CLASS_LABELS[hazmatInfo.hazardClass]?.name}</span>
                    </div>
                  </div>
                )}
                {hazmatInfo.packingGroup && (
                  <div className="hazmat-detail-item">
                    <label>Packing Group</label>
                    <div className="hazmat-value">{hazmatInfo.packingGroup}</div>
                  </div>
                )}
              </div>
              <div className="hazmat-requirements">
                <h4>📋 Shipping Requirements:</h4>
                <ul>
                  <li key="packaging">✓ UN-rated packaging required</li>
                  <li key="labels">✓ Hazard warning labels must be affixed</li>
                  <li key="sds">✓ Safety Data Sheet (SDS) must be included</li>
                  {parseFloat(shipment.amount_shipped) > 70 && <li key="weight-limit" className="warning">⚠️ FedEx Ground limit: 70 lbs per package</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

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
                  <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as 'LB' | 'KG')} aria-label="Weight unit">
                    <option value="LB">LB</option>
                    <option value="KG">KG</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Shipping Service *</label>
                <select value={service} onChange={(e) => setService(e.target.value)} aria-label="Shipping service">
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

      <footer className="dashboard-footer">
        <div className="footer-content">
          <span className="footer-text">Developed and operated by</span>
          <img src="/images/AAL_Dig_Dev.png" alt="AAL Digital Development" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
};

export default ProcessingView;
