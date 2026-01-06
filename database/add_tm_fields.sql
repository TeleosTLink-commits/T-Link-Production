-- Add new fields for better test method categorization
ALTER TABLE test_methods 
ADD COLUMN IF NOT EXISTS sample_matrix VARCHAR(200),
ADD COLUMN IF NOT EXISTS analyte VARCHAR(200),
ADD COLUMN IF NOT EXISTS test_purpose VARCHAR(100);

-- Create index for common searches
CREATE INDEX IF NOT EXISTS idx_test_methods_analyte ON test_methods(analyte);
CREATE INDEX IF NOT EXISTS idx_test_methods_matrix ON test_methods(sample_matrix);
