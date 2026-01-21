import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

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
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>Success</div>
          <h1 style={styles.successTitle}>Shipment Request Submitted!</h1>
          <p style={styles.successMessage}>Your shipment request has been created and a confirmation email has been sent.</p>

          <div style={styles.summaryBox}>
            <h3 style={styles.summaryTitle}>Request Summary</h3>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Request ID:</span>
                <span style={styles.summaryValue}>{submittedData.id}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Status:</span>
                <span style={{ ...styles.summaryValue, color: '#007bff' }}>
                  {submittedData.status.charAt(0).toUpperCase() + submittedData.status.slice(1)}
                </span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Samples:</span>
                <span style={styles.summaryValue}>{submittedData.samples?.length || 1} sample(s)</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Total Quantity:</span>
                <span style={styles.summaryValue}>{submittedData.total_quantity} {submittedData.unit}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Delivery Address:</span>
                <span style={styles.summaryValue}>{submittedData.delivery_address}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Hazmat:</span>
                <span style={{ ...styles.summaryValue, color: submittedData.is_hazmat ? '#dc3545' : '#28a745' }}>
                  {submittedData.is_hazmat ? 'Yes - DG Documentation Required' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <div style={styles.infoBox}>
            <h4 style={styles.infoTitle}>What happens next?</h4>
            <ol style={styles.infoList}>
              <li>Your request will be reviewed by our lab team</li>
              <li>We'll prepare your shipment and verify inventory for all samples</li>
              <li>Once shipped, you'll receive tracking information</li>
              <li>Monitor progress in "My Shipments" section</li>
            </ol>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={() => navigate('/manufacturer/my-shipments')} style={styles.viewButton}>
              View All Shipments
            </button>
            <button onClick={handleCreateAnother} style={styles.createAnotherButton}>
              Create Another Request
            </button>
            <button onClick={handleGoBack} style={styles.backDashboardButton}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={handleGoBack} style={styles.backButton}>
          Back to Dashboard
        </button>
        <h1 style={styles.title}>Create Shipment Request</h1>
        <p style={styles.subtitle}>Add up to 10 samples per shipment</p>
      </div>

      {/* Form Section */}
      <div style={styles.formSection}>
        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Personal Information */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Personal Information</legend>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label htmlFor="first_name" style={styles.label}>
                  First Name *
                </label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  style={{ ...styles.input, borderColor: errors.first_name ? '#dc3545' : '#ccc' }}
                  placeholder="John"
                />
                {errors.first_name && <span style={styles.error}>{errors.first_name}</span>}
              </div>

              <div style={styles.formGroup}>
                <label htmlFor="last_name" style={styles.label}>
                  Last Name *
                </label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  style={{ ...styles.input, borderColor: errors.last_name ? '#dc3545' : '#ccc' }}
                  placeholder="Doe"
                />
                {errors.last_name && <span style={styles.error}>{errors.last_name}</span>}
              </div>
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="delivery_address" style={styles.label}>
                Delivery Address *
              </label>
              <textarea
                id="delivery_address"
                name="delivery_address"
                value={formData.delivery_address}
                onChange={handleChange}
                style={{ ...styles.input, ...styles.textarea, borderColor: errors.delivery_address ? '#dc3545' : '#ccc' }}
                placeholder="123 Business Street, City, State 12345"
              />
              {errors.delivery_address && <span style={styles.error}>{errors.delivery_address}</span>}
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="scheduled_ship_date" style={styles.label}>
                Scheduled Ship Date (Optional)
              </label>
              <input
                type="date"
                id="scheduled_ship_date"
                name="scheduled_ship_date"
                value={formData.scheduled_ship_date}
                onChange={handleChange}
                style={styles.input}
              />
              <p style={styles.hint}>Leave empty for ASAP processing</p>
            </div>
          </fieldset>

          {/* Samples Section */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>
              Samples ({samples.length} of 10)
            </legend>

            {samples.map((sample, index) => (
              <div key={index} style={styles.sampleCard}>
                <div style={styles.sampleHeader}>
                  <h4 style={styles.sampleTitle}>Sample {index + 1}</h4>
                  {samples.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSample(index)}
                      style={styles.removeButton}
                    >
                      âœ• Remove
                    </button>
                  )}
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label htmlFor={`sample_name_${index}`} style={styles.label}>
                      Sample Name *
                    </label>
                    <input
                      type="text"
                      id={`sample_name_${index}`}
                      value={sample.sample_name}
                      onChange={(e) => handleSampleChange(index, 'sample_name', e.target.value)}
                      style={{ ...styles.input, borderColor: errors[`sample_${index}_sample_name`] ? '#dc3545' : '#ccc' }}
                      placeholder="Sample XYZ"
                    />
                    {errors[`sample_${index}_sample_name`] && (
                      <span style={styles.error}>{errors[`sample_${index}_sample_name`]}</span>
                    )}
                  </div>

                  <div style={styles.formGroup}>
                    <label htmlFor={`lot_number_${index}`} style={styles.label}>
                      Lot Number *
                    </label>
                    <input
                      type="text"
                      id={`lot_number_${index}`}
                      value={sample.lot_number}
                      onChange={(e) => handleSampleChange(index, 'lot_number', e.target.value)}
                      style={{ ...styles.input, borderColor: errors[`sample_${index}_lot_number`] ? '#dc3545' : '#ccc' }}
                      placeholder="LOT-2026-001"
                    />
                    {errors[`sample_${index}_lot_number`] && (
                      <span style={styles.error}>{errors[`sample_${index}_lot_number`]}</span>
                    )}
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label htmlFor={`quantity_${index}`} style={styles.label}>
                      Quantity *
                    </label>
                    <input
                      type="number"
                      id={`quantity_${index}`}
                      value={sample.quantity_requested}
                      onChange={(e) => handleSampleChange(index, 'quantity_requested', e.target.value)}
                      step="0.1"
                      style={{ ...styles.input, borderColor: errors[`sample_${index}_quantity_requested`] ? '#dc3545' : '#ccc' }}
                      placeholder="50"
                    />
                    {errors[`sample_${index}_quantity_requested`] && (
                      <span style={styles.error}>{errors[`sample_${index}_quantity_requested`]}</span>
                    )}
                  </div>

                  <div style={styles.formGroup}>
                    <label htmlFor={`unit_${index}`} style={styles.label}>
                      Unit
                    </label>
                    <select
                      id={`unit_${index}`}
                      value={sample.quantity_unit}
                      onChange={(e) => handleSampleChange(index, 'quantity_unit', e.target.value)}
                      style={styles.input}
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
                style={styles.addSampleButton}
              >
                + Add Another Sample
              </button>
            )}
          </fieldset>

          {/* Hazmat Warning */}
          {isHazmat && (
            <div style={styles.warningBox}>
              <span style={styles.warningIcon}>Warning</span>
              <div>
                <p style={styles.warningTitle}>Hazmat Notice</p>
                <p style={styles.warningText}>
                  Total shipment quantity of {totalQuantity} ml or more may require additional dangerous goods (DG) documentation and special handling.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button type="submit" style={styles.submitButton} disabled={loading}>
            {loading ? 'Creating Request...' : `Create Shipment Request (${samples.length} sample${samples.length !== 1 ? 's' : ''})`}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '30px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px 0',
    marginBottom: '12px',
    fontWeight: '500',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: '4px 0 0 0',
    fontStyle: 'italic',
  },
  formSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '30px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  fieldset: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '20px',
    margin: 0,
  },
  legend: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    padding: '0 8px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#333',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontFamily: 'Arial, sans-serif',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    resize: 'vertical' as const,
    minHeight: '100px',
  },
  error: {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '2px',
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
    fontStyle: 'italic',
    margin: '4px 0 0 0',
  },
  sampleCard: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    padding: '16px',
    marginBottom: '16px',
  },
  sampleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  sampleTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  removeButton: {
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  addSampleButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 'bold',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '12px',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    padding: '16px',
    display: 'flex',
    gap: '12px',
  },
  warningIcon: {
    fontSize: '24px',
  },
  warningTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#856404',
    margin: '0 0 4px 0',
  },
  warningText: {
    fontSize: '13px',
    color: '#856404',
    margin: 0,
  },
  submitButton: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '16px',
  },
  successCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '40px',
    textAlign: 'center' as const,
  },
  successIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    display: 'block',
  },
  successTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#28a745',
    margin: '0 0 12px 0',
  },
  successMessage: {
    fontSize: '16px',
    color: '#666',
    margin: '0 0 30px 0',
    lineHeight: '1.6',
  },
  summaryBox: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    padding: '20px',
    marginBottom: '30px',
    textAlign: 'left' as const,
  },
  summaryTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 16px 0',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase' as const,
  },
  summaryValue: {
    fontSize: '14px',
    color: '#333',
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    borderRadius: '4px',
    padding: '20px',
    marginBottom: '30px',
    textAlign: 'left' as const,
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#004085',
    margin: '0 0 12px 0',
  },
  infoList: {
    fontSize: '14px',
    color: '#004085',
    margin: 0,
    paddingLeft: '20px',
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginTop: '20px',
  },
  viewButton: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  createAnotherButton: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  backDashboardButton: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default ShipmentRequest;

