import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [emailAuthorized, setEmailAuthorized] = useState(false);
  const [authorizedRole, setAuthorizedRole] = useState('');

  const checkEmail = async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailChecked(false);
      return;
    }

    try {
      const response = await api.post('/auth/check-email', { email });
      setEmailChecked(true);
      setEmailAuthorized(response.data.data.authorized);
      setAuthorizedRole(response.data.data.role || '');
    } catch (err) {
      setEmailChecked(false);
    }
  };

  const handleEmailBlur = () => {
    checkEmail(formData.email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!emailAuthorized) {
      setError('This email is not authorized to register. Please contact your administrator.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name
      });

      if (response.data.success) {
        // Store token and user info
        localStorage.setItem('auth_token', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        
        // Show success and redirect
        alert(`Account created successfully! You've been assigned the role: ${response.data.data.user.role}`);
        navigate('/dashboard');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box" style={{ maxWidth: '500px' }}>
        <div className="collab-band">
          <div className="collab-title">A partnership between</div>
          <div className="collab-logos">
            <img src="/images/teleos-logo.png" alt="Teleos AG Solutions" className="collab-logo" />
            <span className="collab-separator">×</span>
            <div className="collab-subblock">
              <span className="collab-subtext">Built & maintained by</span>
              <img src="/images/ajwa-logo.png" alt="AJWA Analytical Laboratories" className="collab-logo small" />
            </div>
          </div>
        </div>
        <div className="login-header">
          <h1>T-Link</h1>
          <p>Create Your Account</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {emailChecked && !emailAuthorized && (
          <div className="error-message">
            ⚠️ This email is not authorized. Contact your administrator to get access.
          </div>
        )}

        {emailChecked && emailAuthorized && (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#d4edda', 
            border: '1px solid #c3e6cb', 
            borderRadius: '4px', 
            marginBottom: '15px',
            color: '#155724'
          }}>
            Email authorized! You'll be assigned role: <strong>{authorizedRole}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              onBlur={handleEmailBlur}
              required
              autoFocus
              placeholder="you@example.com"
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Only pre-authorized emails can register
            </small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label htmlFor="first_name">First Name *</label>
              <input
                type="text"
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
                placeholder="John"
              />
            </div>

            <div className="form-group">
              <label htmlFor="last_name">Last Name *</label>
              <input
                type="text"
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="At least 8 characters"
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              placeholder="Re-enter your password"
            />
          </div>

          <button type="submit" disabled={loading || !emailAuthorized} className="login-button">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#007bff', textDecoration: 'none' }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
