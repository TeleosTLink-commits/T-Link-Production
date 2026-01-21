import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { useAuthStore } from '../store/authStore';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const storedUserStr = localStorage.getItem('user');
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
  const effectiveUser = user || storedUser;

  const [activeModal, setActiveModal] = useState<'contact' | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
          <button className="contact-btn" onClick={() => setActiveModal('contact')}>
            Contact Support
          </button>
          <div className="user-badge-container">
            <button 
              className="user-badge" 
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-details">
                <div className="user-email">{effectiveUser?.email}</div>
                <div className="user-role">{effectiveUser?.role}</div>
              </div>
              <span className="dropdown-icon">Menu</span>
            </button>
            {showUserMenu && (
              <div className="user-menu">
                <button onClick={handleLogout} className="menu-item logout">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content" aria-hidden>
        <div className="logo-spacer" />
      </div>

      <div className="actions-container">
        <h2>Platform Modules</h2>
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

      {/* Contact Modal */}
      {activeModal === 'contact' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Contact Support</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>Close</button>
            </div>
            <div className="modal-content">
              <p style={{ textAlign: 'center', marginBottom: '24px', color: '#666' }}>
                Select the type of support you need:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <button 
                  onClick={() => { setActiveModal(null); navigate('/manufacturer/support?type=tech'); }}
                  className="contact-type-btn tech"
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Technical Support</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Portal & access issues</div>
                </button>
                <button 
                  onClick={() => { setActiveModal(null); navigate('/manufacturer/support?type=lab'); }}
                  className="contact-type-btn lab"
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Lab Support</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Sample & shipment questions</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
