import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return '#28a745';
      case 'low':
        return '#ffc107';
      case 'out_of_stock':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={handleGoBack} style={styles.backButton}>
          ← Back
        </button>
        <h1 style={styles.title}>Sample Inventory Search</h1>
      </div>

      {/* Search Section */}
      <div style={styles.searchSection}>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <div style={styles.searchGroup}>
            <label htmlFor="sampleName" style={styles.label}>
              Enter Sample Name:
            </label>
            <div style={styles.inputGroup}>
              <input
                type="text"
                id="sampleName"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g., Sample XYZ, Product A"
                style={styles.input}
              />
              <button type="submit" style={styles.searchButton} disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Results Section */}
      <div style={styles.resultsSection}>
        {searched && results.length === 0 && !loading && (
          <div style={styles.noResults}>
            <p style={styles.noResultsText}>No samples found matching this name.</p>
            <p style={styles.noResultsHint}>Please try a different search term or contact support.</p>
          </div>
        )}

        {results.length > 0 && (
          <div style={styles.resultsList}>
            <h2 style={styles.resultsTitle}>Available Samples</h2>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead style={styles.tableHead}>
                  <tr>
                    <th style={styles.th}>Sample Name</th>
                    <th style={styles.th}>Lot Number</th>
                    <th style={styles.th}>Available Quantity</th>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id} style={styles.tableRow}>
                      <td style={styles.td}>{result.name}</td>
                      <td style={styles.td}><strong>{result.lot_number}</strong></td>
                      <td style={styles.td}>{result.available_quantity}</td>
                      <td style={styles.td}>{result.unit}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            backgroundColor: getStatusColor(result.status),
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

            <div style={styles.summaryInfo}>
              <p style={styles.summaryText}>
                Found <strong>{results.length}</strong> sample{results.length !== 1 ? 's' : ''} matching your search.
              </p>
            </div>
          </div>
        )}

        {!searched && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📦</div>
            <h2 style={styles.emptyTitle}>Search Sample Inventory</h2>
            <p style={styles.emptyText}>
              Enter a sample name above to check current availability and quantity in our inventory.
            </p>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div style={styles.infoSection}>
        <h3 style={styles.infoTitle}>About Inventory</h3>
        <div style={styles.infoGrid}>
          <div style={styles.infItem}>
            <span style={styles.infIcon}>✓</span>
            <span>Real-time inventory updates</span>
          </div>
          <div style={styles.infItem}>
            <span style={styles.infIcon}>✓</span>
            <span>Accurate quantity tracking</span>
          </div>
          <div style={styles.infItem}>
            <span style={styles.infIcon}>✓</span>
            <span>Lot number identification</span>
          </div>
          <div style={styles.infItem}>
            <span style={styles.infIcon}>✓</span>
            <span>Ready for shipment requests</span>
          </div>
        </div>
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
  backButton: {
    background: 'none',
    border: 'none',
    color: '#007bff',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px 0',
    marginBottom: '12px',
    fontWeight: '500',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  searchSection: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: '30px',
  },
  searchForm: {
    display: 'flex',
    gap: '20px',
  },
  searchGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
  },
  searchButton: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 'bold',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  resultsSection: {
    marginBottom: '30px',
    minHeight: '200px',
  },
  noResults: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    padding: '20px',
    textAlign: 'center' as const,
  },
  noResultsText: {
    fontSize: '16px',
    color: '#856404',
    fontWeight: 'bold',
    margin: '0 0 8px 0',
  },
  noResultsHint: {
    fontSize: '14px',
    color: '#856404',
    margin: 0,
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  resultsTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 16px 0',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  tableHead: {
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
  },
  th: {
    padding: '12px',
    textAlign: 'left' as const,
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
  },
  tableRow: {
    borderBottom: '1px solid #dee2e6',
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    color: '#333',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'capitalize' as const,
  },
  summaryInfo: {
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    borderRadius: '4px',
    padding: '12px',
    marginTop: '12px',
  },
  summaryText: {
    fontSize: '14px',
    color: '#004085',
    margin: 0,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px dashed #ccc',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 12px 0',
  },
  emptyText: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
    maxWidth: '400px',
  },
  infoSection: {
    backgroundColor: '#e7f3ff',
    border: '1px solid #b3d9ff',
    borderRadius: '4px',
    padding: '20px',
  },
  infoTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#004085',
    margin: '0 0 16px 0',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  infItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#004085',
  },
  infIcon: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
};

export default InventorySearch;
