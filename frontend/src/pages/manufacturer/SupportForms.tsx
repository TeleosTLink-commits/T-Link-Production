import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './SupportForms.css';

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
      icon: 'Tech',
      color: '#007bff',
    },
    lab: {
      name: 'Lab Support',
      email: 'eboak@ajwalabs.com',
      description: 'Sample preparation, testing procedures, and lab documentation',
      icon: '',
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
      // Determine endpoint based on user role
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const isManufacturer = user.role === 'manufacturer';
      const baseEndpoint = isManufacturer ? '/manufacturer' : '/internal';
      
      const endpoint =
        selectedType === 'tech'
          ? `${baseEndpoint}/support/tech-support`
          : `${baseEndpoint}/support/lab-support`;

      const response = await api.post(endpoint, {
        subject: formData.subject,
        message: formData.message,
      });

      setSubmittedData({
        ...response.data,
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
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const dashboardPath = user.role === 'manufacturer' ? '/manufacturer/dashboard' : '/dashboard';
    navigate(dashboardPath);
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
      <div className="support-forms-portal">
        <div className="support-content">
          <div className="success-card">
            <div className="success-icon">✓</div>
            <h1 className="success-title">Support Request Submitted!</h1>
            <p className="success-message">
              Your {info.name.toLowerCase()} request has been received and forwarded to our team.
            </p>

            <div className="summary-box">
              <h3 className="summary-title">Request Details</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Request ID:</span>
                  <span className="summary-value">{submittedData.id}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Type:</span>
                  <span className="summary-value">{info.name}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Subject:</span>
                  <span className="summary-value">{submittedData.subject}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Assigned To:</span>
                  <span className="summary-value">{info.email}</span>
                </div>
                <div className="summary-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="summary-label">Your Message:</span>
                  <span className="summary-value" style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }}>
                    {submittedData.message}
                  </span>
                </div>
              </div>
            </div>

            <div className="info-box">
              <h4 className="info-title">What happens next?</h4>
              <ol className="info-list">
                <li>Your request has been assigned to {info.email}</li>
                <li>You can expect a response within 24-48 business hours</li>
                <li>Further communication will be via email</li>
                <li>Reference your request ID when following up</li>
              </ol>
            </div>

            <div className="button-group">
              <button onClick={handleCreateAnother} className="create-another-button">
                Submit Another Request
              </button>
              <button onClick={handleGoBack} className="back-dashboard-button">
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        <footer className="support-footer">
          <div className="footer-content">
            <span className="footer-text">Developed and operated by</span>
            <img src="/images/AAL_Dig_Dev.png" alt="AAL Digital Development" className="footer-logo" />
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="support-forms-portal">
      {/* Header */}
      <div className="support-header">
        <button onClick={handleGoBack} className="support-back-button">
          ← Back to Dashboard
        </button>
        <h1 className="support-title">Support Request</h1>
      </div>

      <div className="support-content">{/* Support Type Selection */}
        {!selectedType ? (
          <div className="type-selection-container">
            <p className="type-selection-intro">Select the type of support you need:</p>

            <div className="type-grid">
              {(['tech', 'lab'] as const).map((type) => {
                const info = contactInfo[type];
                return (
                  <button
                    key={type}
                    onClick={() => handleSelectType(type)}
                    className={`type-card ${type}`}
                  >
                    <h3 className="type-card-title">{info.name}</h3>
                    <p className="type-card-description">{info.description}</p>
                    <span className="type-card-cta">Click to start →</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="form-section">
            <div className="form-header">
              <button onClick={() => setSelectedType(null)} className="change-type-button">
                ← Change Type
              </button>
              <h2 className="form-title">
                {selectedType ? contactInfo[selectedType].name : ''} Request Form
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Contact Info Box */}
              <div className="contact-box">
                <p className="contact-info">
                  <strong>This request will be sent to:</strong>
                </p>
                <p className="contact-email">
                  {selectedType ? contactInfo[selectedType].email : ''}
                </p>
                <p className="contact-subtext">
                  You'll receive a response via email within 24-48 business hours.
                </p>
              </div>

              {/* Form Fields */}
              <div className="form-group">
                <label htmlFor="subject" className="form-label">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className={`form-input ${errors.subject ? 'error' : ''}`}
                  placeholder="Brief description of your issue"
                  maxLength={100}
                />
                {errors.subject && <span className="form-error">{errors.subject}</span>}
                <span className="char-count">{formData.subject.length}/100</span>
              </div>

              <div className="form-group">
                <label htmlFor="message" className="form-label">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  className={`form-textarea ${errors.message ? 'error' : ''}`}
                  placeholder="Please provide detailed information about your request..."
                  maxLength={2000}
                />
                {errors.message && <span className="form-error">{errors.message}</span>}
                <span className="char-count">{formData.message.length}/2000</span>
              </div>

              {/* Important Notes */}
              <div className="notes-box">
                <p className="notes-title">Tips for faster response:</p>
                <ul className="notes-list">
                  <li>Provide specific details about your issue</li>
                  <li>Include any error messages you're seeing</li>
                  <li>Mention sample/lot numbers if relevant</li>
                  <li>Include your preferred contact method in the message</li>
                </ul>
              </div>

              {/* Submit Button */}
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? 'Sending Request...' : `Submit ${selectedType === 'tech' ? 'Technical' : 'Lab'} Support Request`}
              </button>
            </form>
          </div>
        )}
      </div>

      <footer className="support-footer">
        <div className="footer-content">
          <span className="footer-text">Developed and operated by</span>
          <img src="/images/AAL_Dig_Dev.png" alt="AAL Digital Development" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
};

export default SupportForms;
