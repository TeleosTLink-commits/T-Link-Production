-- Test Methods Library Schema
-- Handles legacy numbering, version history, and standardization workflow

-- Drop existing tables if they exist
DROP TABLE IF EXISTS test_method_versions CASCADE;
DROP TABLE IF EXISTS test_method_files CASCADE;
DROP TABLE IF EXISTS test_methods CASCADE;
DROP TABLE IF EXISTS test_method_categories CASCADE;

-- Test Method Categories (e.g., GC, HPLC, Titration, etc.)
CREATE TABLE test_method_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main Test Methods Table
CREATE TABLE test_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Legacy/External Identification (what they came with)
    legacy_number VARCHAR(100),
    legacy_lab_source VARCHAR(100),  -- Which lab it came from
    original_title VARCHAR(255) NOT NULL,
    
    -- Official T-Link Identification (assigned after verification)
    official_number VARCHAR(50) UNIQUE,  -- NULL until standardized
    official_title VARCHAR(255),  -- Standardized title
    
    -- Classification
    category_id UUID REFERENCES test_method_categories(id),
    method_type VARCHAR(100),  -- GC-MS, HPLC, Titration, etc.
    
    -- Status Workflow
    status VARCHAR(50) DEFAULT 'draft',  -- draft, under_review, verified, standardized, archived, superseded
    verification_status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, verified, needs_revision
    
    -- Verification tracking
    verified_by UUID REFERENCES users(id),
    verified_date DATE,
    verification_notes TEXT,
    
    -- Content
    purpose TEXT,
    scope TEXT,
    principle TEXT,
    equipment_required TEXT,
    reagents_required TEXT,
    procedure TEXT,
    calculations TEXT,
    acceptance_criteria TEXT,
    references TEXT,
    
    -- Version information
    current_version VARCHAR(20) DEFAULT '1.0',
    version_notes TEXT,
    
    -- Relationships
    supersedes_method_id UUID REFERENCES test_methods(id),  -- If this replaces an older TM
    superseded_by_method_id UUID REFERENCES test_methods(id),  -- If this was replaced
    
    -- Metadata
    effective_date DATE,
    review_date DATE,
    next_review_date DATE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Full-text search
    search_vector tsvector
);

-- Version History - tracks all changes to test methods
CREATE TABLE test_method_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_method_id UUID REFERENCES test_methods(id) ON DELETE CASCADE,
    
    version_number VARCHAR(20) NOT NULL,
    
    -- What changed
    change_type VARCHAR(50) NOT NULL,  -- major_revision, minor_revision, correction, label_change, standardization
    change_description TEXT NOT NULL,
    
    -- Snapshot of data at this version
    legacy_number VARCHAR(100),
    official_number VARCHAR(50),
    title VARCHAR(255),
    status VARCHAR(50),
    
    -- Who and when
    changed_by UUID REFERENCES users(id),
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Previous values (for audit trail)
    previous_values JSONB,  -- Store full previous state
    new_values JSONB,  -- Store new state
    
    notes TEXT
);

-- File Attachments - PDFs, documents, etc.
CREATE TABLE test_method_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_method_id UUID REFERENCES test_methods(id) ON DELETE CASCADE,
    
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),  -- pdf, docx, xlsx, etc.
    file_size INTEGER,
    
    file_category VARCHAR(50),  -- original_document, sop, attachment, reference, validation_data
    
    version VARCHAR(20),  -- Which version of the TM this file belongs to
    
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    notes TEXT
);

-- Indexes for performance
CREATE INDEX idx_tm_legacy_number ON test_methods(legacy_number);
CREATE INDEX idx_tm_official_number ON test_methods(official_number);
CREATE INDEX idx_tm_status ON test_methods(status);
CREATE INDEX idx_tm_verification_status ON test_methods(verification_status);
CREATE INDEX idx_tm_category ON test_methods(category_id);
CREATE INDEX idx_tm_lab_source ON test_methods(legacy_lab_source);
CREATE INDEX idx_tm_created_at ON test_methods(created_at);
CREATE INDEX idx_tm_search ON test_methods USING gin(search_vector);

CREATE INDEX idx_tmv_test_method ON test_method_versions(test_method_id);
CREATE INDEX idx_tmv_change_date ON test_method_versions(change_date);

CREATE INDEX idx_tmf_test_method ON test_method_files(test_method_id);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION test_methods_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.legacy_number, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.official_number, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.original_title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.official_title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.purpose, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.scope, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER test_methods_search_update
    BEFORE INSERT OR UPDATE ON test_methods
    FOR EACH ROW
    EXECUTE FUNCTION test_methods_search_trigger();

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_test_methods_timestamp() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER test_methods_timestamp_update
    BEFORE UPDATE ON test_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_test_methods_timestamp();

-- View for easy querying with all relationships
CREATE VIEW test_methods_full AS
SELECT 
    tm.id,
    tm.legacy_number,
    tm.legacy_lab_source,
    tm.original_title,
    tm.official_number,
    tm.official_title,
    COALESCE(tm.official_title, tm.original_title) as display_title,
    COALESCE(tm.official_number, tm.legacy_number) as display_number,
    tm.status,
    tm.verification_status,
    tm.current_version,
    tm.method_type,
    cat.category_name,
    tm.effective_date,
    tm.next_review_date,
    u1.username as created_by_name,
    u2.username as verified_by_name,
    tm.verified_date,
    tm.created_at,
    tm.updated_at,
    COUNT(DISTINCT tmf.id) as file_count,
    COUNT(DISTINCT tmv.id) as version_count,
    CASE 
        WHEN tm.official_number IS NOT NULL THEN true
        ELSE false
    END as is_standardized
FROM test_methods tm
LEFT JOIN test_method_categories cat ON tm.category_id = cat.id
LEFT JOIN users u1 ON tm.created_by = u1.id
LEFT JOIN users u2 ON tm.verified_by = u2.id
LEFT JOIN test_method_files tmf ON tm.id = tmf.test_method_id
LEFT JOIN test_method_versions tmv ON tm.id = tmv.test_method_id
GROUP BY tm.id, cat.category_name, u1.username, u2.username;

-- Insert default categories
INSERT INTO test_method_categories (category_name, description) VALUES
('Gas Chromatography', 'GC and GC-MS methods'),
('Liquid Chromatography', 'HPLC, UHPLC, and LC-MS methods'),
('Titration', 'Volumetric and titration methods'),
('Spectroscopy', 'UV-Vis, IR, NMR, and other spectroscopic methods'),
('Physical Testing', 'Physical property measurements'),
('Wet Chemistry', 'Classical wet chemistry methods'),
('Sample Preparation', 'Sample prep and extraction methods'),
('Quality Control', 'QC and calibration methods'),
('Other', 'Miscellaneous test methods');

-- Comments
COMMENT ON TABLE test_methods IS 'Library of test methods with legacy and standardized numbering support';
COMMENT ON COLUMN test_methods.legacy_number IS 'Original number from external lab (e.g., "Lab-A-GC-001", "Method-2023-45")';
COMMENT ON COLUMN test_methods.official_number IS 'T-Link standardized number (e.g., "TM-GC-001"), NULL until verified';
COMMENT ON COLUMN test_methods.status IS 'Workflow status: draft, under_review, verified, standardized, archived, superseded';
COMMENT ON COLUMN test_methods.verification_status IS 'Verification progress: pending, in_progress, verified, needs_revision';
COMMENT ON COLUMN test_method_versions.change_type IS 'Type of change: major_revision, minor_revision, correction, label_change, standardization';
COMMENT ON TABLE test_method_versions IS 'Complete version history and audit trail for test methods';
COMMENT ON TABLE test_method_files IS 'File attachments (PDFs, SOPs, validation data) for test methods';
