import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './CoALookup.css';

interface Sample {
  id: string;
  chemical_name: string;
  lot_number: string;
  cas_number?: string;
}

interface CoAResult {
  id: string;
  name: string;
  lot_number: string;
  created_at: string;
  file_path: string;
}

const CoALookup: React.FC = () => {
  const navigate = useNavigate();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [results, setResults] = useState<CoAResult[]>([]);
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
      const response = await api.get('/manufacturer/coa/search', {
        params: { lot_number: selectedSample.lot_number },
      });

      setResults([response.data.sample]);
    } catch (error: any) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (sampleId: string, lotNumber: string) => {
    try {
      // First try to get the download info
      const response = await api.get(`/manufacturer/coa/download/${sampleId}`);

      // If it's a Cloudinary URL, open in new tab
      if (response.data.download_url) {
        window.open(response.data.download_url, '_blank');
        return;
      }
    } catch (error: any) {
      // If the endpoint returns a file directly (blob), try blob download
      try {
        const blobResponse = await api.get(`/manufacturer/coa/download/${sampleId}`, {
          responseType: 'blob',
        });

        const url = window.URL.createObjectURL(new Blob([blobResponse.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${lotNumber}_CoA.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      } catch (blobError) {
        console.error('Download failed:', blobError);
      }
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
            Back to Dashboard
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
              <label htmlFor="sampleSelect">Select Sample</label>
              {loadingSamples ? (
                <div className="loading-samples">Loading samples...</div>
              ) : (
                <select
                  id="sampleSelect"
                  value={selectedSampleId}
                  onChange={(e) => setSelectedSampleId(e.target.value)}
                  className="sample-select"
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
            <button type="submit" className="search-button" disabled={loading || !selectedSampleId}>
              {loading ? 'Searching...' : 'Get Certificate'}
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
                    {result.file_path ? (
                      <button
                        onClick={() => handleDownload(result.id, result.lot_number)}
                        className="download-button"
                      >
                        Download PDF
                      </button>
                    ) : (
                      <span className="no-coa-badge">No CoA Available</span>
                    )}
                  </div>
                  <p className="result-date">Created: {new Date(result.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          {!searched && (
            <div className="empty-state">
              <h2 className="empty-title">Search for Certificates of Analysis</h2>
              <p className="empty-text">
                Enter a lot number above to find and download the corresponding Certificate of Analysis.
              </p>
            </div>
          )}
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

export default CoALookup;
