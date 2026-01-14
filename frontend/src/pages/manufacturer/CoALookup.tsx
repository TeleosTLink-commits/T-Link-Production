import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

interface CoAResult {
  id: string;
  name: string;
  lot_number: string;
  created_at: string;
  file_path: string;
}

const CoALookup: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<CoAResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim()) {
      toast.error('Please enter a lot number');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await api.get('/manufacturer/coa/search', {
        params: { lot_number: searchTerm },
      });

      setResults([response.data.sample]);
      toast.success('CoA found!');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'CoA not found';
      setResults([]);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (sampleId: string, lotNumber: string) => {
    try {
      const response = await api.get(`/manufacturer/coa/download/${sampleId}`, {
        responseType: 'blob',
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${lotNumber}_CoA.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);

      toast.success('CoA downloaded successfully!');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to download CoA';
      toast.error(errorMsg);
    }
  };

  const handleGoBack = () => {
    navigate('/manufacturer/dashboard');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={handleGoBack} style={styles.backButton}>
          ← Back
        </button>
        <h1 style={styles.title}>Certificate of Analysis Lookup</h1>
      </div>

      {/* Search Section */}
      <div style={styles.searchSection}>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <div style={styles.searchGroup}>
            <label htmlFor="lotNumber" style={styles.label}>
              Enter Lot Number:
            </label>
            <div style={styles.inputGroup}>
              <input
                type="text"
                id="lotNumber"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g., LOT-2026-001"
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
            <p style={styles.noResultsText}>No Certificate of Analysis found for this lot number.</p>
            <p style={styles.noResultsHint}>Please verify the lot number and try again.</p>
          </div>
        )}

        {results.length > 0 && (
          <div style={styles.resultsList}>
            <h2 style={styles.resultsTitle}>Results</h2>
            {results.map((result) => (
              <div key={result.id} style={styles.resultCard}>
                <div style={styles.resultHeader}>
                  <div>
                    <h3 style={styles.resultName}>{result.name}</h3>
                    <p style={styles.resultLot}>Lot Number: <strong>{result.lot_number}</strong></p>
                  </div>
                  <button
                    onClick={() => handleDownload(result.id, result.lot_number)}
                    style={styles.downloadButton}
                  >
                    📥 Download PDF
                  </button>
                </div>
                <p style={styles.resultDate}>Created: {new Date(result.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}

        {!searched && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📄</div>
            <h2 style={styles.emptyTitle}>Search for Certificates of Analysis</h2>
            <p style={styles.emptyText}>
              Enter a lot number above to find and download the corresponding Certificate of Analysis.
            </p>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div style={styles.infoSection}>
        <h3 style={styles.infoTitle}>About CoA Lookup</h3>
        <ul style={styles.infoList}>
          <li>CoA documents are available for all active samples</li>
          <li>Lot numbers are case-sensitive</li>
          <li>Downloaded PDFs contain complete analysis results</li>
          <li>Contact lab support if you cannot find your lot number</li>
        </ul>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '900px',
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
  resultCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
    gap: '20px',
  },
  resultName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    margin: '0 0 4px 0',
  },
  resultLot: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
  },
  downloadButton: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 'bold',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  resultDate: {
    fontSize: '12px',
    color: '#999',
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
    margin: '0 0 12px 0',
  },
  infoList: {
    fontSize: '14px',
    color: '#004085',
    margin: 0,
    paddingLeft: '20px',
  },
};

export default CoALookup;
