import { Outlet, Link, useNavigate } from 'react-router-dom';
import {
  FaHome, FaFileAlt, FaBoxes,
  FaShippingFast, FaUserCircle, FaSignOutAlt
} from 'react-icons/fa';
import './Layout.css';
import { useAuthStore } from '../store/authStore';

const Layout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const storedUserStr = localStorage.getItem('user');
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
  const effectiveUser = user || storedUser;

  const handleLogout = () => {
    // Clear both persisted store and fallback tokens
    logout();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isManufacturer = effectiveUser?.role === 'manufacturer';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">T-Link</h1>
          <p className="sidebar-subtitle">Teleos Logistics</p>
        </div>

        <nav className="sidebar-nav">
          {!isManufacturer ? (
            <>
              <Link to="/dashboard" className="nav-item">
                <FaHome /> Dashboard
              </Link>
              <Link to="/test-methods" className="nav-item">
                <FaFileAlt /> Test Methods
              </Link>
              {/* CoA page removed - use Sample Inventory for CoA management */}
              <Link to="/inventory" className="nav-item">
                <FaBoxes /> Sample Inventory
              </Link>
              <Link to="/shipments" className="nav-item">
                <FaShippingFast /> Shipments & Logistics
              </Link>
            </>
          ) : (
            <Link to="/manufacturer" className="nav-item">
              <FaHome /> Manufacturer Portal
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <FaUserCircle size={24} />
            <div>
              <div className="user-name">{effectiveUser?.firstName} {effectiveUser?.lastName}</div>
              <div className="user-role">{effectiveUser?.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
