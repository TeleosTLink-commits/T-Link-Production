-- ============================================================================
-- Migration 015: Teleos Studies Module — Stage A (Milestone 1)
-- ============================================================================
-- Purpose: Create the study-management schema for the internal-only Teleos
--          Studies module. This migration does NOT touch production inventory
--          quantities. Inventory normalization and workbook automation are
--          handled separately in Milestone 2 (see Studies/INVENTORY_MIGRATION.md).
--
-- Internal only: these tables back the /api/studies routes which are never
--                exposed through the Manufacturer Portal.
--
-- Safe to re-run: uses IF NOT EXISTS and idempotent guards.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- study_programs
-- Optional grouping for related / recurring studies, e.g. the
-- "Analytical Reference Standard Re-Certification" series (2026-TELEOS-*).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    default_glp_status VARCHAR(10) CHECK (default_glp_status IN ('GLP', 'Non-GLP')),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- studies
-- Primary study record. Each Teleos study has one unique row.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_number VARCHAR(100) NOT NULL UNIQUE,
    study_title VARCHAR(500) NOT NULL,
    program_id UUID REFERENCES study_programs(id) ON DELETE SET NULL,

    -- Classification
    glp_status VARCHAR(10) NOT NULL CHECK (glp_status IN ('GLP', 'Non-GLP')),

    -- People / responsibility (stored as text; not every director is a system user)
    sponsor VARCHAR(255),
    study_director VARCHAR(255),
    principal_investigator VARCHAR(255),

    -- Protocol reference (the controlled file lives in study_documents)
    protocol_number VARCHAR(100),
    protocol_version VARCHAR(50),

    -- Timeline
    date_received DATE,
    start_date DATE,
    target_completion_date DATE,
    actual_completion_date DATE,

    -- Progress / state (standardized picklist, not free text)
    status VARCHAR(50) NOT NULL DEFAULT 'Planned' CHECK (status IN (
        'Planned',
        'Upcoming',
        'Awaiting Samples',
        'Ready to Start',
        'Ongoing',
        'In Progress',
        'Testing Complete',
        'Data Review',
        'QA Review',
        'Report Preparation',
        'Complete',
        'On Hold',
        'Cancelled'
    )),
    current_phase VARCHAR(100),
    percent_complete INTEGER CHECK (percent_complete BETWEEN 0 AND 100),

    notes TEXT,

    -- Lifecycle
    is_archived BOOLEAN DEFAULT false,

    -- Audit stamps
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_studies_status ON studies(status);
CREATE INDEX IF NOT EXISTS idx_studies_glp_status ON studies(glp_status);
CREATE INDEX IF NOT EXISTS idx_studies_program_id ON studies(program_id);
CREATE INDEX IF NOT EXISTS idx_studies_is_archived ON studies(is_archived);
CREATE INDEX IF NOT EXISTS idx_studies_study_number ON studies(study_number);

-- ----------------------------------------------------------------------------
-- study_users
-- Per-study permission assignments, layered on top of the global users.role.
-- A user may have general Study access but different permissions per study.
--   study_admin  — full control of the study (create/edit/assign/manage docs)
--   study_editor — work within assigned study, upload permitted working docs
--   study_viewer — read-only access to authorized studies/documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    study_role VARCHAR(20) NOT NULL CHECK (study_role IN ('study_admin', 'study_editor', 'study_viewer')),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (study_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_study_users_study_id ON study_users(study_id);
CREATE INDEX IF NOT EXISTS idx_study_users_user_id ON study_users(user_id);

-- ----------------------------------------------------------------------------
-- study_documents
-- One record per logical document. The actual file(s) live in
-- study_document_versions so history is preserved and signed protocols
-- can be made immutable.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'Signed Protocol',
        'Protocol Amendment',
        'Test Method',
        'Sample Preparation Form',
        'Standard Preparation Form',
        'Raw Data',
        'Calculations',
        'QA Document',
        'Report',
        'Correspondence',
        'Study Workbook',
        'Other'
    )),
    document_name VARCHAR(500) NOT NULL,

    -- Points at the active version (nullable until first version is uploaded)
    current_version_id UUID,

    status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN (
        'Draft',
        'Working Copy',
        'Pending Review',
        'QA Reviewed',
        'Approved',
        'Signed',
        'Superseded',
        'Archived'
    )),

    -- Signed protocol control: once true, the current file is immutable and may
    -- only be superseded by a new versioned record (amendment), never overwritten.
    is_signed_protocol BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,

    -- Internal-only guard. No study document is externally visible unless a
    -- future, explicit release process sets this true.
    is_sponsor_visible BOOLEAN DEFAULT false,

    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_study_documents_study_id ON study_documents(study_id);
CREATE INDEX IF NOT EXISTS idx_study_documents_type ON study_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_study_documents_status ON study_documents(status);

-- ----------------------------------------------------------------------------
-- study_document_versions
-- Immutable version history for each document. A new upload = a new row.
-- Signed protocol versions carry is_immutable = true and must never be replaced.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES study_documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,

    -- File storage (Cloudinary in production, local path in development)
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(150),
    cloudinary_public_id VARCHAR(500),

    -- Integrity: checksum supports immutability verification of signed files
    checksum VARCHAR(128),

    is_immutable BOOLEAN DEFAULT false,
    change_note TEXT,

    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_study_doc_versions_document_id ON study_document_versions(document_id);

-- Wire up the current_version_id FK now that the versions table exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_study_documents_current_version'
    ) THEN
        ALTER TABLE study_documents
            ADD CONSTRAINT fk_study_documents_current_version
            FOREIGN KEY (current_version_id)
            REFERENCES study_document_versions(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- study_samples
-- Read-only link between a study and inventory items (samples / reference
-- standards). This associates material with a study for the Samples & Standards
-- tab. It does NOT modify inventory quantities — deductions arrive in
-- Milestone 2 via study_form_transactions and the existing sample_transactions.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    material_role VARCHAR(20) NOT NULL DEFAULT 'sample' CHECK (material_role IN ('sample', 'standard')),
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE (study_id, sample_id)
);

CREATE INDEX IF NOT EXISTS idx_study_samples_study_id ON study_samples(study_id);
CREATE INDEX IF NOT EXISTS idx_study_samples_sample_id ON study_samples(sample_id);

-- ----------------------------------------------------------------------------
-- study_activity
-- Study-level audit trail. Every significant action generates a record.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    related_entity_type VARCHAR(50),   -- e.g. 'document', 'sample', 'transaction', 'user'
    related_entity_id UUID,
    transaction_ref VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_study_activity_study_id ON study_activity(study_id);
CREATE INDEX IF NOT EXISTS idx_study_activity_created_at ON study_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_study_activity_entity ON study_activity(related_entity_type, related_entity_id);

-- ----------------------------------------------------------------------------
-- Table comments
-- ----------------------------------------------------------------------------
COMMENT ON TABLE study_programs IS 'Optional grouping of related/recurring Teleos studies (e.g. reference-standard re-certification series).';
COMMENT ON TABLE studies IS 'Primary Teleos study records. Internal-only; not exposed to the Manufacturer Portal.';
COMMENT ON TABLE study_users IS 'Per-study permission assignments (study_admin/study_editor/study_viewer) layered on global users.role.';
COMMENT ON TABLE study_documents IS 'Logical study documents with metadata and signed-protocol controls.';
COMMENT ON TABLE study_document_versions IS 'Immutable version history for study documents; signed protocol versions are locked.';
COMMENT ON TABLE study_samples IS 'Read-only association of inventory samples/standards to a study. Does not modify inventory quantities.';
COMMENT ON TABLE study_activity IS 'Study-level audit trail of significant actions.';

-- ============================================================================
-- End Migration 015
-- Milestone 2 will add: samples.available_quantity / unit / low_quantity_limit /
-- aal_id, and the study_form_transactions table (workbook deduction engine).
-- ============================================================================
