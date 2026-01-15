import React from 'react';
import './ManufacturerPortal.css';

const ManufacturerPortal: React.FC = () => {
  return (
    <div className="manufacturer-portal">
      <div className="portal-hero">
        <div className="hero-content">
          <h1>Manufacturer Access Portal</h1>
          <p className="hero-subtitle">Welcome to your dedicated portal for accessing product documentation and reference standards</p>
        </div>
      </div>

      <div className="portal-images">
        <div className="image-card">
          <img 
            src="/images/manufacturer-portal-1.png" 
            alt="Manufacturer Portal Feature 1" 
            className="portal-image"
          />
        </div>
        <div className="image-card">
          <img 
            src="/images/manufacturer-portal-2.png" 
            alt="Manufacturer Portal Feature 2" 
            className="portal-image"
          />
        </div>
      </div>

      <div className="portal-features">
        <h2>Portal Capabilities</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>Certificates of Analysis</h3>
            <p>View and download CoAs for your company's products with real-time status updates</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Reference Standards</h3>
            <p>Access comprehensive documentation and technical specifications</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure Access</h3>
            <p>Read-only access ensures data integrity while providing full visibility</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Filtered Views</h3>
            <p>Automatically filtered content specific to your company's products</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Shipment Tracking</h3>
            <p>Monitor shipments and delivery status for your orders</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📥</div>
            <h3>Document Downloads</h3>
            <p>Download certificates and supporting documentation at any time</p>
          </div>
        </div>
      </div>

      <div className="portal-status">
        <div className="status-badge">
          <span className="status-indicator"></span>
          <span>Portal Status: Operational</span>
        </div>
      </div>
    </div>
  );
};

export default ManufacturerPortal;
