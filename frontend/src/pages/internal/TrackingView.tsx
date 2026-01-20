import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './TrackingView.css';

interface TrackingInfo {
  trackingNumber: string;
  status: 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception';
  location: string;
  timestamp: string;
  estimatedDelivery?: string;
  events: Array<{
    status: string;
    location: string;
    timestamp: string;
    description: string;
  }>;
}

interface ShipmentTracking {
  id: string;
  shipment_number: string;
  tracking_number: string;
  status: string;
  shipped_date: string;
  estimated_delivery: string;
  recipient_name: string;
  recipient_company?: string;
  destination_address: string;
  destination_city: string;
  destination_state: string;
  destination_zip: string;
  amount_shipped: string;
  unit: string;
  chemical_name: string;
  carrier?: string;
}

const TrackingView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState<ShipmentTracking | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchShipmentTracking();
    }
  }, [id]);

  const fetchShipmentTracking = async () => {
    try {
      setLoading(true);
      
      // Fetch shipment details
      const shipmentRes = await api.get(`/shipments/${id}`);
      setShipment(shipmentRes.data.data || shipmentRes.data);

      // Fetch tracking info from FedEx
      if (shipmentRes.data.data?.tracking_number || shipmentRes.data.tracking_number) {
        const trackingNumber = shipmentRes.data.data?.tracking_number || shipmentRes.data.tracking_number;
        const trackingRes = await api.get(`/processing/tracking/${trackingNumber}`);
        setTracking(trackingRes.data.data || trackingRes.data);
      }

      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch tracking information');
      console.error('Tracking error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'in_transit': return '#007bff';
      case 'out_for_delivery': return '#ffc107';
      case 'delivered': return '#28a745';
      case 'exception': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'in_transit': return '';
      case 'out_for_delivery': return '🚚';
      case 'delivered': return '';
      case 'exception': return '⚠️';
      default: return '📮';
    }
  };

  if (loading) {
    return (
      <div className="tracking-view">
        <div className="tracking-header">
          <div className="tracking-header-content">
            <button className="tracking-back-btn" onClick={() => navigate('/shipments')}>
              ← Back to Shipments
            </button>
            <h1>Package Tracking</h1>
          </div>
        </div>
        <div className="tracking-content">
          <div className="tracking-loading">Loading tracking information...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-view">
      {/* Header */}
      <div className="tracking-header">
        <div className="tracking-header-content">
          <button className="tracking-back-btn" onClick={() => navigate('/shipments')}>
            ← Back to Shipments
          </button>
          <div>
            <h1>Package Tracking</h1>
            <p>Shipment #{shipment?.shipment_number}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="tracking-content">
        {error && (
          <div className="tracking-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="tracking-container">
          {/* Shipment Details Card */}
          {shipment && (
            <div className="tracking-card">
              <div className="tracking-card-header">
                <h2>Shipment Details</h2>
              </div>
              <div className="tracking-card-body">
                <div className="tracking-grid">
                  <div className="tracking-item">
                    <label>Shipment Number</label>
                    <div className="tracking-value">{shipment.shipment_number}</div>
                  </div>
                  
                  <div className="tracking-item">
                    <label>Tracking Number</label>
                    <div className="tracking-value tracking-number">{shipment.tracking_number || 'N/A'}</div>
                  </div>
                  
                  <div className="tracking-item">
                    <label>Chemical/Sample</label>
                    <div className="tracking-value">{shipment.chemical_name}</div>
                  </div>
                  
                  <div className="tracking-item">
                    <label>Amount</label>
                    <div className="tracking-value">{shipment.amount_shipped} {shipment.unit}</div>
                  </div>
                  
                  <div className="tracking-item">
                    <label>Carrier</label>
                    <div className="tracking-value">{shipment.carrier || 'FedEx'}</div>
                  </div>
                  
                  <div className="tracking-item">
                    <label>Status</label>
                    <div className={`tracking-status ${shipment.status}`}>
                      {shipment.status?.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="tracking-dates">
                  <div className="tracking-date-item">
                    <label>📤 Shipped</label>
                    <div className="tracking-date-value">
                      {shipment.shipped_date ? new Date(shipment.shipped_date).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="tracking-date-item">
                    <label>🎯 Estimated Delivery</label>
                    <div className="tracking-date-value highlight">
                      {shipment.estimated_delivery ? new Date(shipment.estimated_delivery).toLocaleDateString() : 'TBD'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recipient Information */}
          {shipment && (
            <div className="tracking-card">
              <div className="tracking-card-header">
                <h2>Recipient Information</h2>
              </div>
              <div className="tracking-card-body">
                <div className="tracking-recipient">
                  <div className="recipient-name">{shipment.recipient_name}</div>
                  {shipment.recipient_company && (
                    <div className="recipient-company">{shipment.recipient_company}</div>
                  )}
                  <div className="recipient-address">
                    {shipment.destination_address}
                  </div>
                  <div className="recipient-city-state">
                    {shipment.destination_city}, {shipment.destination_state} {shipment.destination_zip}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tracking Timeline */}
          {tracking && (
            <div className="tracking-card">
              <div className="tracking-card-header">
                <h2>
                  {getStatusIcon(tracking.status)} Tracking Timeline
                </h2>
              </div>
              <div className="tracking-card-body">
                <div className="tracking-timeline">
                  <div className="timeline-status-badge" style={{ borderColor: getStatusColor(tracking.status) }}>
                    <div className="status-badge-dot" style={{ backgroundColor: getStatusColor(tracking.status) }}></div>
                    <div>
                      <div className="status-badge-title">{tracking.status?.replace('_', ' ').toUpperCase()}</div>
                      <div className="status-badge-location">{tracking.location}</div>
                      <div className="status-badge-time">
                        {tracking.timestamp ? new Date(tracking.timestamp).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {tracking.events && tracking.events.length > 0 && (
                    <div className="timeline-events">
                      <h3>Recent Updates</h3>
                      {tracking.events.map((event, idx) => (
                        <div key={idx} className="timeline-event">
                          <div className="event-marker"></div>
                          <div className="event-content">
                            <div className="event-status">{event.status}</div>
                            <div className="event-location">{event.location}</div>
                            <div className="event-description">{event.description}</div>
                            <div className="event-time">
                              {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* No Tracking Info */}
          {!tracking && !error && shipment && (
            <div className="tracking-card">
              <div className="tracking-card-body">
                <div className="tracking-empty">
                  <div className="tracking-empty-icon">📮</div>
                  <h3>Tracking Information Not Available</h3>
                  <p>Tracking details will be available once the shipment is in transit.</p>
                  <p className="tracking-number-info">Tracking #: {shipment.tracking_number || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackingView;
