import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './InventorySearch.css';

interface Sample {
  id: string;
  chemical_name: string;
  lot_number: string;
  cas_number?: string;
}

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
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [results, setResults] = useState<InventoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(true);
  const [searched, setSearched] = useState(false);

  // Fetch samples on mount
  useEffect(() => {
    fetchSamples();
  }, []);

  const fetchSamples = async () => {
    setLoadingSamples(true);
    try {
      const response = await api.get('/manufacturer/inventory/samples');
      setSamples(response.data.samples || []);
    } catch (error) {
      console.error('Error fetching samples:', error);
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSampleId) {
      return;
    }

    const selectedSample = samples.find(s => s.id === selectedSampleId);
    if (!selectedSample) {
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await api.get('/manufacturer/inventory/search', {
        params: {
          lot_number: selectedSample.lot_number,
        },
      });

      setResults(response.data.samples);
    } catch (error: any) {
      setResults([]);
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
              <label htmlFor="sampleSelect">Select Sample</label>
              {loadingSamples ? (
                <div className="loading-samples">Loading samples...</div>
              ) : (
                <select
                  id="sampleSelect"
                  value={selectedSampleId}
                  onChange={(e) => setSelectedSampleId(e.target.value)}
                  className="inventory-sample-select"
                >
                  <option value="">-- Select a sample --</option>
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.chemical_name} - {s.lot_number}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button type="submit" className="inventory-search-btn" disabled={loading || !selectedSampleId}>
              {loading ? 'Searching...' : 'Check Availability'}
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

      <footer className="dashboard-footer">
        <div className="footer-content">
          <span className="footer-text">Developed and operated by</span>
          <img src="/images/AAL_Dig_Dev.png" alt="AAL Digital Development" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
};

export default InventorySearch;
