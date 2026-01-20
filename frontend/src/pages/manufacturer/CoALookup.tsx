import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './CoALookup.css';

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
    <div className="portal-page">
      {/* Header */}
      <div className="portal-header">
        <div className="header-top">
          <button onClick={handleGoBack} className="btn-back">
            ← Dashboard
          </button>
          <h1>Certificate of Analysis</h1>
        </div>
      </div>

      {/* Content */}
      <div className="portal-content">
        {/* Search Section */}
        <div className="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-form-group">
              <label htmlFor="lotNumber">Lot Number</label>
              <input
                type="text"
                id="lotNumber"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g., LOT-2026-001"
                className="search-input"
              />
            </div>
            <button type="submit" className="search-button" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Results Section */}
        <div className="results-section">
          {searched && results.length === 0 && !loading && (
            <div className="no-results">
              <p className="no-results-text">No Certificate of Analysis found for this lot number.</p>
              <p className="no-results-hint">Please verify the lot number and try again.</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="results-list">
              <h2 className="results-title">Results</h2>
              {results.map((result) => (
                <div key={result.id} className="result-card">
                  <div className="result-header">
                    <div className="result-info">
                      <h3 className="result-name">{result.name}</h3>
                      <p className="result-lot">Lot Number: <strong>{result.lot_number}</strong></p>
                    </div>
                    <button
                      onClick={() => handleDownload(result.id, result.lot_number)}
                      className="download-button"
                    >
                      📥 Download PDF
                    </button>
                  </div>
                  <p className="result-date">Created: {new Date(result.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          {!searched && (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h2 className="empty-title">Search for Certificates of Analysis</h2>
              <p className="empty-text">
                Enter a lot number above to find and download the corresponding Certificate of Analysis.
              </p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="info-section">
          <h3 className="info-title">About CoA Lookup</h3>
          <ul className="info-list">
            <li>CoA documents are available for all active samples</li>
            <li>Lot numbers are case-sensitive</li>
            <li>Downloaded PDFs contain complete analysis results</li>
            <li>Contact lab support if you cannot find your lot number</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CoALookup;
