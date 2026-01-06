import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './SampleInventory.css';

interface Sample {
  id: number;
  chemical_name: string;
  lot_number: string;
  cas_number: string;
  quantity: string;
  concentration: string;
  received_date: string;
  expiration_date: string;
  hazard_class: string;
  hazard_description: string;
  un_number: string;
  hs_code: string;
  packing_group: string;
  packing_instruction: string;
  has_coa: boolean;
  has_dow_sds: boolean;
  status: string;
  expiration_status: string;
  certification_date: string;
  recertification_date: string;
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
  hazard_classes: Array<{ hazard_class: string; count: number }>;
}

const SampleInventory: React.FC = () => {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters and search
  const [search, setSearch] = useState('');
  const [hazardClassFilter, setHazardClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [expirationFilter, setExpirationFilter] = useState('');
  const [hasCoa, setHasCoa] = useState<boolean | undefined>(undefined);
  const [hasSds, setHasSds] = useState<boolean | undefined>(undefined);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Sort
  const [sortBy, setSortBy] = useState('chemical_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCoaFile, setSelectedCoaFile] = useState<File | null>(null);
  const [selectedSdsFile, setSelectedSdsFile] = useState<File | null>(null);
  const [deleteCoaFile, setDeleteCoaFile] = useState(false);
  const [deleteSdsFile, setDeleteSdsFile] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    chemical_name: '',
    lot_number: '',
    cas_number: '',
    quantity: '',
    concentration: '',
    received_date: '',
    expiration_date: '',
    certification_date: '',
    recertification_date: '',
    hazard_class: '',
    hazard_description: '',
    un_number: '',
    hs_code: '',
    packing_group: '',
    packing_instruction: '',
    has_coa: false,
    has_dow_sds: false,
  });

  useEffect(() => {
    fetchSamples();
    fetchStats();
  }, [page, search, hazardClassFilter, statusFilter, expirationFilter, hasCoa, hasSds, sortBy, sortOrder]);

  const fetchSamples = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 20, sortBy, sortOrder };
      
      if (search) params.search = search;
      if (hazardClassFilter) params.hazardClass = hazardClassFilter;
      if (statusFilter) params.status = statusFilter;
      if (expirationFilter) params.expirationStatus = expirationFilter;
      if (hasCoa !== undefined) params.hasCoa = hasCoa;
      if (hasSds !== undefined) params.hasSds = hasSds;
      
      const response = await api.get('/sample-inventory', { params });
      setSamples(response.data.data.samples);
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
      lot_number: '',
      cas_number: '',
      quantity: '',
      concentration: '',
      received_date: '',
      expiration_date: '',
      certification_date: '',
      recertification_date: '',
      hazard_class: '',
      hazard_description: '',
      un_number: '',
      hs_code: '',
      packing_group: '',
      packing_instruction: '',
      has_coa: false,
      has_dow_sds: false,
    });
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
      lot_number: sample.lot_number,
      cas_number: sample.cas_number,
      quantity: sample.quantity,
      concentration: sample.concentration || '',
      received_date: sample.received_date?.split('T')[0] || '',
      expiration_date: sample.expiration_date?.split('T')[0] || '',
      certification_date: sample.certification_date?.split('T')[0] || '',
      recertification_date: sample.recertification_date?.split('T')[0] || '',
      hazard_class: sample.hazard_class || '',
      hazard_description: sample.hazard_description || '',
      un_number: sample.un_number || '',
      hs_code: sample.hs_code || '',
      packing_group: sample.packing_group || '',
      packing_instruction: sample.packing_instruction || '',
      has_coa: sample.has_coa,
      has_dow_sds: sample.has_dow_sds,
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
      let sampleId;
      if (isEditing && selectedSample) {
        await api.put(`/sample-inventory/${selectedSample.id}`, formData);
        sampleId = selectedSample.id;
      } else {
        const response = await api.post('/sample-inventory', formData);
        sampleId = response.data.data.id;
      }

      // Handle COA file deletion or upload
      if (deleteCoaFile && sampleId) {
        await api.delete(`/sample-inventory/${sampleId}/coa`);
      } else if (selectedCoaFile && sampleId) {
        const coaFormData = new FormData();
        coaFormData.append('file', selectedCoaFile);
        await api.post(`/sample-inventory/${sampleId}/coa/upload`, coaFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Handle SDS file deletion or upload
      if (deleteSdsFile && sampleId) {
        await api.delete(`/sample-inventory/${sampleId}/sds`);
      } else if (selectedSdsFile && sampleId) {
        const sdsFormData = new FormData();
        sdsFormData.append('file', selectedSdsFile);
        await api.post(`/sample-inventory/${sampleId}/sds/upload`, sdsFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setShowModal(false);
      setSelectedCoaFile(null);
      setSelectedSdsFile(null);
      setDeleteCoaFile(false);
      setDeleteSdsFile(false);
      fetchSamples();
      fetchStats();
    } catch (err: any) {
      console.error('Error saving sample:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save sample';
      alert(`Error: ${errorMessage}`);
    }
  };


  const handleViewCoa = async (sampleId: number, _lotNumber: string) => {
    try {
      const response = await api.get(`/sample-inventory/${sampleId}/coa/download`, {
        responseType: 'blob'
      });

      // Create blob URL and open in new tab
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
      alert(err.response?.data?.message || 'Failed to open CoA. The CoA file may not be available for this sample.');
      console.error('Error opening CoA:', err);
    }
  };

  const handleViewSds = async (sampleId: number, casNumber: string, chemicalName: string) => {
    try {
      // Try to download the SDS file from the backend
      const response = await api.get(`/sample-inventory/${sampleId}/sds/download`, {
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
      // If no file exists, open DOW's SDS search page
      const searchUrl = `https://www.dow.com/en-us/safety-data-sheet-search.html?q=${encodeURIComponent(casNumber || chemicalName)}`;
      window.open(searchUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to archive this sample?')) return;
    
    try {
      await api.delete(`/sample-inventory/${id}`, {
        data: { notes: 'Archived from Sample Inventory UI' }
      });
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
          <div className="stat-card">
            <h3>{stats.with_sds}</h3>
            <p>With SDS</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by chemical name, CAS number, lot number..."
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
            <option value="archived">Archived</option>
          </select>

          <select value={expirationFilter} onChange={(e) => setExpirationFilter(e.target.value)}>
            <option value="">All Expiration</option>
            <option value="expired">Expired</option>
            <option value="expiring_30">Expiring (30 days)</option>
            <option value="expiring_60">Expiring (60 days)</option>
            <option value="expiring_90">Expiring (90 days)</option>
          </select>

          <select value={hazardClassFilter} onChange={(e) => setHazardClassFilter(e.target.value)}>
            <option value="">All Hazard Classes</option>
            {stats?.hazard_classes.map((hc) => (
              <option key={hc.hazard_class} value={hc.hazard_class}>
                {hc.hazard_class} ({hc.count})
              </option>
            ))}
          </select>

          <label>
            <input
              type="checkbox"
              checked={hasCoa === true}
              onChange={(e) => setHasCoa(e.target.checked ? true : undefined)}
            />
            Has CoA
          </label>

          <label>
            <input
              type="checkbox"
              checked={hasSds === true}
              onChange={(e) => setHasSds(e.target.checked ? true : undefined)}
            />
            Has SDS
          </label>
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
                  <th onClick={() => handleSort('chemical_name')}>
                    Chemical Name {sortBy === 'chemical_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('lot_number')}>
                    Lot Number {sortBy === 'lot_number' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>CAS Number</th>
                  <th>Quantity</th>
                  <th onClick={() => handleSort('expiration_date')}>
                    Expiration {sortBy === 'expiration_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('hazard_class')}>
                    Hazard Class {sortBy === 'hazard_class' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>UN Number</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {samples.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                      No samples found
                    </td>
                  </tr>
                ) : (
                  samples.map((sample) => (
                    <tr key={sample.id}>
                      <td>
                        <strong>{sample.chemical_name}</strong>
                        <br />
                        <small style={{ color: '#666' }}>{sample.concentration}</small>
                      </td>
                      <td>{sample.lot_number}</td>
                      <td>{sample.cas_number}</td>
                      <td>{sample.quantity}</td>
                      <td>
                        {sample.expiration_date ? new Date(sample.expiration_date).toLocaleDateString() : 'N/A'}
                        <br />
                        {getExpirationBadge(sample.expiration_status, sample.expiration_date)}
                      </td>
                      <td>
                        {sample.hazard_class}
                        {sample.packing_group && <><br /><small>PG: {sample.packing_group}</small></>}
                      </td>
                      <td>{sample.un_number}</td>
                      <td>
                        <span className={`badge badge-${sample.status === 'active' ? 'success' : 'secondary'}`}>
                          {sample.status}
                        </span>
                        <br />
                        {sample.has_coa && (
                          <button 
                            className="btn-icon" 
                            onClick={() => handleViewCoa(sample.id, sample.lot_number)}
                            title="View Certificate of Analysis"
                            style={{ fontSize: '10px', padding: '2px 6px', marginRight: '4px' }}
                          >
                             CoA
                          </button>
                        )}
                        {sample.has_dow_sds && (
                          <button 
                            className="btn-icon" 
                            onClick={() => handleViewSds(sample.id, sample.cas_number, sample.chemical_name)}
                            title="View Safety Data Sheet"
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                          >
                             SDS
                          </button>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(sample)}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(sample.id)}>
                          Archive
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
                  <label>Chemical Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.chemical_name}
                    onChange={(e) => setFormData({ ...formData, chemical_name: e.target.value })}
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
                  <label>CAS Number</label>
                  <input
                    type="text"
                    value={formData.cas_number}
                    onChange={(e) => setFormData({ ...formData, cas_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 12.86g or 1: 0.91g, 2: 3.91g"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Concentration</label>
                  <input
                    type="text"
                    value={formData.concentration}
                    onChange={(e) => setFormData({ ...formData, concentration: e.target.value })}
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
                  <label>Certification Date</label>
                  <input
                    type="date"
                    value={formData.certification_date}
                    onChange={(e) => setFormData({ ...formData, certification_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Recertification Date</label>
                  <input
                    type="date"
                    value={formData.recertification_date}
                    onChange={(e) => setFormData({ ...formData, recertification_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Hazard Class</label>
                  <input
                    type="text"
                    value={formData.hazard_class}
                    onChange={(e) => setFormData({ ...formData, hazard_class: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>UN Number</label>
                  <input
                    type="text"
                    value={formData.un_number}
                    onChange={(e) => setFormData({ ...formData, un_number: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>HS Code</label>
                  <input
                    type="text"
                    value={formData.hs_code}
                    onChange={(e) => setFormData({ ...formData, hs_code: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Packing Group</label>
                  <input
                    type="text"
                    value={formData.packing_group}
                    onChange={(e) => setFormData({ ...formData, packing_group: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Packing Instruction</label>
                  <input
                    type="text"
                    value={formData.packing_instruction}
                    onChange={(e) => setFormData({ ...formData, packing_instruction: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Hazard Description</label>
                  <textarea
                    rows={2}
                    value={formData.hazard_description}
                    onChange={(e) => setFormData({ ...formData, hazard_description: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Certificate of Analysis (CoA)</label>
                  {isEditing && selectedSample?.has_coa && !deleteCoaFile && !selectedCoaFile && (
                    <div style={{ marginTop: '8px', marginBottom: '8px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#333' }}> CoA file exists</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setDeleteCoaFile(true)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                         Delete
                      </button>
                    </div>
                  )}
                  {deleteCoaFile && (
                    <div style={{ marginTop: '8px', marginBottom: '8px', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#d00' }}> CoA file will be deleted</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setDeleteCoaFile(false)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Undo
                      </button>
                    </div>
                  )}
                  {!deleteCoaFile && (
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedCoaFile(file);
                        setFormData({ ...formData, has_coa: !!file });
                      }}
                    />
                  )}
                  {selectedCoaFile && (
                    <div style={{ marginTop: '8px', fontSize: '14px', color: '#0066cc' }}>
                      Selected: {selectedCoaFile.name}
                    </div>
                  )}
                </div>

                <div className="form-group full-width">
                  <label>Safety Data Sheet (SDS)</label>
                  {isEditing && selectedSample?.has_dow_sds && !deleteSdsFile && !selectedSdsFile && (
                    <div style={{ marginTop: '8px', marginBottom: '8px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#333' }}>📋 SDS file exists</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setDeleteSdsFile(true)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                  {deleteSdsFile && (
                    <div style={{ marginTop: '8px', marginBottom: '8px', padding: '10px', backgroundColor: '#ffe6e6', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#d00' }}>⚠️ SDS file will be deleted</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setDeleteSdsFile(false)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Undo
                      </button>
                    </div>
                  )}
                  {!deleteSdsFile && (
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedSdsFile(file);
                        setFormData({ ...formData, has_dow_sds: !!file });
                      }}
                    />
                  )}
                  {selectedSdsFile && (
                    <div style={{ marginTop: '8px', fontSize: '14px', color: '#0066cc' }}>
                      Selected: {selectedSdsFile.name}
                    </div>
                  )}
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




