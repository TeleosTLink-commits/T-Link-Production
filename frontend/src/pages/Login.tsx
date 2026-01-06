import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', formData);
      
      if (response.data.success) {
        // Store token and user info
        localStorage.setItem('auth_token', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        
        // Redirect to dashboard
        navigate('/dashboard');
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>T-Link</h1>
          <p>Telios Logistics & Information Network</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoFocus
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-footer">
          <p>Don't have an account? <Link to="/register" style={{ color: '#007bff', textDecoration: 'none' }}>Create Account</Link></p>
          <p style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
            Note: Only authorized email addresses can register
          </p>

        </div>
      </div>
    </div>
  );
};

export default Login;
