import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './TestMethods.css';

interface TestMethod {
  id?: number;
  tm_number: string;
  version: string;
  title: string;
  description?: string;
  status: string;
  is_current_version?: boolean;
  file_path?: string;
  file_name?: string;
  created_at?: string;
  updated_at?: string;
}

const TestMethods: React.FC = () => {
  const [testMethods, setTestMethods] = useState<TestMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<TestMethod | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<TestMethod>({
    tm_number: '',
    version: '',
    title: '',
    description: '',
    status: 'active',
  });

  useEffect(() => {
    fetchTestMethods();
  }, []);

  const fetchTestMethods = async () => {
    try {
      const response = await api.get('/test-methods?page=1&limit=100');
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

  const handleViewDocument = (id: number | undefined) => {
    if (!id) {
      alert('No document ID available');
      return;
    }
    // Open file in new tab using backend endpoint
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const token = localStorage.getItem('auth_token');
    const url = `${baseUrl}/test-methods/${id}/download?token=${token}`;
    window.open(url, '_blank');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this test method?')) return;
    try {
      await api.delete(`/test-methods/${id}`);
      fetchTestMethods();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete test method');
    }
  };

  if (loading) return <div className="test-methods-container"><div className="loading">Loading test methods...</div></div>;
  if (error) return <div className="test-methods-container"><div className="error-message">{error}</div></div>;

  return (
    <div className="test-methods-container">
      <div className="page-header">
        <h1>Test Methods Library</h1>
        <button className="btn-primary" onClick={handleAdd}>
          + Add Test Method
        </button>
      </div>

      <div className="table-container">
        <table className="test-methods-table">
          <thead>
            <tr>
              <th>TM Number</th>
              <th>Version</th>
              <th>Title</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {testMethods.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                  <p>No test methods found.</p>
                  <p>Click &quot;+ Add Test Method&quot; to create one.</p>
                </td>
              </tr>
            ) : (
              testMethods.map((method: TestMethod) => (
                <tr key={method.id}>
                  <td>{method.tm_number}</td>
                  <td>{method.version}</td>
                  <td>{method.title}</td>
                  <td>{method.description || 'N/A'}</td>
                  <td><span style={{padding: '4px 8px', backgroundColor: method.status === 'active' ? '#d4edda' : '#fff3cd', borderRadius: '4px'}}>{method.status}</span></td>
                  <td>
                    {method.file_path && (
                      <button className="btn-icon" onClick={() => handleViewDocument(method.id)} title="View Document">📄 View</button>
                    )}
                    <button className="btn-icon" onClick={() => handleEdit(method)} title="Edit">✏️ Edit</button>
                    <button className="btn-icon" onClick={() => handleDelete(method.id!)} title="Delete">🗑️ Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingMethod ? 'Edit Test Method' : 'Add Test Method'}</h2>
              <button className="btn-close" onClick={() => setShowModal(false)}></button>
            </div>
            <form onSubmit={handleSubmit}>
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
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Test Method Document</label>
                  {editingMethod?.file_name && (
                    <div style={{marginBottom: '8px', fontSize: '14px', color: '#666'}}>
                      Current file: {editingMethod.file_name}
                    </div>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  {selectedFile && (
                    <div style={{marginTop: '8px', fontSize: '14px', color: '#0066cc'}}>
                      Selected: {selectedFile.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
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
    </div>
  );
};

export default TestMethods;


