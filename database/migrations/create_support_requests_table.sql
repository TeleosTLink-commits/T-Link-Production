-- Create support_requests table for tech and lab support submissions
CREATE TABLE IF NOT EXISTS support_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    manufacturer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    support_type VARCHAR(50) NOT NULL CHECK (support_type IN ('tech_support', 'lab_support')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    submitted_by_email VARCHAR(255) NOT NULL,
    submitted_by_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_user ON support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_manufacturer_user ON support_requests(manufacturer_user_id);
CREATE INDEX IF NOT EXISTS idx_support_type ON support_requests(support_type);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_requests(status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_support_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_requests_updated_at 
    BEFORE UPDATE ON support_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_support_requests_updated_at();

-- Add comments
COMMENT ON TABLE support_requests IS 'Stores technical and lab support requests from users';
COMMENT ON COLUMN support_requests.user_id IS 'Reference to internal staff user (if applicable)';
COMMENT ON COLUMN support_requests.manufacturer_user_id IS 'Reference to manufacturer user (if applicable)';
COMMENT ON COLUMN support_requests.support_type IS 'Type of support: tech_support or lab_support';
COMMENT ON COLUMN support_requests.status IS 'Current status: open, in_progress, resolved, or closed';
