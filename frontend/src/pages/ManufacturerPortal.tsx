import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ManufacturerPortal.css';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface SearchResult {
  found: boolean;
  type: 'coa' | 'inventory';
  data?: {
    name: string;
    lotNumber: string;
    createdDate?: string;
    expirationDate?: string;
    quantity?: number;
    pdfPath?: string;
  };
  message: string;
}

interface Shipment {
  id: string;
  shipment_number: string;
  lot_number: string;
  quantity: number;
  unit: string;
  status: 'initiated' | 'processing' | 'shipped' | 'delivered';
  created_at: string;
  scheduled_ship_date?: string;
  tracking_number?: string;
  carrier?: string;
  is_hazmat: boolean;
  shipped_date?: string;
  estimated_delivery?: string;
}

const ManufacturerPortal: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const storedUserStr = localStorage.getItem('user');
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
  const effectiveUser = user || storedUser;

  const [activeModal, setActiveModal] = useState<'coa' | 'inventory' | 'shipment' | 'request-shipment' | 'contact' | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // COA Search
  const [coaSearch, setCoaSearch] = useState({ sampleName: '', lotNumber: '' });

  // Inventory Search
  const [inventorySearch, setInventorySearch] = useState({ sampleName: '', lotNumber: '' });

  // Shipment state
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);

  // Shipment Request Form
  const [shipmentRequest, setShipmentRequest] = useState({
    firstName: '',
    lastName: '',
    deliveryAddress: '',
    sampleName: '',
    lotNumber: '',
    quantityRequested: '',
    quantityUnit: 'ml',
    scheduledShipDate: ''
  });
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestResult, setRequestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleLogout = () => {
    logout();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  // Fetch shipments when shipment modal opens
  useEffect(() => {
    if (activeModal === 'shipment') {
      fetchShipments();
    }
  }, [activeModal]);

  const fetchShipments = async () => {
    setShipmentsLoading(true);
    try {
      const response = await api.get('/manufacturer/shipments/my-requests');
      setShipments(response.data.shipments || []);
    } catch (error: any) {
      console.error('Error fetching shipments:', error);
      setShipments([]);
    } finally {
      setShipmentsLoading(false);
    }
  };

  const handleCoaSearch = async () => {
    if (!coaSearch.lotNumber.trim()) {
      setSearchResult({
        found: false,
        type: 'coa',
        message: 'Please enter a lot number.'
      });
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.get('/manufacturer/coa/search', {
        params: { lot_number: coaSearch.lotNumber }
      });
      
      const sample = response.data.sample;
      setSearchResult({
        found: true,
        type: 'coa',
        message: 'COA Found',
        data: {
          name: sample.name || 'Sample',
          lotNumber: sample.lot_number || coaSearch.lotNumber,
          createdDate: sample.certification_date ? new Date(sample.certification_date).toLocaleDateString() : 'Not extracted',
          expirationDate: sample.expiration_date ? new Date(sample.expiration_date).toLocaleDateString() : 'Not extracted',
          pdfPath: sample.file_path
        }
      });
    } catch (error: any) {
      console.error('CoA search error:', error);
      setSearchResult({
        found: false,
        type: 'coa',
        message: error.response?.data?.error || 'COA not found. Please verify the lot number.'
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInventorySearch = async () => {
    if (!inventorySearch.sampleName.trim()) {
      setSearchResult({
        found: false,
        type: 'inventory',
        message: 'Please enter a sample name.'
      });
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.get('/manufacturer/inventory/search', {
        params: { sample_name: inventorySearch.sampleName }
      });
      
      if (response.data.samples && response.data.samples.length > 0) {
        const sample = response.data.samples[0];
        setSearchResult({
          found: true,
          type: 'inventory',
          message: 'Inventory Found',
          data: {
            name: sample.name,
            lotNumber: sample.lot_number,
            quantity: sample.available_quantity
          }
        });
      } else {
        setSearchResult({
          found: false,
          type: 'inventory',
          message: 'No inventory records found for this sample.'
        });
      }
    } catch (error: any) {
      console.error('Inventory search error:', error);
      setSearchResult({
        found: false,
        type: 'inventory',
        message: error.response?.data?.error || 'Inventory record not found.'
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleShipmentRequest = async () => {
    if (!shipmentRequest.firstName || !shipmentRequest.lastName || !shipmentRequest.deliveryAddress || 
        !shipmentRequest.sampleName || !shipmentRequest.lotNumber || !shipmentRequest.quantityRequested) {
      setRequestResult({
        success: false,
        message: 'Please fill in all required fields.'
      });
      return;
    }

    setRequestLoading(true);
    try {
      const response = await api.post('/manufacturer/shipments/request', {
        first_name: shipmentRequest.firstName,
        last_name: shipmentRequest.lastName,
        delivery_address: shipmentRequest.deliveryAddress,
        sample_name: shipmentRequest.sampleName,
        lot_number: shipmentRequest.lotNumber,
        quantity_requested: parseFloat(shipmentRequest.quantityRequested),
        quantity_unit: shipmentRequest.quantityUnit,
        scheduled_ship_date: shipmentRequest.scheduledShipDate || null
      });

      setRequestResult({
        success: true,
        message: `Shipment request created successfully! Shipment #${response.data.shipment.shipment_number}`
      });

      // Reset form
      setShipmentRequest({
        firstName: '',
        lastName: '',
        deliveryAddress: '',
        sampleName: '',
        lotNumber: '',
        quantityRequested: '',
        quantityUnit: 'ml',
        scheduledShipDate: ''
      });
    } catch (error: any) {
      console.error('Shipment request error:', error);
      setRequestResult({
        success: false,
        message: error.response?.data?.error || 'Failed to create shipment request. Please try again.'
      });
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="manufacturer-portal">
      {/* Header */}
      <div className="portal-header">
        <div className="header-left">
          <img src="/images/tlink-official-logo.png" alt="T-Link" className="logo" />
          <div className="header-text">
            <h1>Manufacturer Access Portal</h1>
          </div>
        </div>
        <div className="header-right">
          <button className="contact-btn" onClick={() => setActiveModal('contact')}>
            💬 Contact Support
          </button>
          <div className="user-badge-container">
            <button 
              className="user-badge" 
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-icon">👤</div>
              <div className="user-details">
                <div className="user-email">{effectiveUser?.email}</div>
                <div className="user-role">{effectiveUser?.role}</div>
              </div>
              <span className="dropdown-icon">▼</span>
            </button>
            {showUserMenu && (
              <div className="user-menu">
                <button onClick={handleLogout} className="menu-item logout">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="portal-content">
        {/* ...other content... */}
      </div>

      {/* COA Search Modal */}
      {activeModal === 'coa' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Search Certificate of Analysis</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            {!searchResult ? (
              <div className="modal-content">
                <div className="form-group">
                  <label>Sample Name</label>
                  <input
                    type="text"
                    value={coaSearch.sampleName}
                    onChange={(e) => setCoaSearch({ ...coaSearch, sampleName: e.target.value })}
                    placeholder="e.g., 1,2,2-trichloropropane"
                  />
                </div>

                <div className="form-group">
                  <label>Lot Number</label>
                  <input
                    type="text"
                    value={coaSearch.lotNumber}
                    onChange={(e) => setCoaSearch({ ...coaSearch, lotNumber: e.target.value })}
                    placeholder="e.g., YC2-106153-90"
                  />
                </div>

                <div className="modal-actions">
                  <button className="btn-cancel" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn-search" onClick={handleCoaSearch} disabled={searchLoading}>
                    {searchLoading ? 'Searching...' : 'Initiate Search'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-content">
                {searchResult.found ? (
                  <div className="search-result success">
                    <div className="result-header">✓ {searchResult.message}</div>
                    <div className="result-details">
                      <div className="detail-row">
                        <span className="label">Sample Name:</span>
                        <span className="value">{searchResult.data?.name}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Lot Number:</span>
                        <span className="value">{searchResult.data?.lotNumber}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Created Date:</span>
                        <span className="value">{searchResult.data?.createdDate}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Expiration Date:</span>
                        <span className="value">{searchResult.data?.expirationDate}</span>
                      </div>
                    </div>

                    <div className="pdf-viewer">
                      <p>📄 PDF ready for viewing</p>
                      <a href={searchResult.data?.pdfPath} target="_blank" rel="noopener noreferrer" className="btn-pdf-view">
                        View PDF
                      </a>
                      <a href={searchResult.data?.pdfPath} download className="btn-pdf-download">
                        Download PDF
                      </a>
                    </div>

                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => { setActiveModal(null); setSearchResult(null); setCoaSearch({ sampleName: '', lotNumber: '' }); }}>
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="search-result error">
                    <div className="result-header">✗ Not Found</div>
                    <p>{searchResult.message}</p>
                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => setSearchResult(null)}>Back to Search</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory Search Modal */}
      {activeModal === 'inventory' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sample Inventory Quantity Inquiry</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            {!searchResult ? (
              <div className="modal-content">
                <div className="form-group">
                  <label>Sample Name</label>
                  <input
                    type="text"
                    value={inventorySearch.sampleName}
                    onChange={(e) => setInventorySearch({ ...inventorySearch, sampleName: e.target.value })}
                    placeholder="e.g., 1,2,2-trichloropropane"
                  />
                </div>

                <div className="form-group">
                  <label>Lot Number</label>
                  <input
                    type="text"
                    value={inventorySearch.lotNumber}
                    onChange={(e) => setInventorySearch({ ...inventorySearch, lotNumber: e.target.value })}
                    placeholder="e.g., YC2-106153-90"
                  />
                </div>

                <div className="modal-actions">
                  <button className="btn-cancel" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn-search" onClick={handleInventorySearch} disabled={searchLoading}>
                    {searchLoading ? 'Searching...' : 'Initiate Search'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-content">
                {searchResult.found ? (
                  <div className="search-result success">
                    <div className="result-header">✓ {searchResult.message}</div>
                    <div className="result-details">
                      <div className="detail-row">
                        <span className="label">Sample Name:</span>
                        <span className="value">{searchResult.data?.name}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Lot Number:</span>
                        <span className="value">{searchResult.data?.lotNumber}</span>
                      </div>
                      <div className="detail-row highlight">
                        <span className="label">Available Quantity:</span>
                        <span className="value quantity">{searchResult.data?.quantity}</span>
                      </div>
                    </div>

                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => { setActiveModal(null); setSearchResult(null); setInventorySearch({ sampleName: '', lotNumber: '' }); }}>
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="search-result error">
                    <div className="result-header">✗ Not Found</div>
                    <p>{searchResult.message}</p>
                    <div className="modal-actions">
                      <button className="btn-cancel" onClick={() => setSearchResult(null)}>Back to Search</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Request Shipment Modal */}
      {activeModal === 'request-shipment' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Request Shipment</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>

            {!requestResult ? (
              <div className="modal-content">
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      type="text"
                      value={shipmentRequest.firstName}
                      onChange={(e) => setShipmentRequest({ ...shipmentRequest, firstName: e.target.value })}
                      placeholder="Enter first name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      value={shipmentRequest.lastName}
                      onChange={(e) => setShipmentRequest({ ...shipmentRequest, lastName: e.target.value })}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Delivery Address *</label>
                  <textarea
                    value={shipmentRequest.deliveryAddress}
                    onChange={(e) => setShipmentRequest({ ...shipmentRequest, deliveryAddress: e.target.value })}
                    placeholder="Enter full delivery address"
                    rows={3}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Sample Name *</label>
                    <input
                      type="text"
                      value={shipmentRequest.sampleName}
                      onChange={(e) => setShipmentRequest({ ...shipmentRequest, sampleName: e.target.value })}
                      placeholder="e.g., 1,2,2-trichloropropane"
                    />
                  </div>

                  <div className="form-group">
                    <label>Lot Number *</label>
                    <input
                      type="text"
                      value={shipmentRequest.lotNumber}
                      onChange={(e) => setShipmentRequest({ ...shipmentRequest, lotNumber: e.target.value })}
                      placeholder="e.g., YC2-106153-90"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity Requested *</label>
                    <input
                      type="number"
                      value={shipmentRequest.quantityRequested}
                      onChange={(e) => setShipmentRequest({ ...shipmentRequest, quantityRequested: e.target.value })}
                      placeholder="Enter quantity"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label>Unit</label>
                    <select
                      value={shipmentRequest.quantityUnit}
                      onChange={(e) => setShipmentRequest({ ...shipmentRequest, quantityUnit: e.target.value })}
                    >
                      <option value="ml">mL</option>
                      <option value="L">L</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="mg">mg</option>
                      <option value="units">units</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Scheduled Ship Date (Optional)</label>
                  <input
                    type="date"
                    value={shipmentRequest.scheduledShipDate}
                    onChange={(e) => setShipmentRequest({ ...shipmentRequest, scheduledShipDate: e.target.value })}
                  />
                </div>

                <div className="modal-actions">
                  <button className="btn-cancel" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn-search" onClick={handleShipmentRequest} disabled={requestLoading}>
                    {requestLoading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-content">
                <div className={`search-result ${requestResult.success ? 'success' : 'error'}`}>
                  <div className="result-header">{requestResult.success ? '✓ Success' : '✗ Error'}</div>
                  <p>{requestResult.message}</p>
                  <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => { setActiveModal(null); setRequestResult(null); }}>
                      Close
                    </button>
                    {requestResult.success && (
                      <button className="btn-search" onClick={() => { setActiveModal('shipment'); setRequestResult(null); }}>
                        View Shipments
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shipment Modal */}
      {activeModal === 'shipment' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Shipments & Tracking</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-content">
              {shipmentsLoading ? (
                <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                  Loading shipments...
                </p>
              ) : shipments.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                  No shipments found.
                </p>
              ) : (
                <div className="shipments-list">
                  {shipments.map((shipment) => (
                    <div key={shipment.id} className="shipment-card">
                      <div className="shipment-header">
                        <div>
                          <div className="shipment-lot">Lot: {shipment.lot_number}</div>
                          <div className="shipment-date">Requested: {new Date(shipment.created_at).toLocaleDateString()}</div>
                        </div>
                        <div className={`shipment-status status-${shipment.status}`}>
                          {shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1)}
                        </div>
                      </div>
                      <div className="shipment-details">
                        <div className="detail-item">
                          <span className="label">Quantity:</span>
                          <span className="value">{shipment.quantity} {shipment.unit}</span>
                        </div>
                        {shipment.tracking_number && (
                          <div className="detail-item">
                            <span className="label">Tracking Number:</span>
                            <span className="value">{shipment.tracking_number}</span>
                          </div>
                        )}
                        {shipment.carrier && (
                          <div className="detail-item">
                            <span className="label">Carrier:</span>
                            <span className="value">{shipment.carrier}</span>
                          </div>
                        )}
                        {shipment.scheduled_ship_date && (
                          <div className="detail-item">
                            <span className="label">Scheduled Ship Date:</span>
                            <span className="value">{new Date(shipment.scheduled_ship_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {shipment.estimated_delivery && (
                          <div className="detail-item">
                            <span className="label">Estimated Delivery:</span>
                            <span className="value">{new Date(shipment.estimated_delivery).toLocaleDateString()}</span>
                          </div>
                        )}
                        {shipment.is_hazmat && (
                          <div className="detail-item hazmat">
                            <span className="label">⚠️ Hazmat Materials</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setActiveModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {activeModal === 'contact' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Contact Support</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-content">
              <p style={{ textAlign: 'center', marginBottom: '24px', color: '#666' }}>
                Select the type of support you need:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <button 
                  onClick={() => { setActiveModal(null); navigate('/manufacturer/support?type=tech'); }}
                  className="contact-type-btn tech"
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖥️</div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Technical Support</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Portal & access issues</div>
                </button>
                <button 
                  onClick={() => { setActiveModal(null); navigate('/manufacturer/support?type=lab'); }}
                  className="contact-type-btn lab"
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧪</div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Lab Support</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Sample & shipment questions</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Quick Actions */}
      <div className="portal-bottom">
        <div className="actions-container">
          <h2>Quick Actions</h2>
          <div className="actions-grid">
            <button className="action-btn coa-btn" onClick={() => setActiveModal('coa')}>
              <span className="btn-icon">📄</span>
              <span className="btn-label">Fetch Certificate of Analysis</span>
              <span className="btn-desc">Search and download CoAs</span>
            </button>

            <button className="action-btn inventory-btn" onClick={() => setActiveModal('inventory')}>
              <span className="btn-icon">📦</span>
              <span className="btn-label">Sample Inventory Quantity</span>
              <span className="btn-desc">Check stock availability</span>
            </button>

            <button className="action-btn request-btn" onClick={() => setActiveModal('request-shipment')}>
              <span className="btn-icon">📤</span>
              <span className="btn-label">Request Shipment</span>
              <span className="btn-desc">Order sample delivery</span>
            </button>

            <button className="action-btn shipment-btn" onClick={() => setActiveModal('shipment')}>
              <span className="btn-icon">🚚</span>
              <span className="btn-label">Shipments</span>
              <span className="btn-desc">View orders & tracking</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="portal-footer">
        <div className="footer-content">
          <span className="footer-text">Developed and operated by</span>
          <img src="/images/AAL_Dig_Dev.png" alt="AAL Digital Development" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
};

export default ManufacturerPortal;
