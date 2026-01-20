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
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim()) {
      toast.error('Please enter a sample name');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await api.get('/manufacturer/inventory/search', {
        params: { sample_name: searchTerm },
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
            ← Dashboard
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
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g., Sample XYZ, Product A"
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
            <div className="inventory-empty-state">
              <div className="inventory-empty-icon"></div>
              <h2 className="inventory-empty-title">Search Sample Inventory</h2>
              <p className="inventory-empty-text">
                Enter a sample name above to check current availability and quantity in our inventory.
              </p>
            </div>
          )}
        </div>

        <div className="inventory-info-section">
          <h3 className="inventory-info-title">About Inventory</h3>
          <div className="inventory-info-grid">
            <div className="inventory-info-item">
              <span className="inventory-info-icon">✓</span>
              <span>Real-time inventory updates</span>
            </div>
            <div className="inventory-info-item">
              <span className="inventory-info-icon">✓</span>
              <span>Accurate quantity tracking</span>
            </div>
            <div className="inventory-info-item">
              <span className="inventory-info-icon">✓</span>
              <span>Lot number identification</span>
            </div>
            <div className="inventory-info-item">
              <span className="inventory-info-icon">✓</span>
              <span>Ready for shipment requests</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventorySearch;
