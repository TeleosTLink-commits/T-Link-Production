-- Migration: Backup and drop certificates_of_analysis
-- IMPORTANT: Run this on a DB backup or production only after verifying the backup.
-- Backup approach (SQL): create a full schema+data copy of the CoA table

-- Create a backup table preserving columns and constraints
CREATE TABLE IF NOT EXISTS certificates_of_analysis_backup (LIKE certificates_of_analysis INCLUDING ALL);

-- Copy data into backup table
INSERT INTO certificates_of_analysis_backup SELECT * FROM certificates_of_analysis;

-- Optionally verify row counts before dropping:
-- SELECT COUNT(*) FROM certificates_of_analysis;
-- SELECT COUNT(*) FROM certificates_of_analysis_backup;

-- If you prefer to export with pg_dump instead of SQL copy, run locally:
-- pg_dump -h localhost -U postgres -d tlink_db -t certificates_of_analysis -F c -f certificates_of_analysis.dump

-- Remove dependent notification table first (if present)
DROP TABLE IF EXISTS coa_expiration_notifications;

-- Finally drop the certificates table
DROP TABLE IF EXISTS certificates_of_analysis CASCADE;
