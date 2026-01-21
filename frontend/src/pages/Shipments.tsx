import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Shipments.css';

interface Sample {
  id: string;
  chemical_name: string;
  lot_number: string;
  cas_number: string;
  quantity: string;
  hazard_class: string;
  un_number: string;
}

interface ShipmentItem {
  sample_id: string;
  amount_shipped: string;
}

const Shipments: React.FC = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<any[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedSupply, setSelectedSupply] = useState<any>(null);
  const [restockAmount, setRestockAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'processing' | 'shipped'>('all');
  
  const [formData, setFormData] = useState({
    shipment_items: [{ sample_id: '', amount_shipped: '' }],
    unit: 'g',
    recipient_name: '',
    recipient_address: '',
    recipient_city: '',
    recipient_state: '',
    recipient_zip: '',
    recipient_country: 'USA',
    notes: ''
  });

  useEffect(() => {
    fetchShipments();
    fetchSamples();
    fetchSupplies();
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/shipments');
      setShipments(Array.isArray(response.data) ? response.data : response.data.data || []);
    } catch (err) {
      console.error('Error fetching shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSamples = async () => {
    try {
      const response = await api.get('/sample-inventory', { params: { limit: 1000, status: 'active' } });
      setSamples(response.data.data?.samples || []);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchSupplies = async () => {
    try {
      const response = await api.get('/shipments/supplies/all');
      setSupplies(Array.isArray(response.data) ? response.data : response.data.data || []);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const addShipmentItem = () => {
    if (formData.shipment_items.length < 10) {
      setFormData({
        ...formData,
        shipment_items: [...formData.shipment_items, { sample_id: '', amount_shipped: '' }]
      });
    }
  };

  const removeShipmentItem = (index: number) => {
    if (formData.shipment_items.length > 1) {
      setFormData({
        ...formData,
        shipment_items: formData.shipment_items.filter((_, i) => i !== index)
      });
    }
  };

  const handleShipmentItemChange = (index: number, field: keyof ShipmentItem, value: string) => {
    const newItems = [...formData.shipment_items];
    newItems[index][field] = value;
    setFormData({ ...formData, shipment_items: newItems });
  };

  const getRequiredSupplies = () => {
    const totalAmount = formData.shipment_items.reduce((sum, item) => 
      sum + (parseFloat(item.amount_shipped) || 0), 0
    );
    if (!totalAmount) return [];
    if (totalAmount <= 30) return [{ type: '4GV/X 2.9/S/23', reason: 'Small quantity (<30g)' }];
    if (totalAmount <= 100) return [{ type: '4GV/X 4.0/S/25', reason: 'Medium quantity (30-100g)' }];
    return [{ type: '4GV/X 10/S/25', reason: 'Large quantity (>100g)' }];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all items are filled
    const hasValidItems = formData.shipment_items.every(item => item.sample_id && item.amount_shipped);
    if (!hasValidItems || !formData.recipient_name) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      // Prepare shipment items with additional data
      const shipmentItems = formData.shipment_items.map(item => {
        const sample = samples.find(s => s.id === item.sample_id);
        return {
          sample_id: item.sample_id,
          amount_shipped: parseFloat(item.amount_shipped),
          lot_number: sample?.lot_number,
          chemical_name: sample?.chemical_name,
          hazard_class: sample?.hazard_class,
          un_number: sample?.un_number
        };
      });

      const response = await api.post('/shipments/multi', { 
        shipment_items: shipmentItems,
        unit: formData.unit,
        recipient_name: formData.recipient_name,
        recipient_address: formData.recipient_address,
        recipient_city: formData.recipient_city,
        recipient_state: formData.recipient_state,
        recipient_zip: formData.recipient_zip,
        recipient_country: formData.recipient_country,
        notes: formData.notes
      });
      
      const message = response.data.message || 'Shipment created successfully!';
      alert(`${message}\n\nThe sample quantities have been automatically updated in inventory.`);
      
      setShowModal(false);
      setFormData({
        shipment_items: [{ sample_id: '', amount_shipped: '' }],
        unit: 'g',
        recipient_name: '',
        recipient_address: '',
        recipient_city: '',
        recipient_state: '',
        recipient_zip: '',
        recipient_country: 'USA',
        notes: ''
      });
      fetchShipments();
      fetchSamples(); // Refresh to show updated quantities
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create shipment';
      alert('Error: ' + errorMsg);
    }
  };

  const handleUpdateSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupply || !restockAmount) return;
    
    try {
      const newCount = selectedSupply.count + parseInt(restockAmount);
      await api.post(`/shipments/supplies/${selectedSupply.id}/restock`, { count: newCount });
      
      alert(`Updated ${selectedSupply.un_box_type} stock to ${newCount}`);
      setShowSupplyModal(false);
      setSelectedSupply(null);
      setRestockAmount('');
      fetchSupplies();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update supply');
    }
  };

  return (
    <div className="shipments-page">
      {/* Green Gradient Portal Header */}
      <div className="shipments-header">
        <div className="shipments-header-content">
          <button className="shipments-back-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
          <div className="shipments-title-section">
            <h1>Shipment Management</h1>
            <p>Track and manage all shipments</p>
          </div>
          <button className="shipments-create-btn" onClick={() => setShowModal(true)}>
            + Create Shipment
          </button>
        </div>        
        {/* Tabs */}
        <div className="shipments-tabs">
          <button 
            className={`shipments-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Shipments
          </button>
          <button 
            className={`shipments-tab ${activeTab === 'processing' ? 'active' : ''}`}
            onClick={() => setActiveTab('processing')}
          >
            Processing
          </button>
          <button 
            className={`shipments-tab ${activeTab === 'shipped' ? 'active' : ''}`}
            onClick={() => setActiveTab('shipped')}
          >
            Shipped & Tracking
          </button>
        </div>      </div>

      {/* Main Content */}
      <div className="shipments-content">
        {/* All Shipments Tab */}
        {activeTab === 'all' && (
        <div className="shipments-section">
          <div className="shipments-section-header">
            <h2>All Shipments</h2>
          </div>
          <div className="shipments-section-body">
            {loading ? (
              <div className="shipments-empty">Loading shipments...</div>
            ) : shipments.length === 0 ? (
              <div className="shipments-empty">
                <div className="shipments-empty-icon"></div>
                <h3>No Shipments Found</h3>
                <p>Create your first shipment to get started</p>
              </div>
            ) : (
              <div className="shipments-table-wrapper">
                <table className="shipments-table">
                  <thead>
                    <tr>
                      <th>Shipment #</th>
                      <th>Chemical/Lot</th>
                      <th>Amount</th>
                      <th>Recipient</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((s) => (
                      <tr key={s.id} className={s.status || ''}>
                        <td><strong>{s.shipment_number}</strong></td>
                        <td>
                          {s.sample_name || s.chemical_name || s.lot_number}
                          {s.is_hazmat && <span className="hazmat-badge">Hazmat</span>}
                        </td>
                        <td>{s.amount_shipped} {s.unit}</td>
                        <td>{s.recipient_name}</td>
                        <td>
                          <span className={`status-badge ${s.status || 'pending'}`}>
                            {s.status || 'pending'}
                          </span>
                        </td>
                        <td>
                          {s.shipped_date 
                            ? new Date(s.shipped_date).toLocaleDateString()
                            : s.created_at 
                            ? new Date(s.created_at).toLocaleDateString()
                            : 'N/A'
                          }
                        </td>
                        <td>
                          {s.status === 'initiated' && (
                            <button 
                              className="shipments-action-btn"
                              onClick={() => navigate(`/internal/processing/shipment/${s.id}`)}
                            >
                              Process
                            </button>
                          )}
                          {s.status === 'shipped' && (
                            <button 
                              className="shipments-action-btn"
                              onClick={() => navigate(`/internal/tracking/${s.id}`)}
                            >
                              Track
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Processing Tab */}
        {activeTab === 'processing' && (
        <div className="shipments-section">
          <div className="shipments-section-header">
            <h2>Shipments Pending Processing</h2>
            <button 
              className="shipments-primary-btn"
              onClick={() => navigate('/internal/processing-dashboard')}
            >
              Go to Processing Dashboard
            </button>
          </div>
          <div className="shipments-section-body">
            {loading ? (
              <div className="shipments-empty">Loading...</div>
            ) : shipments.filter(s => s.status === 'initiated').length === 0 ? (
              <div className="shipments-empty">
                <div className="shipments-empty-icon"></div>
                <h3>All Caught Up!</h3>
                <p>No shipments pending processing</p>
              </div>
            ) : (
              <div className="shipments-table-wrapper">
                <table className="shipments-table">
                  <thead>
                    <tr>
                      <th>Shipment #</th>
                      <th>Chemical/Lot</th>
                      <th>Amount</th>
                      <th>Recipient</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.filter(s => s.status === 'initiated').map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.shipment_number}</strong></td>
                        <td>
                          {s.sample_name || s.chemical_name || s.lot_number}
                          {s.is_hazmat && <span className="hazmat-badge">Hazmat</span>}
                        </td>
                        <td>{s.amount_shipped} {s.unit}</td>
                        <td>{s.recipient_name}</td>
                        <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          <button 
                            className="shipments-action-btn"
                            onClick={() => navigate(`/internal/processing/shipment/${s.id}`)}
                          >
                            Process
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Shipped & Tracking Tab */}
        {activeTab === 'shipped' && (
        <div className="shipments-section">
          <div className="shipments-section-header">
            <h2>Shipped & Tracking</h2>
          </div>
          <div className="shipments-section-body">
            {loading ? (
              <div className="shipments-empty">Loading...</div>
            ) : shipments.filter(s => s.status === 'shipped').length === 0 ? (
              <div className="shipments-empty">
                <div className="shipments-empty-icon"></div>
                <h3>No Shipped Shipments</h3>
                <p>Process shipments to see them here</p>
              </div>
            ) : (
              <div className="shipments-table-wrapper">
                <table className="shipments-table">
                  <thead>
                    <tr>
                      <th>Shipment #</th>
                      <th>Chemical/Lot</th>
                      <th>Tracking #</th>
                      <th>Recipient</th>
                      <th>Shipped Date</th>
                      <th>Est. Delivery</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.filter(s => s.status === 'shipped').map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.shipment_number}</strong></td>
                        <td>{s.sample_name || s.chemical_name || s.lot_number}</td>
                        <td>
                          <code className="tracking-number">{s.tracking_number || 'N/A'}</code>
                        </td>
                        <td>{s.recipient_name}</td>
                        <td>{s.shipped_date ? new Date(s.shipped_date).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          {s.estimated_delivery 
                            ? new Date(s.estimated_delivery).toLocaleDateString()
                            : 'N/A'
                          }
                        </td>
                        <td>
                          <button 
                            className="shipments-action-btn"
                            onClick={() => navigate(`/internal/tracking/${s.id}`)}
                          >
                            Track Package
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Shipping Supplies Section */}
        <div className="shipments-section">
          <div className="shipments-section-header">
            <h2>Shipping Supplies Inventory</h2>
          </div>
          <div className="shipments-section-body">
            <div className="shipments-table-wrapper">
              <table className="shipments-table">
                <thead>
                  <tr>
                    <th>UN Box Type</th>
                    <th>Inner Packing</th>
                    <th>DOT-SP #</th>
                    <th>Item #</th>
                    <th>Supplier</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {supplies.map((sup) => {
                    const stockLevel = sup.count < 5 ? 'low' : sup.count < 15 ? 'medium' : 'high';
                    return (
                      <tr key={sup.id}>
                        <td><strong>{sup.un_box_type}</strong></td>
                        <td>{sup.inner_packing || 'N/A'}</td>
                        <td>{sup.dot_sp_number || 'N/A'}</td>
                        <td>{sup.item_number || 'N/A'}</td>
                        <td>{sup.supplier || 'N/A'}</td>
                        <td>{sup.price ? `$${parseFloat(sup.price).toFixed(2)}` : 'N/A'}</td>
                        <td>
                          <span className={`stock-indicator ${stockLevel}`}>
                            {sup.count}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="shipments-action-btn"
                            onClick={() => {
                              setSelectedSupply(sup);
                              setShowSupplyModal(true);
                            }}
                          >
                            Update Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create Shipment Modal */}
      {showModal && (
        <div className="shipments-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="shipments-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="shipments-modal-header">
              <h2>Create New Shipment (Ship 1-10 Items per Request)</h2>
              <button className="shipments-modal-close" onClick={() => setShowModal(false)}>
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {/* Shipment Items Section */}
              <div className="shipments-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <label style={{ marginBottom: 0 }}>Samples to Ship ({formData.shipment_items.length}/10) *</label>
                  <button 
                    type="button" 
                    onClick={addShipmentItem}
                    disabled={formData.shipment_items.length >= 10}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: formData.shipment_items.length >= 10 ? '#ccc' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: formData.shipment_items.length >= 10 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    + Add Sample
                  </button>
                </div>

                {/* Samples List */}
                <div style={{ 
                  backgroundColor: '#f8f9fa',
                  padding: '1rem',
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {formData.shipment_items.map((item, index) => (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 150px 30px',
                      gap: '0.5rem',
                      marginBottom: index < formData.shipment_items.length - 1 ? '1rem' : 0,
                      paddingBottom: index < formData.shipment_items.length - 1 ? '1rem' : 0,
                      borderBottom: index < formData.shipment_items.length - 1 ? '1px solid #ddd' : 'none'
                    }}>
                      <div>
                        <label style={{ fontSize: '0.85rem' }}>Sample #{index + 1} *</label>
                        <select
                          required
                          value={item.sample_id}
                          onChange={(e) => handleShipmentItemChange(index, 'sample_id', e.target.value)}
                          style={{ width: '100%', padding: '0.5rem' }}
                        >
                          <option value="">-- Select sample --</option>
                          {samples.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.chemical_name} - {s.lot_number}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.85rem' }}>Amount *</label>
                        <input
                          type="number"
                          step="0.001"
                          required
                          value={item.amount_shipped}
                          onChange={(e) => handleShipmentItemChange(index, 'amount_shipped', e.target.value)}
                          placeholder="Qty"
                          style={{ width: '100%', padding: '0.5rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        {formData.shipment_items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeShipmentItem(index)}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              width: '100%'
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="shipments-form-group">
                <label>Unit *</label>
                <select 
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  <option value="g">Grams (g)</option>
                  <option value="ml">Milliliters (ml)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="L">Liters (L)</option>
                </select>
              </div>

              <div className="shipments-form-group">
                <label>Recipient Name *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  placeholder="Full name"
                />
              </div>

              <div className="shipments-form-group">
                <label>Street Address *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient_address}
                  onChange={(e) => setFormData({ ...formData, recipient_address: e.target.value })}
                  placeholder="Street address"
                />
              </div>

              <div className="shipments-form-group">
                <label>City *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient_city}
                  onChange={(e) => setFormData({ ...formData, recipient_city: e.target.value })}
                  placeholder="City"
                />
              </div>

              <div className="shipments-form-group">
                <label>State *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient_state}
                  onChange={(e) => setFormData({ ...formData, recipient_state: e.target.value })}
                  placeholder="State"
                />
              </div>

              <div className="shipments-form-group">
                <label>ZIP Code *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient_zip}
                  onChange={(e) => setFormData({ ...formData, recipient_zip: e.target.value })}
                  placeholder="ZIP"
                />
              </div>

              <div className="shipments-form-group">
                <label>Country *</label>
                <input
                  type="text"
                  required
                  value={formData.recipient_country}
                  onChange={(e) => setFormData({ ...formData, recipient_country: e.target.value })}
                  placeholder="Country"
                />
              </div>

              <div className="shipments-form-group">
                <label>Special Instructions</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special handling instructions..."
                  rows={3}
                />
              </div>

              {getRequiredSupplies().length > 0 && (
                <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <strong>Required Supplies:</strong>
                  <ul style={{ margin: '0.5rem 0 0 1.5rem' }}>
                    {getRequiredSupplies().map((req, i) => (
                      <li key={i}>{req.type} - {req.reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="shipments-form-actions">
                <button type="button" className="shipments-form-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="shipments-form-submit">
                  Create Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Supply Modal */}
      {showSupplyModal && selectedSupply && (
        <div className="shipments-modal-overlay" onClick={() => setShowSupplyModal(false)}>
          <div className="shipments-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shipments-modal-header">
              <h2>Update Supply Stock</h2>
              <button className="shipments-modal-close" onClick={() => setShowSupplyModal(false)}>
                Close
              </button>
            </div>
            <form onSubmit={handleUpdateSupply}>
              <div className="shipments-form-group">
                <label>Current Stock</label>
                <input type="text" value={selectedSupply.count} disabled />
              </div>

              <div className="shipments-form-group">
                <label>Add Stock *</label>
                <input
                  type="number"
                  required
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  placeholder="Amount to add"
                />
              </div>

              <div className="shipments-form-group">
                <label>New Total</label>
                <input 
                  type="text" 
                  value={selectedSupply.count + parseInt(restockAmount || '0')} 
                  disabled 
                />
              </div>

              <div className="shipments-form-actions">
                <button type="button" className="shipments-form-cancel" onClick={() => setShowSupplyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="shipments-form-submit">
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="dashboard-footer">
        <div className="footer-content">
          <div className="footer-text">
            © 2024 T-Link Portal. All rights reserved.
          </div>
          <div className="footer-logo">
            <span>Powered by </span>
            <strong>AAL Digital Development</strong>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Shipments;
