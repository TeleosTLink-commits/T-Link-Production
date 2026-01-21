import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

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
      toast.error(error.response?.data?.error || 'Failed to load shipments');
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'initiated':
        return '';
      case 'processing':
        return '';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      default:
        return 'Unknown';
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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/manufacturer/dashboard')} style={styles.backButton}>
          ← Back
        </button>
        <h1 style={styles.title}>My Shipments</h1>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
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
            style={{
              ...styles.summaryCard,
              borderBottom: statusFilter === item.key ? '4px solid #007bff' : 'none',
              backgroundColor: statusFilter === item.key ? '#f0f6ff' : 'white',
            }}
          >
            <p style={styles.summaryLabel}>{item.label}</p>
            <p style={styles.summaryCount}>{item.count}</p>
          </button>
        ))}
      </div>

      {/* Filter Section */}
      <div style={styles.filterSection}>
        <label style={styles.filterLabel}>Filter by Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={styles.filterSelect}
        >
          <option value="all">All Shipments</option>
          <option value="initiated">Initiated</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>

      {/* Shipments List */}
      <div style={styles.shipmentsContainer}>
        {loading ? (
          <div style={styles.loadingMessage}>
            <p>Loading your shipments...</p>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div style={styles.emptyMessage}>
            <p style={styles.emptyIcon}>📭</p>
            <p style={styles.emptyText}>
              {statusFilter === 'all'
                ? 'No shipments found. Create your first shipment request!'
                : `No ${statusFilter} shipments found.`}
            </p>
            <button onClick={() => navigate('/manufacturer/shipment-request')} style={styles.createButton}>
              Create Shipment Request
            </button>
          </div>
        ) : (
          <div style={styles.shipmentsList}>
            {filteredShipments.map((shipment) => (
              <div key={shipment.id} style={styles.shipmentCard}>
                {/* Card Header - Clickable */}
                <button
                  onClick={() => setExpandedId(expandedId === shipment.id ? null : shipment.id)}
                  style={{
                    ...styles.shipmentHeader,
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    width: '100%',
                    textAlign: 'left' as const,
                  }}
                >
                  <div style={styles.headerContent}>
                    <div style={styles.headerLeft}>
                      <div>
                        <p style={styles.shipmentId}>Request #{shipment.id.substring(0, 8)}</p>
                        <p style={styles.shipmentDate}>{formatDate(shipment.created_at)}</p>
                      </div>
                      <div style={styles.itemInfo}>
                        <p style={styles.itemLabel}>
                          {shipment.lot_number} · {shipment.quantity_requested}
                          {shipment.unit}
                        </p>
                      </div>
                    </div>

                    <div style={styles.headerRight}>
                      {shipment.is_hazmat && (
                        <span style={styles.hazmatBadge}>HAZMAT</span>
                      )}
                      <div
                        style={{
                          ...styles.statusBadge,
                          backgroundColor: getStatusColor(shipment.status),
                        }}
                      >
                        <span style={styles.statusIcon}>{getStatusIcon(shipment.status)}</span>
                        <span>{shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1)}</span>
                      </div>
                      <span style={styles.expandIcon}>
                        {expandedId === shipment.id ? 'Hide' : 'Show'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === shipment.id && (
                  <div style={styles.expandedDetails}>
                    <div style={styles.detailsGrid}>
                      <div style={styles.detailItem}>
                        <span style={styles.detailLabel}>Lot Number</span>
                        <span style={styles.detailValue}>{shipment.lot_number}</span>
                      </div>
                      <div style={styles.detailItem}>
                        <span style={styles.detailLabel}>Quantity</span>
                        <span style={styles.detailValue}>
                          {shipment.quantity_requested} {shipment.unit}
                        </span>
                      </div>
                      {shipment.scheduled_ship_date && (
                        <div style={styles.detailItem}>
                          <span style={styles.detailLabel}>Scheduled Ship Date</span>
                          <span style={styles.detailValue}>{formatDate(shipment.scheduled_ship_date)}</span>
                        </div>
                      )}
                      {shipment.carrier && (
                        <div style={styles.detailItem}>
                          <span style={styles.detailLabel}>Carrier</span>
                          <span style={styles.detailValue}>{shipment.carrier}</span>
                        </div>
                      )}
                      {shipment.tracking_number && (
                        <div style={styles.detailItem}>
                          <span style={styles.detailLabel}>Tracking Number</span>
                          <span style={styles.detailValue}>{shipment.tracking_number}</span>
                        </div>
                      )}
                      {shipment.is_hazmat && (
                        <div style={styles.detailItem}>
                          <span style={styles.detailLabel}>Hazmat Status</span>
                          <span style={{ ...styles.detailValue, color: '#dc3545' }}>
                            Dangerous Goods Declaration Required
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timeline */}
                    <div style={styles.timeline}>
                      <div style={styles.timelineTitle}>Shipment Progress</div>
                      <div style={styles.timelineSteps}>
                        {['initiated', 'processing', 'shipped', 'delivered'].map((step, index) => (
                          <div key={step} style={styles.timelineStep}>
                            <div
                              style={{
                                ...styles.timelineCircle,
                                backgroundColor: ['initiated', 'processing', 'shipped', 'delivered'].indexOf(step) <=
                                  ['initiated', 'processing', 'shipped', 'delivered'].indexOf(shipment.status)
                                  ? getStatusColor(shipment.status)
                                  : '#e0e0e0',
                              }}
                            >
                              {getStatusIcon(step)}
                            </div>
                            <div style={styles.timelineLabel}>{step.charAt(0).toUpperCase() + step.slice(1)}</div>
                            {index < 3 && <div style={styles.timelineConnector} />}
                          </div>
                        ))}
                      </div>
                    </div>

                    {shipment.status === 'shipped' && shipment.tracking_number && (
                      <div style={styles.actionBox}>
                        <a
                          href={`https://tracking.fedex.com/en/tracking/${shipment.tracking_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.trackingLink}
                        >
                          Track Package on FedEx
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create New Button */}
      {!loading && filteredShipments.length > 0 && (
        <div style={styles.createNewSection}>
          <button onClick={() => navigate('/manufacturer/shipment-request')} style={styles.createNewButton}>
            + Create New Shipment Request
          </button>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    minHeight: '100vh',
  },
  header: {
    marginBottom: '30px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px 0',
    marginBottom: '12px',
    fontWeight: '500',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
    marginBottom: '24px',
  },
  summaryCard: {
    padding: '16px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#666',
    margin: '0 0 8px 0',
    textTransform: 'uppercase' as const,
    fontWeight: 'bold',
  },
  summaryCount: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  filterSection: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '24px',
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  filterSelect: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  shipmentsContainer: {
    marginBottom: '30px',
  },
  loadingMessage: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#666',
  },
  emptyMessage: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  emptyIcon: {
    fontSize: '48px',
    margin: 0,
  },
  emptyText: {
    fontSize: '16px',
    color: '#666',
    margin: '12px 0 24px 0',
  },
  createButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 'bold',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  shipmentsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  shipmentCard: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  },
  shipmentHeader: {
    padding: '16px',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  shipmentId: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  shipmentDate: {
    fontSize: '12px',
    color: '#666',
    margin: '4px 0 0 0',
  },
  itemInfo: {
    marginTop: '8px',
  },
  itemLabel: {
    fontSize: '14px',
    color: '#555',
    margin: 0,
  },
  hazmatBadge: {
    padding: '4px 8px',
    backgroundColor: '#dc3545',
    color: 'white',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap' as const,
  },
  statusBadge: {
    padding: '6px 12px',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statusIcon: {
    fontSize: '16px',
  },
  expandIcon: {
    fontSize: '12px',
    color: '#666',
    fontWeight: 'bold',
  },
  expandedDetails: {
    padding: '20px 16px',
    backgroundColor: '#f8f9fa',
    borderTop: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  detailLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase' as const,
  },
  detailValue: {
    fontSize: '14px',
    color: '#333',
  },
  timeline: {
    marginTop: '12px',
  },
  timelineTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#666',
    marginBottom: '12px',
    textTransform: 'uppercase' as const,
  },
  timelineSteps: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  },
  timelineStep: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flex: 1,
    position: 'relative' as const,
  },
  timelineCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    marginBottom: '8px',
    zIndex: 2,
    position: 'relative' as const,
  },
  timelineLabel: {
    fontSize: '11px',
    color: '#666',
    textAlign: 'center' as const,
  },
  timelineConnector: {
    position: 'absolute' as const,
    top: '20px',
    left: '52%',
    width: '100%',
    height: '2px',
    backgroundColor: '#ddd',
    zIndex: 1,
  },
  actionBox: {
    marginTop: '12px',
  },
  trackingLink: {
    display: 'inline-block',
    padding: '10px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  createNewSection: {
    textAlign: 'center' as const,
    marginTop: '30px',
    paddingTop: '20px',
    borderTop: '1px solid #ddd',
  },
  createNewButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default MyShipments;
