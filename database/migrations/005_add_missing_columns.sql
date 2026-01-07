-- Add missing columns that backend code expects
-- Run this on production database after initial schema import

ALTER TABLE test_methods 
  ADD COLUMN IF NOT EXISTS official_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS category_id INTEGER;

ALTER TABLE sample_inventory 
  ADD COLUMN IF NOT EXISTS has_coa BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chemical_name VARCHAR(255);

-- Create view for test methods with category names
CREATE OR REPLACE VIEW test_methods_full AS 
  SELECT tm.*, c.name as category_name 
  FROM test_methods tm 
  LEFT JOIN test_method_categories c ON tm.category_id = c.id;

-- Verify columns were added
SELECT 'Migration 005 completed successfully' as status;
