-- Migration: Update shipments status constraint to include 'initiated' and 'processing' statuses
-- This allows new multi-sample shipment requests to use more granular status tracking

ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;

ALTER TABLE shipments ADD CONSTRAINT shipments_status_check 
  CHECK (status IN ('initiated', 'processing', 'pending', 'in_progress', 'shipped', 'delivered', 'cancelled'));
