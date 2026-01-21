import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './ManufacturerDashboard.css';

const ManufacturerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showContactModal, setShowContactModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="manufacturer-portal">
      {/* Header with green gradient */}
      <header className="manufacturer-header">
        <div className="header-left">
          <img src="/images/tlink-official-logo.png" alt="T-Link" className="logo" />
          <div className="header-text">
            <h1>Manufacturer Portal</h1>
            {user && <p className="subtitle">Welcome, {user.firstName} {user.lastName}</p>}
          </div>
        </div>
        <div className="header-right">
          <button className="contact-btn" onClick={() => setShowContactModal(true)}>
            Contact Support
          </button>
          <div className="user-info">
            <span className="user-name">{user?.firstName} {user?.lastName}</span>
          </div>
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

      {/* Contact Modal */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Contact Support</h3>
              <button className="close-btn" onClick={() => setShowContactModal(false)}>Close</button>
            </div>
            <div className="modal-content">
              <div className="contact-section">
                <h4>Technical Issues</h4>
                <p>For login problems, access issues, or technical difficulties:</p>
                <p><strong>Email:</strong> jhunzie@ajwalabs.com</p>
              </div>
              <div className="contact-section">
                <h4>Lab Questions</h4>
                <p>For questions about samples, shipments, or lab procedures:</p>
                <p><strong>Email:</strong> eboak@ajwalabs.com</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturerDashboard;
