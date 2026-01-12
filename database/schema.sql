-- T-Link Database Schema
-- Teleos Logistics & Information Network

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================
-- USER MANAGEMENT & AUTH
-- ============================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'lab_staff', 'logistics', 'manufacturer')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE manufacturer_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL UNIQUE,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link manufacturers to companies
CREATE TABLE manufacturer_users (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES manufacturer_companies(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, company_id)
);

-- ============================
-- MODULE 1: DIGITAL QUALITY LIBRARY
-- ============================

-- Test Methods with version control
CREATE TABLE test_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tm_number VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    is_current_version BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tm_number, version)
);

-- Standard Operating Procedures
CREATE TABLE sops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sop_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL,
    effective_date DATE NOT NULL,
    review_date DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'under_review', 'archived')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificates of Analysis
-- Certificates of Analysis removed: handled by Sample Inventory
-- The `certificates_of_analysis` and related notification table have been
-- consolidated into the `samples` / sample-inventory workflow.
-- If you need to drop the old table from an existing database, use the
-- migration script located at: database/migrations/999_drop_certificates_of_analysis.sql

-- Document Audit Trail
CREATE TABLE document_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('test_method', 'sop')),
    document_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'viewed', 'downloaded', 'deleted', 'version_changed')),
    performed_by UUID REFERENCES users(id),
    previous_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- MODULE 2: INVENTORY & FREEZER MANAGEMENT
-- ============================

-- Freezer Locations
CREATE TABLE freezers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    freezer_name VARCHAR(100) NOT NULL UNIQUE,
    location VARCHAR(255) NOT NULL,
    temperature_range VARCHAR(50),
    capacity_description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE freezer_shelves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    freezer_id UUID REFERENCES freezers(id) ON DELETE CASCADE,
    shelf_number VARCHAR(20) NOT NULL,
    position_description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(freezer_id, shelf_number)
);

-- Sample Inventory
CREATE TABLE samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id VARCHAR(100) NOT NULL UNIQUE,
    lot_number VARCHAR(100),
    sample_name VARCHAR(255) NOT NULL,
    sample_type VARCHAR(100) NOT NULL,
    initial_volume DECIMAL(10, 3) NOT NULL,
    current_volume DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL CHECK (unit IN ('mL', 'L', 'g', 'kg', 'mg', 'units')),
    low_inventory_threshold DECIMAL(10, 3) NOT NULL,
    freezer_id UUID REFERENCES freezers(id),
    shelf_id UUID REFERENCES freezer_shelves(id),
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'low', 'depleted', 'quarantine', 'expired')),
    received_date DATE NOT NULL,
    expiration_date DATE,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Checkout/Usage Log
CREATE TABLE sample_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('checkout', 'return', 'adjustment', 'disposal')),
    amount_used DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    volume_before DECIMAL(10, 3) NOT NULL,
    volume_after DECIMAL(10, 3) NOT NULL,
    test_method_id UUID REFERENCES test_methods(id),
    purpose TEXT,
    performed_by UUID REFERENCES users(id),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Low Inventory Alerts
CREATE TABLE inventory_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('low_inventory', 'depleted', 'expiring_soon')),
    alert_message TEXT NOT NULL,
    current_volume DECIMAL(10, 3),
    threshold_volume DECIMAL(10, 3),
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- MODULE 3: LOGISTICS & SHIPMENT CENTER
-- ============================

-- Shipping Supply Inventory
CREATE TABLE shipping_supplies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supply_name VARCHAR(255) NOT NULL UNIQUE,
    supply_type VARCHAR(100) NOT NULL CHECK (supply_type IN ('cooler', 'dry_ice_label', 'un_box', 'packaging_material', 'other')),
    current_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 10,
    unit VARCHAR(50) NOT NULL,
    supplier_name VARCHAR(255),
    reorder_quantity INTEGER,
    status VARCHAR(50) DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'low_stock', 'out_of_stock')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipping Supply Transactions
CREATE TABLE supply_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supply_id UUID REFERENCES shipping_supplies(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('restock', 'usage', 'adjustment')),
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    performed_by UUID REFERENCES users(id),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Chemical Hazard Classifications
CREATE TABLE chemical_hazards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hazard_class VARCHAR(100) NOT NULL UNIQUE,
    un_number VARCHAR(20),
    packing_group VARCHAR(10),
    label_requirements TEXT,
    packaging_requirements TEXT,
    handling_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipment Requests
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'shipped', 'delivered', 'cancelled')),
    sample_id UUID REFERENCES samples(id),
    lot_number VARCHAR(100),
    amount_shipped DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    hazard_id UUID REFERENCES chemical_hazards(id),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_company VARCHAR(255),
    destination_address TEXT NOT NULL,
    destination_city VARCHAR(100),
    destination_state VARCHAR(50),
    destination_zip VARCHAR(20),
    destination_country VARCHAR(100),
    carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    shipping_label_path VARCHAR(500),
    special_instructions TEXT,
    requested_by UUID REFERENCES users(id),
    prepared_by UUID REFERENCES users(id),
    shipped_date TIMESTAMP,
    estimated_delivery TIMESTAMP,
    actual_delivery TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shipment Chain of Custody
CREATE TABLE shipment_chain_of_custody (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL CHECK (event_type IN ('created', 'prepared', 'quality_check', 'packed', 'shipped', 'in_transit', 'delivered')),
    performed_by UUID REFERENCES users(id),
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    location VARCHAR(255),
    notes TEXT,
    signature_path VARCHAR(500)
);

-- Shipment Supplies Used (many-to-many)
CREATE TABLE shipment_supplies_used (
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    supply_id UUID REFERENCES shipping_supplies(id) ON DELETE CASCADE,
    quantity_used INTEGER NOT NULL,
    PRIMARY KEY (shipment_id, supply_id)
);

-- ============================
-- SYSTEM NOTIFICATIONS
-- ============================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_type VARCHAR(100) NOT NULL CHECK (notification_type IN (
        'coa_expiration', 'low_inventory', 'shipment_request', 
        'supply_low_stock', 'sample_depleted', 'general'
    )),
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    recipient_user_id UUID REFERENCES users(id),
    recipient_email VARCHAR(255),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    sent_via VARCHAR(50) CHECK (sent_via IN ('email', 'in_app', 'both')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================
-- INDEXES FOR PERFORMANCE
-- ============================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Test Methods
CREATE INDEX idx_tm_number ON test_methods(tm_number);
CREATE INDEX idx_tm_current ON test_methods(is_current_version);
CREATE INDEX idx_tm_status ON test_methods(status);

-- CoA
-- Certificates of Analysis indexes removed (table consolidated into samples)

-- Samples
CREATE INDEX idx_samples_id ON samples(sample_id);
CREATE INDEX idx_samples_lot ON samples(lot_number);
CREATE INDEX idx_samples_status ON samples(status);
CREATE INDEX idx_samples_location ON samples(freezer_id, shelf_id);

-- Shipments
CREATE INDEX idx_shipments_number ON shipments(shipment_number);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_date ON shipments(shipped_date);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(recipient_user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- Audit Log
CREATE INDEX idx_audit_document ON document_audit_log(document_type, document_id);
CREATE INDEX idx_audit_user ON document_audit_log(performed_by);
CREATE INDEX idx_audit_created ON document_audit_log(created_at);

-- ============================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_manufacturer_companies_updated_at BEFORE UPDATE ON manufacturer_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_methods_updated_at BEFORE UPDATE ON test_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sops_updated_at BEFORE UPDATE ON sops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_freezers_updated_at BEFORE UPDATE ON freezers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_samples_updated_at BEFORE UPDATE ON samples FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipping_supplies_updated_at BEFORE UPDATE ON shipping_supplies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update CoA status based on expiration
-- Auto-update CoA status removed (handled on sample inventory if needed)

-- Auto-update sample status based on volume
CREATE OR REPLACE FUNCTION update_sample_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_volume <= 0 THEN
        NEW.status = 'depleted';
    ELSIF NEW.current_volume <= NEW.low_inventory_threshold THEN
        NEW.status = 'low';
    ELSIF NEW.expiration_date IS NOT NULL AND NEW.expiration_date <= CURRENT_DATE THEN
        NEW.status = 'expired';
    ELSE
        NEW.status = 'available';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sample_status_trigger 
BEFORE INSERT OR UPDATE ON samples 
FOR EACH ROW EXECUTE FUNCTION update_sample_status();

-- Auto-update shipping supply status
CREATE OR REPLACE FUNCTION update_supply_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_quantity <= 0 THEN
        NEW.status = 'out_of_stock';
    ELSIF NEW.current_quantity <= NEW.low_stock_threshold THEN
        NEW.status = 'low_stock';
    ELSE
        NEW.status = 'in_stock';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_supply_status_trigger 
BEFORE INSERT OR UPDATE ON shipping_supplies 
FOR EACH ROW EXECUTE FUNCTION update_supply_status();
