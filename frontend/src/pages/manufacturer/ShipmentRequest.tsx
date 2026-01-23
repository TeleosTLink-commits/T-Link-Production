import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './ShipmentRequest.css';

interface Sample {
  sample_name: string;
  lot_number: string;
  quantity_requested: string;
  quantity_unit: string;
}

const ShipmentRequest: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    delivery_address: '',
    scheduled_ship_date: '',
  });
  const [samples, setSamples] = useState<Sample[]>([
    { sample_name: '', lot_number: '', quantity_requested: '', quantity_unit: 'ml' }
  ]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
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
    newSamples[index][field] = value;
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

  const addSample = () => {
    if (samples.length < 10) {
      setSamples([...samples, { sample_name: '', lot_number: '', quantity_requested: '', quantity_unit: 'ml' }]);
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
    if (!formData.delivery_address) newErrors.delivery_address = 'Delivery address is required';

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
      const response = await api.post('/manufacturer/shipments/request-multiple', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        delivery_address: formData.delivery_address,
        scheduled_ship_date: formData.scheduled_ship_date || undefined,
        samples: samples.map(s => ({
          sample_name: s.sample_name,
          lot_number: s.lot_number,
          quantity_requested: parseFloat(s.quantity_requested),
          quantity_unit: s.quantity_unit,
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
      delivery_address: '',
      scheduled_ship_date: '',
    });
    setSamples([{ sample_name: '', lot_number: '', quantity_requested: '', quantity_unit: 'ml' }]);
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
                  <span className="shipment-request-summary-value" style={{ color: '#007bff' }}>
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
                  <span className="shipment-request-summary-value" style={{ color: submittedData.is_hazmat ? '#dc3545' : '#28a745' }}>
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
              <legend className="shipment-request-legend">Personal Information</legend>

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

              <div className="shipment-request-form-group">
                <label htmlFor="delivery_address" className="shipment-request-label">
                  Delivery Address *
                </label>
                <textarea
                  id="delivery_address"
                  name="delivery_address"
                  value={formData.delivery_address}
                  onChange={handleChange}
                  className={`shipment-request-textarea ${errors.delivery_address ? 'error' : ''}`}
                  placeholder="123 Business Street, City, State 12345"
                />
                {errors.delivery_address && <span className="shipment-request-error">{errors.delivery_address}</span>}
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
            </fieldset>

            {/* Samples Section */}
            <fieldset className="shipment-request-fieldset">
              <legend className="shipment-request-legend">
                Samples ({samples.length} of 10)
              </legend>

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
              <div className="shipment-request-info-box" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
                <h4 className="shipment-request-info-title" style={{ color: '#856404' }}>⚠️ Hazmat Notice</h4>
                <p className="shipment-request-info-list" style={{ color: '#856404', padding: 0 }}>
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

