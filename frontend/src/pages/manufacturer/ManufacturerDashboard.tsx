import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import HelpButton from '../../components/HelpButton';
import './ManufacturerDashboard.css';

const ManufacturerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="manufacturer-portal">
      {/* Header */}
      <header className="manufacturer-header">
        <div className="header-left">
          <img src="/images/tlink-official-logo.png" alt="T-Link" className="logo" />
          <div className="header-text">
            <h1>Manufacturer Portal</h1>
          </div>
        </div>
        <div className="header-right">
          <HelpButton userType="manufacturer" />
          <button className="sign-out-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content - background only */}
      <div className="manufacturer-content">
        <div className="logo-spacer" />
      </div>

      {/* Action Buttons - matching T-Link Dashboard style */}
      <div className="actions-container">
        <div className="actions-grid">
          <Link to="/manufacturer/coa-lookup" className="action-btn">
            <span className="btn-label">CoA Lookup</span>
            <span className="btn-desc">Search & download</span>
          </Link>
          <Link to="/manufacturer/inventory-search" className="action-btn">
            <span className="btn-label">Inventory Search</span>
            <span className="btn-desc">Check availability</span>
          </Link>
          <Link to="/manufacturer/shipment-request" className="action-btn">
            <span className="btn-label">Request Shipment</span>
            <span className="btn-desc">Create new request</span>
          </Link>
          <Link to="/manufacturer/my-shipments" className="action-btn">
            <span className="btn-label">My Shipments</span>
            <span className="btn-desc">View status</span>
          </Link>
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

export default ManufacturerDashboard;
