import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './InventorySearch.css';

interface InventoryResult {
  id: string;
  name: string;
  lot_number: string;
  available_quantity: number;
  unit: string;
  status: string;
}

const InventorySearch: React.FC = () => {
  const navigate = useNavigate();
  const [sampleName, setSampleName] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sampleName.trim() && !lotNumber.trim()) {
      toast.error('Please enter a sample name or lot number');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await api.get('/manufacturer/inventory/search', {
        params: {
          sample_name: sampleName || undefined,
          lot_number: lotNumber || undefined,
        },
      });

      setResults(response.data.samples);
      toast.success(`Found ${response.data.count} sample(s)`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Samples not found';
      setResults([]);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/manufacturer/dashboard');
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#d1f0d9';
      case 'low':
        return '#fff3cd';
      case 'out_of_stock':
        return '#f8d7da';
      default:
        return '#e8e8e8';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#0a5028';
      case 'low':
        return '#664d03';
      case 'out_of_stock':
        return '#842029';
      default:
        return '#383d41';
    }
  };

  return (
    <div className="inventory-portal-page">
      <div className="inventory-portal-header">
        <div className="inventory-header-top">
          <button onClick={handleGoBack} className="inventory-btn-back">
            Back to Dashboard
          </button>
          <h1>Sample Inventory</h1>
        </div>
      </div>

      <div className="inventory-portal-content">
        <div className="inventory-search-section">
          <form onSubmit={handleSearch} className="inventory-search-form">
            <div className="inventory-search-group">
              <label htmlFor="sampleName">Sample Name</label>
              <input
                type="text"
                id="sampleName"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                placeholder="e.g., Sample XYZ, Product A"
                className="inventory-search-input"
              />
            </div>
            <div className="inventory-search-group">
              <label htmlFor="lotNumber">Lot Number</label>
              <input
                type="text"
                id="lotNumber"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g., LOT-2026-001"
                className="inventory-search-input"
              />
            </div>
            <button type="submit" className="inventory-search-btn" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        <div className="inventory-results-section">
          {searched && results.length === 0 && !loading && (
            <div className="inventory-no-results">
              <p className="inventory-no-results-text">No samples found matching this name.</p>
              <p className="inventory-no-results-hint">Please try a different search term or contact support.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="inventory-results-list">
              <h2 className="inventory-results-title">Available Samples</h2>
              <div className="inventory-table-wrapper">
                <table className="inventory-data-table">
                  <thead>
                    <tr>
                      <th>Sample Name</th>
                      <th>Lot Number</th>
                      <th>Available Quantity</th>
                      <th>Unit</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => (
                      <tr key={result.id}>
                        <td>{result.name}</td>
                        <td><strong>{result.lot_number}</strong></td>
                        <td>{result.available_quantity}</td>
                        <td>{result.unit}</td>
                        <td>
                          <span
                            className="inventory-status-badge"
                            style={{
                              backgroundColor: getStatusBadgeColor(result.status),
                              color: getStatusTextColor(result.status),
                            }}
                          >
                            {result.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="inventory-summary-info">
                <p className="inventory-summary-text">
                  Found <strong>{results.length}</strong> sample{results.length !== 1 ? 's' : ''} matching your search.
                </p>
              </div>
            </div>
          )}

          {!searched && (
              <div className="inventory-empty-icon"></div>
              <h2 className="inventory-empty-title">Search Sample Inventory</h2>
              <p className="inventory-empty-text">
                Enter a sample name above to check current availability and quantity in our inventory.
              </p>
            </div>
          )}
        <div className="inventory-info-section" aria-hidden>
          <h3 className="inventory-info-title">About Inventory</h3>
          <div className="inventory-info-grid">
            <div className="inventory-info-item">Real-time inventory updates</div>
            <div className="inventory-info-item">Accurate quantity tracking</div>
            <div className="inventory-info-item">Lot number identification</div>
            <div className="inventory-info-item">Ready for shipment requests</div>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="inventory-portal-page">
      {/* Portal Header */}
      <div className="inventory-portal-header">
        <div className="inventory-header-top">
          <button onClick={handleGoBack} className="inventory-btn-back">
            Back to Dashboard
          </button>
          <h1>Sample Inventory</h1>
        </div>
      </div>

      {/* Content */}
      <div className="inventory-portal-content">
        {/* Search Section */}
        <div className="inventory-search-section">
          <form onSubmit={handleSearch} className="inventory-search-form">
            <div className="search-fields">
              <div className="inventory-search-form-group">
                <label htmlFor="sampleName">Chemical Name</label>
                <input
                  type="text"
                  id="sampleName"
                  value={sampleName}
                  onChange={(e) => setSampleName(e.target.value)}
                  placeholder="e.g., Sodium Chloride"
                  className="inventory-search-input"
                />
              </div>
              <div className="inventory-search-form-group">
                <label htmlFor="lotNumber">Lot Number</label>
                <input
                  type="text"
                  id="lotNumber"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="e.g., LOT-2026-001"
                  className="inventory-search-input"
                />
              </div>
            </div>
            <button type="submit" className="inventory-search-button" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Results Section */}
        <div className="inventory-results-section">
          {searched && results.length === 0 && !loading && (
            <div className="inventory-no-results">
              <p className="inventory-no-results-text">
                No samples found matching your search criteria.
              </p>
              <p className="inventory-no-results-hint">
                Please verify the information and try again.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="inventory-results-list">
              <h2 className="inventory-results-title">Results</h2>
              {results.map((item, index) => (
                <div key={index} className="inventory-result-card">
                  <div className="inventory-result-header">
                    <h3 className="inventory-result-name">{item.chemical_name}</h3>
                    <span className="inventory-status-badge">{item.status}</span>
                  </div>

                  <div className="inventory-result-body">
                    <div className="inventory-info-list">
                      <div className="inventory-info-item">
                        <strong>Lot Number:</strong> {item.lot_number}
                      </div>
                      <div className="inventory-info-item">
                        <strong>Quantity:</strong> {item.quantity} {item.unit || ''}
                      </div>
                      {item.concentration && (
                        <div className="inventory-info-item">
                          <strong>Concentration:</strong> {item.concentration}
                        </div>
                      )}
                      {item.cas_number && (
                        <div className="inventory-info-item">
                          <strong>CAS Number:</strong> {item.cas_number}
                        </div>
                      )}
                    </div>

                    {/* Certifications & Documents */}
                    <div className="inventory-docs-section">
                      <h4>Certifications & Documents</h4>
                      <div className="inventory-docs-list">
                        <div className="inventory-doc-item">
                          <span>Has CoA</span>
                          <span className={item.has_coa ? 'yes' : 'no'}>
                            {item.has_coa ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="inventory-doc-item">
                          <span>Has SDS</span>
                          <span className={item.has_dow_sds ? 'yes' : 'no'}>
                            {item.has_dow_sds ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expiration Info */}
                    {item.expiration_date && (
                      <div className="inventory-expiration-info">
                        <strong>Expiration:</strong> {new Date(item.expiration_date).toLocaleDateString()}
                      </div>
                    )}

                    {/* Hazmat Information */}
                    {(item.un_number || item.hazard_class) && (
                      <div className="inventory-hazmat-section">
                        <h4>Hazmat Information</h4>
                        <div className="inventory-data-table-container">
                          <table className="inventory-data-table">
                            <tbody>
                              {item.un_number && (
                                <tr>
                                  <th>UN Number</th>
                                  <td>{item.un_number}</td>
                                </tr>
                              )}
                              {item.hazard_description && (
                                <tr>
                                  <th>Hazard Description</th>
                                  <td>{item.hazard_description}</td>
                                </tr>
                              )}
                              {item.hazard_class && (
                                <tr>
                                  <th>Hazard Class</th>
                                  <td>{item.hazard_class}</td>
                                </tr>
                              )}
                              {item.packing_group && (
                                <tr>
                                  <th>Packing Group</th>
                                  <td>{item.packing_group}</td>
                                </tr>
                              )}
                              {item.hs_code && (
                                <tr>
                                  <th>HS Code</th>
                                  <td>{item.hs_code}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searched && (
            <div className="inventory-empty-state">
              <h2 className="inventory-empty-title">Search Sample Inventory</h2>
              <p className="inventory-empty-text">
                Enter a chemical name or lot number above to search our sample inventory.
              </p>
            </div>
          )}
        </div>
      </div>

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

export default InventorySearch;
