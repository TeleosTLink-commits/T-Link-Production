import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

interface Shipment {
  id: string;
  first_name: string;
  last_name: string;
  lot_number: string;
  quantity_requested: number;
  unit: string;
  status: string;
  created_at: string;
  is_hazmat: boolean;
}

interface ShipmentDetails {
  id: string;
  lot_number: string;
  quantity_requested: number;
  unit: string;
  is_hazmat: boolean;
  sds_documents: Array<{ id: string; file_name: string; file_path: string }>;
  inventory: {
    current_quantity: number;
    unit: string;
    projected_remaining: number;
  };
}

const ProcessingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<{ [key: string]: string }>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/processing/shipments');
      setShipments(response.data.shipments || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const fetchShipmentDetails = async (shipmentId: string) => {
    try {
      const response = await api.get(`/processing/shipments/${shipmentId}/details`);
      setSelectedShipment(response.data.shipment);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load shipment details');
    }
  };

  const handleExpandShipment = async (shipmentId: string) => {
    if (expandedId === shipmentId) {
      setExpandedId(null);
      setSelectedShipment(null);
    } else {
      setExpandedId(shipmentId);
      await fetchShipmentDetails(shipmentId);
    }
  };

  const handleStatusChange = async (shipmentId: string, newStatus: string) => {
    setUpdatingId(shipmentId);
    try {
      await api.post(`/processing/shipments/${shipmentId}/update-status`, {
        status: newStatus,
      });
      setStatusUpdates((prev) => ({
        ...prev,
        [shipmentId]: newStatus,
      }));
      toast.success('Status updated successfully');
      // Update shipments list
      setShipments((prev) =>
        prev.map((s) => (s.id === shipmentId ? { ...s, status: newStatus } : s))
      );
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleFlagHazmat = async (shipmentId: string) => {
    navigate(`/internal/hazmat-processing?shipmentId=${shipmentId}`);
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
        return '📋';
      case 'processing':
        return '⚙️';
      case 'shipped':
        return '🚚';
      case 'delivered':
        return '✅';
      default:
        return '❓';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const inventoryStatus = (current: number, requested: number) => {
    const projected = current - requested;
    if (projected < 0) {
      return { color: '#dc3545', text: `INSUFFICIENT (needs ${Math.abs(projected)}${''} more)`, emoji: '❌' };
    } else if (projected < 10) {
      return { color: '#ffc107', text: `LOW STOCK (${projected} remaining)`, emoji: '⚠️' };
    } else {
      return { color: '#28a745', text: `AVAILABLE (${projected} remaining)`, emoji: '✅' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Lab Processing Dashboard</h1>
        <p style={styles.subtitle}>Manage initiated shipments and inventory</p>
      </div>

      {/* Summary Card */}
      <div style={styles.summaryCard}>
        <div style={styles.summaryItem}>
          <p style={styles.summaryLabel}>Initiated Requests</p>
          <p style={styles.summaryCount}>{shipments.length}</p>
        </div>
        <div style={styles.summaryItem}>
          <p style={styles.summaryLabel}>Requires Attention</p>
          <p style={styles.summaryCount}>
            {shipments.filter((s) => s.is_hazmat).length}
          </p>
        </div>
        <button
          onClick={() => navigate('/internal/supplies')}
          style={styles.suppliesButton}
        >
          📦 Manage Supplies
        </button>
      </div>

      {/* Shipments List */}
      <div style={styles.shipmentsContainer}>
        {loading ? (
          <div style={styles.loadingMessage}>
            <p>Loading shipments...</p>
          </div>
        ) : shipments.length === 0 ? (
          <div style={styles.emptyMessage}>
            <p style={styles.emptyIcon}>📭</p>
            <p style={styles.emptyText}>No initiated shipments to process</p>
          </div>
        ) : (
          <div style={styles.shipmentsList}>
            {shipments.map((shipment) => (
              <div key={shipment.id} style={styles.shipmentCard}>
                {/* Card Header */}
                <button
                  onClick={() => handleExpandShipment(shipment.id)}
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
                        <p style={styles.shipmentId}>
                          {shipment.first_name} {shipment.last_name}
                        </p>
                        <p style={styles.shipmentDate}>
                          Requested: {formatDate(shipment.created_at)}
                        </p>
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
                        <span style={styles.hazmatBadge}>⚠️ HAZMAT</span>
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
                        {expandedId === shipment.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === shipment.id && selectedShipment && (
                  <div style={styles.expandedDetails}>
                    {/* Inventory Check */}
                    <div style={styles.inventoryBox}>
                      <h4 style={styles.boxTitle}>Inventory Status</h4>
                      <div style={styles.inventoryGrid}>
                        <div style={styles.inventoryItem}>
                          <span style={styles.inventoryLabel}>Current Stock</span>
                          <span style={styles.inventoryValue}>
                            {selectedShipment.inventory.current_quantity}
                            {selectedShipment.inventory.unit}
                          </span>
                        </div>
                        <div style={styles.inventoryItem}>
                          <span style={styles.inventoryLabel}>Requested</span>
                          <span style={styles.inventoryValue}>
                            {selectedShipment.quantity_requested}
                            {selectedShipment.unit}
                          </span>
                        </div>
                        <div style={styles.inventoryItem}>
                          <span style={styles.inventoryLabel}>Projected Remaining</span>
                          <span
                            style={{
                              ...styles.inventoryValue,
                              color: inventoryStatus(
                                selectedShipment.inventory.current_quantity,
                                selectedShipment.quantity_requested
                              ).color,
                              fontWeight: 'bold',
                            }}
                          >
                            {selectedShipment.inventory.projected_remaining}
                            {selectedShipment.inventory.unit}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          ...styles.inventoryAlert,
                          borderColor: inventoryStatus(
                            selectedShipment.inventory.current_quantity,
                            selectedShipment.quantity_requested
                          ).color,
                          backgroundColor:
                            inventoryStatus(
                              selectedShipment.inventory.current_quantity,
                              selectedShipment.quantity_requested
                            ).color === '#28a745'
                              ? '#d4edda'
                              : inventoryStatus(
                                  selectedShipment.inventory.current_quantity,
                                  selectedShipment.quantity_requested
                                ).color === '#ffc107'
                              ? '#fff3cd'
                              : '#f8d7da',
                        }}
                      >
                        <span style={styles.alertIcon}>
                          {
                            inventoryStatus(
                              selectedShipment.inventory.current_quantity,
                              selectedShipment.quantity_requested
                            ).emoji
                          }
                        </span>
                        <span
                          style={{
                            ...styles.alertText,
                            color:
                              inventoryStatus(
                                selectedShipment.inventory.current_quantity,
                                selectedShipment.quantity_requested
                              ).color === '#28a745'
                                ? '#155724'
                                : inventoryStatus(
                                    selectedShipment.inventory.current_quantity,
                                    selectedShipment.quantity_requested
                                  ).color === '#ffc107'
                                ? '#856404'
                                : '#721c24',
                          }}
                        >
                          {
                            inventoryStatus(
                              selectedShipment.inventory.current_quantity,
                              selectedShipment.quantity_requested
                            ).text
                          }
                        </span>
                      </div>
                    </div>

                    {/* SDS Documents */}
                    {selectedShipment.sds_documents && selectedShipment.sds_documents.length > 0 && (
                      <div style={styles.documentsBox}>
                        <h4 style={styles.boxTitle}>Safety Data Sheets (SDS)</h4>
                        <div style={styles.documentsList}>
                          {selectedShipment.sds_documents.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={styles.documentLink}
                            >
                              📄 {doc.file_name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status Update */}
                    <div style={styles.actionBox}>
                      <h4 style={styles.boxTitle}>Update Status</h4>
                      <div style={styles.statusGrid}>
                        {['initiated', 'processing', 'shipped', 'delivered'].map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(shipment.id, status)}
                            style={{
                              ...styles.statusButton,
                              backgroundColor:
                                statusUpdates[shipment.id] === status || shipment.status === status
                                  ? getStatusColor(status)
                                  : '#f0f0f0',
                              color:
                                statusUpdates[shipment.id] === status || shipment.status === status
                                  ? 'white'
                                  : '#333',
                            }}
                            disabled={updatingId === shipment.id}
                          >
                            {getStatusIcon(status)} {status}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hazmat Processing */}
                    {selectedShipment.is_hazmat && (
                      <div style={styles.hazmatBox}>
                        <h4 style={styles.boxTitle}>⚠️ Hazmat Processing Required</h4>
                        <p style={styles.hazmatText}>
                          This shipment requires dangerous goods documentation and must be processed before shipping.
                        </p>
                        <button
                          onClick={() => handleFlagHazmat(shipment.id)}
                          style={styles.hazmatButton}
                        >
                          Process Hazmat Documentation →
                        </button>
                      </div>
                    )}

                    {/* Supply Recording */}
                    <div style={styles.actionBox}>
                      <h4 style={styles.boxTitle}>Record Used Supplies</h4>
                      <p style={styles.actionText}>
                        Select supplies used for this shipment packaging.
                      </p>
                      <button
                        onClick={() => navigate(`/internal/record-supplies?shipmentId=${shipment.id}`)}
                        style={styles.recordButton}
                      >
                        Record Supplies Used →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
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
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  summaryCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  summaryItem: {
    textAlign: 'center' as const,
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
  suppliesButton: {
    padding: '10px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
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
    margin: '12px 0 0 0',
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
    gap: '16px',
  },
  inventoryBox: {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
  },
  boxTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px 0',
  },
  inventoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '12px',
  },
  inventoryItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    textAlign: 'center' as const,
  },
  inventoryLabel: {
    fontSize: '11px',
    color: '#666',
    textTransform: 'uppercase' as const,
    fontWeight: 'bold',
  },
  inventoryValue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  inventoryAlert: {
    padding: '12px',
    borderLeft: '4px solid',
    borderRadius: '2px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  alertIcon: {
    fontSize: '18px',
  },
  alertText: {
    fontSize: '13px',
    fontWeight: 'bold',
    margin: 0,
  },
  documentsBox: {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
  },
  documentsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  documentLink: {
    padding: '10px 12px',
    backgroundColor: '#f0f6ff',
    border: '1px solid #b3d9ff',
    borderRadius: '2px',
    color: '#004085',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: '500',
  },
  actionBox: {
    backgroundColor: 'white',
    padding: '16px',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
  },
  actionText: {
    fontSize: '13px',
    color: '#666',
    margin: '0 0 12px 0',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '8px',
  },
  statusButton: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  },
  hazmatBox: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    padding: '16px',
    borderRadius: '4px',
  },
  hazmatText: {
    fontSize: '13px',
    color: '#856404',
    margin: '0 0 12px 0',
  },
  hazmatButton: {
    padding: '10px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  recordButton: {
    padding: '10px 16px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
  },
};

export default ProcessingDashboard;
