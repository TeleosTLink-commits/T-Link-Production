CREATE TABLE IF NOT EXISTS test_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_number VARCHAR(100),
    legacy_lab_source VARCHAR(100),
    original_title VARCHAR(255) NOT NULL,
    official_number VARCHAR(50) UNIQUE,
    official_title VARCHAR(255),
    category_id UUID,
    method_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    verification_status VARCHAR(50) DEFAULT 'pending',
    verified_by UUID,
    verified_date DATE,
    verification_notes TEXT,
    purpose TEXT,
    scope TEXT,
    principle TEXT,
    equipment_required TEXT,
    reagents_required TEXT,
    procedure TEXT,
    calculations TEXT,
    acceptance_criteria TEXT,
    method_references TEXT,
    current_version VARCHAR(20) DEFAULT '1.0',
    version_notes TEXT,
    supersedes_method_id UUID,
    superseded_by_method_id UUID,
    effective_date DATE,
    review_date DATE,
    next_review_date DATE,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_method_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_method_id UUID,
    version_number VARCHAR(20) NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    change_description TEXT NOT NULL,
    legacy_number VARCHAR(100),
    official_number VARCHAR(50),
    title VARCHAR(255),
    status VARCHAR(50),
    changed_by UUID,
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    previous_values JSONB,
    new_values JSONB,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS test_method_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_method_id UUID,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    file_category VARCHAR(50),
    version VARCHAR(20),
    uploaded_by UUID,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE OR REPLACE VIEW test_methods_full AS
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
