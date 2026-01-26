import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './ShipmentRequest.css';

interface SampleInventory {
  id: string;
  chemical_name: string;
  lot_number: string;
  quantity: string;
  un_number: string;
  hazard_class: string;
  packing_group: string;
  proper_shipping_name: string;
  hazard_description: string;
}

interface Sample {
  sample_name: string;
  lot_number: string;
  quantity_requested: string;
  quantity_unit: string;
  // HazMat info from inventory
  un_number?: string;
  hazard_class?: string;
  packing_group?: string;
  proper_shipping_name?: string;
  hazard_description?: string;
  is_hazmat?: boolean;
}

const ShipmentRequest: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [availableSamples, setAvailableSamples] = useState<SampleInventory[]>([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    recipient_company: '',
    recipient_phone: '',
    // Structured address fields
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'US',
    // Shipping options
    is_international: false,
    emergency_contact_phone: '',
    special_instructions: '',
    scheduled_ship_date: '',
  });
  const [samples, setSamples] = useState<Sample[]>([
    { sample_name: '', lot_number: '', quantity_requested: '', quantity_unit: 'ml' }
  ]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  // Fetch available samples on mount
  useEffect(() => {
    fetchAvailableSamples();
  }, []);

  const fetchAvailableSamples = async () => {
    try {
      const response = await api.get('/sample-inventory?status=active&limit=500');
      const data = response.data.data || response.data.samples || response.data || [];
      setAvailableSamples(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSampleChange = (index: number, field: keyof Sample, value: string) => {
    const newSamples = [...samples];
    // Use spread to update the specific field
    newSamples[index] = { ...newSamples[index], [field]: value };
    
    // Auto-populate hazmat info when lot number is entered
    if (field === 'lot_number' && value) {
      const matchingSample = availableSamples.find(
        s => s.lot_number.toLowerCase() === value.toLowerCase()
      );
      if (matchingSample) {
        newSamples[index] = {
          ...newSamples[index],
          sample_name: matchingSample.chemical_name,
          un_number: matchingSample.un_number || '',
          hazard_class: matchingSample.hazard_class || '',
          packing_group: matchingSample.packing_group || '',
          proper_shipping_name: matchingSample.proper_shipping_name || '',
          hazard_description: matchingSample.hazard_description || '',
        };
      }
    }
    
    setSamples(newSamples);
    
    // Clear error for this sample
    const errorKey = `sample_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({
        ...prev,
        [errorKey]: '',
      }));
    }
  };
  
  // Handle sample selection from dropdown
  const handleSampleSelect = (index: number, sampleId: string) => {
    if (!sampleId) return;
    
    const selectedSample = availableSamples.find(s => s.id.toString() === sampleId);
    if (selectedSample) {
      const newSamples = [...samples];
      newSamples[index] = {
        ...newSamples[index],
        sample_name: selectedSample.chemical_name,
        lot_number: selectedSample.lot_number,
        un_number: selectedSample.un_number || '',
        hazard_class: selectedSample.hazard_class || '',
        packing_group: selectedSample.packing_group || '',
        proper_shipping_name: selectedSample.proper_shipping_name || '',
        hazard_description: selectedSample.hazard_description || '',
      };
      setSamples(newSamples);
    }
  };

  const addSample = () => {
    if (samples.length < 10) {
      setSamples([...samples, { 
        sample_name: '', 
        lot_number: '', 
        quantity_requested: '', 
        quantity_unit: 'ml',
        un_number: '',
        hazard_class: '',
        packing_group: '',
        proper_shipping_name: '',
        hazard_description: '',
      }]);
    }
  };

  const removeSample = (index: number) => {
    if (samples.length > 1) {
      setSamples(samples.filter((_, i) => i !== index));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';
    if (!formData.street_address) newErrors.street_address = 'Street address is required';
    if (!formData.city) newErrors.city = 'City is required';
    if (!formData.state) newErrors.state = 'State/Province is required';
    if (!formData.zip_code) newErrors.zip_code = 'ZIP/Postal code is required';
    if (!formData.recipient_phone) newErrors.recipient_phone = 'Phone number is required';
    if (!formData.emergency_contact_phone) newErrors.emergency_contact_phone = 'Emergency contact phone is required for hazmat shipments';

    // Validate samples
    samples.forEach((sample, index) => {
      if (!sample.sample_name) newErrors[`sample_${index}_sample_name`] = 'Sample name is required';
      if (!sample.lot_number) newErrors[`sample_${index}_lot_number`] = 'Lot number is required';
      if (!sample.quantity_requested) newErrors[`sample_${index}_quantity_requested`] = 'Quantity is required';
      else if (isNaN(parseFloat(sample.quantity_requested))) newErrors[`sample_${index}_quantity_requested`] = 'Must be a valid number';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      // Build full delivery address for backward compatibility
      const fullAddress = [
        formData.street_address,
        formData.city,
        formData.state,
        formData.zip_code,
        formData.country || 'USA'
      ].filter(Boolean).join(', ');
      
      const response = await api.post('/manufacturer/shipments/request-multiple', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        recipient_company: formData.recipient_company || undefined,
        recipient_phone: formData.recipient_phone,
        // Structured address fields
        street_address: formData.street_address,
        city: formData.city,
        state: formData.state,
        zip_code: formData.zip_code,
        country: formData.country || 'USA',
        // Legacy field for backward compatibility
        delivery_address: fullAddress,
        // Shipping details
        is_international: formData.is_international || false,
        emergency_contact_phone: formData.emergency_contact_phone,
        special_instructions: formData.special_instructions || undefined,
        scheduled_ship_date: formData.scheduled_ship_date || undefined,
        samples: samples.map(s => ({
          sample_name: s.sample_name,
          lot_number: s.lot_number,
          quantity_requested: parseFloat(s.quantity_requested),
          quantity_unit: s.quantity_unit,
          // HazMat fields
          un_number: s.un_number || undefined,
          hazard_class: s.hazard_class || undefined,
          packing_group: s.packing_group || undefined,
          proper_shipping_name: s.proper_shipping_name || undefined,
          hazard_description: s.hazard_description || undefined,
        })),
      });

      setSubmittedData(response.data.shipment);
      setSubmitted(true);
      toast.success('Shipment request created successfully!');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to create shipment request';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/manufacturer/dashboard');
  };

  const handleCreateAnother = () => {
    setSubmitted(false);
    setSubmittedData(null);
    setFormData({
      first_name: '',
      last_name: '',
      recipient_company: '',
      recipient_phone: '',
      street_address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'USA',
      is_international: false,
      emergency_contact_phone: '',
      special_instructions: '',
      scheduled_ship_date: '',
    });
    setSamples([{ 
      sample_name: '', 
      lot_number: '', 
      quantity_requested: '', 
      quantity_unit: 'ml',
      un_number: '',
      hazard_class: '',
      packing_group: '',
      proper_shipping_name: '',
      hazard_description: '',
    }]);
    setErrors({});
  };

  // Calculate total quantity and check for hazmat
  const totalQuantity = samples.reduce((sum, s) => sum + (parseFloat(s.quantity_requested) || 0), 0);
  const isHazmat = totalQuantity >= 30;

  if (submitted && submittedData) {
    return (
      <div className="shipment-request-portal">
        <div className="shipment-request-header">
          <div className="shipment-request-header-text">
            <h1 className="shipment-request-title">Request Submitted Successfully</h1>
            <p className="shipment-request-subtitle">Your shipment has been created</p>
          </div>
        </div>

        <div className="shipment-request-content">
          <div className="shipment-request-success">
            <div className="shipment-request-success-icon">✓</div>
            <h1 className="shipment-request-success-title">Shipment Request Submitted!</h1>
            <p className="shipment-request-success-message">Your shipment request has been created and a confirmation email has been sent.</p>

            <div className="shipment-request-summary-box">
              <h3 className="shipment-request-summary-title">Request Summary</h3>
              <h3 className="shipment-request-summary-title">Request Summary</h3>
              <div className="shipment-request-summary-grid">
                <div className="shipment-request-summary-item">
                  <span className="shipment-request-summary-label">Request ID:</span>
                  <span className="shipment-request-summary-value">{submittedData.id}</span>
                </div>
                <div className="shipment-request-summary-item">
                  <span className="shipment-request-summary-label">Status:</span>
                  <span className="shipment-request-summary-value status-blue">
                    {submittedData.status.charAt(0).toUpperCase() + submittedData.status.slice(1)}
                  </span>
                </div>
                <div className="shipment-request-summary-item">
                  <span className="shipment-request-summary-label">Samples:</span>
                  <span className="shipment-request-summary-value">{submittedData.samples?.length || 1} sample(s)</span>
                </div>
                <div className="shipment-request-summary-item">
                  <span className="shipment-request-summary-label">Total Quantity:</span>
                  <span className="shipment-request-summary-value">{submittedData.total_quantity} {submittedData.unit}</span>
                </div>
                <div className="shipment-request-summary-item">
                  <span className="shipment-request-summary-label">Delivery Address:</span>
                  <span className="shipment-request-summary-value">{submittedData.delivery_address}</span>
                </div>
                <div className="shipment-request-summary-item">
                  <span className="shipment-request-summary-label">Hazmat:</span>
                  <span className={`shipment-request-summary-value ${submittedData.is_hazmat ? 'status-danger' : 'status-success'}`}>
                    {submittedData.is_hazmat ? 'Yes - DG Documentation Required' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="shipment-request-info-box">
              <h4 className="shipment-request-info-title">What happens next?</h4>
              <ol className="shipment-request-info-list">
                <li>Your request will be reviewed by our lab team</li>
                <li>We'll prepare your shipment and verify inventory for all samples</li>
                <li>Once shipped, you'll receive tracking information</li>
                <li>Monitor progress in "My Shipments" section</li>
              </ol>
            </div>

            <div className="shipment-request-button-group">
              <button onClick={() => navigate('/manufacturer/my-shipments')} className="shipment-request-create-another">
                View All Shipments
              </button>
              <button onClick={handleCreateAnother} className="shipment-request-create-another">
                Create Another Request
              </button>
              <button onClick={handleGoBack} className="shipment-request-back-dashboard">
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        <footer className="shipment-request-footer">
          <div className="footer-content">
            <span className="footer-text">© 2026 T-Link Sample Management System</span>
            <img src="/images/tlink-official-logo.png" alt="T-Link Logo" className="footer-logo" />
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="shipment-request-portal">
      {/* Header */}
      <div className="shipment-request-header">
        <button onClick={handleGoBack} className="shipment-request-back-button">
          ← Back to Dashboard
        </button>
        <div className="shipment-request-header-text">
          <h1 className="shipment-request-title">Create Shipment Request</h1>
          <p className="shipment-request-subtitle">Add up to 10 samples per shipment</p>
        </div>
      </div>

      {/* Form Section */}
      <div className="shipment-request-content">
        <div className="shipment-request-form-section">
          <form onSubmit={handleSubmit} className="shipment-request-form">
            {/* Personal Information */}
            <fieldset className="shipment-request-fieldset">
              <legend className="shipment-request-legend">Recipient Information</legend>

              <div className="shipment-request-form-row">
                <div className="shipment-request-form-group">
                  <label htmlFor="first_name" className="shipment-request-label">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className={`shipment-request-input ${errors.first_name ? 'error' : ''}`}
                    placeholder="John"
                  />
                  {errors.first_name && <span className="shipment-request-error">{errors.first_name}</span>}
                </div>

                <div className="shipment-request-form-group">
                  <label htmlFor="last_name" className="shipment-request-label">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className={`shipment-request-input ${errors.last_name ? 'error' : ''}`}
                    placeholder="Doe"
                  />
                  {errors.last_name && <span className="shipment-request-error">{errors.last_name}</span>}
                </div>
              </div>

              <div className="shipment-request-form-row">
                <div className="shipment-request-form-group">
                  <label htmlFor="recipient_company" className="shipment-request-label">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="recipient_company"
                    name="recipient_company"
                    value={formData.recipient_company}
                    onChange={handleChange}
                    className="shipment-request-input"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div className="shipment-request-form-group">
                  <label htmlFor="recipient_phone" className="shipment-request-label">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="recipient_phone"
                    name="recipient_phone"
                    value={formData.recipient_phone}
                    onChange={handleChange}
                    className={`shipment-request-input ${errors.recipient_phone ? 'error' : ''}`}
                    placeholder="(555) 123-4567"
                  />
                  {errors.recipient_phone && <span className="shipment-request-error">{errors.recipient_phone}</span>}
                </div>
              </div>
            </fieldset>

            {/* Delivery Address */}
            <fieldset className="shipment-request-fieldset">
              <legend className="shipment-request-legend">Delivery Address</legend>

              <div className="shipment-request-form-group">
                <label htmlFor="street_address" className="shipment-request-label">
                  Street Address *
                </label>
                <input
                  type="text"
                  id="street_address"
                  name="street_address"
                  value={formData.street_address}
                  onChange={handleChange}
                  className={`shipment-request-input ${errors.street_address ? 'error' : ''}`}
                  placeholder="123 Business Street, Suite 100"
                />
                {errors.street_address && <span className="shipment-request-error">{errors.street_address}</span>}
              </div>

              <div className="shipment-request-form-row">
                <div className="shipment-request-form-group">
                  <label htmlFor="city" className="shipment-request-label">
                    City *
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={`shipment-request-input ${errors.city ? 'error' : ''}`}
                    placeholder="Indianapolis"
                  />
                  {errors.city && <span className="shipment-request-error">{errors.city}</span>}
                </div>

                <div className="shipment-request-form-group">
                  <label htmlFor="state" className="shipment-request-label">
                    State/Province *
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className={`shipment-request-input ${errors.state ? 'error' : ''}`}
                    placeholder="IN"
                  />
                  {errors.state && <span className="shipment-request-error">{errors.state}</span>}
                </div>
              </div>

              <div className="shipment-request-form-row">
                <div className="shipment-request-form-group">
                  <label htmlFor="zip_code" className="shipment-request-label">
                    ZIP/Postal Code *
                  </label>
                  <input
                    type="text"
                    id="zip_code"
                    name="zip_code"
                    value={formData.zip_code}
                    onChange={handleChange}
                    className={`shipment-request-input ${errors.zip_code ? 'error' : ''}`}
                    placeholder="46240"
                  />
                  {errors.zip_code && <span className="shipment-request-error">{errors.zip_code}</span>}
                </div>

                <div className="shipment-request-form-group">
                  <label htmlFor="country" className="shipment-request-label">
                    Country
                  </label>
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="shipment-request-select"
                  >
                    <option value="USA">United States</option>
                    <option value="CAN">Canada</option>
                    <option value="MEX">Mexico</option>
                  </select>
                </div>
              </div>

              <div className="shipment-request-form-group">
                <label className="shipment-request-checkbox-label">
                  <input
                    type="checkbox"
                    name="is_international"
                    checked={formData.is_international}
                    onChange={handleChange}
                    className="shipment-request-checkbox"
                  />
                  This is an international shipment (outside USA)
                </label>
              </div>
            </fieldset>

            {/* Shipping Details */}
            <fieldset className="shipment-request-fieldset">
              <legend className="shipment-request-legend">Shipping Details</legend>

              <div className="shipment-request-form-row">
                <div className="shipment-request-form-group">
                  <label htmlFor="emergency_contact_phone" className="shipment-request-label">
                    Emergency Contact Phone * (24-hour)
                  </label>
                  <input
                    type="tel"
                    id="emergency_contact_phone"
                    name="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={handleChange}
                    className={`shipment-request-input ${errors.emergency_contact_phone ? 'error' : ''}`}
                    placeholder="(800) 555-1234"
                  />
                  {errors.emergency_contact_phone && <span className="shipment-request-error">{errors.emergency_contact_phone}</span>}
                  <p className="shipment-request-hint">Required for hazmat shipments - must be 24/7 available</p>
                </div>

                <div className="shipment-request-form-group">
                  <label htmlFor="scheduled_ship_date" className="shipment-request-label">
                    Scheduled Ship Date (Optional)
                  </label>
                  <input
                    type="date"
                    id="scheduled_ship_date"
                    name="scheduled_ship_date"
                    value={formData.scheduled_ship_date}
                    onChange={handleChange}
                    className="shipment-request-input"
                  />
                  <p className="shipment-request-hint">Leave empty for ASAP processing</p>
                </div>
              </div>

              <div className="shipment-request-form-group">
                <label htmlFor="special_instructions" className="shipment-request-label">
                  Special Instructions
                </label>
                <textarea
                  id="special_instructions"
                  name="special_instructions"
                  value={formData.special_instructions}
                  onChange={handleChange}
                  className="shipment-request-textarea"
                  placeholder="Any special handling instructions, delivery requirements, etc."
                  rows={3}
                />
              </div>
            </fieldset>

            {/* Samples Section */}
            <fieldset className="shipment-request-fieldset">
              <legend className="shipment-request-legend">
                Samples ({samples.length} of 10)
              </legend>

              {availableSamples.length > 0 && (
                <div className="shipment-request-info-box shipment-request-sample-tip">
                  <p>
                    💡 Tip: Select from available samples below to auto-populate hazmat information
                  </p>
                </div>
              )}

              {samples.map((sample, index) => (
                <div key={index} className="shipment-request-sample-card">
                  <div className="shipment-request-sample-header">
                    <h4 className="shipment-request-sample-number">Sample {index + 1}</h4>
                    {samples.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSample(index)}
                        className="shipment-request-remove-sample"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  {/* Quick Select from Available Samples */}
                  {availableSamples.length > 0 && (
                    <div className="shipment-request-form-group">
                      <label htmlFor={`sample_select_${index}`} className="shipment-request-label">
                        Quick Select Sample
                      </label>
                      <select
                        id={`sample_select_${index}`}
                        onChange={(e) => handleSampleSelect(index, e.target.value)}
                        className="shipment-request-select"
                        value=""
                        aria-label={`Select sample ${index + 1} from inventory`}
                      >
                        <option value="">-- Select from available samples --</option>
                        {availableSamples.map((s) => (
                          <option key={s.id} value={s.id.toString()}>
                            {s.chemical_name} - Lot: {s.lot_number} {s.un_number ? `(${s.un_number})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="shipment-request-form-row">
                    <div className="shipment-request-form-group">
                      <label htmlFor={`sample_name_${index}`} className="shipment-request-label">
                        Sample Name *
                      </label>
                      <input
                        type="text"
                        id={`sample_name_${index}`}
                        value={sample.sample_name}
                        onChange={(e) => handleSampleChange(index, 'sample_name', e.target.value)}
                        className={`shipment-request-input ${errors[`sample_${index}_sample_name`] ? 'error' : ''}`}
                        placeholder="Sample XYZ"
                      />
                      {errors[`sample_${index}_sample_name`] && (
                        <span className="shipment-request-error">{errors[`sample_${index}_sample_name`]}</span>
                      )}
                    </div>

                    <div className="shipment-request-form-group">
                      <label htmlFor={`lot_number_${index}`} className="shipment-request-label">
                        Lot Number *
                      </label>
                      <input
                        type="text"
                        id={`lot_number_${index}`}
                        value={sample.lot_number}
                        onChange={(e) => handleSampleChange(index, 'lot_number', e.target.value)}
                        className={`shipment-request-input ${errors[`sample_${index}_lot_number`] ? 'error' : ''}`}
                        placeholder="LOT-2026-001"
                      />
                      {errors[`sample_${index}_lot_number`] && (
                        <span className="shipment-request-error">{errors[`sample_${index}_lot_number`]}</span>
                      )}
                    </div>
                  </div>

                  <div className="shipment-request-quantity-row">
                    <div className="shipment-request-form-group">
                      <label htmlFor={`quantity_${index}`} className="shipment-request-label">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        id={`quantity_${index}`}
                        value={sample.quantity_requested}
                        onChange={(e) => handleSampleChange(index, 'quantity_requested', e.target.value)}
                        step="0.1"
                        className={`shipment-request-input ${errors[`sample_${index}_quantity_requested`] ? 'error' : ''}`}
                        placeholder="50"
                      />
                      {errors[`sample_${index}_quantity_requested`] && (
                        <span className="shipment-request-error">{errors[`sample_${index}_quantity_requested`]}</span>
                      )}
                    </div>

                    <div className="shipment-request-form-group">
                      <label htmlFor={`unit_${index}`} className="shipment-request-label">
                        Unit
                      </label>
                      <select
                        id={`unit_${index}`}
                        value={sample.quantity_unit}
                        onChange={(e) => handleSampleChange(index, 'quantity_unit', e.target.value)}
                        className="shipment-request-select"
                      >
                        <option value="ml">ml (milliliters)</option>
                        <option value="L">L (liters)</option>
                        <option value="mg">mg (milligrams)</option>
                        <option value="g">g (grams)</option>
                        <option value="oz">oz (ounces)</option>
                        <option value="lb">lb (pounds)</option>
                      </select>
                    </div>
                  </div>

                  {/* Hazmat Information Display */}
                  {sample.un_number && (
                    <div className="shipment-request-hazmat-info">
                      <h5>
                        ⚠️ Hazmat Information (Auto-populated)
                      </h5>
                      <div className="shipment-request-hazmat-grid">
                        <div><strong>UN Number:</strong> {sample.un_number}</div>
                        <div><strong>Hazard Class:</strong> {sample.hazard_class || 'N/A'}</div>
                        <div><strong>Packing Group:</strong> {sample.packing_group || 'N/A'}</div>
                        <div className="full-width">
                          <strong>Proper Shipping Name:</strong> {sample.proper_shipping_name || 'N/A'}
                        </div>
                        {sample.hazard_description && (
                          <div className="full-width">
                            <strong>Description:</strong> {sample.hazard_description}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {samples.length < 10 && (
                <button
                  type="button"
                  onClick={addSample}
                  className="shipment-request-add-sample"
                  disabled={samples.length >= 10}
                >
                  + Add Another Sample
                </button>
              )}
            </fieldset>

            {/* Hazmat Warning */}
            {isHazmat && (
              <div className="shipment-request-info-box shipment-request-hazmat-warning">
                <h4 className="shipment-request-info-title">⚠️ Hazmat Notice</h4>
                <p className="shipment-request-info-list">
                  Total shipment quantity of {totalQuantity} ml or more may require additional dangerous goods (DG) documentation and special handling.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" className="shipment-request-submit" disabled={loading}>
              {loading ? 'Creating Request...' : `Create Shipment Request (${samples.length} sample${samples.length !== 1 ? 's' : ''})`}
            </button>
          </form>
        </div>
      </div>

      <footer className="shipment-request-footer">
        <div className="footer-content">
          <span className="footer-text">© 2026 T-Link Sample Management System</span>
          <img src="/images/tlink-official-logo.png" alt="T-Link Logo" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
};

export default ShipmentRequest;

