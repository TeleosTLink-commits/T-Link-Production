-- Migration: Add proper_shipping_name and emergency_contact for DOT hazmat compliance
-- This is required for FedEx hazardous materials API

-- Add proper_shipping_name column if it doesn't exist
ALTER TABLE samples 
ADD COLUMN IF NOT EXISTS proper_shipping_name VARCHAR(255);

-- Add company emergency contact for hazmat shipments
-- This will be stored at the company/system level, not per sample
-- For now, we'll use environment variable LAB_EMERGENCY_PHONE

-- Create index for hazmat lookups
CREATE INDEX IF NOT EXISTS idx_samples_proper_shipping_name ON samples(proper_shipping_name) WHERE proper_shipping_name IS NOT NULL;

-- Add comments
COMMENT ON COLUMN samples.proper_shipping_name IS 'DOT Proper Shipping Name for hazardous materials (e.g., "Paint", "Flammable Liquid, N.O.S.")';

-- Verify the hazmat columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'samples' 
AND column_name IN ('un_number', 'hazard_class', 'packing_group', 'proper_shipping_name', 'sds_file_path');
