import { Outlet, Link } from 'react-router-dom';
import {
  FaHome, FaFileAlt, FaCertificate, FaBoxes,
  FaShippingFast, FaUserCircle, FaSignOutAlt
} from 'react-icons/fa';
import './Layout.css';

const Layout = () => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  };

  const isManufacturer = user?.role === 'manufacturer';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">T-Link</h1>
          <p className="sidebar-subtitle">Telios Logistics</p>
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
              <Link to="/coa" className="nav-item">
                <FaCertificate /> Certificates of Analysis
              </Link>
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
              <div className="user-name">{user?.first_name} {user?.last_name}</div>
              <div className="user-role">{user?.role}</div>
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
