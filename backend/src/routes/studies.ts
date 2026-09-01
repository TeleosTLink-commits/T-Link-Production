import { Router, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  requireInternalUser,
  requireStudyCreate,
  requireStudyRole,
  getEffectiveStudyRole,
  isGlobalStudyAdmin,
} from '../middleware/studyAuth';

const router = Router();

// Internal-only module: authenticate, then block manufacturers.
router.use(authenticate);
router.use(requireInternalUser);

// Nested document management routes. Imported after logActivity is declared
// below (see bottom of file) to avoid a circular import at module-eval time.
// eslint-disable-next-line @typescript-eslint/no-var-requires
router.use('/:studyId/documents', require('./studyDocuments').default);

const VALID_STATUSES = [
  'Planned', 'Upcoming', 'Awaiting Samples', 'Ready to Start', 'Ongoing',
  'In Progress', 'Testing Complete', 'Data Review', 'QA Review',
  'Report Preparation', 'Complete', 'On Hold', 'Cancelled',
];

/** Record a study activity/audit entry. Best-effort: never throws to the caller. */
async function logActivity(
  studyId: string,
  userId: string | undefined,
  action: string,
  opts: {
    oldValue?: string | null;
    newValue?: string | null;
    relatedType?: string | null;
    relatedId?: string | null;
  } = {}
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO study_activity
         (study_id, user_id, action, old_value, new_value, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        studyId,
        userId || null,
        action,
        opts.oldValue ?? null,
        opts.newValue ?? null,
        opts.relatedType ?? null,
        opts.relatedId ?? null,
      ]
    );
  } catch (err) {
    console.error('[Studies] Failed to write activity log:', err);
  }
}

// ============================================================================
// Lookups
// ============================================================================

// GET /api/studies/lookup/users — internal users available for study assignment.
// Any internal user may read this (needed to populate personnel dropdowns);
// mutating assignments still requires study_admin on the target study.
router.get('/lookup/users', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, username, first_name, last_name, email, role
       FROM users
       WHERE role <> 'manufacturer' AND is_active = true
       ORDER BY last_name NULLS LAST, first_name NULLS LAST, username`
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[Studies] user lookup failed:', error);
    res.status(500).json({ success: false, message: 'Failed to load users' });
  }
});

// ============================================================================
// Study Programs
// ============================================================================

// GET /api/studies/programs — list all programs
router.get('/programs', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM studies s WHERE s.program_id = p.id) AS study_count
       FROM study_programs p
       ORDER BY p.program_name`
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[Studies] list programs failed:', error);
    res.status(500).json({ success: false, message: 'Failed to list study programs' });
  }
});

// POST /api/studies/programs — create a program (system administrator only)
router.post('/programs', requireStudyCreate, async (req: AuthRequest, res: Response) => {
  try {
    const { program_name, description, default_glp_status } = req.body;
    if (!program_name || typeof program_name !== 'string') {
      return res.status(400).json({ success: false, message: 'program_name is required' });
    }
    if (default_glp_status && !['GLP', 'Non-GLP'].includes(default_glp_status)) {
      return res.status(400).json({ success: false, message: 'default_glp_status must be GLP or Non-GLP' });
    }
    const result = await pool.query(
      `INSERT INTO study_programs (program_name, description, default_glp_status, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [program_name, description || null, default_glp_status || null, req.user!.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'A program with that name already exists' });
    }
    console.error('[Studies] create program failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create study program' });
  }
});

// ============================================================================
// Studies — list & create
// ============================================================================

// GET /api/studies — list studies visible to the user, with search/filter
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      search = '',
      glp_status,
      status,
      program_id,
      archived = 'false',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];

    // Visibility: global admins see everything; others only assigned studies.
    if (!isGlobalStudyAdmin(req.user!.role)) {
      params.push(req.user!.id);
      conditions.push(`s.id IN (SELECT study_id FROM study_users WHERE user_id = $${params.length})`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.study_number ILIKE $${params.length} OR s.study_title ILIKE $${params.length})`);
    }
    if (glp_status && ['GLP', 'Non-GLP'].includes(glp_status)) {
      params.push(glp_status);
      conditions.push(`s.glp_status = $${params.length}`);
    }
    if (status && VALID_STATUSES.includes(status)) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }
    if (program_id) {
      params.push(program_id);
      conditions.push(`s.program_id = $${params.length}`);
    }
    params.push(archived === 'true');
    conditions.push(`s.is_archived = $${params.length}`);

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Whitelist sort columns to prevent injection.
    const sortColumns: Record<string, string> = {
      created_at: 's.created_at',
      study_number: 's.study_number',
      study_title: 's.study_title',
      start_date: 's.start_date',
      target_completion_date: 's.target_completion_date',
      status: 's.status',
    };
    const sortCol = sortColumns[sortBy] || 's.created_at';
    const sortDir = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const result = await pool.query(
      `SELECT s.*, p.program_name,
              (SELECT COUNT(*) FROM study_documents d WHERE d.study_id = s.id) AS document_count,
              (SELECT COUNT(*) FROM study_samples ss WHERE ss.study_id = s.id) AS sample_count
       FROM studies s
       LEFT JOIN study_programs p ON s.program_id = p.id
       ${whereClause}
       ORDER BY ${sortCol} ${sortDir} NULLS LAST`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[Studies] list failed:', error);
    res.status(500).json({ success: false, message: 'Failed to list studies' });
  }
});

// POST /api/studies — create a study (system administrator only)
router.post('/', requireStudyCreate, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      study_number, study_title, program_id, glp_status,
      sponsor, study_director, principal_investigator,
      protocol_number, protocol_version,
      date_received, start_date, target_completion_date,
      status, current_phase, percent_complete, notes,
    } = req.body;

    if (!study_number || typeof study_number !== 'string') {
      return res.status(400).json({ success: false, message: 'study_number is required' });
    }
    if (!study_title || typeof study_title !== 'string') {
      return res.status(400).json({ success: false, message: 'study_title is required' });
    }
    if (!['GLP', 'Non-GLP'].includes(glp_status)) {
      return res.status(400).json({ success: false, message: 'glp_status must be GLP or Non-GLP' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO studies (
         study_number, study_title, program_id, glp_status,
         sponsor, study_director, principal_investigator,
         protocol_number, protocol_version,
         date_received, start_date, target_completion_date,
         status, current_phase, percent_complete, notes,
         created_by, modified_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
       RETURNING *`,
      [
        study_number, study_title, program_id || null, glp_status,
        sponsor || null, study_director || null, principal_investigator || null,
        protocol_number || null, protocol_version || null,
        date_received || null, start_date || null, target_completion_date || null,
        status || 'Planned', current_phase || null,
        percent_complete ?? null, notes || null,
        req.user!.id,
      ]
    );
    const study = result.rows[0];

    // The creator is registered as a study_admin for the new study.
    await client.query(
      `INSERT INTO study_users (study_id, user_id, study_role, assigned_by)
       VALUES ($1, $2, 'study_admin', $2)
       ON CONFLICT (study_id, user_id) DO NOTHING`,
      [study.id, req.user!.id]
    );

    await client.query(
      `INSERT INTO study_activity (study_id, user_id, action, new_value)
       VALUES ($1, $2, $3, $4)`,
      [study.id, req.user!.id, 'Study created', study.study_number]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: study });
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'A study with that study number already exists' });
    }
    console.error('[Studies] create failed:', error);
    res.status(500).json({ success: false, message: 'Failed to create study' });
  } finally {
    client.release();
  }
});

// ============================================================================
// Single study — read, update, archive
// ============================================================================

// GET /api/studies/:id — full study detail (any assigned role)
router.get('/:id', requireStudyRole('study_viewer'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const studyResult = await pool.query(
      `SELECT s.*, p.program_name
       FROM studies s
       LEFT JOIN study_programs p ON s.program_id = p.id
       WHERE s.id = $1`,
      [id]
    );
    if (studyResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Study not found' });
    }

    const [users, samples, documents] = await Promise.all([
      pool.query(
        `SELECT su.id, su.study_role, su.assigned_at,
                u.id AS user_id, u.username, u.first_name, u.last_name, u.email
         FROM study_users su
         JOIN users u ON u.id = su.user_id
         WHERE su.study_id = $1
         ORDER BY su.study_role, u.last_name`,
        [id]
      ),
      pool.query(
        `SELECT ss.id, ss.material_role, ss.notes, ss.added_at,
                sm.id AS sample_pk, sm.chemical_name, sm.lot_number,
                sm.cas_number, sm.quantity
         FROM study_samples ss
         JOIN samples sm ON sm.id = ss.sample_id
         WHERE ss.study_id = $1
         ORDER BY sm.chemical_name`,
        [id]
      ),
      pool.query(
        `SELECT id, document_type, document_name, status, is_signed_protocol,
                is_locked, current_version_id, created_at, updated_at
         FROM study_documents
         WHERE study_id = $1
         ORDER BY created_at DESC`,
        [id]
      ),
    ]);

    res.json({
      success: true,
      data: {
        ...studyResult.rows[0],
        study_role: (req as any).studyRole,
        assigned_users: users.rows,
        samples: samples.rows,
        documents: documents.rows,
      },
    });
  } catch (error: any) {
    console.error('[Studies] get failed:', error);
    res.status(500).json({ success: false, message: 'Failed to load study' });
  }
});

// PUT /api/studies/:id — update study record (study_admin only in v1)
router.put('/:id', requireStudyRole('study_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM studies WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Study not found' });
    }
    const prev = existing.rows[0];

    const {
      study_title, program_id, glp_status,
      sponsor, study_director, principal_investigator,
      protocol_number, protocol_version,
      date_received, start_date, target_completion_date, actual_completion_date,
      status, current_phase, percent_complete, notes,
    } = req.body;

    if (glp_status && !['GLP', 'Non-GLP'].includes(glp_status)) {
      return res.status(400).json({ success: false, message: 'glp_status must be GLP or Non-GLP' });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const result = await pool.query(
      `UPDATE studies SET
         study_title = COALESCE($2, study_title),
         program_id = $3,
         glp_status = COALESCE($4, glp_status),
         sponsor = $5,
         study_director = $6,
         principal_investigator = $7,
         protocol_number = $8,
         protocol_version = $9,
         date_received = $10,
         start_date = $11,
         target_completion_date = $12,
         actual_completion_date = $13,
         status = COALESCE($14, status),
         current_phase = $15,
         percent_complete = $16,
         notes = $17,
         modified_by = $18,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        id, study_title ?? null, program_id ?? null, glp_status ?? null,
        sponsor ?? null, study_director ?? null, principal_investigator ?? null,
        protocol_number ?? null, protocol_version ?? null,
        date_received ?? null, start_date ?? null, target_completion_date ?? null,
        actual_completion_date ?? null, status ?? null, current_phase ?? null,
        percent_complete ?? null, notes ?? null, req.user!.id,
      ]
    );

    if (status && status !== prev.status) {
      await logActivity(id, req.user!.id, 'Study status changed', {
        oldValue: prev.status, newValue: status,
      });
    } else {
      await logActivity(id, req.user!.id, 'Study information updated');
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('[Studies] update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update study' });
  }
});

// POST /api/studies/:id/archive — archive / unarchive (study_admin only)
router.post('/:id/archive', requireStudyRole('study_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const archived = req.body?.archived !== false; // default true
    const result = await pool.query(
      `UPDATE studies SET is_archived = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING id, is_archived`,
      [id, archived]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Study not found' });
    }
    await logActivity(id, req.user!.id, archived ? 'Study archived' : 'Study unarchived');
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('[Studies] archive failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update archive state' });
  }
});

// ============================================================================
// Study personnel
// ============================================================================

// POST /api/studies/:id/users — assign a user to the study (study_admin only)
router.post('/:id/users', requireStudyRole('study_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, study_role } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'user_id is required' });
    }
    if (!['study_admin', 'study_editor', 'study_viewer'].includes(study_role)) {
      return res.status(400).json({ success: false, message: 'Invalid study_role' });
    }
    const result = await pool.query(
      `INSERT INTO study_users (study_id, user_id, study_role, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (study_id, user_id)
       DO UPDATE SET study_role = EXCLUDED.study_role, assigned_by = EXCLUDED.assigned_by, assigned_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, user_id, study_role, req.user!.id]
    );
    await logActivity(id, req.user!.id, 'User assigned to study', {
      newValue: `${user_id} as ${study_role}`, relatedType: 'user', relatedId: user_id,
    });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(400).json({ success: false, message: 'Referenced user does not exist' });
    }
    console.error('[Studies] assign user failed:', error);
    res.status(500).json({ success: false, message: 'Failed to assign user' });
  }
});

// DELETE /api/studies/:id/users/:userId — remove a user (study_admin only)
router.delete('/:id/users/:userId', requireStudyRole('study_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const result = await pool.query(
      'DELETE FROM study_users WHERE study_id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    await logActivity(id, req.user!.id, 'User removed from study', {
      oldValue: userId, relatedType: 'user', relatedId: userId,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Studies] remove user failed:', error);
    res.status(500).json({ success: false, message: 'Failed to remove user' });
  }
});

// ============================================================================
// Study samples & standards (read-only association; no inventory mutation)
// ============================================================================

// POST /api/studies/:id/samples — link an inventory item to the study (editor+)
router.post('/:id/samples', requireStudyRole('study_editor'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { sample_id, material_role, notes } = req.body;
    if (!sample_id) {
      return res.status(400).json({ success: false, message: 'sample_id is required' });
    }
    if (material_role && !['sample', 'standard'].includes(material_role)) {
      return res.status(400).json({ success: false, message: 'material_role must be sample or standard' });
    }
    const result = await pool.query(
      `INSERT INTO study_samples (study_id, sample_id, material_role, notes, added_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (study_id, sample_id) DO UPDATE
         SET material_role = EXCLUDED.material_role, notes = EXCLUDED.notes
       RETURNING *`,
      [id, sample_id, material_role || 'sample', notes || null, req.user!.id]
    );
    await logActivity(id, req.user!.id, 'Sample associated with study', {
      relatedType: 'sample', relatedId: sample_id,
    });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(400).json({ success: false, message: 'Referenced sample does not exist' });
    }
    console.error('[Studies] link sample failed:', error);
    res.status(500).json({ success: false, message: 'Failed to link sample' });
  }
});

// DELETE /api/studies/:id/samples/:sampleId — unlink an inventory item (editor+)
router.delete('/:id/samples/:sampleId', requireStudyRole('study_editor'), async (req: AuthRequest, res: Response) => {
  try {
    const { id, sampleId } = req.params;
    const result = await pool.query(
      'DELETE FROM study_samples WHERE study_id = $1 AND sample_id = $2 RETURNING id',
      [id, sampleId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Association not found' });
    }
    await logActivity(id, req.user!.id, 'Sample removed from study', {
      relatedType: 'sample', relatedId: sampleId,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Studies] unlink sample failed:', error);
    res.status(500).json({ success: false, message: 'Failed to unlink sample' });
  }
});

// ============================================================================
// Study activity / audit trail
// ============================================================================

// GET /api/studies/:id/activity — audit history (any assigned role)
router.get('/:id/activity', requireStudyRole('study_viewer'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10) || 100, 500);
    const result = await pool.query(
      `SELECT a.*, u.username, u.first_name, u.last_name
       FROM study_activity a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.study_id = $1
       ORDER BY a.created_at DESC
       LIMIT $2`,
      [id, limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[Studies] activity failed:', error);
    res.status(500).json({ success: false, message: 'Failed to load activity' });
  }
});

export default router;
export { logActivity, getEffectiveStudyRole };
