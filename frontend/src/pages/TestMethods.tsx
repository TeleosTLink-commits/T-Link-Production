import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './TestMethods.css';

interface TestMethod {
  id?: number;
  legacy_number: string;
  official_number?: string;
  original_title: string;
  method_type: string;
  effective_date?: string;
  aal_verification_date?: string;
  file_path?: string;
  file_name?: string;
}

const TestMethods: React.FC = () => {
  const [testMethods, setTestMethods] = useState<TestMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<TestMethod | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [naVerification, setNaVerification] = useState(false);
  
  const [formData, setFormData] = useState<TestMethod>({
    legacy_number: '',
    official_number: '',
    original_title: '',
    method_type: '',
    effective_date: '',
    aal_verification_date: ''
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
      legacy_number: '',
      official_number: '',
      original_title: '',
      method_type: '',
      effective_date: '',
      aal_verification_date: ''
    });
    setSelectedFile(null);
    setNaVerification(false);
    setShowModal(true);
  };

  const handleEdit = (method: TestMethod) => {
    setEditingMethod(method);
    setFormData(method);
    setSelectedFile(null);
    setNaVerification(!method.aal_verification_date);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        aal_verification_date: naVerification ? null : formData.aal_verification_date
      };
      
      let methodId;
      if (editingMethod) {
        await api.put(`/test-methods/${editingMethod.id}`, submitData);
        methodId = editingMethod.id;
      } else {
        const response = await api.post('/test-methods', submitData);
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

  const handleViewDocument = async (id: number | undefined, fileName: string) => {
    if (!id) return;
    try {
      const response = await api.get(`/test-methods/${id}/download`, {
        responseType: 'blob'
      });
      
      // Create blob URL and open in new tab
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to open document');
    }
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
              <th>Legacy Number</th>
              <th>Title</th>
              <th>Method Type</th>
              <th>Effective Date</th>
              <th>AAL Test Method Number</th>
              <th>Date of AAL Verification</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {testMethods.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                  <p>No test methods found.</p>
                  <p>Click &quot;+ Add Test Method&quot; to create one, or import from CSV.</p>
                </td>
              </tr>
            ) : (
              testMethods.map((method: TestMethod) => (
                <tr key={method.id}>
                  <td>{method.legacy_number || 'N/A'}</td>
                  <td>{method.original_title}</td>
                  <td>{method.method_type || 'N/A'}</td>
                  <td>{method.effective_date ? new Date(method.effective_date).toLocaleDateString() : 'N/A'}</td>
                  <td>{method.official_number || 'Not Assigned'}</td>
                  <td>{method.aal_verification_date ? new Date(method.aal_verification_date).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    {method.file_path && (
                      <button className="btn-icon" onClick={() => handleViewDocument(method.id, method.file_name || 'document.pdf')} title="View Document">📄 View</button>
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
                  <label>Legacy Number *</label>
                  <input
                    type="text"
                    value={formData.legacy_number}
                    onChange={(e) => setFormData({...formData, legacy_number: e.target.value})}
                    required
                    placeholder="e.g., LAB-A-2019-05"
                  />
                </div>
                
                <div className="form-group">
                  <label>AAL Test Method Number</label>
                  <input
                    type="text"
                    value={formData.official_number || ''}
                    onChange={(e) => setFormData({...formData, official_number: e.target.value})}
                    placeholder="e.g., TM-001"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.original_title}
                    onChange={(e) => setFormData({...formData, original_title: e.target.value})}
                    required
                    placeholder="Test method title"
                  />
                </div>

                <div className="form-group">
                  <label>Method Type *</label>
                  <select
                    value={formData.method_type}
                    onChange={(e) => setFormData({...formData, method_type: e.target.value})}
                    required
                  >
                    <option value="">Select type...</option>
                    <option value="GC">Gas Chromatography (GC)</option>
                    <option value="HPLC">HPLC</option>
                    <option value="FTIR">FTIR</option>
                    <option value="NMR">NMR</option>
                    <option value="Titration">Titration</option>
                    <option value="Wet Chemistry">Wet Chemistry</option>
                    <option value="Physical Testing">Physical Testing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    value={formData.effective_date || ''}
                    onChange={(e) => setFormData({...formData, effective_date: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Date of AAL Verification</label>
                  <input
                    type="date"
                    value={naVerification ? '' : (formData.aal_verification_date || '')}
                    onChange={(e) => setFormData({...formData, aal_verification_date: e.target.value})}
                    disabled={naVerification}
                  />
                  <label style={{marginTop: '5px', fontSize: '14px'}}>
                    <input
                      type="checkbox"
                      checked={naVerification}
                      onChange={(e) => setNaVerification(e.target.checked)}
                    />
                    {' '}N/A
                  </label>
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


