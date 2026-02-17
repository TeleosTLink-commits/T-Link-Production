-- URGENT FIX: Add missing hazmat columns to shipments table
-- Run this on production database immediately
-- Date: 2026-02-17

-- Add hazmat-related columns if they don't exist
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS is_hazmat BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_dg_declaration BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipments_is_hazmat ON shipments(is_hazmat);
CREATE INDEX IF NOT EXISTS idx_shipments_dg_required ON shipments(requires_dg_declaration);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'shipments' 
  AND column_name IN ('is_hazmat', 'requires_dg_declaration');
