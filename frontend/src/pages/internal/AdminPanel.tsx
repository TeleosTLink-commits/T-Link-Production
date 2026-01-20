import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './AdminPanel.css';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

interface Sample {
  id: string;
  chemical_name: string;
  lot_number: string;
  quantity: string;
  status: string;
  created_at: string;
}

interface Shipment {
  id: string;
  shipment_number: string;
  status: string;
  recipient_name: string;
  created_at: string;
}

interface TestMethod {
  id: string;
  test_name: string;
  method_number: string;
  status: string;
}

interface ActivityData {
  activeUsers: number;
  usersByRole: Array<{ role: string; count: string }>;
  recentLogins: Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    last_login: string;
  }>;
  neverLoggedIn: number;
  loginsByDay: Array<{ date: string; logins: string }>;
}

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'shipments' | 'samples' | 'testmethods' | 'system'>('users');
  const [loading, setLoading] = useState(false);
  
  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', firstName: '', lastName: '', password: '', role: 'manufacturer' });
  
  // Shipments
  const [shipments, setShipments] = useState<Shipment[]>([]);
  
  // Samples
  const [samples, setSamples] = useState<Sample[]>([]);
  
  // Test Methods
  const [testMethods, setTestMethods] = useState<TestMethod[]>([]);
  
  // System
  const [dbStats, setDbStats] = useState<any>(null);

  // Activity
  const [activityData, setActivityData] = useState<ActivityData | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
      if (activeTab === 'activity') fetchActivity();
    if (activeTab === 'shipments') fetchShipments();
    if (activeTab === 'samples') fetchSamples();
    if (activeTab === 'testmethods') fetchTestMethods();
    if (activeTab === 'system') fetchSystemStats();
  }, [activeTab]);

  const checkAdminAccess = async () => {
    try {
      const response = await api.get('/admin/verify');
      if (!response.data.isSuperAdmin) {
        alert('Access Denied: Super Admin privileges required');
        navigate('/dashboard');
      }
    } catch (err) {
      alert('Access Denied');
      navigate('/dashboard');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.data || response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/shipments');
      setShipments(Array.isArray(response.data) ? response.data : response.data.data || []);
    } catch (err) {
      console.error('Error fetching shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSamples = async () => {
    setLoading(true);
    try {
      const response = await api.get('/sample-inventory', { params: { limit: 1000 } });
      setSamples(response.data.data?.samples || []);
    } catch (err) {
      console.error('Error fetching samples:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestMethods = async () => {
    setLoading(true);
    try {
      const response = await api.get('/test-methods', { params: { limit: 1000 } });
      setTestMethods(response.data.data?.testMethods || []);
    } catch (err) {
      console.error('Error fetching test methods:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/system-stats');
      setDbStats(response.data.data || response.data);
    } catch (err) {
      console.error('Error fetching system stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/user-activity');
      setActivityData(response.data.data || response.data);
    } catch (err) {
      console.error('Error fetching activity data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', newUser);
      alert('✅ User created successfully');
      setShowAddUser(false);
      setNewUser({ email: '', firstName: '', lastName: '', password: '', role: 'manufacturer' });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    const newPassword = prompt(`Enter new password for ${email}:`);
    if (!newPassword) return;
    
    try {
      await api.post(`/admin/users/${userId}/reset-password`, { password: newPassword });
      alert('✅ Password reset successfully');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleChangeRole = async (userId: string, currentRole: string, email: string) => {
    const roles = ['manufacturer', 'lab_staff', 'admin', 'super_admin'];
    const newRole = prompt(`Change role for ${email}\nCurrent: ${currentRole}\nOptions: ${roles.join(', ')}`);
    if (!newRole || !roles.includes(newRole)) return;
    
    try {
      await api.post(`/admin/users/${userId}/change-role`, { role: newRole });
      alert('✅ Role updated successfully');
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change role');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.post(`/admin/users/${userId}/toggle-status`, { isActive: !currentStatus });
      alert(`✅ User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const handleDeleteShipment = async (id: string, shipmentNumber: string) => {
    if (!confirm(`Delete shipment ${shipmentNumber}? This action cannot be undone.`)) return;
    
    try {
      await api.delete(`/admin/shipments/${id}`);
      alert('✅ Shipment deleted successfully');
      fetchShipments();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete shipment');
    }
  };

  const handleDeleteSample = async (id: string, chemicalName: string) => {
    if (!confirm(`Delete sample "${chemicalName}"? This action cannot be undone.`)) return;
    
    try {
      await api.delete(`/admin/samples/${id}`);
      alert('✅ Sample deleted successfully');
      fetchSamples();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete sample');
    }
  };

  const handleDeleteTestMethod = async (id: string, testName: string) => {
    if (!confirm(`Delete test method "${testName}"? This action cannot be undone.`)) return;
    
    try {
      await api.delete(`/admin/test-methods/${id}`);
      alert('✅ Test method deleted successfully');
      fetchTestMethods();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete test method');
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-header-content">
          <button className="admin-back-btn" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </button>
          <div>
            <h1>🛡️ Super Admin Panel</h1>
            <p>Full platform management and control</p>
          </div>
        </div>
        
        <div className="admin-tabs">
          <button 
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Users
                    <button 
                      className={`admin-tab ${activeTab === 'activity' ? 'active' : ''}`}
                      onClick={() => setActiveTab('activity')}
                    >
                      📊 Activity
                    </button>
          </button>
          <button 
            className={`admin-tab ${activeTab === 'shipments' ? 'active' : ''}`}
            onClick={() => setActiveTab('shipments')}
          >
            📦 Shipments
          </button>
          <button 
            className={`admin-tab ${activeTab === 'samples' ? 'active' : ''}`}
            onClick={() => setActiveTab('samples')}
          >
            🧪 Samples
          </button>
          <button 
            className={`admin-tab ${activeTab === 'testmethods' ? 'active' : ''}`}
            onClick={() => setActiveTab('testmethods')}
          >
            📋 Test Methods
          </button>
          <button 
            className={`admin-tab ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            ⚙️ System
          </button>
        </div>
      </div>

      <div className="admin-content">
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>User Management</h2>
              <button className="admin-primary-btn" onClick={() => setShowAddUser(true)}>
                + Add New User
              </button>
            </div>
            
            {loading ? (
              <div className="admin-loading">Loading users...</div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>{user.first_name} {user.last_name}</td>
                        <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                        <td>
                          <span className={`status-indicator ${user.is_active ? 'active' : 'inactive'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                        <td>
                          <div className="action-buttons">
                            <button 
                              className="action-btn small"
                              onClick={() => handleResetPassword(user.id, user.email)}
                            >
                              Reset Password
                            </button>
                            <button 
                              className="action-btn small"
                              onClick={() => handleChangeRole(user.id, user.role, user.email)}
                            >
                              Change Role
                            </button>
                            <button 
                              className="action-btn small warning"
                              onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>User Activity & Statistics</h2>
            </div>
            
            {loading ? (
              <div className="admin-loading">Loading activity data...</div>
            ) : activityData ? (
              <div className="activity-dashboard">
                {/* Summary Cards */}
                <div className="activity-stats">
                  <div className="stat-card">
                              <div className="stat-icon">✅</div>
                              <div className="stat-value">{activityData.activeUsers}</div>
                              <div className="stat-label">Active Users (30 days)</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-icon">⏸️</div>
                              <div className="stat-value">{activityData.neverLoggedIn}</div>
                              <div className="stat-label">Never Logged In</div>
                            </div>
                            <div className="stat-card">
                              <div className="stat-icon">📈</div>
                              <div className="stat-value">
                                {activityData.recentLogins.length > 0 
                                  ? new Date(activityData.recentLogins[0].last_login).toLocaleDateString()
                                  : 'N/A'}
                              </div>
                              <div className="stat-label">Latest Login</div>
                            </div>
                </div>

                {/* Users by Role */}
                <div className="activity-section">
                            <h3>Users by Role</h3>
                            <div className="role-distribution">
                              {activityData.usersByRole.map((roleData) => (
                                <div key={roleData.role} className="role-stat">
                                  <span className={`role-badge ${roleData.role}`}>{roleData.role}</span>
                                  <span className="role-count">{roleData.count} users</span>
                                </div>
                              ))}
                            </div>
                </div>

                {/* Recent Logins */}
                <div className="activity-section">
                            <h3>Recent Logins (Last 10)</h3>
                            <div className="admin-table-wrapper">
                              <table className="admin-table">
                                <thead>
                                  <tr>
                                    <th>User</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Last Login</th>
                                    <th>Days Ago</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activityData.recentLogins.map((user) => {
                                    const daysAgo = Math.floor(
                                      (Date.now() - new Date(user.last_login).getTime()) / (1000 * 60 * 60 * 24)
                                    );
                                    return (
                                      <tr key={user.id}>
                                        <td>{user.first_name} {user.last_name}</td>
                                        <td>{user.email}</td>
                                        <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>
                                        <td>{new Date(user.last_login).toLocaleString()}</td>
                                        <td>
                                          <span className={daysAgo === 0 ? 'recent-badge' : ''}>
                                            {daysAgo === 0 ? 'Today' : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                </div>

                {/* Login Activity by Day */}
                <div className="activity-section">
                            <h3>Login Activity (Last 30 Days)</h3>
                            <div className="login-timeline">
                              {activityData.loginsByDay.length > 0 ? (
                                activityData.loginsByDay.map((day) => (
                                  <div key={day.date} className="timeline-item">
                                    <div className="timeline-date">
                                      {new Date(day.date).toLocaleDateString()}
                                    </div>
                                    <div className="timeline-bar" style={{ width: `${Math.min(parseInt(day.logins) * 20, 100)}%` }}>
                                      {day.logins} login{parseInt(day.logins) > 1 ? 's' : ''}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="admin-empty">No login activity in the last 30 days</div>
                              )}
                            </div>
                </div>
              </div>
            ) : (
              <div className="admin-empty">No activity data available</div>
            )}
          </div>
        )}

        {/* Shipments Tab */}
        {activeTab === 'shipments' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Shipment Management</h2>
            </div>
            
            {loading ? (
              <div className="admin-loading">Loading shipments...</div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Shipment #</th>
                      <th>Recipient</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td><strong>{shipment.shipment_number}</strong></td>
                        <td>{shipment.recipient_name}</td>
                        <td><span className={`status-badge ${shipment.status}`}>{shipment.status}</span></td>
                        <td>{new Date(shipment.created_at).toLocaleDateString()}</td>
                        <td>
                          <button 
                            className="action-btn small danger"
                            onClick={() => handleDeleteShipment(shipment.id, shipment.shipment_number)}
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
        )}

        {/* Samples Tab */}
        {activeTab === 'samples' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Sample Management</h2>
            </div>
            
            {loading ? (
              <div className="admin-loading">Loading samples...</div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Chemical Name</th>
                      <th>Lot Number</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((sample) => (
                      <tr key={sample.id}>
                        <td><strong>{sample.chemical_name}</strong></td>
                        <td>{sample.lot_number}</td>
                        <td>{sample.quantity}</td>
                        <td><span className={`status-badge ${sample.status}`}>{sample.status}</span></td>
                        <td>
                          <button 
                            className="action-btn small danger"
                            onClick={() => handleDeleteSample(sample.id, sample.chemical_name)}
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
        )}

        {/* Test Methods Tab */}
        {activeTab === 'testmethods' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Test Method Management</h2>
            </div>
            
            {loading ? (
              <div className="admin-loading">Loading test methods...</div>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Test Name</th>
                      <th>Method Number</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testMethods.map((method) => (
                      <tr key={method.id}>
                        <td><strong>{method.test_name}</strong></td>
                        <td>{method.method_number}</td>
                        <td><span className={`status-badge ${method.status}`}>{method.status}</span></td>
                        <td>
                          <button 
                            className="action-btn small danger"
                            onClick={() => handleDeleteTestMethod(method.id, method.test_name)}
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
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>System Information</h2>
            </div>
            
            {loading ? (
              <div className="admin-loading">Loading system stats...</div>
            ) : dbStats ? (
              <div className="system-stats">
                <div className="stat-card">
                  <div className="stat-icon">👥</div>
                  <div className="stat-value">{dbStats.totalUsers || 0}</div>
                  <div className="stat-label">Total Users</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📦</div>
                  <div className="stat-value">{dbStats.totalShipments || 0}</div>
                  <div className="stat-label">Total Shipments</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🧪</div>
                  <div className="stat-value">{dbStats.totalSamples || 0}</div>
                  <div className="stat-label">Total Samples</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📋</div>
                  <div className="stat-value">{dbStats.totalTestMethods || 0}</div>
                  <div className="stat-label">Test Methods</div>
                </div>
              </div>
            ) : (
              <div className="admin-empty">No system data available</div>
            )}
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="admin-modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add New User</h2>
              <button className="admin-modal-close" onClick={() => setShowAddUser(false)}>×</button>
            </div>
            <form onSubmit={handleAddUser} className="admin-form">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="manufacturer">Manufacturer</option>
                  <option value="lab_staff">Lab Staff</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowAddUser(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
