-- Migration: Add shipment_samples junction table for multi-sample shipments
-- Run this on production database to enable multi-sample shipment functionality
-- Date: 2026-01-23

-- Step 1: Create shipment_samples table if it doesn't exist
CREATE TABLE IF NOT EXISTS shipment_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    quantity_requested DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'ml',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_shipment_sample UNIQUE(shipment_id, sample_id)
);

-- Step 2: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shipment_samples_shipment_id ON shipment_samples(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_samples_sample_id ON shipment_samples(sample_id);

-- Step 3: Update shipments table status constraint to include 'initiated' status
-- First, drop the old constraint if it exists
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;

-- Add new constraint with all statuses including 'initiated'
ALTER TABLE shipments ADD CONSTRAINT shipments_status_check 
CHECK (status IN ('initiated', 'pending', 'processing', 'in_progress', 'shipped', 'in_transit', 'delivered', 'cancelled'));

-- Verification queries (run these to confirm migration success):
-- 1. Check if table exists:
-- SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_samples');

-- 2. Check table structure:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'shipment_samples' ORDER BY ordinal_position;

-- 3. Check status constraint:
-- SELECT con.conname, pg_get_constraintdef(con.oid) as definition FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid WHERE rel.relname = 'shipments' AND con.contype = 'c' AND con.conname LIKE '%status%';

COMMIT;
