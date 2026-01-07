import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './SampleInventory.css';

interface Sample {
  id: string;
  sample_id: string;
  sample_name: string;
  sample_type: string;
  lot_number: string;
  initial_volume: number;
  current_volume: number;
  unit: string;
  low_inventory_threshold: number;
  received_date: string;
  expiration_date: string;
  status: string;
  expiration_status: string;
  coa_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total_samples: number;
  active_samples: number;
  expired_samples: number;
  expiring_30_days: number;
  expiring_60_days: number;
  expiring_90_days: number;
  with_coa: number;
}

const SampleInventory: React.FC = () => {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [expirationFilter, setExpirationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [sortBy, setSortBy] = useState('sample_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [showModal, setShowModal] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    sample_id: '',
    sample_name: '',
    sample_type: '',
    lot_number: '',
    initial_volume: 0,
    current_volume: 0,
    unit: 'mL',
    low_inventory_threshold: 10,
    received_date: '',
    expiration_date: '',
    status: 'active',
    notes: '',
  });

  useEffect(() => {
    fetchSamples();
    fetchStats();
  }, [page, search, statusFilter, expirationFilter, sortBy, sortOrder]);

  const fetchSamples = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20, sortBy, sortOrder };
      
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (expirationFilter) params.expirationStatus = expirationFilter;
      
      const response = await api.get('/sample-inventory', { params });
      setSamples(response.data.data.samples || []);
      setTotalPages(response.data.data.pagination.pages);
      setTotalCount(response.data.data.pagination.total);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch samples');
      console.error('Error fetching samples:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/sample-inventory/stats');
      setStats(response.data.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getExpirationBadge = (expirationStatus: string, expirationDate: string) => {
    if (!expirationDate) return null;
    const daysUntil = Math.ceil((new Date(expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    switch (expirationStatus) {
      case 'expired':
        return <span className="badge badge-danger">Expired</span>;
      case 'expiring_soon_30':
        return <span className="badge badge-danger">Expires in {daysUntil} days</span>;
      case 'expiring_soon_60':
        return <span className="badge badge-warning">Expires in {daysUntil} days</span>;
      case 'expiring_soon_90':
        return <span className="badge badge-info">Expires in {daysUntil} days</span>;
      default:
        return <span className="badge badge-success">Valid</span>;
    }
  };

  const handleAddNew = () => {
    setFormData({
      sample_id: '',
      sample_name: '',
      sample_type: '',
      lot_number: '',
      initial_volume: 0,
      current_volume: 0,
      unit: 'mL',
      low_inventory_threshold: 10,
      received_date: '',
      expiration_date: '',
      status: 'active',
      notes: '',
    });
    setSelectedSample(null);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (sample: Sample) => {
    setFormData({
      sample_id: sample.sample_id,
      sample_name: sample.sample_name,
      sample_type: sample.sample_type,
      lot_number: sample.lot_number,
      initial_volume: sample.initial_volume,
      current_volume: sample.current_volume,
      unit: sample.unit,
      low_inventory_threshold: sample.low_inventory_threshold,
      received_date: sample.received_date?.split('T')[0] || '',
      expiration_date: sample.expiration_date?.split('T')[0] || '',
      status: sample.status,
      notes: sample.notes || '',
    });
    setSelectedSample(sample);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedSample) {
        await api.put(`/sample-inventory/${selectedSample.id}`, formData);
      } else {
        await api.post('/sample-inventory', formData);
      }
      setShowModal(false);
      fetchSamples();
      fetchStats();
    } catch (err: any) {
      console.error('Error saving sample:', err);
      alert(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sample?')) return;
    try {
      await api.delete(`/sample-inventory/${id}`);
      fetchSamples();
      fetchStats();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete sample');
    }
  };

  return (
    <div className="sample-inventory">
      <div className="page-header">
        <h1>Sample Inventory</h1>
        <button className="btn btn-primary" onClick={handleAddNew}>
          + Add New Sample
        </button>
      </div>

      {/* Statistics Dashboard */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>{stats.total_samples}</h3>
            <p>Total Samples</p>
          </div>
          <div className="stat-card stat-success">
            <h3>{stats.active_samples}</h3>
            <p>Active Samples</p>
          </div>
          <div className="stat-card stat-warning">
            <h3>{stats.expiring_30_days}</h3>
            <p>Expiring (30 days)</p>
          </div>
          <div className="stat-card stat-danger">
            <h3>{stats.expired_samples}</h3>
            <p>Expired</p>
          </div>
          <div className="stat-card">
            <h3>{stats.with_coa}</h3>
            <p>With CoA</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by sample name, sample ID, lot number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="depleted">Depleted</option>
          </select>

          <select value={expirationFilter} onChange={(e) => setExpirationFilter(e.target.value)}>
            <option value="">All Expiration</option>
            <option value="expired">Expired</option>
            <option value="expiring_30">Expiring (30 days)</option>
            <option value="expiring_60">Expiring (60 days)</option>
            <option value="expiring_90">Expiring (90 days)</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="error-message">{error}</div>}

      {/* Samples Table */}
      {loading ? (
        <div className="loading">Loading samples...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="samples-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('sample_name')}>
                    Sample Name {sortBy === 'sample_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Sample ID</th>
                  <th onClick={() => handleSort('lot_number')}>
                    Lot Number {sortBy === 'lot_number' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Type</th>
                  <th>Volume (Current / Initial)</th>
                  <th onClick={() => handleSort('expiration_date')}>
                    Expiration {sortBy === 'expiration_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {samples.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                      No samples found
                    </td>
                  </tr>
                ) : (
                  samples.map((sample) => (
                    <tr key={sample.id}>
                      <td><strong>{sample.sample_name}</strong></td>
                      <td>{sample.sample_id}</td>
                      <td>{sample.lot_number}</td>
                      <td>{sample.sample_type}</td>
                      <td>
                        {sample.current_volume} / {sample.initial_volume} {sample.unit}
                      </td>
                      <td>
                        {sample.expiration_date 
                          ? new Date(sample.expiration_date).toLocaleDateString() 
                          : 'N/A'}
                        <br />
                        {getExpirationBadge(sample.expiration_status, sample.expiration_date)}
                      </td>
                      <td>
                        <span className={`badge badge-${sample.status === 'active' ? 'success' : 'secondary'}`}>
                          {sample.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(sample)}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(sample.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Sample' : 'Add New Sample'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Sample ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.sample_id}
                    onChange={(e) => setFormData({ ...formData, sample_id: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Sample Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.sample_name}
                    onChange={(e) => setFormData({ ...formData, sample_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Sample Type</label>
                  <input
                    type="text"
                    value={formData.sample_type}
                    onChange={(e) => setFormData({ ...formData, sample_type: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Lot Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Initial Volume</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.initial_volume}
                    onChange={(e) => setFormData({ ...formData, initial_volume: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Current Volume</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.current_volume}
                    onChange={(e) => setFormData({ ...formData, current_volume: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Unit</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Low Inventory Threshold</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.low_inventory_threshold}
                    onChange={(e) => setFormData({ ...formData, low_inventory_threshold: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Received Date</label>
                  <input
                    type="date"
                    value={formData.received_date}
                    onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Expiration Date</label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="depleted">Depleted</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isEditing ? 'Update Sample' : 'Add Sample'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SampleInventory;




