import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './TestMethods.css';

interface TestMethod {
  id?: string;
  tm_number: string;
  version: string;
  title: string;
  description?: string;
  file_path?: string;
  file_name?: string;
  is_current_version: boolean;
  status: string;
  approved_by?: string;
  approved_at?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

const TestMethods: React.FC = () => {
  const navigate = useNavigate();
  const [testMethods, setTestMethods] = useState<TestMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<TestMethod | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [formData, setFormData] = useState<TestMethod>({
    tm_number: '',
    version: '',
    title: '',
    description: '',
    file_path: '',
    file_name: '',
    is_current_version: true,
    status: 'active',
  });

  useEffect(() => {
    fetchTestMethods();
  }, []);

  const fetchTestMethods = async () => {
    try {
      const response = await api.get('/test-methods?page=1&limit=500');
      setTestMethods(response.data.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load test methods');
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMethod(null);
    setFormData({
      tm_number: '',
      version: '',
      title: '',
      description: '',
      file_path: '',
      file_name: '',
      is_current_version: true,
      status: 'active',
    });
    setSelectedFile(null);
    setShowModal(true);
  };

  const handleEdit = (method: TestMethod) => {
    setEditingMethod(method);
    setFormData(method);
    setSelectedFile(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let methodId;
      if (editingMethod) {
        await api.put(`/test-methods/${editingMethod.id}`, formData);
        methodId = editingMethod.id;
      } else {
        const response = await api.post('/test-methods', formData);
        methodId = response.data.data.id;
      }
      
      // Upload file if selected
      if (selectedFile && methodId) {
        const fileFormData = new FormData();
        fileFormData.append('file', selectedFile);
        await api.post(`/test-methods/${methodId}/upload`, fileFormData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      setShowModal(false);
      setSelectedFile(null);
      fetchTestMethods();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save test method');
    }
  };

  const handleViewDocument = (method: TestMethod) => {
    if (!method?.id) {
      alert('No document ID available');
      return;
    }
    // If Cloudinary URL present, open directly; else use backend download route
    if (method.file_path && method.file_path.startsWith('http')) {
      window.open(method.file_path, '_blank');
    } else {
      const base =
        (import.meta.env.VITE_API_URL as string) || 'https://tlink-production-backend.onrender.com/api';
      const url = `${base}/test-methods/${method.id}/download`;
      window.open(url, '_blank');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this test method?')) return;
    try {
      await api.delete(`/test-methods/${id}`);
      fetchTestMethods();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete test method');
    }
  };

  const filteredMethods = testMethods.filter(method => {
    const matchesSearch = 
      (method.tm_number?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (method.title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (method.version?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = !statusFilter || method.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="portal-page">
        <div className="portal-header">
          <div className="header-content">
            <div className="header-top">
              <button className="btn-back" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
                ← Dashboard
              </button>
              <h1>Test Methods Library</h1>
            </div>
          </div>
        </div>
        <div className="portal-content">
          <div className="loading-message">Loading test methods...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="portal-page">
        <div className="portal-header">
          <div className="header-content">
            <div className="header-top">
              <button className="btn-back" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
                ← Dashboard
              </button>
              <h1>Test Methods Library</h1>
            </div>
          </div>
        </div>
        <div className="portal-content">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div className="header-content">
          <div className="header-top">
            <button className="btn-back" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
              ← Dashboard
            </button>
            <h1>Test Methods Library</h1>
          </div>
          <button className="btn-contact" onClick={handleAdd}>
            + Add Test Method
          </button>
        </div>
      </div>

      <div className="portal-content">
        <div className="filters-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by TM Number, Title, or Version..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="superseded">Superseded</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {filteredMethods.length === 0 ? (
          <div className="empty-state">
            <p className="empty-message">No test methods found</p>
            <button className="btn-primary-outline" onClick={handleAdd}>
              Create First Test Method
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>TM Number</th>
                  <th>Version</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Current</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMethods.map((method) => (
                  <tr key={method.id}>
                    <td className="tm-number"><strong>{method.tm_number}</strong></td>
                    <td>{method.version}</td>
                    <td>{method.title}</td>
                    <td className="description">{method.description || 'N/A'}</td>
                    <td>
                      <span className={`status-badge status-${method.status}`}>
                        {method.status}
                      </span>
                    </td>
                    <td className="center">
                      {method.is_current_version ? (
                        <span className="badge-current">Active</span>
                      ) : (
                        <span className="badge-inactive">Inactive</span>
                      )}
                    </td>
                    <td className="actions">
                      {method.file_path && (
                        <button 
                          className="btn-small"
                          onClick={() => handleViewDocument(method)}
                          title="View Document"
                        >
                          View
                        </button>
                      )}
                      <button 
                        className="btn-small"
                        onClick={() => handleEdit(method)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button 
                        className="btn-small btn-delete"
                        onClick={() => handleDelete(method.id!)}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingMethod ? 'Edit Test Method' : 'Add Test Method'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}>Close</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>TM Number *</label>
                  <input
                    type="text"
                    value={formData.tm_number}
                    onChange={(e) => setFormData({...formData, tm_number: e.target.value})}
                    required
                    placeholder="e.g., TM-001"
                  />
                </div>
                
                <div className="form-group">
                  <label>Version *</label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({...formData, version: e.target.value})}
                    required
                    placeholder="e.g., 1.0"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="Test method title"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Description of the test method"
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label>Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    required
                  >
                    <option value="active">Active</option>
                    <option value="superseded">Superseded</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_current_version}
                      onChange={(e) => setFormData({...formData, is_current_version: e.target.checked})}
                    />
                    Current Version
                  </label>
                </div>

                <div className="form-group full-width">
                  <label>Test Method Document</label>
                  {editingMethod?.file_name && (
                    <div className="file-info">
                      Current file: {editingMethod.file_name}
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  {selectedFile && (
                    <div className="file-selected">
                      Selected: {selectedFile.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingMethod ? 'Update' : 'Create'} Test Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="footer-content">
          <span className="footer-text">Developed and operated by</span>
          <img src="/images/AAL_Dig_Dev.png" alt="AAL Digital Development" className="footer-logo" />
        </div>
      </footer>
    </div>
  );
};

export default TestMethods;


