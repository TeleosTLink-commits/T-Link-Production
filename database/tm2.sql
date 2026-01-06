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
