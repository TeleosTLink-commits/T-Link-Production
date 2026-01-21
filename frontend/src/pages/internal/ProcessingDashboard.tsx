import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './ProcessingDashboard.css';

interface Shipment {
  id: string;
  shipment_number: string;
  first_name: string;
  last_name: string;
  company_name: string;
  chemical_name: string;
  lot_number: string;
  quantity_requested: number;
  amount_shipped: string;
  unit: string;
  status: string;
  created_at: string;
  scheduled_ship_date: string;
  is_hazmat: boolean;
  requires_dg_declaration: boolean;
  recipient_name: string;
}

const ProcessingDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/processing/shipments');
      setShipments(response.data.data || response.data.shipments || []);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load shipments');
      toast.error(error.response?.data?.error || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessShipment = (shipmentId: string) => {
    navigate(`/internal/processing/shipment/${shipmentId}`);
  };

  const handleDashboardReturn = () => {
    navigate('/dashboard');
  };

  return (
    <div className="processing-dashboard">
      {/* Green Gradient Portal Header */}
      <div className="processing-header">
        <div className="processing-header-content">
          <button className="processing-back-btn" onClick={handleDashboardReturn}>
            ← Dashboard
          </button>
          <div className="processing-title-section">
            <h1 className="processing-title">Shipment Processing</h1>
          </div>
          <button className="processing-refresh-btn" onClick={fetchShipments}>
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="processing-content">
        {error && <div className="processing-error">{error}</div>}

        {loading ? (
          <div className="processing-loading">Loading pending shipments...</div>
        ) : (
          <>
            <div className="processing-summary">
              <div className="summary-card">
                <div className="summary-number">{shipments.length}</div>
                <div className="summary-label">Pending Requests</div>
              </div>
              <div className="summary-card hazmat">
                <div className="summary-number">
                  {shipments.filter((s) => s.is_hazmat || s.requires_dg_declaration).length}
                </div>
                <div className="summary-label">Hazmat Shipments</div>
              </div>
              <div className="summary-card urgent">
                <div className="summary-number">
                  {
                    shipments.filter((s) => {
                      const scheduledDate = new Date(s.scheduled_ship_date);
                      const today = new Date();
                      const diffDays = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return diffDays <= 2;
                    }).length
                  }
                </div>
                <div className="summary-label">Due Soon (≤2 days)</div>
              </div>
            </div>

            {shipments.length === 0 ? (
              <div className="processing-empty">
                <div className="empty-icon"></div>
                <h3>No Pending Shipments</h3>
                <p>All shipment requests have been processed</p>
              </div>
            ) : (
              <div className="shipments-table-wrapper">
                <table className="shipments-table">
                  <thead>
                    <tr>
                      <th>Request Date</th>
                      <th>Shipment #</th>
                      <th>Manufacturer</th>
                      <th>Company</th>
                      <th>Chemical</th>
                      <th>Lot Number</th>
                      <th>Quantity</th>
                      <th>Recipient</th>
                      <th>Scheduled Date</th>
                      <th>Flags</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((shipment) => {
                      const scheduledDate = new Date(shipment.scheduled_ship_date);
                      const today = new Date();
                      const diffDays = Math.ceil((scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const isDueSoon = diffDays <= 2 && diffDays >= 0;
                      const isPastDue = diffDays < 0;

                      return (
                        <tr key={shipment.id} className={isPastDue ? 'past-due' : isDueSoon ? 'due-soon' : ''}>
                          <td>{new Date(shipment.created_at).toLocaleDateString()}</td>
                          <td>
                            <strong>{shipment.shipment_number}</strong>
                          </td>
                          <td>
                            {shipment.first_name} {shipment.last_name}
                          </td>
                          <td>{shipment.company_name}</td>
                          <td>{shipment.chemical_name || 'N/A'}</td>
                          <td>{shipment.lot_number}</td>
                          <td>
                            {shipment.amount_shipped || shipment.quantity_requested} {shipment.unit}
                          </td>
                          <td>{shipment.recipient_name}</td>
                          <td>
                            {new Date(shipment.scheduled_ship_date).toLocaleDateString()}
                            {isPastDue && <span className="date-flag past-due-flag">PAST DUE</span>}
                            {isDueSoon && <span className="date-flag due-soon-flag">DUE SOON</span>}
                          </td>
                          <td>
                            <div className="flags-container">
                              {(shipment.is_hazmat || shipment.requires_dg_declaration) && (
                                <span className="flag-badge hazmat-badge" title="Hazardous Materials">
                                  HAZMAT
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <button
                              className="processing-btn-primary"
                              onClick={() => handleProcessShipment(shipment.id)}
                            >
                              Process
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProcessingDashboard;

