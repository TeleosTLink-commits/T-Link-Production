import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { useAuthStore } from '../store/authStore';

// Dashboard component - main internal user dashboard
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const storedUserStr = localStorage.getItem('user');
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
  const effectiveUser = user || storedUser;

  const handleLogout = () => {
    logout();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="dashboard-portal">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <img src="/images/tlink-official-logo.png" alt="T-Link" className="logo" />
          <div className="header-text">
            <h1>T-Link Dashboard</h1>
          </div>
        </div>
        <div className="header-right">
          <button className="contact-btn" onClick={() => navigate('/internal/support')}>
            Contact Support
          </button>
          <button className="sign-out-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content" aria-hidden>
        <div className="logo-spacer" />
      </div>

      <div className="actions-container">
        <div className="actions-grid">
          <button className="action-btn test-methods-btn" onClick={() => navigate('/test-methods')}>
            <span className="btn-label">Test Methods</span>
            <span className="btn-desc">Manage testing procedures</span>
          </button>

          <button className="action-btn inventory-btn" onClick={() => navigate('/inventory')}>
            <span className="btn-label">Sample Inventory</span>
            <span className="btn-desc">Track samples and CoAs</span>
          </button>

          <button className="action-btn shipments-btn" onClick={() => navigate('/shipments')}>
            <span className="btn-label">Shipment Logistics</span>
            <span className="btn-desc">Manage shipping operations</span>
          </button>

          {effectiveUser?.role === 'super_admin' && (
            <button className="action-btn admin-btn" onClick={() => navigate('/internal/admin')}>
              <span className="btn-label">Super Admin Panel</span>
              <span className="btn-desc">Platform management and control</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="footer-content">
          <span className="footer-text">Developed and operated by</span>
          <img src="/images/AAL_Dig_Dev.png" alt="AAL Digital Development" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
