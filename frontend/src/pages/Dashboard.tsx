import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Dashboard.css';

interface DashboardStats {
  testMethods: number;
  coas: number;
  samples: number;
  shipments: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    testMethods: 0,
    coas: 0,
    samples: 0,
    shipments: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Fetch all stats in parallel
      const [testMethodsRes, sampleInventoryRes, coasRes, shipmentsRes] = await Promise.all([
        api.get('/test-methods/stats').catch(() => ({ data: { data: { total_methods: 0 } } })),
        api.get('/sample-inventory/stats').catch(() => ({ data: { data: { total_samples: 0 } } })),
        api.get('/coa/stats').catch(() => ({ data: { data: { total_coas: 0 } } })),
        api.get('/shipments').catch(() => ({ data: { data: [] } }))
      ]);

      setStats({
        testMethods: testMethodsRes.data.data?.total_methods || 0,
        samples: sampleInventoryRes.data.data?.total_samples || 0,
        coas: coasRes.data.data?.total_coas || 0,
        shipments: shipmentsRes.data.data?.filter((s: any) => s.status === 'in_transit' || s.status === 'pending').length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <h1>Welcome to T-Link Dashboard</h1>
      <p className="welcome-message">Hello, {user?.first_name || user?.username}!</p>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-icon">📋</div>
          <h3>Test Methods</h3>
          <p className="card-count">{loading ? '...' : stats.testMethods}</p>
          <p className="card-description">Active test methods with version control</p>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">📜</div>
          <h3>Certificates of Analysis</h3>
          <p className="card-count">{loading ? '...' : stats.coas}</p>
          <p className="card-description">Active CoAs tracked by lot number</p>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">🧪</div>
          <h3>Sample Inventory</h3>
          <p className="card-count">{loading ? '...' : stats.samples}</p>
          <p className="card-description">Samples across all freezer locations</p>
        </div>

        <div className="dashboard-card">
          <div className="card-icon">📦</div>
          <h3>Active Shipments</h3>
          <p className="card-count">{loading ? '...' : stats.shipments}</p>
          <p className="card-description">Shipments in progress</p>
        </div>
      </div>

      <div className="alerts-section">
        <h2>Recent Alerts</h2>
        <div className="alert-list">
          <div className="alert-item info">
            <div className="alert-icon">ℹ️</div>
            <div className="alert-content">
              <p className="alert-title">System Ready</p>
              <p className="alert-description">T-Link system is fully operational</p>
            </div>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
          <button className="action-btn" onClick={() => navigate('/test-methods')}>
            <span>➕</span> Add Test Method
          </button>
          <button className="action-btn" onClick={() => navigate('/inventory')}>
            <span>📄</span> Manage Certificates of Analysis
          </button>
          <button className="action-btn" onClick={() => navigate('/inventory')}>
            <span>🧪</span> Add Sample
          </button>
          <button className="action-btn" onClick={() => navigate('/shipments')}>
            <span>📦</span> Create Shipment
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
