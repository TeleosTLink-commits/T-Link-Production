import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './MyShipments.css';

interface Shipment {
  id: string;
  lot_number: string;
  quantity_requested: number;
  unit: string;
  status: 'initiated' | 'processing' | 'shipped' | 'delivered';
  created_at: string;
  scheduled_ship_date?: string;
  tracking_number?: string;
  carrier?: string;
  is_hazmat: boolean;
}

const MyShipments: React.FC = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'initiated' | 'processing' | 'shipped' | 'delivered'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/manufacturer/shipments/my-requests');
      setShipments(response.data.shipments || []);
    } catch (error: any) {
      // Silently handle "no shipments" scenarios - not an error condition
      setShipments([]);
      // Only log to console for debugging, don't show error to user
      console.log('No shipments found or error loading shipments:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'initiated':
        return '#ffc107'; // yellow
      case 'processing':
        return '#17a2b8'; // cyan
      case 'shipped':
        return '#007bff'; // blue
      case 'delivered':
        return '#28a745'; // green
      default:
        return '#6c757d'; // gray
    }
  };

  const filteredShipments =
    statusFilter === 'all'
      ? shipments
      : shipments.filter((s) => s.status === statusFilter);

  const statusCounts = {
    all: shipments.length,
    initiated: shipments.filter((s) => s.status === 'initiated').length,
    processing: shipments.filter((s) => s.status === 'processing').length,
    shipped: shipments.filter((s) => s.status === 'shipped').length,
    delivered: shipments.filter((s) => s.status === 'delivered').length,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="my-shipments-portal">
      {/* Header */}
      <div className="my-shipments-header">
        <button onClick={() => navigate('/manufacturer/dashboard')} className="my-shipments-back-button">
          ← Back to Dashboard
        </button>
        <div className="my-shipments-header-text">
          <h1 className="my-shipments-title">My Shipments</h1>
          <p className="my-shipments-subtitle">Track and manage your shipment requests</p>
        </div>
      </div>

      <div className="my-shipments-content">

        {/* Summary Cards */}
        <div className="my-shipments-summary-grid">
          {[
            { key: 'all', label: 'All Requests', count: statusCounts.all },
            { key: 'initiated', label: 'Initiated', count: statusCounts.initiated },
            { key: 'processing', label: 'Processing', count: statusCounts.processing },
            { key: 'shipped', label: 'Shipped', count: statusCounts.shipped },
            { key: 'delivered', label: 'Delivered', count: statusCounts.delivered },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key as any)}
              className={`my-shipments-summary-card ${statusFilter === item.key ? 'active' : ''}`}
            >
              <p className="my-shipments-summary-label">{item.label}</p>
              <p className="my-shipments-summary-count">{item.count}</p>
            </button>
          ))}
        </div>

        {/* Filter Section */}
        <div className="my-shipments-filter-section">
          <label className="my-shipments-filter-label">Filter by Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="my-shipments-filter-select"
          >
            <option value="all">All Shipments</option>
            <option value="initiated">Initiated</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        {/* Shipments List */}
        {loading ? (
          <div className="my-shipments-loading">
            <p className="my-shipments-loading-text">Loading your shipments...</p>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="my-shipments-empty">
            <p className="my-shipments-empty-icon">📭</p>
            <p className="my-shipments-empty-text">
              {statusFilter === 'all'
                ? 'No shipments found. Create your first shipment request!'
                : `No ${statusFilter} shipments found.`}
            </p>
            <button onClick={() => navigate('/manufacturer/shipment-request')} className="my-shipments-create-button">
              + Create Shipment Request
            </button>
          </div>
        ) : (
          <div className="my-shipments-list">
            {filteredShipments.map((shipment) => (
              <div key={shipment.id} className="my-shipments-card">
                {/* Card Header - Clickable */}
                <button
                  onClick={() => setExpandedId(expandedId === shipment.id ? null : shipment.id)}
                  className="my-shipments-card-header-button"
                >
                  <div className="my-shipments-header-content">
                    <div className="my-shipments-header-left">
                      <div>
                        <p className="my-shipments-id">Request #{shipment.id.substring(0, 8)}</p>
                        <p className="my-shipments-date">{formatDate(shipment.created_at)}</p>
                      </div>
                      <p className="my-shipments-item-info">
                        {shipment.lot_number} · {shipment.quantity_requested}{shipment.unit}
                      </p>
                    </div>

                    <div className="my-shipments-header-right">
                      {shipment.is_hazmat && (
                        <span className="my-shipments-hazmat-badge">HAZMAT</span>
                      )}
                      <div className={`my-shipments-status-badge ${shipment.status}`}>
                        <span>{shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1)}</span>
                      </div>
                      <span className="my-shipments-expand-icon">
                        {expandedId === shipment.id ? '▲ Hide' : '▼ Show'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === shipment.id && (
                  <div className="my-shipments-expanded-details">
                    <div className="my-shipments-details-grid">
                      <div className="my-shipments-detail-item">
                        <span className="my-shipments-detail-label">Lot Number</span>
                        <span className="my-shipments-detail-value">{shipment.lot_number}</span>
                      </div>
                      <div className="my-shipments-detail-item">
                        <span className="my-shipments-detail-label">Quantity</span>
                        <span className="my-shipments-detail-value">
                          {shipment.quantity_requested} {shipment.unit}
                        </span>
                      </div>
                      {shipment.scheduled_ship_date && (
                        <div className="my-shipments-detail-item">
                          <span className="my-shipments-detail-label">Scheduled Ship Date</span>
                          <span className="my-shipments-detail-value">{formatDate(shipment.scheduled_ship_date)}</span>
                        </div>
                      )}
                      {shipment.carrier && (
                        <div className="my-shipments-detail-item">
                          <span className="my-shipments-detail-label">Carrier</span>
                          <span className="my-shipments-detail-value">{shipment.carrier}</span>
                        </div>
                      )}
                      {shipment.tracking_number && (
                        <div className="my-shipments-detail-item">
                          <span className="my-shipments-detail-label">Tracking Number</span>
                          <span className="my-shipments-detail-value">{shipment.tracking_number}</span>
                        </div>
                      )}
                      {shipment.is_hazmat && (
                        <div className="my-shipments-detail-item">
                          <span className="my-shipments-detail-label">Hazmat Status</span>
                          <span className="my-shipments-detail-value" style={{ color: '#dc3545' }}>
                            Dangerous Goods Declaration Required
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="my-shipments-timeline">
                      <div className="my-shipments-timeline-title">Shipment Progress</div>
                      <div className="my-shipments-timeline-steps">
                        {['initiated', 'processing', 'shipped', 'delivered'].map((step, index) => {
                          const stepIndex = ['initiated', 'processing', 'shipped', 'delivered'].indexOf(step);
                          const currentIndex = ['initiated', 'processing', 'shipped', 'delivered'].indexOf(shipment.status);
                          const isActive = stepIndex <= currentIndex;
                          
                          return (
                            <div key={step} className="my-shipments-timeline-step">
                              <div
                                className={`my-shipments-timeline-circle ${isActive ? 'active' : 'inactive'}`}
                                style={{
                                  backgroundColor: isActive ? getStatusColor(shipment.status) : '#e0e0e0',
                                }}
                              >
                                {stepIndex === currentIndex ? '✓' : ''}
                              </div>
                              <div className="my-shipments-timeline-label">{step.charAt(0).toUpperCase() + step.slice(1)}</div>
                              {index < 3 && <div className="my-shipments-timeline-connector" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {shipment.status === 'shipped' && shipment.tracking_number && (
                      <div className="my-shipments-action-box">
                        <a
                          href={`https://tracking.fedex.com/en/tracking/${shipment.tracking_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="my-shipments-tracking-link"
                        >
                          🚚 Track Package on FedEx
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create New Button */}
        {!loading && filteredShipments.length > 0 && (
          <div className="my-shipments-create-new-section">
            <button onClick={() => navigate('/manufacturer/shipment-request')} className="my-shipments-create-new-button">
              + Create New Shipment Request
            </button>
          </div>
        )}
      </div>

      <footer className="my-shipments-footer">
        <div className="footer-content">
          <span className="footer-text">© 2026 T-Link Sample Management System</span>
          <img src="/images/tlink-official-logo.png" alt="T-Link Logo" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
};

export default MyShipments;
