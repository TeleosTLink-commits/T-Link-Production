import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { requireStudyRole } from '../middleware/studyAuth';
import { logActivity } from './studies';
import { uploadToCloudinary, uploadBufferToCloudinary } from '../utils/cloudinary';

// mergeParams so :studyId from the parent mount is available here.
const router = Router({ mergeParams: true });

const DOCUMENT_TYPES = [
  'Signed Protocol', 'Protocol Amendment', 'Test Method',
  'Sample Preparation Form', 'Standard Preparation Form', 'Raw Data',
  'Calculations', 'QA Document', 'Report', 'Correspondence',
  'Study Workbook', 'Other',
];

const DOCUMENT_STATUSES = [
  'Draft', 'Working Copy', 'Pending Review', 'QA Reviewed',
  'Approved', 'Signed', 'Superseded', 'Archived',
];

// File storage: memory in production (Render), disk locally.
const storage = process.env.NODE_ENV === 'production'
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/study-documents');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — workbooks can be large
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(pdf|doc|docx|xls|xlsx|csv|txt)$/i.test(path.extname(file.originalname));
    const allowedMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
    ].includes(file.mimetype);
    if (allowedExt || allowedMime) cb(null, true);
    else cb(new Error('Only PDF, Word, Excel, CSV and text files are allowed'));
  },
});

/** Store an uploaded file (Cloudinary in prod, disk path in dev) and return storage info. */
async function persistFile(file: any, studyId: string): Promise<{ file_path: string; cloudinary_public_id: string | null }> {
  const folder = `study-documents/${studyId}`;
  if (process.env.NODE_ENV === 'production') {
    if (!file.buffer) throw new Error('File buffer unavailable in production');
    const url = await uploadBufferToCloudinary(file.buffer, file.originalname, folder);
    if (!url) throw new Error('Cloud upload failed');
    return { file_path: url, cloudinary_public_id: null };
  }
  // Development: keep the local disk path, and best-effort mirror to Cloudinary if configured.
  const url = await uploadToCloudinary(file.path, folder).catch(() => null);
  return { file_path: url || file.path, cloudinary_public_id: null };
}

function checksumOf(file: any): string | null {
  try {
    const buf: Buffer | undefined = file.buffer || (file.path ? fs.readFileSync(file.path) : undefined);
    if (!buf) return null;
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

// ============================================================================
// List / read documents
// ============================================================================

// GET /api/studies/:studyId/documents — list documents (viewer+)
router.get('/', requireStudyRole('study_viewer'), async (req: AuthRequest, res: Response) => {
  try {
    const studyId = req.params.studyId;
    const result = await pool.query(
      `SELECT d.*,
              v.version_number AS current_version_number,
              v.file_name AS current_file_name,
              v.uploaded_at AS current_uploaded_at
       FROM study_documents d
       LEFT JOIN study_document_versions v ON v.id = d.current_version_id
       WHERE d.study_id = $1
       ORDER BY d.created_at DESC`,
      [studyId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('[StudyDocs] list failed:', error);
    res.status(500).json({ success: false, message: 'Failed to list documents' });
  }
});

// GET /api/studies/:studyId/documents/:docId/versions — version history (viewer+)
router.get('/:docId/versions', requireStudyRole('study_viewer'), async (req: AuthRequest, res: Response) => {
  try {
    const { studyId, docId } = req.params;
    const doc = await pool.query('SELECT id FROM study_documents WHERE id = $1 AND study_id = $2', [docId, studyId]);
    if (doc.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const versions = await pool.query(
      `SELECT v.*, u.username, u.first_name, u.last_name
       FROM study_document_versions v
       LEFT JOIN users u ON u.id = v.uploaded_by
       WHERE v.document_id = $1
       ORDER BY v.version_number DESC`,
      [docId]
    );
    res.json({ success: true, data: versions.rows });
  } catch (error: any) {
    console.error('[StudyDocs] versions failed:', error);
    res.status(500).json({ success: false, message: 'Failed to load versions' });
  }
});

// ============================================================================
// Create document (with first version) — editor+
// ============================================================================

router.post('/', requireStudyRole('study_editor'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const studyId = req.params.studyId;
    const { document_type, document_name, status, notes } = req.body;

    if (!document_type || !DOCUMENT_TYPES.includes(document_type)) {
      return res.status(400).json({ success: false, message: 'Valid document_type is required' });
    }
    if (!document_name) {
      return res.status(400).json({ success: false, message: 'document_name is required' });
    }
    if (status && !DOCUMENT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid document status' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'A file upload is required' });
    }

    const { file_path, cloudinary_public_id } = await persistFile(req.file, studyId);
    const checksum = checksumOf(req.file);

    await client.query('BEGIN');
    const docResult = await client.query(
      `INSERT INTO study_documents
         (study_id, document_type, document_name, status, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [studyId, document_type, document_name, status || 'Draft', notes || null, req.user!.id]
    );
    const doc = docResult.rows[0];

    const versionResult = await client.query(
      `INSERT INTO study_document_versions
         (document_id, version_number, file_name, file_path, file_size, mime_type,
          cloudinary_public_id, checksum, is_immutable, change_note, uploaded_by)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, false, $8, $9)
       RETURNING *`,
      [
        doc.id, req.file.originalname, file_path, req.file.size || null,
        req.file.mimetype || null, cloudinary_public_id, checksum,
        'Initial upload', req.user!.id,
      ]
    );

    await client.query('UPDATE study_documents SET current_version_id = $1 WHERE id = $2', [versionResult.rows[0].id, doc.id]);
    await client.query('COMMIT');

    await logActivity(studyId, req.user!.id, `Document uploaded: ${document_name}`, {
      relatedType: 'document', relatedId: doc.id, newValue: document_type,
    });

    res.status(201).json({ success: true, data: { ...doc, current_version_id: versionResult.rows[0].id } });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[StudyDocs] create failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload document' });
  } finally {
    client.release();
  }
});

// ============================================================================
// Upload a new version — editor+. Blocked when the document is locked.
// ============================================================================

router.post('/:docId/versions', requireStudyRole('study_editor'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { studyId, docId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'A file upload is required' });
    }

    const docResult = await pool.query('SELECT * FROM study_documents WHERE id = $1 AND study_id = $2', [docId, studyId]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const doc = docResult.rows[0];

    // Signed protocol control: locked documents can never be overwritten/replaced.
    if (doc.is_locked) {
      return res.status(409).json({
        success: false,
        message: 'This document is locked (signed protocol). Add an amendment as a new document instead of replacing it.',
      });
    }

    const { file_path, cloudinary_public_id } = await persistFile(req.file, studyId);
    const checksum = checksumOf(req.file);
    const change_note = req.body?.change_note || 'New version uploaded';

    await client.query('BEGIN');
    const nextVersion = await client.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM study_document_versions WHERE document_id = $1',
      [docId]
    );
    const versionNumber = nextVersion.rows[0].next;

    const versionResult = await client.query(
      `INSERT INTO study_document_versions
         (document_id, version_number, file_name, file_path, file_size, mime_type,
          cloudinary_public_id, checksum, is_immutable, change_note, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10)
       RETURNING *`,
      [
        docId, versionNumber, req.file.originalname, file_path, req.file.size || null,
        req.file.mimetype || null, cloudinary_public_id, checksum, change_note, req.user!.id,
      ]
    );

    await client.query(
      'UPDATE study_documents SET current_version_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [versionResult.rows[0].id, docId]
    );
    await client.query('COMMIT');

    await logActivity(studyId, req.user!.id, `Document updated: ${doc.document_name} (v${versionNumber})`, {
      relatedType: 'document', relatedId: docId,
    });

    res.status(201).json({ success: true, data: versionResult.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[StudyDocs] new version failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload new version' });
  } finally {
    client.release();
  }
});

// ============================================================================
// Designate signed protocol — study_admin only. Makes current version immutable.
// ============================================================================

router.post('/:docId/sign', requireStudyRole('study_admin'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { studyId, docId } = req.params;
    const docResult = await pool.query('SELECT * FROM study_documents WHERE id = $1 AND study_id = $2', [docId, studyId]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const doc = docResult.rows[0];
    if (!doc.current_version_id) {
      return res.status(400).json({ success: false, message: 'Document has no uploaded file to sign' });
    }
    if (doc.is_locked) {
      return res.status(409).json({ success: false, message: 'Document is already locked' });
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE study_documents
         SET is_signed_protocol = true, is_locked = true, status = 'Signed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [docId]
    );
    // Freeze the current file version so it can never be altered.
    await client.query(
      'UPDATE study_document_versions SET is_immutable = true WHERE id = $1',
      [doc.current_version_id]
    );
    await client.query('COMMIT');

    await logActivity(studyId, req.user!.id, `Signed protocol designated: ${doc.document_name}`, {
      relatedType: 'document', relatedId: docId,
    });

    res.json({ success: true, message: 'Document locked as signed protocol' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[StudyDocs] sign failed:', error);
    res.status(500).json({ success: false, message: 'Failed to designate signed protocol' });
  } finally {
    client.release();
  }
});

// ============================================================================
// Update document metadata (status/name/notes) — editor+. Locked docs restricted.
// ============================================================================

router.put('/:docId', requireStudyRole('study_editor'), async (req: AuthRequest, res: Response) => {
  try {
    const { studyId, docId } = req.params;
    const { document_name, status, notes } = req.body;
    if (status && !DOCUMENT_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid document status' });
    }

    const docResult = await pool.query('SELECT * FROM study_documents WHERE id = $1 AND study_id = $2', [docId, studyId]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (docResult.rows[0].is_locked) {
      return res.status(409).json({ success: false, message: 'Locked signed protocol metadata cannot be changed' });
    }

    const result = await pool.query(
      `UPDATE study_documents
         SET document_name = COALESCE($2, document_name),
             status = COALESCE($3, status),
             notes = COALESCE($4, notes),
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [docId, document_name ?? null, status ?? null, notes ?? null]
    );
    await logActivity(studyId, req.user!.id, `Document metadata updated: ${result.rows[0].document_name}`, {
      relatedType: 'document', relatedId: docId,
    });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('[StudyDocs] update failed:', error);
    res.status(500).json({ success: false, message: 'Failed to update document' });
  }
});

// ============================================================================
// Delete document — study_admin only. Signed/locked documents are retained.
// ============================================================================

router.delete('/:docId', requireStudyRole('study_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { studyId, docId } = req.params;
    const docResult = await pool.query('SELECT * FROM study_documents WHERE id = $1 AND study_id = $2', [docId, studyId]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (docResult.rows[0].is_locked || docResult.rows[0].is_signed_protocol) {
      return res.status(409).json({ success: false, message: 'Signed protocols are retained and cannot be deleted' });
    }
    await pool.query('DELETE FROM study_documents WHERE id = $1', [docId]);
    await logActivity(studyId, req.user!.id, `Document deleted: ${docResult.rows[0].document_name}`, {
      relatedType: 'document', relatedId: docId,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[StudyDocs] delete failed:', error);
    res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
});

export default router;
