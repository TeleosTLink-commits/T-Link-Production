import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { pool } from '../config/database';

// ============================================================================
// Teleos Studies — per-study permission layer
// ----------------------------------------------------------------------------
// Layers on top of the global users.role. The Studies module is internal only
// and is never exposed to manufacturers.
//
// Study roles (stored in study_users.study_role):
//   study_admin  — create/edit studies, assign personnel, manage documents
//   study_editor — work within an assigned study, upload permitted working docs
//   study_viewer — read-only access to authorized studies/documents
//
// Global-role mapping:
//   'admin'  (system administrator) acts as an implicit study_admin on every
//            study, and is the only role permitted to CREATE studies in v1.
//   Other internal roles (lab_staff, logistics) get access to a study only when
//            explicitly assigned in study_users.
//   'manufacturer' is blocked from the entire module.
//
// This is intentionally conservative and can be loosened later (e.g. granting
// creation rights to more users) without changing the database schema.
// ============================================================================

export type StudyRole = 'study_admin' | 'study_editor' | 'study_viewer';

const STUDY_ROLE_RANK: Record<StudyRole, number> = {
  study_viewer: 1,
  study_editor: 2,
  study_admin: 3,
};

// Global roles that act as an implicit Study Administrator on every study and
// are permitted to create studies in v1.
const GLOBAL_STUDY_ADMIN_ROLES = ['admin', 'super_admin'];

/** True when the global role grants implicit study_admin on all studies. */
export const isGlobalStudyAdmin = (globalRole: string): boolean =>
  GLOBAL_STUDY_ADMIN_ROLES.includes(globalRole);

/**
 * Block manufacturers (and any non-authenticated request) from the internal
 * Studies module. Apply this before any study route.
 */
export const requireInternalUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role === 'manufacturer') {
    return res.status(403).json({ error: 'Forbidden: The Studies module is not available to manufacturers.' });
  }
  next();
};

/**
 * Resolve a user's effective role for a specific study.
 * Global admins are implicit study_admins. Otherwise the explicit study_users
 * assignment (if any) is returned. Returns null when the user has no access.
 */
export const getEffectiveStudyRole = async (
  userId: string,
  globalRole: string,
  studyId: string
): Promise<StudyRole | null> => {
  if (isGlobalStudyAdmin(globalRole)) {
    return 'study_admin';
  }
  const result = await pool.query(
    'SELECT study_role FROM study_users WHERE study_id = $1 AND user_id = $2',
    [studyId, userId]
  );
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0].study_role as StudyRole;
};

/**
 * Only users permitted to create a study may pass. In v1 this is the global
 * system administrator (implicit Study Administrator).
 */
export const requireStudyCreate = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!isGlobalStudyAdmin(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Only a Study Administrator may create studies.' });
  }
  next();
};

/**
 * Middleware factory: require at least the given study role for the study
 * identified by req.params.studyId (falls back to req.params.id).
 * On success, attaches req.studyRole for downstream handlers.
 */
export const requireStudyRole = (minimum: StudyRole) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const studyId = (req.params.studyId || req.params.id) as string | undefined;
      if (!studyId) {
        return res.status(400).json({ error: 'Study identifier is required' });
      }

      const effective = await getEffectiveStudyRole(req.user.id, req.user.role, studyId);
      if (!effective) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this study.' });
      }
      if (STUDY_ROLE_RANK[effective] < STUDY_ROLE_RANK[minimum]) {
        return res.status(403).json({ error: 'Forbidden: Insufficient study permissions.' });
      }

      (req as any).studyRole = effective;
      next();
    } catch (error) {
      console.error('[StudyAuth] permission check failed:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};
