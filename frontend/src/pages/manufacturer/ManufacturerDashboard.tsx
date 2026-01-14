import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const ManufacturerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();


  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    {
      icon: '📄',
      title: 'CoA Lookup',
      description: 'Search and download Certificates of Analysis',
      link: '/manufacturer/coa-lookup',
    },
    {
      icon: '📦',
      title: 'Inventory Search',
      description: 'Check sample availability',
      link: '/manufacturer/inventory-search',
    },
    {
      icon: '✈️',
      title: 'Shipment Requests',
      description: 'Create and track shipments',
      link: '/manufacturer/shipment-request',
    },
    {
      icon: '📋',
      title: 'My Shipments',
      description: 'View shipment status and tracking',
      link: '/manufacturer/my-shipments',
    },
    {
      icon: '💬',
      title: 'Tech Support',
      description: 'Get technical assistance',
      link: '/manufacturer/support?type=tech',
    },
    {
      icon: '🧪',
      title: 'Lab Support',
      description: 'Questions about samples and shipments',
      link: '/manufacturer/support?type=lab',
    },
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.headerTitle}>Manufacturer Portal</h1>
            {user && (
              <p style={styles.headerSubtitle}>
                Welcome, {user.firstName} {user.lastName}
              </p>
            )}
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Welcome Section */}
        <section style={styles.welcomeSection}>
          <div style={styles.welcomeCard}>
            <h2 style={styles.sectionTitle}>Welcome to T-Link</h2>
            <p style={styles.sectionDescription}>
              Your secure portal for accessing certificates of analysis, managing shipments, and communicating with our lab team.
            </p>
            <div style={styles.features}>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>🔒</span>
                <span style={styles.featureText}>Secure Access</span>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>📊</span>
                <span style={styles.featureText}>Real-time Status</span>
              </div>
              <div style={styles.feature}>
                <span style={styles.featureIcon}>⚡</span>
                <span style={styles.featureText}>Fast Support</span>
              </div>
            </div>
          </div>
        </section>

        {/* Menu Grid */}
        <section style={styles.menuSection}>
          <h2 style={styles.sectionTitle}>What would you like to do?</h2>
          <div style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <Link key={index} to={item.link} style={{ textDecoration: 'none' }}>
                <div style={styles.menuCard}>
                  <div style={styles.menuIcon}>{item.icon}</div>
                  <h3 style={styles.menuTitle}>{item.title}</h3>
                  <p style={styles.menuDescription}>{item.description}</p>
                  <div style={styles.menuArrow}>→</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Quick Info */}
        <section style={styles.infoSection}>
          <div style={styles.infoGrid}>
            <div style={styles.infoCard}>
              <h3 style={styles.infoTitle}>Contact Support</h3>
              <p style={styles.infoText}>
                <strong>Technical Issues:</strong>
                <br />
                jhunzie@ajwalabs.com
              </p>
              <p style={styles.infoText}>
                <strong>Lab Questions:</strong>
                <br />
                eboak@ajwalabs.com
              </p>
            </div>

            <div style={styles.infoCard}>
              <h3 style={styles.infoTitle}>Shipment Timeline</h3>
              <div style={styles.timeline}>
                <div style={styles.timelineItem}>
                  <div style={styles.timelineDot}>1</div>
                  <span>Request Created</span>
                </div>
                <div style={styles.timelineItem}>
                  <div style={styles.timelineDot}>2</div>
                  <span>Processing</span>
                </div>
                <div style={styles.timelineItem}>
                  <div style={styles.timelineDot}>3</div>
                  <span>Shipped</span>
                </div>
                <div style={styles.timelineItem}>
                  <div style={styles.timelineDot}>4</div>
                  <span>Delivered</span>
                </div>
              </div>
            </div>

            <div style={styles.infoCard}>
              <h3 style={styles.infoTitle}>Important Notes</h3>
              <ul style={styles.infoList}>
                <li>All shipments require valid sample lot numbers</li>
                <li>Quantities over 30ml may require additional documentation</li>
                <li>Track your shipments in real-time</li>
                <li>Contact support for special requests</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerText}>T-Link Manufacturer Portal &copy; 2026 Teleos. All rights reserved.</p>
      </footer>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    padding: '20px 0',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#666',
  },
  logoutButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  main: {
    flex: 1,
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 20px',
    width: '100%',
  },
  welcomeSection: {
    marginBottom: '40px',
  },
  welcomeCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    borderLeft: '4px solid #007bff',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px 0',
  },
  sectionDescription: {
    fontSize: '16px',
    color: '#666',
    margin: '0 0 20px 0',
    lineHeight: '1.6',
  },
  features: {
    display: 'flex',
    gap: '20px',
    marginTop: '20px',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#333',
  },
  featureIcon: {
    fontSize: '20px',
  },
  featureText: {
    fontWeight: '500',
  },
  menuSection: {
    marginBottom: '40px',
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginTop: '20px',
  },
  menuCard: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    border: '1px solid #e0e0e0',
  },
  menuIcon: {
    fontSize: '40px',
    marginBottom: '12px',
  },
  menuTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 8px 0',
  },
  menuDescription: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
    lineHeight: '1.5',
  },
  menuArrow: {
    position: 'absolute',
    right: '24px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '20px',
    color: '#007bff',
    opacity: 0,
    transition: 'opacity 0.3s ease',
  },
  infoSection: {
    marginBottom: '40px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  infoCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  infoTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px 0',
  },
  infoText: {
    fontSize: '13px',
    color: '#666',
    margin: '0 0 12px 0',
    lineHeight: '1.6',
  },
  infoList: {
    fontSize: '13px',
    color: '#666',
    margin: 0,
    paddingLeft: '20px',
  },
  timeline: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#666',
  },
  timelineDot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '12px',
  },
  footer: {
    backgroundColor: '#f0f0f0',
    borderTop: '1px solid #e0e0e0',
    padding: '20px',
    textAlign: 'center' as const,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: '12px',
    color: '#666',
    margin: 0,
  },
};

export default ManufacturerDashboard;
