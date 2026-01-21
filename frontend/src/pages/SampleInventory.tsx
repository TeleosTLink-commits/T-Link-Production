import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './SampleInventory.css';

interface Sample {
  id: string;
  chemical_name: string;
  received_date: string;
  lot_number: string;
  quantity: string;
  concentration: string;
  has_dow_sds: boolean;
  cas_number: string;
  has_coa: boolean;
  certification_date: string;
  recertification_date: string;
  expiration_date: string;
  un_number: string;
  hazard_description: string;
  hs_code: string;
  hazard_class: string;
  packing_group: string;
  packing_instruction: string;
  status: string;
  notes: string;
  coa_file_path: string | null;
  coa_file_name: string | null;
  sds_file_path: string | null;
  sds_file_name: string | null;
  expiration_status: string;
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
  with_sds: number;
}

const SampleInventory: React.FC = () => {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [sortBy, setSortBy] = useState('chemical_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [showModal, setShowModal] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCoaFile, setSelectedCoaFile] = useState<File | null>(null);
  const [selectedSdsFile, setSelectedSdsFile] = useState<File | null>(null);
  const [deleteCoaFile, setDeleteCoaFile] = useState(false);
  const [deleteSdsFile, setDeleteSdsFile] = useState(false);
  
  const [formData, setFormData] = useState({
    chemical_name: '',
    received_date: '',
    lot_number: '',
    quantity: '',
    concentration: '',
    has_dow_sds: false,
    cas_number: '',
    has_coa: false,
    certification_date: '',
    recertification_date: '',
    expiration_date: '',
    un_number: '',
    hazard_description: '',
    hs_code: '',
    hazard_class: '',
    packing_group: '',
    packing_instruction: '',
    status: 'active',
    notes: '',
  });

  useEffect(() => {
    fetchSamples();
    fetchStats();
  }, [page, search, statusFilter, sortBy, sortOrder]);

  const fetchSamples = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20, sortBy, sortOrder };
      
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      
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
      chemical_name: '',
      received_date: '',
      lot_number: '',
      quantity: '',
      concentration: '',
      has_dow_sds: false,
      cas_number: '',
      has_coa: false,
      certification_date: '',
      recertification_date: '',
      expiration_date: '',
      un_number: '',
      hazard_description: '',
      hs_code: '',
      hazard_class: '',
      packing_group: '',
      packing_instruction: '',
      status: 'active',
      notes: '',
    });
    setSelectedSample(null);
    setSelectedCoaFile(null);
    setSelectedSdsFile(null);
    setDeleteCoaFile(false);
    setDeleteSdsFile(false);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleEdit = (sample: Sample) => {
    setFormData({
      chemical_name: sample.chemical_name,
      received_date: sample.received_date ? sample.received_date.split('T')[0] : '',
      lot_number: sample.lot_number || '',
      quantity: sample.quantity || '',
      concentration: sample.concentration || '',
      has_dow_sds: sample.has_dow_sds,
      cas_number: sample.cas_number || '',
      has_coa: sample.has_coa,
      certification_date: sample.certification_date ? sample.certification_date.split('T')[0] : '',
      recertification_date: sample.recertification_date ? sample.recertification_date.split('T')[0] : '',
      expiration_date: sample.expiration_date ? sample.expiration_date.split('T')[0] : '',
      un_number: sample.un_number || '',
      hazard_description: sample.hazard_description || '',
      hs_code: sample.hs_code || '',
      hazard_class: sample.hazard_class || '',
      packing_group: sample.packing_group || '',
      packing_instruction: sample.packing_instruction || '',
      status: sample.status,
      notes: sample.notes || '',
    });
    setSelectedSample(sample);
    setSelectedCoaFile(null);
    setSelectedSdsFile(null);
    setDeleteCoaFile(false);
    setDeleteSdsFile(false);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && selectedSample) {
        await api.put(`/sample-inventory/${selectedSample.id}`, formData);

        // Handle CoA file upload/deletion
        if (deleteCoaFile && selectedSample.coa_file_path) {
          await api.delete(`/sample-inventory/${selectedSample.id}/coa`);
        } else if (selectedCoaFile) {
          const fileFormData = new FormData();
          fileFormData.append('file', selectedCoaFile);
          await api.post(
            `/sample-inventory/${selectedSample.id}/coa/upload`,
            fileFormData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
        }

        // Handle SDS file upload/deletion
        if (deleteSdsFile && selectedSample.sds_file_path) {
          await api.delete(`/sample-inventory/${selectedSample.id}/sds`);
        } else if (selectedSdsFile) {
          const fileFormData = new FormData();
          fileFormData.append('file', selectedSdsFile);
          await api.post(
            `/sample-inventory/${selectedSample.id}/sds/upload`,
            fileFormData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
        }
      } else {
        const response = await api.post('/sample-inventory', formData);
        const newSampleId = response.data.data.id;

        // Handle file uploads if provided
        if (selectedCoaFile) {
          const fileFormData = new FormData();
          fileFormData.append('file', selectedCoaFile);
          await api.post(
            `/sample-inventory/${newSampleId}/coa/upload`,
            fileFormData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
        }

        if (selectedSdsFile) {
          const fileFormData = new FormData();
          fileFormData.append('file', selectedSdsFile);
          await api.post(
            `/sample-inventory/${newSampleId}/sds/upload`,
            fileFormData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
        }
      }

      setShowModal(false);
      setSelectedCoaFile(null);
      setSelectedSdsFile(null);
      setDeleteCoaFile(false);
      setDeleteSdsFile(false);
      fetchSamples();
      fetchStats();
      alert('Sample saved successfully');
    } catch (err: any) {
      console.error('Error saving sample:', err);
      alert(`Error: ${err.response?.data?.message || 'Failed to save sample'}`);
    }
  };

  const handleViewCoA = (sample: Sample) => {
    if (!sample.coa_file_path) {
      alert('No CoA file attached to this sample');
      return;
    }
    if (sample.coa_file_path.startsWith('http')) {
      window.open(sample.coa_file_path, '_blank');
    } else {
      const base =
        (import.meta.env.VITE_API_URL as string) || 'https://tlink-production-backend.onrender.com/api';
      const token = localStorage.getItem('auth_token');
      const url = `${base}/sample-inventory/${sample.id}/coa/download${token ? `?token=${token}` : ''}`;
      window.open(url, '_blank');
    }
  };

  const handleViewSDS = (sample: Sample) => {
    if (!sample.sds_file_path) {
      alert('No SDS file attached to this sample');
      return;
    }
    if (sample.sds_file_path.startsWith('http')) {
      window.open(sample.sds_file_path, '_blank');
    } else {
      const base =
        (import.meta.env.VITE_API_URL as string) || 'https://tlink-production-backend.onrender.com/api';
      const token = localStorage.getItem('auth_token');
      const url = `${base}/sample-inventory/${sample.id}/sds/download${token ? `?token=${token}` : ''}`;
      window.open(url, '_blank');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sample?')) return;
    try {
      await api.delete(`/sample-inventory/${id}`);
      fetchSamples();
      fetchStats();
      alert('Sample deleted successfully');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete sample');
    }
  };

  const handleDashboardReturn = () => {
    window.location.href = '/dashboard';
  };

  return (
    <div className="sample-inventory">
      {/* Green Gradient Portal Header */}
      <div className="sampleinv-header">
        <div className="sampleinv-header-content">
          <button className="sampleinv-back-btn" onClick={handleDashboardReturn}>
            ← Dashboard
          </button>
          <div className="sampleinv-title-section">
            <h1 className="sampleinv-title">Sample Inventory</h1>
          </div>
          <button className="sampleinv-action-btn" onClick={handleAddNew}>
            + Add New Sample
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="sampleinv-content">
        {/* Statistics Dashboard */}
        {stats && (
          <div className="sampleinv-stats-container">
            <div className="sampleinv-stat-card">
              <div className="sampleinv-stat-number">{stats.total_samples}</div>
              <div className="sampleinv-stat-label">Total Samples</div>
            </div>
            <div className="sampleinv-stat-card">
              <div className="sampleinv-stat-number">{stats.active_samples}</div>
              <div className="sampleinv-stat-label">Active</div>
            </div>
            <div className="sampleinv-stat-card">
              <div className="sampleinv-stat-number">{stats.expiring_30_days}</div>
              <div className="sampleinv-stat-label">Expiring (30d)</div>
            </div>
            <div className="sampleinv-stat-card">
              <div className="sampleinv-stat-number">{stats.expired_samples}</div>
              <div className="sampleinv-stat-label">Expired</div>
            </div>
            <div className="sampleinv-stat-card">
              <div className="sampleinv-stat-number">{stats.with_coa}</div>
              <div className="sampleinv-stat-label">With CoA</div>
            </div>
            <div className="sampleinv-stat-card">
              <div className="sampleinv-stat-number">{stats.with_sds}</div>
              <div className="sampleinv-stat-label">With SDS</div>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="sampleinv-filters-section">
          <div className="sampleinv-search-container">
            <input
              type="text"
              className="sampleinv-search-input"
              placeholder="Search by chemical name, lot number, CAS number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="sampleinv-filter-group">
            <select className="sampleinv-status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="depleted">Depleted</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="sampleinv-error-message">{error}</div>}

        {/* Samples Table */}
        {loading ? (
          <div className="sampleinv-loading">Loading samples...</div>
        ) : (
          <>
            <div className="sampleinv-table-wrapper">
              <table className="sampleinv-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('chemical_name')}>
                      Chemical Name {sortBy === 'chemical_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('received_date')}>
                      Received {sortBy === 'received_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('lot_number')}>
                      Lot Number {sortBy === 'lot_number' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Quantity</th>
                    <th>Concentration</th>
                    <th>DOW SDS</th>
                    <th>CAS Number</th>
                    <th>Have CoA</th>
                    <th>Cert. Date</th>
                    <th>Recert. Date</th>
                    <th onClick={() => handleSort('expiration_date')}>
                      Expiration {sortBy === 'expiration_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>UN Number</th>
                    <th>Hazard</th>
                    <th>HS Code</th>
                    <th>Hazard Class</th>
                    <th>Packing Group</th>
                    <th>Packing Inst.</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.length === 0 ? (
                    <tr>
                      <td colSpan={19} style={{ textAlign: 'center', padding: '40px' }}>
                        No samples found
                      </td>
                    </tr>
                  ) : (
                    samples.map((sample) => (
                      <tr key={sample.id}>
                        <td><strong>{sample.chemical_name}</strong></td>
                        <td>{sample.received_date ? new Date(sample.received_date).toLocaleDateString() : 'N/A'}</td>
                        <td>{sample.lot_number}</td>
                        <td>{sample.quantity}</td>
                        <td>{sample.concentration}</td>
                        <td>{sample.has_dow_sds ? 'Y' : 'N'}</td>
                        <td>{sample.cas_number}</td>
                        <td>{sample.has_coa ? 'Y' : 'N'}</td>
                        <td>{sample.certification_date ? new Date(sample.certification_date).toLocaleDateString() : ''}</td>
                        <td>{sample.recertification_date ? new Date(sample.recertification_date).toLocaleDateString() : ''}</td>
                        <td>
                          {sample.expiration_date 
                            ? new Date(sample.expiration_date).toLocaleDateString() 
                            : 'N/A'}
                          <br />
                          {getExpirationBadge(sample.expiration_status, sample.expiration_date)}
                        </td>
                        <td>{sample.un_number}</td>
                        <td>{sample.hazard_description}</td>
                        <td>{sample.hs_code}</td>
                        <td>{sample.hazard_class}</td>
                        <td>{sample.packing_group}</td>
                        <td>{sample.packing_instruction}</td>
                        <td>
                          <span className={`sampleinv-badge sampleinv-badge-${sample.status === 'active' ? 'success' : 'secondary'}`}>
                            {sample.status}
                          </span>
                        </td>
                        <td>
                          <div className="sampleinv-actions">
                            {sample.coa_file_path && (
                              <button 
                                className="sampleinv-btn sampleinv-btn-info" 
                                onClick={() => handleViewCoA(sample)}
                                title="View Certificate of Analysis"
                              >
                                CoA
                              </button>
                            )}
                            {sample.sds_file_path && (
                              <button 
                                className="sampleinv-btn sampleinv-btn-warning" 
                                onClick={() => handleViewSDS(sample)}
                                title="View Safety Data Sheet"
                              >
                                SDS
                              </button>
                            )}
                            <button className="sampleinv-btn sampleinv-btn-secondary" onClick={() => handleEdit(sample)}>
                              Edit
                            </button>
                            <button className="sampleinv-btn sampleinv-btn-danger" onClick={() => handleDelete(sample.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="sampleinv-pagination">
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
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="sampleinv-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="sampleinv-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="sampleinv-modal-header">
              <h2>{isEditing ? 'Edit Sample' : 'Add New Sample'}</h2>
              <button className="sampleinv-close-btn" onClick={() => setShowModal(false)}>Close</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="sampleinv-form-grid">
                <div className="sampleinv-form-group">
                  <label>Chemical Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.chemical_name}
                    onChange={(e) => setFormData({ ...formData, chemical_name: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Lot Number</label>
                  <input
                    type="text"
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>CAS Number</label>
                  <input
                    type="text"
                    value={formData.cas_number}
                    onChange={(e) => setFormData({ ...formData, cas_number: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Quantity</label>
                  <input
                    type="text"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Concentration</label>
                  <input
                    type="text"
                    value={formData.concentration}
                    onChange={(e) => setFormData({ ...formData, concentration: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Received Date</label>
                  <input
                    type="date"
                    value={formData.received_date}
                    onChange={(e) => setFormData({ ...formData, received_date: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Expiration Date</label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Certification Date</label>
                  <input
                    type="date"
                    value={formData.certification_date}
                    onChange={(e) => setFormData({ ...formData, certification_date: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Recertification Date</label>
                  <input
                    type="date"
                    value={formData.recertification_date}
                    onChange={(e) => setFormData({ ...formData, recertification_date: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>UN Number</label>
                  <input
                    type="text"
                    value={formData.un_number}
                    onChange={(e) => setFormData({ ...formData, un_number: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>HS Code</label>
                  <input
                    type="text"
                    value={formData.hs_code}
                    onChange={(e) => setFormData({ ...formData, hs_code: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Hazard Class</label>
                  <input
                    type="text"
                    value={formData.hazard_class}
                    onChange={(e) => setFormData({ ...formData, hazard_class: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Packing Group</label>
                  <input
                    type="text"
                    value={formData.packing_group}
                    onChange={(e) => setFormData({ ...formData, packing_group: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Packing Instruction</label>
                  <input
                    type="text"
                    value={formData.packing_instruction}
                    onChange={(e) => setFormData({ ...formData, packing_instruction: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="depleted">Depleted</option>
                  </select>
                </div>

                <div className="sampleinv-form-group sampleinv-form-full">
                  <label>Hazard Description</label>
                  <textarea
                    rows={2}
                    value={formData.hazard_description}
                    onChange={(e) => setFormData({ ...formData, hazard_description: e.target.value })}
                  />
                </div>

                <div className="sampleinv-form-group sampleinv-form-full">
                  <label>Certificate of Analysis (CoA)</label>
                  {isEditing && selectedSample?.coa_file_name && !deleteCoaFile && (
                    <div className="sampleinv-file-info">
                      <div>Current file: {selectedSample.coa_file_name}</div>
                      <label className="sampleinv-checkbox-label">
                        <input
                          type="checkbox"
                          checked={deleteCoaFile}
                          onChange={(e) => setDeleteCoaFile(e.target.checked)}
                        />
                        {' '}Delete current file
                      </label>
                    </div>
                  )}
                  {!deleteCoaFile && (
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setSelectedCoaFile(e.target.files?.[0] || null)}
                    />
                  )}
                  {selectedCoaFile && <div className="sampleinv-selected-file">Selected: {selectedCoaFile.name}</div>}
                </div>

                <div className="sampleinv-form-group sampleinv-form-full">
                  <label>Safety Data Sheet (SDS)</label>
                  {isEditing && selectedSample?.sds_file_name && !deleteSdsFile && (
                    <div className="sampleinv-file-info">
                      <div>Current file: {selectedSample.sds_file_name}</div>
                      <label className="sampleinv-checkbox-label">
                        <input
                          type="checkbox"
                          checked={deleteSdsFile}
                          onChange={(e) => setDeleteSdsFile(e.target.checked)}
                        />
                        {' '}Delete current file
                      </label>
                    </div>
                  )}
                  {!deleteSdsFile && (
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setSelectedSdsFile(e.target.files?.[0] || null)}
                    />
                  )}
                  {selectedSdsFile && <div className="sampleinv-selected-file">Selected: {selectedSdsFile.name}</div>}
                </div>

                <div className="sampleinv-form-group sampleinv-form-full">
                  <label>Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="sampleinv-modal-footer">
                <button type="button" className="sampleinv-btn sampleinv-btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="sampleinv-btn sampleinv-btn-primary">
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




