-- Sample Inventory Schema Update
-- This modifies the samples table to match the actual CSV data structure

-- Drop existing samples table and related tables
DROP TABLE IF EXISTS sample_transactions CASCADE;
DROP TABLE IF EXISTS samples CASCADE;

-- Create simplified samples table matching CSV structure
CREATE TABLE samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chemical_name VARCHAR(255) NOT NULL,
    received_date DATE,
    lot_number VARCHAR(100),
    quantity VARCHAR(100), -- Storing as text since it can be "12.86g" or "1: 0.91g, 2: 3.91g"
    concentration VARCHAR(50),
    has_dow_sds BOOLEAN DEFAULT false,
    cas_number VARCHAR(50),
    has_coa BOOLEAN DEFAULT false,
    
    -- Certification dates
    certification_date DATE,
    recertification_date DATE,
    expiration_date DATE,
    
    -- Hazmat information
    un_number VARCHAR(20),
    hazard_description TEXT,
    hs_code VARCHAR(50),
    hazard_class VARCHAR(50),
    packing_group VARCHAR(10),
    packing_instruction VARCHAR(50),
    
    -- System fields
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired', 'archived')),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Search optimization
    search_vector tsvector
);

-- Create indexes for common searches
CREATE INDEX idx_samples_chemical_name ON samples(chemical_name);
CREATE INDEX idx_samples_lot_number ON samples(lot_number);
CREATE INDEX idx_samples_cas_number ON samples(cas_number);
CREATE INDEX idx_samples_un_number ON samples(un_number);
CREATE INDEX idx_samples_expiration_date ON samples(expiration_date);
CREATE INDEX idx_samples_status ON samples(status);
CREATE INDEX idx_samples_search_vector ON samples USING gin(search_vector);

-- Create full-text search index
CREATE OR REPLACE FUNCTION samples_search_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.chemical_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.lot_number, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.cas_number, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.hazard_description, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER samples_search_update BEFORE INSERT OR UPDATE
    ON samples FOR EACH ROW EXECUTE FUNCTION samples_search_trigger();

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_samples_updated_at BEFORE UPDATE
    ON samples FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample transactions for tracking usage/adjustments
CREATE TABLE sample_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('received', 'used', 'adjusted', 'depleted', 'expired')),
    quantity_change VARCHAR(100), -- e.g., "-5g", "+10mL", etc.
    performed_by UUID REFERENCES users(id),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    purpose TEXT,
    reference_number VARCHAR(100),
    notes TEXT
);

CREATE INDEX idx_sample_transactions_sample_id ON sample_transactions(sample_id);
CREATE INDEX idx_sample_transactions_date ON sample_transactions(transaction_date DESC);

-- View for samples with expired/expiring status
CREATE OR REPLACE VIEW samples_with_status AS
SELECT 
    s.*,
    CASE 
        WHEN s.status = 'depleted' THEN 'Depleted'
        WHEN s.status = 'archived' THEN 'Archived'
        WHEN s.expiration_date IS NULL THEN 'Active'
        WHEN s.expiration_date < CURRENT_DATE THEN 'Expired'
        WHEN s.expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN 'Expiring Soon (30 days)'
        WHEN s.expiration_date < CURRENT_DATE + INTERVAL '60 days' THEN 'Expiring Soon (60 days)'
        WHEN s.expiration_date < CURRENT_DATE + INTERVAL '90 days' THEN 'Expiring Soon (90 days)'
        ELSE 'Active'
    END as expiration_status,
    CASE 
        WHEN s.expiration_date IS NOT NULL AND s.expiration_date < CURRENT_DATE 
        THEN s.expiration_date - CURRENT_DATE 
        ELSE NULL 
    END as days_until_expiration
FROM samples s;

-- Comments for documentation
COMMENT ON TABLE samples IS 'Sample inventory with hazmat information';
COMMENT ON COLUMN samples.quantity IS 'Quantity as text (e.g., "12.86g" or "1: 0.91g, 2: 3.91g")';
COMMENT ON COLUMN samples.has_dow_sds IS 'Whether DOW SDS is available';
COMMENT ON COLUMN samples.has_coa IS 'Whether Certificate of Analysis is available';
COMMENT ON COLUMN samples.hazard_description IS 'Hazard description (e.g., "flammable liquid; toxic")';
COMMENT ON COLUMN samples.packing_instruction IS 'Packing instruction code';
