import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import './Studies.css';

type StudyRole = 'study_admin' | 'study_editor' | 'study_viewer';

interface AssignedUser {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  study_role: StudyRole;
}

interface StudySample {
  id: string;
  material_role: string;
  notes: string | null;
  sample_pk: string;
  chemical_name: string;
  lot_number: string | null;
  cas_number: string | null;
  quantity: string | null;
}

interface StudyDetail {
  id: string;
  study_number: string;
  study_title: string;
  program_id: string | null;
  program_name: string | null;
  glp_status: string;
  sponsor: string | null;
  study_director: string | null;
  principal_investigator: string | null;
  protocol_number: string | null;
  protocol_version: string | null;
  date_received: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  status: string;
  current_phase: string | null;
  percent_complete: number | null;
  notes: string | null;
  is_archived: boolean;
  study_role: StudyRole;
  assigned_users: AssignedUser[];
  samples: StudySample[];
}

interface StudyDocument {
  id: string;
  document_type: string;
  document_name: string;
  status: string;
  is_signed_protocol: boolean;
  is_locked: boolean;
  current_version_id: string | null;
  current_version_number: number | null;
  current_file_name: string | null;
  current_uploaded_at: string | null;
  created_at: string;
}

interface DocVersion {
  id: string;
  version_number: number;
  file_name: string;
  file_path: string;
  change_note: string | null;
  is_immutable: boolean;
  uploaded_at: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface ActivityEntry {
  id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface LookupUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

const STATUS_OPTIONS = [
  'Planned', 'Upcoming', 'Awaiting Samples', 'Ready to Start', 'Ongoing',
  'In Progress', 'Testing Complete', 'Data Review', 'QA Review',
  'Report Preparation', 'Complete', 'On Hold', 'Cancelled',
];

const DOCUMENT_TYPES = [
  'Signed Protocol', 'Protocol Amendment', 'Test Method',
  'Sample Preparation Form', 'Standard Preparation Form', 'Raw Data',
  'Calculations', 'QA Document', 'Report', 'Correspondence',
  'Study Workbook', 'Other',
];

const RANK: Record<StudyRole, number> = { study_viewer: 1, study_editor: 2, study_admin: 3 };

const StudyWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'documents' | 'samples' | 'activity'>('overview');

  // versions expansion
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [versions, setVersions] = useState<Record<string, DocVersion[]>>({});

  // edit study modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<StudyDetail>>({});
  const [saving, setSaving] = useState(false);

  // document upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [docType, setDocType] = useState('Raw Data');
  const [docName, setDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // personnel
  const [lookupUsers, setLookupUsers] = useState<LookupUser[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newUserRole, setNewUserRole] = useState<StudyRole>('study_viewer');

  const role = study?.study_role;
  const canEdit = role ? RANK[role] >= RANK['study_editor'] : false;
  const isAdmin = role === 'study_admin';

  const fetchStudy = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/studies/${id}`);
      setStudy(res.data.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load study');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await api.get(`/studies/${id}/documents`);
      setDocuments(res.data.data || []);
    } catch {
      /* non-fatal */
    }
  };

  const fetchActivity = async () => {
    try {
      const res = await api.get(`/studies/${id}/activity`);
      setActivity(res.data.data || []);
    } catch {
      /* non-fatal */
    }
  };

  const fetchLookupUsers = async () => {
    try {
      const res = await api.get('/studies/lookup/users');
      setLookupUsers(res.data.data || []);
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    fetchStudy();
    fetchDocuments();
    fetchActivity();
    fetchLookupUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString() : '—');
  const fmtDateTime = (d: string | null | undefined) => (d ? new Date(d).toLocaleString() : '—');
  const userName = (u: { first_name: string | null; last_name: string | null; username: string | null }) =>
    [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Unknown';

  const toDateInput = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '');

  const openEdit = () => {
    if (!study) return;
    setEditForm({
      study_title: study.study_title,
      glp_status: study.glp_status,
      status: study.status,
      sponsor: study.sponsor,
      study_director: study.study_director,
      principal_investigator: study.principal_investigator,
      protocol_number: study.protocol_number,
      protocol_version: study.protocol_version,
      date_received: toDateInput(study.date_received),
      start_date: toDateInput(study.start_date),
      target_completion_date: toDateInput(study.target_completion_date),
      actual_completion_date: toDateInput(study.actual_completion_date),
      current_phase: study.current_phase,
      percent_complete: study.percent_complete,
      notes: study.notes,
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      Object.entries(editForm).forEach(([k, v]) => {
        payload[k] = v === '' ? null : v;
      });
      await api.put(`/studies/${id}`, payload);
      toast.success('Study updated');
      setShowEdit(false);
      fetchStudy();
      fetchActivity();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update study');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!study) return;
    const next = !study.is_archived;
    if (!window.confirm(`${next ? 'Archive' : 'Unarchive'} this study?`)) return;
    try {
      await api.post(`/studies/${id}/archive`, { archived: next });
      toast.success(next ? 'Study archived' : 'Study unarchived');
      fetchStudy();
      fetchActivity();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update archive state');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim() || !docFile) {
      toast.error('Document name and file are required');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('document_type', docType);
      fd.append('document_name', docName);
      fd.append('file', docFile);
      await api.post(`/studies/${id}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Document uploaded');
      setShowUpload(false);
      setDocName('');
      setDocFile(null);
      setDocType('Raw Data');
      fetchDocuments();
      fetchActivity();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleNewVersion = async (doc: StudyDocument, file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/studies/${id}/documents/${doc.id}/versions`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('New version uploaded');
      fetchDocuments();
      fetchActivity();
      if (expandedDoc === doc.id) loadVersions(doc.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload version');
    }
  };

  const handleSign = async (doc: StudyDocument) => {
    if (!window.confirm(
      `Designate "${doc.document_name}" as a signed protocol?\n\nThis permanently locks the file. It can never be replaced — future amendments must be added as new documents.`
    )) return;
    try {
      await api.post(`/studies/${id}/documents/${doc.id}/sign`);
      toast.success('Document locked as signed protocol');
      fetchDocuments();
      fetchActivity();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to sign document');
    }
  };

  const handleDeleteDoc = async (doc: StudyDocument) => {
    if (!window.confirm(`Delete document "${doc.document_name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/studies/${id}/documents/${doc.id}`);
      toast.success('Document deleted');
      fetchDocuments();
      fetchActivity();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    }
  };

  const loadVersions = async (docId: string) => {
    try {
      const res = await api.get(`/studies/${id}/documents/${docId}/versions`);
      setVersions((prev) => ({ ...prev, [docId]: res.data.data || [] }));
    } catch {
      /* non-fatal */
    }
  };

  const toggleVersions = (docId: string) => {
    if (expandedDoc === docId) {
      setExpandedDoc(null);
    } else {
      setExpandedDoc(docId);
      if (!versions[docId]) loadVersions(docId);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId) {
      toast.error('Select a user');
      return;
    }
    try {
      await api.post(`/studies/${id}/users`, { user_id: newUserId, study_role: newUserRole });
      toast.success('User assigned');
      setNewUserId('');
      setNewUserRole('study_viewer');
      fetchStudy();
      fetchActivity();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign user');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!window.confirm('Remove this user from the study?')) return;
    try {
      await api.delete(`/studies/${id}/users/${userId}`);
      toast.success('User removed');
      fetchStudy();
      fetchActivity();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove user');
    }
  };

  const availableUsers = useMemo(() => {
    const assignedIds = new Set((study?.assigned_users || []).map((u) => u.user_id));
    return lookupUsers.filter((u) => !assignedIds.has(u.id));
  }, [lookupUsers, study]);

  if (loading) {
    return (
      <div className="studies-page">
        <div className="studies-content"><div className="studies-loading">Loading study…</div></div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="studies-page">
        <div className="studies-content">
          <div className="studies-error">{error || 'Study not found'}</div>
          <button className="btn btn-secondary" onClick={() => navigate('/studies')}>← Back to Studies</button>
        </div>
      </div>
    );
  }

  const pct = Number(study.percent_complete ?? 0);

  return (
    <div className="studies-page">
      <div className="studies-header">
        <div className="studies-header-content">
          <button className="studies-back-btn" onClick={() => navigate('/studies')}>← Studies</button>
          <div className="studies-title-section">
            <h1 className="studies-title">
              {study.study_number}{' '}
              <span className={`badge ${study.glp_status === 'GLP' ? 'badge-glp' : 'badge-nonglp'}`}>{study.glp_status}</span>
            </h1>
            <p className="studies-subtitle">{study.study_title}</p>
          </div>
          {isAdmin && (
            <>
              <button className="studies-refresh-btn" onClick={openEdit}>Edit</button>
              <button className="studies-refresh-btn" onClick={handleArchive}>
                {study.is_archived ? 'Unarchive' : 'Archive'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="studies-content">
        <div className="workspace-tabs">
          <button className={`workspace-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`workspace-tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>
            Documents<span className="tab-count">{documents.length}</span>
          </button>
          <button className={`workspace-tab ${tab === 'samples' ? 'active' : ''}`} onClick={() => setTab('samples')}>
            Samples &amp; Standards<span className="tab-count">{study.samples.length}</span>
          </button>
          <button className={`workspace-tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Activity History</button>
        </div>

        {/* ---------- Overview ---------- */}
        {tab === 'overview' && (
          <>
            <div className="overview-grid">
              <div className="info-card">
                <h4>Identification</h4>
                <div className="info-row"><span className="info-label">Study Number</span><span className="info-value">{study.study_number}</span></div>
                <div className="info-row"><span className="info-label">GLP Status</span><span className="info-value">{study.glp_status}</span></div>
                <div className="info-row"><span className="info-label">Status</span><span className="info-value">{study.status}</span></div>
                <div className="info-row"><span className="info-label">Program</span><span className="info-value">{study.program_name || '—'}</span></div>
                <div className="info-row"><span className="info-label">Current Phase</span><span className="info-value">{study.current_phase || '—'}</span></div>
              </div>

              <div className="info-card">
                <h4>Protocol &amp; Sponsor</h4>
                <div className="info-row"><span className="info-label">Sponsor</span><span className="info-value">{study.sponsor || '—'}</span></div>
                <div className="info-row"><span className="info-label">Study Director</span><span className="info-value">{study.study_director || '—'}</span></div>
                <div className="info-row"><span className="info-label">Principal Investigator</span><span className="info-value">{study.principal_investigator || '—'}</span></div>
                <div className="info-row"><span className="info-label">Protocol Number</span><span className="info-value">{study.protocol_number || '—'}</span></div>
                <div className="info-row"><span className="info-label">Protocol Version</span><span className="info-value">{study.protocol_version || '—'}</span></div>
              </div>

              <div className="info-card">
                <h4>Timeline</h4>
                <div className="info-row"><span className="info-label">Date Received</span><span className="info-value">{fmtDate(study.date_received)}</span></div>
                <div className="info-row"><span className="info-label">Start Date</span><span className="info-value">{fmtDate(study.start_date)}</span></div>
                <div className="info-row"><span className="info-label">Target Completion</span><span className="info-value">{fmtDate(study.target_completion_date)}</span></div>
                <div className="info-row"><span className="info-label">Actual Completion</span><span className="info-value">{fmtDate(study.actual_completion_date)}</span></div>
                <div className="info-row">
                  <span className="info-label">Progress</span>
                  <span className="info-value">{pct}%</span>
                </div>
                <div className="study-progress"><div className="study-progress-fill" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} /></div>
              </div>

              <div className="info-card">
                <h4>Personnel</h4>
                {study.assigned_users.length === 0 ? (
                  <p className="hint-text">No users assigned yet.</p>
                ) : (
                  study.assigned_users.map((u) => (
                    <div className="info-row" key={u.id}>
                      <span className="info-label">{userName(u)}</span>
                      <span className="info-value">
                        {u.study_role.replace('study_', '')}
                        {isAdmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: 8 }}
                            onClick={() => handleRemoveUser(u.user_id)}
                          >
                            Remove
                          </button>
                        )}
                      </span>
                    </div>
                  ))
                )}
                {isAdmin && (
                  <form onSubmit={handleAssignUser} style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select value={newUserId} onChange={(e) => setNewUserId(e.target.value)} style={{ flex: 1, minWidth: 140, padding: '7px 9px', borderRadius: 6, border: '1px solid #cdd3c6' }}>
                      <option value="">Add user…</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>{userName(u)} ({u.role})</option>
                      ))}
                    </select>
                    <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as StudyRole)} style={{ padding: '7px 9px', borderRadius: 6, border: '1px solid #cdd3c6' }}>
                      <option value="study_viewer">Viewer</option>
                      <option value="study_editor">Editor</option>
                      <option value="study_admin">Admin</option>
                    </select>
                    <button className="btn btn-primary btn-sm" type="submit">Assign</button>
                  </form>
                )}
              </div>
            </div>

            {study.notes && (
              <div className="info-card" style={{ marginTop: 16 }}>
                <h4>Notes</h4>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, color: '#333' }}>{study.notes}</p>
              </div>
            )}
          </>
        )}

        {/* ---------- Documents ---------- */}
        {tab === 'documents' && (
          <>
            <div className="section-actions">
              <h3>Documents</h3>
              {canEdit && (
                <button className="btn btn-primary" onClick={() => setShowUpload(true)}>+ Upload Document</button>
              )}
            </div>
            {documents.length === 0 ? (
              <div className="studies-empty"><p>No documents uploaded yet.</p></div>
            ) : (
              <div className="studies-table-wrapper">
                <table className="studies-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Current</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <React.Fragment key={doc.id}>
                        <tr>
                          <td>
                            {doc.document_name}{' '}
                            {doc.is_signed_protocol && <span className="badge badge-signed">Signed</span>}{' '}
                            {doc.is_locked && <span className="badge badge-locked">Locked</span>}
                          </td>
                          <td>{doc.document_type}</td>
                          <td>{doc.status}</td>
                          <td>v{doc.current_version_number ?? 1}</td>
                          <td>{fmtDate(doc.current_uploaded_at || doc.created_at)}</td>
                          <td>
                            <div className="table-actions">
                              <button className="btn btn-secondary btn-sm" onClick={() => toggleVersions(doc.id)}>
                                {expandedDoc === doc.id ? 'Hide' : 'Versions'}
                              </button>
                              {canEdit && !doc.is_locked && (
                                <label className="btn btn-secondary btn-sm" style={{ margin: 0 }}>
                                  New Version
                                  <input
                                    type="file"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleNewVersion(doc, f);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              )}
                              {isAdmin && !doc.is_locked && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleSign(doc)}>Sign</button>
                              )}
                              {isAdmin && !doc.is_locked && (
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc)}>Delete</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedDoc === doc.id && (
                          <tr>
                            <td colSpan={6} style={{ background: '#fafcf7' }}>
                              {(versions[doc.id] || []).length === 0 ? (
                                <span className="hint-text">Loading versions…</span>
                              ) : (
                                <table className="studies-table" style={{ boxShadow: 'none' }}>
                                  <thead>
                                    <tr>
                                      <th>Version</th>
                                      <th>File</th>
                                      <th>Change Note</th>
                                      <th>Uploaded By</th>
                                      <th>When</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(versions[doc.id] || []).map((v) => (
                                      <tr key={v.id}>
                                        <td>v{v.version_number} {v.is_immutable && <span className="badge badge-locked">Immutable</span>}</td>
                                        <td>{v.file_name}</td>
                                        <td>{v.change_note || '—'}</td>
                                        <td>{userName(v)}</td>
                                        <td>{fmtDateTime(v.uploaded_at)}</td>
                                        <td>
                                          {v.file_path && /^https?:\/\//.test(v.file_path) && (
                                            <a className="btn btn-secondary btn-sm" href={v.file_path} target="_blank" rel="noreferrer">Open</a>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ---------- Samples & Standards ---------- */}
        {tab === 'samples' && (
          <>
            <div className="section-actions">
              <h3>Samples &amp; Standards</h3>
              <span className="hint-text">Read-only in this release. Inventory quantities are managed in Sample Inventory.</span>
            </div>
            {study.samples.length === 0 ? (
              <div className="studies-empty"><p>No samples or standards linked to this study.</p></div>
            ) : (
              <div className="studies-table-wrapper">
                <table className="studies-table">
                  <thead>
                    <tr>
                      <th>Chemical Name</th>
                      <th>Lot Number</th>
                      <th>CAS Number</th>
                      <th>Role</th>
                      <th>Quantity</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {study.samples.map((s) => (
                      <tr key={s.id}>
                        <td>{s.chemical_name}</td>
                        <td>{s.lot_number || '—'}</td>
                        <td>{s.cas_number || '—'}</td>
                        <td>{s.material_role}</td>
                        <td>{s.quantity || '—'}</td>
                        <td>{s.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ---------- Activity ---------- */}
        {tab === 'activity' && (
          <>
            <div className="section-actions"><h3>Activity History</h3></div>
            {activity.length === 0 ? (
              <div className="studies-empty"><p>No activity recorded yet.</p></div>
            ) : (
              <div className="activity-list">
                {activity.map((a) => (
                  <div className="activity-item" key={a.id}>
                    <div className="activity-dot" />
                    <div className="activity-body">
                      <div className="activity-action">{a.action}</div>
                      {(a.old_value || a.new_value) && (
                        <div className="activity-detail">
                          {a.old_value && <>from <strong>{a.old_value}</strong> </>}
                          {a.new_value && <>to <strong>{a.new_value}</strong></>}
                        </div>
                      )}
                      <div className="activity-meta">
                        {userName(a)} · {fmtDateTime(a.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ---------- Edit modal ---------- */}
      {showEdit && (
        <div className="studies-modal-overlay" onClick={() => !saving && setShowEdit(false)}>
          <div className="studies-modal" onClick={(e) => e.stopPropagation()}>
            <div className="studies-modal-header">
              <h3>Edit Study</h3>
              <button className="studies-modal-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="studies-modal-body">
                <div className="form-grid">
                  <div className="form-field full">
                    <label>Study Title</label>
                    <input type="text" value={editForm.study_title || ''} onChange={(e) => setEditForm({ ...editForm, study_title: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>GLP Status</label>
                    <select value={editForm.glp_status || 'GLP'} onChange={(e) => setEditForm({ ...editForm, glp_status: e.target.value })}>
                      <option value="GLP">GLP</option>
                      <option value="Non-GLP">Non-GLP</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Status</label>
                    <select value={editForm.status || 'Planned'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Sponsor</label>
                    <input type="text" value={editForm.sponsor || ''} onChange={(e) => setEditForm({ ...editForm, sponsor: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Study Director</label>
                    <input type="text" value={editForm.study_director || ''} onChange={(e) => setEditForm({ ...editForm, study_director: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Principal Investigator</label>
                    <input type="text" value={editForm.principal_investigator || ''} onChange={(e) => setEditForm({ ...editForm, principal_investigator: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Current Phase</label>
                    <input type="text" value={editForm.current_phase || ''} onChange={(e) => setEditForm({ ...editForm, current_phase: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Protocol Number</label>
                    <input type="text" value={editForm.protocol_number || ''} onChange={(e) => setEditForm({ ...editForm, protocol_number: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Protocol Version</label>
                    <input type="text" value={editForm.protocol_version || ''} onChange={(e) => setEditForm({ ...editForm, protocol_version: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Date Received</label>
                    <input type="date" value={(editForm.date_received as string) || ''} onChange={(e) => setEditForm({ ...editForm, date_received: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Start Date</label>
                    <input type="date" value={(editForm.start_date as string) || ''} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Target Completion</label>
                    <input type="date" value={(editForm.target_completion_date as string) || ''} onChange={(e) => setEditForm({ ...editForm, target_completion_date: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Actual Completion</label>
                    <input type="date" value={(editForm.actual_completion_date as string) || ''} onChange={(e) => setEditForm({ ...editForm, actual_completion_date: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Percent Complete</label>
                    <input type="number" min={0} max={100} value={editForm.percent_complete ?? ''} onChange={(e) => setEditForm({ ...editForm, percent_complete: e.target.value === '' ? null : Number(e.target.value) })} />
                  </div>
                  <div className="form-field full">
                    <label>Notes</label>
                    <textarea value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="studies-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Upload modal ---------- */}
      {showUpload && (
        <div className="studies-modal-overlay" onClick={() => !uploading && setShowUpload(false)}>
          <div className="studies-modal" onClick={(e) => e.stopPropagation()}>
            <div className="studies-modal-header">
              <h3>Upload Document</h3>
              <button className="studies-modal-close" onClick={() => setShowUpload(false)}>×</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="studies-modal-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Document Type <span className="req">*</span></label>
                    <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                      {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Document Name <span className="req">*</span></label>
                    <input type="text" value={docName} onChange={(e) => setDocName(e.target.value)} required />
                  </div>
                  <div className="form-field full">
                    <label>File <span className="req">*</span></label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      required
                    />
                    <p className="hint-text">PDF, Word, Excel, CSV or text. Max 50MB.</p>
                  </div>
                </div>
              </div>
              <div className="studies-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)} disabled={uploading}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyWorkspace;
