import React, { useState } from 'react';
import './ManufacturerPortal.css';
import { useAuthStore } from '../store/authStore';

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

const ManufacturerPortal: React.FC = () => {
  const { user } = useAuthStore();
  const storedUserStr = localStorage.getItem('user');
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
  const effectiveUser = user || storedUser;

  const [activeModal, setActiveModal] = useState<'coa' | 'inventory' | 'shipment' | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // COA Search
  const [coaSearch, setCoaSearch] = useState({ sampleName: '', lotNumber: '' });

  // Inventory Search
  const [inventorySearch, setInventorySearch] = useState({ sampleName: '', lotNumber: '' });

  const handleCoaSearch = async () => {
    setSearchLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await api.post('/manufacturer/coa/search', coaSearch);
      setSearchResult({
        found: true,
        type: 'coa',
        message: 'COA Found',
        data: {
          name: coaSearch.sampleName || 'Sample COA',
          lotNumber: coaSearch.lotNumber || 'LOT-001',
          createdDate: '2026-01-15',
          expirationDate: '2027-01-15',
          pdfPath: '/pdfs/sample-coa.pdf'
        }
      });
    } catch (error) {
      setSearchResult({
        found: false,
        type: 'coa',
        message: 'COA not found. Please verify the sample name and lot number.'
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInventorySearch = async () => {
    setSearchLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await api.post('/manufacturer/inventory/search', inventorySearch);
      setSearchResult({
        found: true,
        type: 'inventory',
        message: 'Inventory Found',
        data: {
          name: inventorySearch.sampleName || 'Sample',
          lotNumber: inventorySearch.lotNumber || 'LOT-001',
          quantity: 250
        }
      });
    } catch (error) {
      setSearchResult({
        found: false,
        type: 'inventory',
        message: 'Inventory record not found.'
      });
    } finally {
      setSearchLoading(false);
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
            <p className="subtitle">Dedicated access for Teleos AG Solutions affiliates to documentation, shipments, and CoAs.</p>
          </div>
        </div>
        <div className="header-right">
          <div className="user-badge">
            <div className="user-icon">👤</div>
            <div className="user-details">
              <div className="user-email">{effectiveUser?.email}</div>
              <div className="user-role">{effectiveUser?.role}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="portal-content">
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

            <button className="action-btn shipment-btn" onClick={() => setActiveModal('shipment')}>
              <span className="btn-icon">🚚</span>
              <span className="btn-label">Shipments</span>
              <span className="btn-desc">View orders & tracking</span>
            </button>
          </div>
        </div>
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
                    placeholder="e.g., API Sample 001"
                  />
                </div>

                <div className="form-group">
                  <label>Lot Number</label>
                  <input
                    type="text"
                    value={coaSearch.lotNumber}
                    onChange={(e) => setCoaSearch({ ...coaSearch, lotNumber: e.target.value })}
                    placeholder="e.g., LOT-2026-001"
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
                        <span className="label">Date of Creation:</span>
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
                    placeholder="e.g., API Sample 001"
                  />
                </div>

                <div className="form-group">
                  <label>Lot Number</label>
                  <input
                    type="text"
                    value={inventorySearch.lotNumber}
                    onChange={(e) => setInventorySearch({ ...inventorySearch, lotNumber: e.target.value })}
                    placeholder="e.g., LOT-2026-001"
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

      {/* Shipment Modal */}
      {activeModal === 'shipment' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Shipments & Tracking</h3>
              <button className="close-btn" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-content">
              <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                Shipment dashboard loading...
              </p>
              {/* TODO: Insert shipment dashboard component here */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturerPortal;
