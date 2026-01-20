import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

type SupportType = 'tech' | 'lab' | null;

interface SupportForm {
  supportType: SupportType;
  subject: string;
  message: string;
}

const SupportForms: React.FC = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<SupportType>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [formData, setFormData] = useState<SupportForm>({
    supportType: null,
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const contactInfo = {
    tech: {
      name: 'Technical Support',
      email: 'jhunzie@ajwalabs.com',
      description: 'Network, software, portal access, and technical issues',
      icon: '🖥️',
      color: '#007bff',
    },
    lab: {
      name: 'Lab Support',
      email: 'eboak@ajwalabs.com',
      description: 'Sample preparation, testing procedures, and lab documentation',
      icon: '🧪',
      color: '#28a745',
    },
  };

  const handleSelectType = (type: SupportType) => {
    setSelectedType(type);
    setFormData({
      ...formData,
      supportType: type,
    });
    setErrors({});
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.subject) newErrors.subject = 'Subject is required';
    if (!formData.message) newErrors.message = 'Message is required';
    else if (formData.message.length < 10) newErrors.message = 'Message must be at least 10 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedType) {
      toast.error('Please select a support type');
      return;
    }

    if (!validateForm()) return;

    setLoading(true);
    try {
      const endpoint =
        selectedType === 'tech'
          ? '/manufacturer/support/tech-support'
          : '/manufacturer/support/lab-support';

      const response = await api.post(endpoint, {
        subject: formData.subject,
        message: formData.message,
      });

      setSubmittedData({
        ...response.data.supportRequest,
        type: selectedType,
      });
      setSubmitted(true);
      toast.success('Support request submitted successfully!');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to submit support request';
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
    setSelectedType(null);
    setFormData({
      supportType: null,
      subject: '',
      message: '',
    });
    setErrors({});
  };

  if (submitted && submittedData) {
    const type: 'tech' | 'lab' = submittedData.type;
    const info = contactInfo[type];

    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✅</div>
          <h1 style={styles.successTitle}>Support Request Submitted!</h1>
          <p style={styles.successMessage}>
            Your {info.name.toLowerCase()} request has been received and forwarded to our team.
          </p>

          <div style={styles.summaryBox}>
            <h3 style={styles.summaryTitle}>Request Details</h3>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Request ID:</span>
                <span style={styles.summaryValue}>{submittedData.id}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Type:</span>
                <span style={styles.summaryValue}>{info.name}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Subject:</span>
                <span style={styles.summaryValue}>{submittedData.subject}</span>
              </div>
              <div style={styles.summaryItem}>
                <span style={styles.summaryLabel}>Assigned To:</span>
                <span style={styles.summaryValue}>{info.email}</span>
              </div>
              <div style={{ ...styles.summaryItem, gridColumn: '1 / -1' }}>
                <span style={styles.summaryLabel}>Your Message:</span>
                <span style={{ ...styles.summaryValue, whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                  {submittedData.message}
                </span>
              </div>
            </div>
          </div>

          <div style={styles.infoBox}>
            <h4 style={styles.infoTitle}>What happens next?</h4>
            <ol style={styles.infoList}>
              <li>Your request has been assigned to {info.email}</li>
              <li>You can expect a response within 24-48 business hours</li>
              <li>Further communication will be via email</li>
              <li>Reference your request ID when following up</li>
            </ol>
          </div>

          <div style={styles.buttonGroup}>
            <button onClick={handleCreateAnother} style={styles.createAnotherButton}>
              Submit Another Request
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
        <h1 style={styles.title}>Support Request</h1>
      </div>

      {/* Support Type Selection */}
      {!selectedType ? (
        <div style={styles.typeSelectionContainer}>
          <p style={styles.typeSelectionIntro}>Select the type of support you need:</p>

          <div style={styles.typeGrid}>
            {(['tech', 'lab'] as const).map((type) => {
              const info = contactInfo[type];
              return (
                <button
                  key={type}
                  onClick={() => handleSelectType(type)}
                  style={{
                    ...styles.typeCard,
                    borderColor: info.color,
                    borderWidth: '2px',
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>{info.icon}</div>
                  <h3 style={{ ...styles.typeCardTitle, color: info.color }}>{info.name}</h3>
                  <p style={styles.typeCardDescription}>{info.description}</p>
                  <span style={{ ...styles.typeCardCTA, color: info.color }}>Click to start →</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={styles.formSection}>
          <div style={styles.formHeader}>
            <button onClick={() => setSelectedType(null)} style={styles.changeTypeButton}>
              ← Change Type
            </button>
            <h2 style={styles.formTitle}>
              {selectedType ? contactInfo[selectedType].name : ''} Request Form
            </h2>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Contact Info Box */}
            <div style={styles.contactBox}>
              <p style={styles.contactInfo}>
                <strong>This request will be sent to:</strong>
              </p>
              <p style={styles.contactEmail}>
                {selectedType ? contactInfo[selectedType].email : ''}
              </p>
              <p style={styles.contactSubtext}>
                You'll receive a response via email within 24-48 business hours.
              </p>
            </div>

            {/* Form Fields */}
            <div style={styles.formGroup}>
              <label htmlFor="subject" style={styles.label}>
                Subject *
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                style={{ ...styles.input, borderColor: errors.subject ? '#dc3545' : '#ccc' }}
                placeholder="Brief description of your issue"
                maxLength={100}
              />
              {errors.subject && <span style={styles.error}>{errors.subject}</span>}
              <span style={styles.charCount}>{formData.subject.length}/100</span>
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="message" style={styles.label}>
                Message *
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                style={{ ...styles.input, ...styles.textarea, borderColor: errors.message ? '#dc3545' : '#ccc' }}
                placeholder="Please provide detailed information about your request..."
                maxLength={2000}
              />
              {errors.message && <span style={styles.error}>{errors.message}</span>}
              <span style={styles.charCount}>{formData.message.length}/2000</span>
            </div>

            {/* Important Notes */}
            <div style={styles.notesBox}>
              <p style={styles.notesTitle}>📝 Tips for faster response:</p>
              <ul style={styles.notesList}>
                <li>Provide specific details about your issue</li>
                <li>Include any error messages you're seeing</li>
                <li>Mention sample/lot numbers if relevant</li>
                <li>Include your preferred contact method in the message</li>
              </ul>
            </div>

            {/* Submit Button */}
            <button type="submit" style={styles.submitButton} disabled={loading}>
              {loading ? 'Sending Request...' : `Submit ${selectedType === 'tech' ? 'Technical' : 'Lab'} Support Request`}
            </button>
          </form>
        </div>
      )}
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
  typeSelectionContainer: {
    marginTop: '40px',
  },
  typeSelectionIntro: {
    fontSize: '16px',
    color: '#555',
    marginBottom: '30px',
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  typeCard: {
    padding: '30px',
    backgroundColor: 'white',
    border: '2px solid',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    transition: 'all 0.2s',
    textDecoration: 'none',
    color: 'inherit',
  },
  typeCardTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0 0 12px 0',
  },
  typeCardDescription: {
    fontSize: '14px',
    color: '#666',
    margin: '0 0 16px 0',
    lineHeight: '1.5',
  },
  typeCardCTA: {
    fontSize: '14px',
    fontWeight: 'bold',
  },
  formSection: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '30px',
    marginTop: '20px',
  },
  formHeader: {
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  changeTypeButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px 0',
    fontWeight: '500',
    minWidth: 'max-content',
  },
  formTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  contactBox: {
    backgroundColor: '#f0f6ff',
    border: '1px solid #b3d9ff',
    borderRadius: '4px',
    padding: '16px',
    marginBottom: '20px',
  },
  contactInfo: {
    fontSize: '13px',
    color: '#004085',
    margin: '0 0 8px 0',
  },
  contactEmail: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#004085',
    margin: '0 0 8px 0',
    backgroundColor: 'white',
    padding: '8px',
    borderRadius: '2px',
  },
  contactSubtext: {
    fontSize: '12px',
    color: '#004085',
    margin: 0,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
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
  textarea: {
    resize: 'vertical' as const,
    minHeight: '150px',
  },
  error: {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '2px',
  },
  charCount: {
    fontSize: '11px',
    color: '#999',
    textAlign: 'right' as const,
    marginTop: '2px',
  },
  notesBox: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    padding: '16px',
  },
  notesTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#856404',
    margin: '0 0 12px 0',
  },
  notesList: {
    fontSize: '13px',
    color: '#856404',
    margin: 0,
    paddingLeft: '20px',
    lineHeight: '1.6',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column' as const,
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

export default SupportForms;
