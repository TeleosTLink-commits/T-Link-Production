-- Run this migration on production database to add CoA and SDS file columns
-- Connect to production database: psql -h <host> -U <user> -d <database>

BEGIN;

-- Add columns for COA and SDS file storage to samples table
ALTER TABLE samples 
ADD COLUMN IF NOT EXISTS coa_file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS coa_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS sds_file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS sds_file_name VARCHAR(255);

-- Add indexes for file path lookups
CREATE INDEX IF NOT EXISTS idx_samples_coa_file ON samples(coa_file_path) WHERE coa_file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_samples_sds_file ON samples(sds_file_path) WHERE sds_file_path IS NOT NULL;

-- Add comments
COMMENT ON COLUMN samples.coa_file_path IS 'File system path or Cloudinary URL to the Certificate of Analysis document';
COMMENT ON COLUMN samples.coa_file_name IS 'Original filename of the COA document';
COMMENT ON COLUMN samples.sds_file_path IS 'File system path or Cloudinary URL to the Safety Data Sheet document';
COMMENT ON COLUMN samples.sds_file_name IS 'Original filename of the SDS document';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'samples' 
AND column_name IN ('coa_file_path', 'coa_file_name', 'sds_file_path', 'sds_file_name');

COMMIT;
