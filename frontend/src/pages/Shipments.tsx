import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './SampleInventory.css';

interface Sample {
  id: string;
  chemical_name: string;
  lot_number: string;
  cas_number: string;
  quantity: string;
  hazard_class: string;
  un_number: string;
}

const Shipments: React.FC = () => {
  const [shipments, setShipments] = useState<any[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [selectedSupply, setSelectedSupply] = useState<any>(null);
  const [restockAmount, setRestockAmount] = useState('');
  
  const [formData, setFormData] = useState({
    sample_id: '',
    amount_shipped: '',
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
    try {
      const response = await api.get('/shipments');
      setShipments(response.data.data || []);
    } catch (err) {
      console.error('Error fetching shipments:', err);
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
      setSupplies(response.data.data || []);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handlePrintSDS = async () => {
    if (!selectedSample) return;
    try {
      const response = await api.get(`/sample-inventory/${selectedSample.id}/sds/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const printWindow = window.open(url, '_blank');
      if (printWindow) printWindow.onload = () => printWindow.print();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to print SDS');
    }
  };

  const getRequiredSupplies = () => {
    if (!formData.amount_shipped) return [];
    const amount = parseFloat(formData.amount_shipped);
    if (amount <= 30) return [{ type: '4GV/X 2.9/S/23', reason: 'Small quantity (<30g)' }];
    if (amount <= 100) return [{ type: '4GV/X 4.0/S/25', reason: 'Medium quantity (30-100g)' }];
    return [{ type: '4GV/X 10/S/25', reason: 'Large quantity (>100g)' }];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSample) return;
    try {
      const response = await api.post('/shipments', { 
        ...formData, 
        lot_number: selectedSample.lot_number, 
        chemical_name: selectedSample.chemical_name,
        hazard_class: selectedSample.hazard_class,
        un_number: selectedSample.un_number
      });
      
      const message = response.data.message || 'Shipment created successfully!';
      alert(`✅ ${message}\n\nThe sample quantity has been automatically updated in inventory.`);
      
      setShowModal(false);
      setSelectedSample(null);
      setFormData({
        sample_id: '',
        amount_shipped: '',
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
      alert('❌ Error: ' + errorMsg);
    }
  };

  const handleUpdateSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupply || !restockAmount) return;
    
    try {
      const newCount = selectedSupply.count + parseInt(restockAmount);
      await api.post(`/shipments/supplies/${selectedSupply.id}/restock`, { count: newCount });
      
      alert(`✅ Updated ${selectedSupply.un_box_type} stock to ${newCount}`);
      setShowSupplyModal(false);
      setSelectedSupply(null);
      setRestockAmount('');
      fetchSupplies();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update supply');
    }
  };

  return (
    <div className="sample-inventory">
      <div className="page-header">
        <h1>Shipment Management</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Create Shipment</button>
      </div>

      <div className="table-container">
        <h2>Active Shipments</h2>
        <table className="samples-table">
          <thead>
            <tr>
              <th>Shipment #</th>
              <th>Chemical/Lot</th>
              <th>Amount</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>No shipments found</td></tr>
            ) : (
              shipments.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.shipment_number}</strong></td>
                  <td>{s.chemical_name || s.lot_number}</td>
                  <td>{s.amount_shipped} {s.unit}</td>
                  <td>{s.recipient_name}</td>
                  <td><span className={`badge badge-${s.status === 'delivered' ? 'success' : 'warning'}`}>{s.status}</span></td>
                  <td>{s.shipped_date ? new Date(s.shipped_date).toLocaleDateString() : 'N/A'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="table-container" style={{ marginTop: '40px' }}>
        <h2>Shipping Supplies Inventory</h2>
        <table className="samples-table">
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
            {supplies.map((sup) => (
              <tr key={sup.id}>
                <td><strong>{sup.un_box_type}</strong></td>
                <td>{sup.inner_packing_type}</td>
                <td>{sup.dot_sp_number}</td>
                <td>{sup.item_number}</td>
                <td>{sup.purchased_from}</td>
                <td>{sup.price_per_unit}</td>
                <td><span className={sup.count < 5 ? 'badge badge-danger' : 'badge badge-success'}>{sup.count}</span></td>
                <td>
                  <button className="btn btn-sm btn-primary" onClick={() => { setSelectedSupply(sup); setShowSupplyModal(true); }}>
                    📦 Update Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>Create Shipment</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Select Sample *</label>
                  <select required value={formData.sample_id} onChange={(e) => {
                    const sample = samples.find(s => s.id === e.target.value);
                    setSelectedSample(sample || null);
                    setFormData({ ...formData, sample_id: e.target.value });
                  }}>
                    <option value="">-- Select a sample --</option>
                    {samples.map((s) => (
                      <option key={s.id} value={s.id}>{s.chemical_name} (Lot: {s.lot_number}) - Qty: {s.quantity}</option>
                    ))}
                  </select>
                </div>

                {selectedSample && (
                  <>
                    <div className="form-group full-width" style={{ backgroundColor: '#f0f8ff', padding: '15px', borderRadius: '4px' }}>
                      <h4>Sample: {selectedSample.chemical_name}</h4>
                      <p>CAS: {selectedSample.cas_number} | Qty: {selectedSample.quantity}</p>
                      <p>Hazard: {selectedSample.hazard_class} | UN: {selectedSample.un_number}</p>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={handlePrintSDS}>🖨️ Print SDS</button>
                    </div>

                    <div className="form-group">
                      <label>Amount to Ship *</label>
                      <input type="number" step="0.001" required value={formData.amount_shipped} onChange={(e) => setFormData({ ...formData, amount_shipped: e.target.value })} />
                    </div>

                    <div className="form-group">
                      <label>Unit *</label>
                      <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                        <option value="g">grams (g)</option>
                        <option value="mg">milligrams (mg)</option>
                        <option value="mL">milliliters (mL)</option>
                      </select>
                    </div>

                    {formData.amount_shipped && (
                      <div className="form-group full-width" style={{ backgroundColor: '#fff3cd', padding: '15px', borderRadius: '4px' }}>
                        <h4>Required Supplies</h4>
                        {getRequiredSupplies().map((r, i) => <p key={i}><strong>{r.type}</strong> - {r.reason}</p>)}
                        <small>⚠️ Requirements will be customized based on regulations</small>
                      </div>
                    )}

                    <div className="form-group"><label>Recipient *</label><input type="text" required value={formData.recipient_name} onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })} /></div>
                    <div className="form-group"><label>Address *</label><input type="text" required value={formData.recipient_address} onChange={(e) => setFormData({ ...formData, recipient_address: e.target.value })} /></div>
                    <div className="form-group"><label>City *</label><input type="text" required value={formData.recipient_city} onChange={(e) => setFormData({ ...formData, recipient_city: e.target.value })} /></div>
                    <div className="form-group"><label>State *</label><input type="text" required value={formData.recipient_state} onChange={(e) => setFormData({ ...formData, recipient_state: e.target.value })} /></div>
                    <div className="form-group"><label>ZIP *</label><input type="text" required value={formData.recipient_zip} onChange={(e) => setFormData({ ...formData, recipient_zip: e.target.value })} /></div>
                    <div className="form-group"><label>Country *</label><input type="text" required value={formData.recipient_country} onChange={(e) => setFormData({ ...formData, recipient_country: e.target.value })} /></div>
                    <div className="form-group full-width"><label>Notes</label><textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!selectedSample}>Create Shipment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSupplyModal && (
        <div className="modal-overlay" onClick={() => setShowSupplyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Update Supply Stock</h2>
              <button className="close-btn" onClick={() => setShowSupplyModal(false)}>×</button>
            </div>
            <form onSubmit={handleUpdateSupply}>
              {selectedSupply && (
                <>
                  <div style={{ backgroundColor: '#f0f8ff', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                    <h4>{selectedSupply.un_box_type}</h4>
                    <p><strong>Current Stock:</strong> {selectedSupply.count}</p>
                    <p><strong>Item #:</strong> {selectedSupply.item_number}</p>
                    <p><strong>Supplier:</strong> {selectedSupply.purchased_from}</p>
                  </div>

                  <div className="form-group">
                    <label>Adjustment Amount *</label>
                    <input 
                      type="number" 
                      required 
                      value={restockAmount} 
                      onChange={(e) => setRestockAmount(e.target.value)} 
                      placeholder="Enter positive or negative number"
                      style={{ fontSize: '16px' }}
                    />
                    <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                      Positive number to add stock, negative to reduce. New total: {selectedSupply.count + parseInt(restockAmount || '0')}
                    </small>
                  </div>
                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupplyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shipments;
