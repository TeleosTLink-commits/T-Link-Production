import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './SampleInventory.css';

interface CoA {
  id: string;
  lot_number: string;
  product_name: string;
  file_name: string;
  file_path: string;
  manufacturer_name?: string;
  issue_date?: string;
  expiration_date?: string;
  status?: string;
}

const CoAManagement: React.FC = () => {
  const [coas, setCoas] = useState<CoA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCoas();
  }, []);

  const fetchCoas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/coa');
      setCoas(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch CoAs');
      console.error('Error fetching CoAs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCoa = async (coa: CoA) => {
    try {
      // Download directly from the CoA route using the ID
      const response = await api.get(`/coa/${coa.id}/download`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to open CoA: ' + (err.response?.data?.message || err.message));
      console.error('Error opening CoA:', err);
    }
  };

  const filteredCoas = coas.filter(coa => 
    search === '' || 
    coa.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
    coa.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="sample-inventory">
      <div className="page-header">
        <h1>Certificates of Analysis</h1>
        <p>Digital Quality Library - CoA tracking by lot number</p>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by lot number or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Loading CoAs...</div>
      ) : (
        <div className="table-container">
          <table className="samples-table">
            <thead>
              <tr>
                <th>Lot Number</th>
                <th>Product Name</th>
                <th>File Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoas.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>
                    {search ? 'No CoAs found matching your search' : 'No CoAs available'}
                  </td>
                </tr>
              ) : (
                filteredCoas.map((coa) => (
                  <tr key={coa.id}>
                    <td><strong>{coa.lot_number}</strong></td>
                    <td>{coa.product_name}</td>
                    <td>
                      <small style={{ color: '#666' }}>{coa.file_name}</small>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-primary" 
                        onClick={() => handleViewCoa(coa)}
                      >
                        📄 View CoA
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div style={{ marginTop: '20px', color: '#666' }}>
            Total: {filteredCoas.length} CoAs
          </div>
        </div>
      )}
    </div>
  );
};

export default CoAManagement;
