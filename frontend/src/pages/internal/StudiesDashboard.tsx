import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import './Studies.css';

interface StudyProgram {
  id: string;
  program_name: string;
  default_glp_status: string | null;
  study_count?: number;
}

interface Study {
  id: string;
  study_number: string;
  study_title: string;
  program_id: string | null;
  program_name: string | null;
  glp_status: string;
  sponsor: string | null;
  status: string;
  current_phase: string | null;
  percent_complete: number | null;
  start_date: string | null;
  target_completion_date: string | null;
  is_archived: boolean;
  document_count: string | number;
  sample_count: string | number;
  created_at: string;
}

const STATUS_OPTIONS = [
  'Planned', 'Upcoming', 'Awaiting Samples', 'Ready to Start', 'Ongoing',
  'In Progress', 'Testing Complete', 'Data Review', 'QA Review',
  'Report Preparation', 'Complete', 'On Hold', 'Cancelled',
];

const emptyForm = {
  study_number: '',
  study_title: '',
  program_id: '',
  glp_status: 'GLP',
  sponsor: '',
  study_director: '',
  principal_investigator: '',
  protocol_number: '',
  protocol_version: '',
  date_received: '',
  start_date: '',
  target_completion_date: '',
  status: 'Planned',
  current_phase: '',
  notes: '',
};

const StudiesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const storedUserStr = localStorage.getItem('user');
  const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;
  const effectiveUser = user || storedUser;
  const canCreate = ['admin', 'super_admin'].includes(effectiveUser?.role);

  const [studies, setStudies] = useState<Study[]>([]);
  const [programs, setPrograms] = useState<StudyProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [glpFilter, setGlpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [creating, setCreating] = useState(false);

  const fetchPrograms = async () => {
    try {
      const res = await api.get('/studies/programs');
      setPrograms(res.data.data || []);
    } catch {
      // non-fatal
    }
  };

  const fetchStudies = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { archived: String(showArchived) };
      if (search) params.search = search;
      if (glpFilter) params.glp_status = glpFilter;
      if (statusFilter) params.status = statusFilter;
      if (programFilter) params.program_id = programFilter;
      const res = await api.get('/studies', { params });
      setStudies(res.data.data || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load studies');
      toast.error(err.response?.data?.message || 'Failed to load studies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchStudies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glpFilter, statusFilter, programFilter, showArchived]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudies();
  };

  const summary = useMemo(() => {
    const glp = studies.filter((s) => s.glp_status === 'GLP').length;
    const ongoing = studies.filter((s) => ['Ongoing', 'In Progress'].includes(s.status)).length;
    const complete = studies.filter((s) => s.status === 'Complete').length;
    return { total: studies.length, glp, ongoing, complete };
  }, [studies]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.study_number.trim() || !form.study_title.trim()) {
      toast.error('Study number and title are required');
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, any> = {};
      Object.entries(form).forEach(([k, v]) => {
        payload[k] = v === '' ? null : v;
      });
      const res = await api.post('/studies', payload);
      toast.success('Study created');
      setShowCreate(false);
      setForm({ ...emptyForm });
      const newId = res.data?.data?.id;
      if (newId) navigate(`/studies/${newId}`);
      else fetchStudies();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create study');
    } finally {
      setCreating(false);
    }
  };

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  return (
    <div className="studies-page">
      <div className="studies-header">
        <div className="studies-header-content">
          <button className="studies-back-btn" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
          <div className="studies-title-section">
            <h1 className="studies-title">Teleos Studies</h1>
            <p className="studies-subtitle">GLP &amp; non-GLP study management</p>
          </div>
          <button className="studies-refresh-btn" onClick={fetchStudies}>
            Refresh
          </button>
          {canCreate && (
            <button className="studies-new-btn" onClick={() => setShowCreate(true)}>
              + New Study
            </button>
          )}
        </div>
      </div>

      <div className="studies-content">
        {error && <div className="studies-error">{error}</div>}

        <div className="studies-summary">
          <div className="summary-card">
            <div className="summary-number">{summary.total}</div>
            <div className="summary-label">Total Studies</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{summary.glp}</div>
            <div className="summary-label">GLP</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{summary.ongoing}</div>
            <div className="summary-label">Ongoing</div>
          </div>
          <div className="summary-card">
            <div className="summary-number">{summary.complete}</div>
            <div className="summary-label">Complete</div>
          </div>
        </div>

        <form className="studies-filters" onSubmit={handleSearchSubmit}>
          <input
            className="search-box"
            type="text"
            placeholder="Search by study number or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={glpFilter} onChange={(e) => setGlpFilter(e.target.value)}>
            <option value="">All GLP status</option>
            <option value="GLP">GLP</option>
            <option value="Non-GLP">Non-GLP</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.program_name}</option>
            ))}
          </select>
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Archived
          </label>
          <button className="btn btn-secondary" type="submit">Search</button>
        </form>

        {loading ? (
          <div className="studies-loading">Loading studies…</div>
        ) : studies.length === 0 ? (
          <div className="studies-empty">
            <h3>No studies found</h3>
            <p>{canCreate ? 'Create your first study to get started.' : 'You have not been assigned to any studies yet.'}</p>
          </div>
        ) : (
          <div className="studies-grid">
            {studies.map((s) => {
              const pct = Number(s.percent_complete ?? 0);
              return (
                <div
                  key={s.id}
                  className={`study-card ${s.glp_status === 'GLP' ? 'glp' : ''}`}
                  onClick={() => navigate(`/studies/${s.id}`)}
                >
                  <div className="study-card-top">
                    <span className="study-number">{s.study_number}</span>
                    <span className={`badge ${s.glp_status === 'GLP' ? 'badge-glp' : 'badge-nonglp'}`}>
                      {s.glp_status}
                    </span>
                  </div>
                  <div className="study-title">{s.study_title}</div>
                  <div className="study-meta">
                    <span className="badge badge-status">{s.status}</span>
                    {s.is_archived && <span className="badge badge-archived">Archived</span>}
                    {s.program_name && <span className="meta-item">{s.program_name}</span>}
                    {s.sponsor && <span className="meta-item">{s.sponsor}</span>}
                  </div>
                  <div className="study-progress">
                    <div className="study-progress-fill" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
                  </div>
                  <div className="study-progress-label">{pct}% complete</div>
                  <div className="study-card-footer">
                    <span>{s.document_count} docs · {s.sample_count} materials</span>
                    <span>Target: {fmtDate(s.target_completion_date)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="studies-modal-overlay" onClick={() => !creating && setShowCreate(false)}>
          <div className="studies-modal" onClick={(e) => e.stopPropagation()}>
            <div className="studies-modal-header">
              <h3>New Study</h3>
              <button className="studies-modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="studies-modal-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Study Number <span className="req">*</span></label>
                    <input
                      type="text"
                      value={form.study_number}
                      onChange={(e) => setForm({ ...form, study_number: e.target.value })}
                      placeholder="2026-TLN-01"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>GLP Status <span className="req">*</span></label>
                    <select value={form.glp_status} onChange={(e) => setForm({ ...form, glp_status: e.target.value })}>
                      <option value="GLP">GLP</option>
                      <option value="Non-GLP">Non-GLP</option>
                    </select>
                  </div>
                  <div className="form-field full">
                    <label>Study Title <span className="req">*</span></label>
                    <input
                      type="text"
                      value={form.study_title}
                      onChange={(e) => setForm({ ...form, study_title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Program</label>
                    <select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })}>
                      <option value="">None</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.program_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Sponsor</label>
                    <input type="text" value={form.sponsor} onChange={(e) => setForm({ ...form, sponsor: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Study Director</label>
                    <input type="text" value={form.study_director} onChange={(e) => setForm({ ...form, study_director: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Protocol Number</label>
                    <input type="text" value={form.protocol_number} onChange={(e) => setForm({ ...form, protocol_number: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Protocol Version</label>
                    <input type="text" value={form.protocol_version} onChange={(e) => setForm({ ...form, protocol_version: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Date Received</label>
                    <input type="date" value={form.date_received} onChange={(e) => setForm({ ...form, date_received: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Start Date</label>
                    <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Target Completion</label>
                    <input type="date" value={form.target_completion_date} onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label>Current Phase</label>
                    <input type="text" value={form.current_phase} onChange={(e) => setForm({ ...form, current_phase: e.target.value })} />
                  </div>
                  <div className="form-field full">
                    <label>Notes</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="studies-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Study'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudiesDashboard;
