import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

interface DGDeclaration {
  un_number: string;
  proper_shipping_name: string;
  hazard_class: string;
  packing_group: string;
  technical_name: string;
  emergency_contact: string;
}

const HazmatWarning: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shipmentId = searchParams.get('shipmentId');

  const [dgFormData, setDgFormData] = useState<DGDeclaration>({
    un_number: '',
    proper_shipping_name: '',
    hazard_class: '',
    packing_group: 'II',
    technical_name: '',
    emergency_contact: '',
  });

  const [labelsMarked, setLabelsMarked] = useState(false);
  const [declarationSubmitted, setDeclarationSubmitted] = useState(false);
  const [labelsPrinted, setLabelsPrinted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const hazardClasses = [
    '1 - Explosives',
    '2 - Gases',
    '3 - Flammable Liquids',
    '4 - Flammable Solids',
    '5 - Oxidizers',
    '6 - Toxic Substances',
    '7 - Radioactive',
    '8 - Corrosive',
    '9 - Miscellaneous',
  ];

  const packingGroups = ['I - HIGH', 'II - MEDIUM', 'III - LOW'];

  const commonUNNumbers = [
    { code: 'UN1170', name: 'Ethyl Alcohol Solution' },
    { code: 'UN1987', name: 'Alcohols, n.e.c.' },
    { code: 'UN1090', name: 'Acetone' },
    { code: 'UN1139', name: 'Coating Solution' },
    { code: 'UN2924', name: 'Flammable Liquid' },
  ];

  const handleDGChange = (field: keyof DGDeclaration, value: string) => {
    setDgFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validateDGForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!dgFormData.un_number) newErrors.un_number = 'UN Number is required';
    if (!dgFormData.proper_shipping_name) newErrors.proper_shipping_name = 'Proper Shipping Name is required';
    if (!dgFormData.hazard_class) newErrors.hazard_class = 'Hazard Class is required';
    if (!dgFormData.packing_group) newErrors.packing_group = 'Packing Group is required';
    if (!dgFormData.emergency_contact) newErrors.emergency_contact = 'Emergency Contact is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitDGDeclaration = async () => {
    if (!shipmentId) {
      toast.error('Shipment ID not found');
      return;
    }

    if (!validateDGForm()) return;

    setLoading(true);
    try {
      await api.post(`/processing/shipments/${shipmentId}/flag-hazmat`, {
        un_number: dgFormData.un_number,
        proper_shipping_name: dgFormData.proper_shipping_name,
        hazard_class: dgFormData.hazard_class,
        packing_group: dgFormData.packing_group,
        technical_name: dgFormData.technical_name || undefined,
        emergency_contact: dgFormData.emergency_contact,
      });

      setDeclarationSubmitted(true);
      toast.success('DG Declaration submitted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit DG declaration');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintWarningLabels = async () => {
    if (!shipmentId) {
      toast.error('Shipment ID not found');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/processing/shipments/${shipmentId}/print-warning-labels`, {});
      toast.success('Warning labels marked as printed');
      setLabelsPrinted(true);

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/internal/processing-dashboard');
      }, 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to record label printing');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/internal/processing-dashboard');
  };

  if (labelsPrinted) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}></div>
          <h1 style={styles.successTitle}>Hazmat Processing Complete!</h1>
          <p style={styles.successMessage}>
            All dangerous goods documentation and warning labels have been recorded.
          </p>

          <div style={styles.checklistBox}>
            <h3 style={styles.checklistTitle}>Completed Tasks</h3>
            <div style={styles.checklist}>
              <div style={styles.checklistItem}>
                <span style={styles.checkmark}>✓</span>
                <span>DG Declaration submitted</span>
              </div>
              <div style={styles.checklistItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Hazmat warning labels printed</span>
              </div>
              <div style={styles.checklistItem}>
                <span style={styles.checkmark}>✓</span>
                <span>Emergency contact information recorded</span>
              </div>
            </div>
          </div>

          <p style={styles.redirectText}>Returning to Processing Dashboard...</p>
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
        <h1 style={styles.title}>Hazmat Documentation</h1>
        <p style={styles.subtitle}>Complete dangerous goods (DG) paperwork for this shipment</p>
      </div>

      {/* Warning Banner */}
      <div style={styles.warningBanner}>
        <span style={styles.warningIcon}>⚠️</span>
        <div>
          <p style={styles.warningTitle}>Dangerous Goods Alert</p>
          <p style={styles.warningText}>
            This shipment contains hazardous materials and requires complete dangerous goods documentation before
            shipment. All fields below must be completed accurately.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Step 1: DG Declaration */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>
              Step 1: Dangerous Goods Declaration
            </h2>
            {declarationSubmitted && (
              <span style={styles.completeBadge}>✓ Completed</span>
            )}
          </div>

          {!declarationSubmitted ? (
            <form style={styles.form}>
              {/* UN Number */}
              <div style={styles.formGroup}>
                <label htmlFor="un_number" style={styles.label}>
                  UN Number *
                </label>
                <input
                  type="text"
                  id="un_number"
                  value={dgFormData.un_number}
                  onChange={(e) => handleDGChange('un_number', e.target.value)}
                  placeholder="e.g., UN1170"
                  style={{ ...styles.input, borderColor: errors.un_number ? '#dc3545' : '#ccc' }}
                  pattern="^UN\d{4}$"
                />
                {errors.un_number && <span style={styles.error}>{errors.un_number}</span>}
                <div style={styles.suggestionsBox}>
                  <p style={styles.suggestionsLabel}>Common UN Numbers:</p>
                  <div style={styles.suggestions}>
                    {commonUNNumbers.map((un) => (
                      <button
                        key={un.code}
                        type="button"
                        onClick={() => handleDGChange('un_number', un.code)}
                        style={styles.suggestionBtn}
                      >
                        {un.code} - {un.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Proper Shipping Name */}
              <div style={styles.formGroup}>
                <label htmlFor="proper_shipping_name" style={styles.label}>
                  Proper Shipping Name *
                </label>
                <input
                  type="text"
                  id="proper_shipping_name"
                  value={dgFormData.proper_shipping_name}
                  onChange={(e) => handleDGChange('proper_shipping_name', e.target.value)}
                  placeholder="Official DG shipping name"
                  style={{ ...styles.input, borderColor: errors.proper_shipping_name ? '#dc3545' : '#ccc' }}
                />
                {errors.proper_shipping_name && <span style={styles.error}>{errors.proper_shipping_name}</span>}
              </div>

              {/* Hazard Class & Packing Group Row */}
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label htmlFor="hazard_class" style={styles.label}>
                    Hazard Class *
                  </label>
                  <select
                    id="hazard_class"
                    value={dgFormData.hazard_class}
                    onChange={(e) => handleDGChange('hazard_class', e.target.value)}
                    style={{ ...styles.input, borderColor: errors.hazard_class ? '#dc3545' : '#ccc' }}
                  >
                    <option value="">Select Hazard Class</option>
                    {hazardClasses.map((hc) => (
                      <option key={hc} value={hc}>
                        {hc}
                      </option>
                    ))}
                  </select>
                  {errors.hazard_class && <span style={styles.error}>{errors.hazard_class}</span>}
                </div>

                <div style={styles.formGroup}>
                  <label htmlFor="packing_group" style={styles.label}>
                    Packing Group *
                  </label>
                  <select
                    id="packing_group"
                    value={dgFormData.packing_group}
                    onChange={(e) => handleDGChange('packing_group', e.target.value)}
                    style={styles.input}
                  >
                    {packingGroups.map((pg) => (
                      <option key={pg} value={pg}>
                        {pg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Technical Name */}
              <div style={styles.formGroup}>
                <label htmlFor="technical_name" style={styles.label}>
                  Technical Name (if applicable)
                </label>
                <input
                  type="text"
                  id="technical_name"
                  value={dgFormData.technical_name}
                  onChange={(e) => handleDGChange('technical_name', e.target.value)}
                  placeholder="Component name if different from shipping name"
                  style={styles.input}
                />
              </div>

              {/* Emergency Contact */}
              <div style={styles.formGroup}>
                <label htmlFor="emergency_contact" style={styles.label}>
                  Emergency Contact Phone Number *
                </label>
                <input
                  type="tel"
                  id="emergency_contact"
                  value={dgFormData.emergency_contact}
                  onChange={(e) => handleDGChange('emergency_contact', e.target.value)}
                  placeholder="+1 (555) 555-0000"
                  style={{ ...styles.input, borderColor: errors.emergency_contact ? '#dc3545' : '#ccc' }}
                />
                {errors.emergency_contact && <span style={styles.error}>{errors.emergency_contact}</span>}
                <p style={styles.hint}>24/7 emergency response contact number</p>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmitDGDeclaration}
                style={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Submitting...' : 'Submit DG Declaration'}
              </button>
            </form>
          ) : (
            <div style={styles.completedBox}>
              <p style={styles.completedText}>✓ Dangerous goods declaration has been recorded.</p>
            </div>
          )}
        </div>

        {/* Step 2: Print Warning Labels */}
        {declarationSubmitted && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>
                Step 2: Print & Mark Warning Labels
              </h2>
            </div>

            <div style={styles.labelGuide}>
              <p style={styles.labelGuideTitle}>Before proceeding, ensure:</p>
              <ul style={styles.labelGuideList}>
                <li>All hazmat warning labels have been physically affixed to the package</li>
                <li>Labels are clearly visible and not damaged</li>
                <li>Labels meet international DG shipping standards</li>
                <li>Package is properly sealed and ready for carrier pickup</li>
                <li>Documentation is complete and accurate</li>
              </ul>
            </div>

            <div style={styles.labelCheckbox}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={labelsMarked}
                  onChange={(e) => setLabelsMarked(e.target.checked)}
                  style={styles.checkbox}
                />
                <span>I confirm that all hazmat warning labels have been properly applied and are visible</span>
              </label>
            </div>

            <button
              onClick={handlePrintWarningLabels}
              style={{
                ...styles.printButton,
                opacity: labelsMarked && declarationSubmitted ? 1 : 0.5,
                cursor: labelsMarked && declarationSubmitted ? 'pointer' : 'not-allowed',
              }}
              disabled={!labelsMarked || !declarationSubmitted || loading}
            >
              {loading ? 'Recording...' : '🏷️ Mark Labels as Printed'}
            </button>
          </div>
        )}
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
    marginBottom: '24px',
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
    margin: '8px 0 0 0',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  warningIcon: {
    fontSize: '28px',
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
    lineHeight: '1.5',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  section: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  completeBadge: {
    backgroundColor: '#28a745',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 'bold',
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
  error: {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '2px',
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    margin: '4px 0 0 0',
    fontStyle: 'italic',
  },
  suggestionsBox: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f0f6ff',
    border: '1px solid #b3d9ff',
    borderRadius: '2px',
  },
  suggestionsLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#004085',
    margin: '0 0 6px 0',
  },
  suggestions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  suggestionBtn: {
    padding: '6px 8px',
    backgroundColor: 'white',
    border: '1px solid #b3d9ff',
    borderRadius: '2px',
    fontSize: '12px',
    color: '#004085',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  submitButton: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  completedBox: {
    backgroundColor: '#d4edda',
    border: '1px solid #28a745',
    borderRadius: '4px',
    padding: '12px',
  },
  completedText: {
    fontSize: '14px',
    color: '#155724',
    margin: 0,
    fontWeight: 'bold',
  },
  labelGuide: {
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    borderRadius: '4px',
    padding: '16px',
    marginBottom: '16px',
  },
  labelGuideTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#004085',
    margin: '0 0 8px 0',
  },
  labelGuideList: {
    fontSize: '13px',
    color: '#004085',
    margin: 0,
    paddingLeft: '20px',
    lineHeight: '1.6',
  },
  labelCheckbox: {
    marginBottom: '16px',
  },
  checkboxLabel: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    fontSize: '14px',
    color: '#333',
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },
  printButton: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '100%',
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
  checklistBox: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'left' as const,
  },
  checklistTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px 0',
  },
  checklist: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  checklistItem: {
    display: 'flex',
    gap: '8px',
    fontSize: '14px',
    color: '#333',
  },
  checkmark: {
    color: '#28a745',
    fontWeight: 'bold',
    minWidth: '24px',
  },
  redirectText: {
    fontSize: '14px',
    color: '#666',
    fontStyle: 'italic',
    margin: 0,
  },
};

export default HazmatWarning;
