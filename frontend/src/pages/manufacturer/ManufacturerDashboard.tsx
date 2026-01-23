import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './ManufacturerDashboard.css';

const ManufacturerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
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
          <button className="contact-btn" onClick={() => navigate('/manufacturer/support')}>
            Contact Support
          </button>
          <button className="sign-out-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content - background only */}
      <div className="manufacturer-content">
        <div className="logo-spacer" />
      </div>

      {/* Quick Actions Bar - 4 buttons at bottom with green styling */}
      <div className="quick-actions-bar">
        <div className="quick-actions-container">
          <h3 className="quick-actions-title">Quick Actions</h3>
          <div className="quick-actions-grid">
            <Link to="/manufacturer/coa-lookup" className="quick-action-btn">
              <span className="quick-btn-label">CoA Lookup</span>
              <span className="quick-btn-desc">Search & download</span>
            </Link>
            <Link to="/manufacturer/inventory-search" className="quick-action-btn">
              <span className="quick-btn-label">Inventory Search</span>
              <span className="quick-btn-desc">Check availability</span>
            </Link>
            <Link to="/manufacturer/shipment-request" className="quick-action-btn">
              <span className="quick-btn-label">Request Shipment</span>
              <span className="quick-btn-desc">Create new request</span>
            </Link>
            <Link to="/manufacturer/my-shipments" className="quick-action-btn">
              <span className="quick-btn-label">My Shipments</span>
              <span className="quick-btn-desc">View status</span>
            </Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ManufacturerDashboard;
