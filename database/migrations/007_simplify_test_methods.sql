BEGIN;

-- Drop dependent objects from the old schema (if present)
DROP VIEW IF EXISTS test_methods_full;
DROP TABLE IF EXISTS test_method_versions;

-- Create new simplified table
CREATE TABLE test_methods_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tm_number VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL DEFAULT '',
    file_name VARCHAR(255) NOT NULL DEFAULT '',
    is_current_version BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tm_number, version)
);

-- Migrate data from legacy schema to the new shape
INSERT INTO test_methods_new (
    tm_number, version, title, description, file_path, file_name,
    is_current_version, status, approved_by, approved_at,
    created_by, created_at, updated_at
)
SELECT
    COALESCE(legacy_number, official_number, 'TM-' || substring(id::text, 1, 8)) AS tm_number,
    COALESCE(current_version, '1.0') AS version,
    COALESCE(original_title, official_title, 'Untitled Method') AS title,
    NULLIF(CONCAT_WS(' ', purpose, scope), '') AS description,
    COALESCE(file_path, '') AS file_path,
    COALESCE(file_name, '') AS file_name,
    TRUE AS is_current_version,
    CASE status
        WHEN 'draft' THEN 'active'
        WHEN 'under_review' THEN 'active'
        WHEN 'verified' THEN 'active'
        WHEN 'standardized' THEN 'active'
        WHEN 'superseded' THEN 'superseded'
        WHEN 'archived' THEN 'archived'
        ELSE 'active'
    END AS status,
    verified_by AS approved_by,
    verified_date AS approved_at,
    created_by,
    created_at,
    updated_at
FROM test_methods;

-- Replace old table
DROP TABLE test_methods CASCADE;
ALTER TABLE test_methods_new RENAME TO test_methods;

COMMIT;
