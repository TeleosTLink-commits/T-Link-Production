import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

const ManufacturerSignUp: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    company_name: '',
    contact_phone: '',
    address: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';

    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';

    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';
    if (!formData.company_name) newErrors.company_name = 'Company name is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await api.post('/auth/manufacturer/signup', {
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        company_name: formData.company_name,
        contact_phone: formData.contact_phone || undefined,
        address: formData.address || undefined,
      });

      // Store token
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      toast.success('Account created successfully!');
      navigate('/manufacturer/dashboard');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to create account';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Manufacturer Portal</h1>
        <p style={styles.subtitle}>Create Your Account</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Name Fields */}
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

          {/* Company Info */}
          <div style={styles.formGroup}>
            <label htmlFor="company_name" style={styles.label}>
              Company Name *
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              style={{ ...styles.input, borderColor: errors.company_name ? '#dc3545' : '#ccc' }}
              placeholder="Your Company Inc."
            />
            {errors.company_name && <span style={styles.error}>{errors.company_name}</span>}
          </div>

          {/* Email */}
          <div style={styles.formGroup}>
            <label htmlFor="email" style={styles.label}>
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={{ ...styles.input, borderColor: errors.email ? '#dc3545' : '#ccc' }}
              placeholder="your@company.com"
            />
            {errors.email && <span style={styles.error}>{errors.email}</span>}
          </div>

          {/* Password Fields */}
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label htmlFor="password" style={styles.label}>
                Password *
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                style={{ ...styles.input, borderColor: errors.password ? '#dc3545' : '#ccc' }}
                placeholder="••••••••"
              />
              {errors.password && <span style={styles.error}>{errors.password}</span>}
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="confirmPassword" style={styles.label}>
                Confirm Password *
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                style={{ ...styles.input, borderColor: errors.confirmPassword ? '#dc3545' : '#ccc' }}
                placeholder="••••••••"
              />
              {errors.confirmPassword && <span style={styles.error}>{errors.confirmPassword}</span>}
            </div>
          </div>

          {/* Optional Contact Info */}
          <div style={styles.formGroup}>
            <label htmlFor="contact_phone" style={styles.label}>
              Contact Phone (Optional)
            </label>
            <input
              type="tel"
              id="contact_phone"
              name="contact_phone"
              value={formData.contact_phone}
              onChange={handleChange}
              style={styles.input}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div style={styles.formGroup}>
            <label htmlFor="address" style={styles.label}>
              Company Address (Optional)
            </label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              style={{ ...styles.input, resize: 'vertical', minHeight: '100px' }}
              placeholder="123 Business St, City, State 12345"
            />
          </div>

          {/* Submit Button */}
          <button type="submit" style={styles.submitButton} disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Login Link */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Already have an account?{' '}
            <Link to="/login" style={styles.link}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '20px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: '#333',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formRow: {
    display: 'flex',
    gap: '16px',
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
  error: {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '2px',
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
  footer: {
    marginTop: '24px',
    textAlign: 'center' as const,
    borderTop: '1px solid #eee',
    paddingTop: '16px',
  },
  footerText: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: 'bold',
  },
};

export default ManufacturerSignUp;
