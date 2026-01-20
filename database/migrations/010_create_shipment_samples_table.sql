-- Migration: Add shipment_samples junction table for multi-sample shipments
-- This allows a shipment to contain multiple samples (up to 10)

CREATE TABLE IF NOT EXISTS shipment_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    quantity_requested DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'ml',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_shipment_sample UNIQUE(shipment_id, sample_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shipment_samples_shipment_id ON shipment_samples(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_samples_sample_id ON shipment_samples(sample_id);

-- Optional: Modify shipments table status check to include 'initiated' and 'processing'
-- If not already present, you may need to update the constraint:
-- ALTER TABLE shipments DROP CONSTRAINT shipments_status_check;
-- ALTER TABLE shipments ADD CONSTRAINT shipments_status_check 
--   CHECK (status IN ('initiated', 'processing', 'pending', 'in_progress', 'shipped', 'delivered', 'cancelled'));

COMMIT;
