import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

const ShipmentRequest: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    delivery_address: '',
    sample_name: '',
    lot_number: '',
    quantity_requested: '',
    quantity_unit: 'ml',
    scheduled_ship_date: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';
    if (!formData.delivery_address) newErrors.delivery_address = 'Delivery address is required';
    if (!formData.sample_name) newErrors.sample_name = 'Sample name is required';
    if (!formData.lot_number) newErrors.lot_number = 'Lot number is required';
    if (!formData.quantity_requested) newErrors.quantity_requested = 'Quantity is required';
    else if (isNaN(parseFloat(formData.quantity_requested))) newErrors.quantity_requested = 'Must be a valid number';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await api.post('/manufacturer/shipments/request', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        delivery_address: formData.delivery_address,
        sample_name: formData.sample_name,
        lot_number: formData.lot_number,
        quantity_requested: parseFloat(formData.quantity_requested),
        quantity_unit: formData.quantity_unit,
        scheduled_ship_date: formData.scheduled_ship_date || undefined,
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
      sample_name: '',
      lot_number: '',
      quantity_requested: '',
      quantity_unit: 'ml',
      scheduled_ship_date: '',
    });
    setErrors({});
  };

  if (submitted && submittedData) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✅</div>
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
                <span style={styles.summaryLabel}>Lot Number:</span>
                <span style={styles.summaryValue}>{submittedData.lot_number}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Quantity:</span>
                <span style={styles.summaryValue}>
                  {submittedData.quantity_requested} {submittedData.unit}
                </span>
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
              <li>We'll prepare your shipment and verify inventory</li>
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
          ← Back
        </button>
        <h1 style={styles.title}>Create Shipment Request</h1>
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
          </fieldset>

          {/* Sample Information */}
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Sample Information</legend>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label htmlFor="sample_name" style={styles.label}>
                  Sample Name *
                </label>
                <input
                  type="text"
                  id="sample_name"
                  name="sample_name"
                  value={formData.sample_name}
                  onChange={handleChange}
                  style={{ ...styles.input, borderColor: errors.sample_name ? '#dc3545' : '#ccc' }}
                  placeholder="Sample XYZ"
                />
                {errors.sample_name && <span style={styles.error}>{errors.sample_name}</span>}
              </div>

              <div style={styles.formGroup}>
                <label htmlFor="lot_number" style={styles.label}>
                  Lot Number *
                </label>
                <input
                  type="text"
                  id="lot_number"
                  name="lot_number"
                  value={formData.lot_number}
                  onChange={handleChange}
                  style={{ ...styles.input, borderColor: errors.lot_number ? '#dc3545' : '#ccc' }}
                  placeholder="LOT-2026-001"
                />
                {errors.lot_number && <span style={styles.error}>{errors.lot_number}</span>}
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label htmlFor="quantity_requested" style={styles.label}>
                  Quantity Requested *
                </label>
                <input
                  type="number"
                  id="quantity_requested"
                  name="quantity_requested"
                  value={formData.quantity_requested}
                  onChange={handleChange}
                  step="0.1"
                  style={{ ...styles.input, borderColor: errors.quantity_requested ? '#dc3545' : '#ccc' }}
                  placeholder="50"
                />
                {errors.quantity_requested && <span style={styles.error}>{errors.quantity_requested}</span>}
              </div>

              <div style={styles.formGroup}>
                <label htmlFor="quantity_unit" style={styles.label}>
                  Unit
                </label>
                <select
                  id="quantity_unit"
                  name="quantity_unit"
                  value={formData.quantity_unit}
                  onChange={handleChange}
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

          {/* Hazmat Warning */}
          {formData.quantity_requested && parseFloat(formData.quantity_requested) >= 30 && (
            <div style={styles.warningBox}>
              <span style={styles.warningIcon}>⚠️</span>
              <div>
                <p style={styles.warningTitle}>Hazmat Notice</p>
                <p style={styles.warningText}>
                  Quantities of 30{formData.quantity_unit || 'ml'} or more may require additional dangerous goods (DG) documentation and special handling.
                </p>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button type="submit" style={styles.submitButton} disabled={loading}>
            {loading ? 'Creating Request...' : 'Create Shipment Request'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '800px',
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
    margin: 0,
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
  // Success styles
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
