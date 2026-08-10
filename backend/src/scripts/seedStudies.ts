/**
 * One-off seed: load the seven current Teleos studies and attach the three
 * signed protocol PDFs. Idempotent — safe to re-run (skips existing studies and
 * existing signed-protocol documents).
 *
 * Run from backend/:  npx ts-node src/scripts/seedStudies.ts
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pool } from '../config/database';
import { uploadToCloudinary } from '../utils/cloudinary';

const STUDIES_DIR = path.resolve(__dirname, '../../../Studies');

const PROGRAM_NAME = 'Analytical Reference Standard Re-Certification';

interface SeedStudy {
  study_number: string;
  study_title: string;
  glp_status: 'GLP' | 'Non-GLP';
  status: string;
  in_program?: boolean;
  percent_complete?: number | null;
  protocol_file?: string;
  protocol_number?: string | null;
}

const STUDIES: SeedStudy[] = [
  {
    study_number: '2026-TLN-01',
    study_title: 'Yichang 5-Batch',
    glp_status: 'GLP',
    status: 'Ongoing',
    protocol_file: '2026-TLN-01_Protocol_5.20.26_signed.pdf',
    protocol_number: '2026-TLN-01',
  },
  {
    study_number: '2026-TLN-02',
    study_title: 'Kashima 5-Batch',
    glp_status: 'GLP',
    status: 'Upcoming',
  },
  {
    study_number: '2026-TELEOS-01',
    study_title: 'Analysis and Re-Certification of Analytical Reference Standards',
    glp_status: 'GLP',
    status: 'Complete',
    in_program: true,
    percent_complete: 100,
    protocol_file: '2026TELEO01_Protocol_signed.pdf',
    protocol_number: '2026-TELEOS-01',
  },
  {
    study_number: '2026-TELEOS-02',
    study_title: 'Analysis and Re-Certification of Analytical Reference Standards',
    glp_status: 'GLP',
    status: 'Complete',
    in_program: true,
    percent_complete: 100,
    protocol_file: '2026Teleos02_Protocol_signed.pdf',
    protocol_number: '2026-TELEOS-02',
  },
  {
    study_number: '2026-TELEOS-03',
    study_title: 'Analysis and Re-Certification of Analytical Reference Standards',
    glp_status: 'GLP',
    status: 'Upcoming',
    in_program: true,
  },
  {
    study_number: '2026-CMO-01',
    study_title: 'Oxirane Stability in Water',
    glp_status: 'Non-GLP',
    status: 'Ongoing',
  },
  {
    study_number: '2026-CMO-02',
    study_title: 'Oxirane Formation in Telone',
    glp_status: 'Non-GLP',
    status: 'Ongoing',
  },
];

function sha256OfFile(filePath: string): string | null {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    // Seed owner: prefer a super_admin, else an admin.
    const ownerRes = await client.query(
      `SELECT id, email, role FROM users
       WHERE role IN ('super_admin', 'admin')
       ORDER BY CASE role WHEN 'super_admin' THEN 0 ELSE 1 END, created_at
       LIMIT 1`
    );
    if (ownerRes.rows.length === 0) {
      throw new Error('No super_admin/admin user found to attribute the seed to.');
    }
    const ownerId = ownerRes.rows[0].id as string;
    console.log(`Seed owner: ${ownerRes.rows[0].email} (${ownerRes.rows[0].role})`);

    // Program (idempotent by unique name).
    const programRes = await client.query(
      `INSERT INTO study_programs (program_name, description, default_glp_status, created_by)
       VALUES ($1, $2, 'GLP', $3)
       ON CONFLICT (program_name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [PROGRAM_NAME, 'Recurring re-certification of analytical reference standards (2026-TELEOS series).', ownerId]
    );
    const programId = programRes.rows[0].id as string;
    console.log(`Program ready: ${PROGRAM_NAME} (${programId})`);

    let created = 0;
    let skipped = 0;
    let protocolsUploaded = 0;
    let protocolsSkipped = 0;

    for (const s of STUDIES) {
      // Skip if the study already exists.
      const existing = await client.query('SELECT id FROM studies WHERE study_number = $1', [s.study_number]);
      let studyId: string;

      if (existing.rows.length > 0) {
        studyId = existing.rows[0].id;
        skipped++;
        console.log(`• ${s.study_number}: already exists — skipping study insert`);
      } else {
        await client.query('BEGIN');
        try {
          const ins = await client.query(
            `INSERT INTO studies
               (study_number, study_title, program_id, glp_status, status,
                percent_complete, protocol_number, created_by, modified_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
             RETURNING id`,
            [
              s.study_number,
              s.study_title,
              s.in_program ? programId : null,
              s.glp_status,
              s.status,
              s.percent_complete ?? null,
              s.protocol_number ?? null,
              ownerId,
            ]
          );
          studyId = ins.rows[0].id;

          await client.query(
            `INSERT INTO study_users (study_id, user_id, study_role, assigned_by)
             VALUES ($1, $2, 'study_admin', $2)
             ON CONFLICT (study_id, user_id) DO NOTHING`,
            [studyId, ownerId]
          );

          await client.query(
            `INSERT INTO study_activity (study_id, user_id, action, new_value)
             VALUES ($1, $2, 'Study created (initial data load)', $3)`,
            [studyId, ownerId, s.study_number]
          );

          await client.query('COMMIT');
          created++;
          console.log(`✓ ${s.study_number}: created`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }

      // Attach the signed protocol if one is provided and not already present.
      if (s.protocol_file) {
        const filePath = path.join(STUDIES_DIR, s.protocol_file);
        if (!fs.existsSync(filePath)) {
          console.warn(`  ! protocol file missing on disk: ${filePath} — skipping upload`);
          continue;
        }

        const already = await client.query(
          `SELECT id FROM study_documents
           WHERE study_id = $1 AND document_type = 'Signed Protocol'`,
          [studyId]
        );
        if (already.rows.length > 0) {
          protocolsSkipped++;
          console.log(`  • ${s.study_number}: signed protocol already present — skipping upload`);
          continue;
        }

        console.log(`  ↑ uploading protocol for ${s.study_number}…`);
        const url = await uploadToCloudinary(filePath, `study-documents/${studyId}`);
        if (!url) {
          console.warn(`  ! Cloudinary upload failed for ${s.protocol_file} — skipping document record`);
          continue;
        }
        const stat = fs.statSync(filePath);
        const checksum = sha256OfFile(filePath);

        await client.query('BEGIN');
        try {
          const docRes = await client.query(
            `INSERT INTO study_documents
               (study_id, document_type, document_name, status,
                is_signed_protocol, is_locked, created_by)
             VALUES ($1, 'Signed Protocol', $2, 'Signed', true, true, $3)
             RETURNING id`,
            [studyId, `${s.study_number} Signed Protocol`, ownerId]
          );
          const docId = docRes.rows[0].id;

          const verRes = await client.query(
            `INSERT INTO study_document_versions
               (document_id, version_number, file_name, file_path, file_size, mime_type,
                checksum, is_immutable, change_note, uploaded_by)
             VALUES ($1, 1, $2, $3, $4, 'application/pdf', $5, true, 'Signed protocol (initial data load)', $6)
             RETURNING id`,
            [docId, s.protocol_file, url, stat.size, checksum, ownerId]
          );

          await client.query('UPDATE study_documents SET current_version_id = $1 WHERE id = $2', [verRes.rows[0].id, docId]);

          await client.query(
            `INSERT INTO study_activity (study_id, user_id, action, related_entity_type, related_entity_id)
             VALUES ($1, $2, 'Signed protocol uploaded and locked (initial data load)', 'document', $3)`,
            [studyId, ownerId, docId]
          );

          await client.query('COMMIT');
          protocolsUploaded++;
          console.log(`  ✓ ${s.study_number}: signed protocol uploaded and locked`);
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      }
    }

    console.log('\n──────────── Summary ────────────');
    console.log(`Studies created:        ${created}`);
    console.log(`Studies skipped:        ${skipped}`);
    console.log(`Protocols uploaded:     ${protocolsUploaded}`);
    console.log(`Protocols skipped:      ${protocolsSkipped}`);
    console.log('Done.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
