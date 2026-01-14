-- Migration: Add Manufacturer Portal & Enhanced Shipping Schema
-- Date: 2026-01-14
-- Purpose: Support new manufacturer portal features and FedEx API integration

-- ============================
-- ALTER SHIPMENTS TABLE
-- ============================

-- Add manufacturer-specific and FedEx integration columns
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS manufacturer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES manufacturer_companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS scheduled_ship_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_notification_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_notification_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_hazmat BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_dg_declaration BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fedex_address_validation_result JSONB,
ADD COLUMN IF NOT EXISTS fedex_quote_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS fedex_label_format VARCHAR(20),
ADD COLUMN IF NOT EXISTS fedex_api_errors JSONB,
ADD COLUMN IF NOT EXISTS dg_declaration_id UUID;

-- Update shipments status check constraint to match requirements
-- Note: This replaces the old constraint
ALTER TABLE shipments
DROP CONSTRAINT IF EXISTS shipments_status_check;

ALTER TABLE shipments
ADD CONSTRAINT shipments_status_check 
  CHECK (status IN ('initiated', 'processing', 'shipped', 'delivered', 'cancelled'));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_shipments_manufacturer_user ON shipments(manufacturer_user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_company ON shipments(company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_is_hazmat ON shipments(is_hazmat);
CREATE INDEX IF NOT EXISTS idx_shipments_dg_required ON shipments(requires_dg_declaration);
CREATE INDEX IF NOT EXISTS idx_shipments_scheduled_date ON shipments(scheduled_ship_date);

-- ============================
-- CREATE DANGEROUS GOODS TABLE
-- ============================

CREATE TABLE IF NOT EXISTS dangerous_goods_declarations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    dg_form_number VARCHAR(100) UNIQUE,
    dg_form_document_path VARCHAR(500),
    un_number VARCHAR(10) NOT NULL,
    proper_shipping_name TEXT NOT NULL,
    hazard_class VARCHAR(50) NOT NULL,
    packing_group VARCHAR(10),
    technical_name TEXT,
    quantity_shipped DECIMAL(10, 3) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL,
    packaging_type VARCHAR(100),
    warning_labels_required BOOLEAN DEFAULT true,
    warning_labels_printed BOOLEAN DEFAULT false,
    warning_labels_printed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    warning_labels_printed_at TIMESTAMP,
    regulatory_compliance_notes TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dg_declarations_shipment ON dangerous_goods_declarations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_dg_declarations_un_number ON dangerous_goods_declarations(un_number);
CREATE INDEX IF NOT EXISTS idx_dg_declarations_hazard_class ON dangerous_goods_declarations(hazard_class);

-- ============================
-- CREATE SDS ASSOCIATIONS TABLE
-- ============================

CREATE TABLE IF NOT EXISTS sample_sds_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID REFERENCES samples(id) ON DELETE CASCADE,
    lot_number VARCHAR(100),
    sds_file_path VARCHAR(500) NOT NULL,
    sds_file_name VARCHAR(255) NOT NULL,
    chemical_name VARCHAR(255) NOT NULL,
    revision_date DATE,
    supplier_name VARCHAR(255),
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sds_sample ON sample_sds_documents(sample_id);
CREATE INDEX IF NOT EXISTS idx_sds_lot_number ON sample_sds_documents(lot_number);
CREATE INDEX IF NOT EXISTS idx_sds_is_current ON sample_sds_documents(is_current);

-- ============================
-- CREATE EMAIL LOG TABLE
-- ============================

CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('shipment_created', 'shipment_processing', 'shipment_shipped', 'shipment_delivered', 'support_request')),
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    delivery_status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_shipment ON email_notifications(shipment_id);
CREATE INDEX IF NOT EXISTS idx_email_recipient ON email_notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_is_sent ON email_notifications(is_sent);
CREATE INDEX IF NOT EXISTS idx_email_notification_type ON email_notifications(notification_type);

-- ============================
-- CREATE SUPPORT REQUESTS TABLE
-- ============================

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

CREATE INDEX IF NOT EXISTS idx_support_user ON support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_manufacturer_user ON support_requests(manufacturer_user_id);
CREATE INDEX IF NOT EXISTS idx_support_type ON support_requests(support_type);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_requests(status);

-- ============================
-- ADD MANUFACTURER PROFILE FIELDS
-- ============================

ALTER TABLE manufacturer_companies
ADD COLUMN IF NOT EXISTS website VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS technical_contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS compliance_notes TEXT;

-- ============================
-- UPDATE SHIPMENT CHAIN OF CUSTODY
-- ============================

-- Add new event types for manufacturer workflow
-- Note: Check constraint will be updated to allow new event types
ALTER TABLE shipment_chain_of_custody
DROP CONSTRAINT IF EXISTS shipment_chain_of_custody_event_type_check;

ALTER TABLE shipment_chain_of_custody
ADD CONSTRAINT shipment_chain_of_custody_event_type_check 
  CHECK (event_type IN ('created', 'prepared', 'quality_check', 'packed', 'shipped', 'in_transit', 'delivered', 'processing_started', 'label_generated', 'hazmat_flagged', 'dg_form_generated'));

-- ============================
-- CREATE TRIGGER FOR SHIPMENT UPDATED_AT
-- ============================

-- Ensure the trigger function exists (created in main schema)
-- The trigger for shipments should already exist, but we ensure it's set up
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dangerous_goods_updated_at 
  BEFORE UPDATE ON dangerous_goods_declarations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sds_documents_updated_at 
  BEFORE UPDATE ON sample_sds_documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_notifications_updated_at 
  BEFORE UPDATE ON email_notifications 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_requests_updated_at 
  BEFORE UPDATE ON support_requests 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================
-- MIGRATION NOTES
-- ============================
-- This migration:
-- 1. Updates shipments table with manufacturer portal and FedEx API fields
-- 2. Creates dangerous_goods_declarations table for hazmat tracking
-- 3. Creates sample_sds_documents table to link SDS files to samples/lots
-- 4. Creates email_notifications table for tracking sent notifications
-- 5. Creates support_requests table for tech/lab support submissions
-- 6. Adds manufacturer profile fields
-- 7. Updates shipment chain of custody event types
--
-- Status values changed from: ('pending', 'in_progress', 'shipped', 'delivered', 'cancelled')
-- To: ('initiated', 'processing', 'shipped', 'delivered', 'cancelled')
--
-- Existing shipment records should be migrated:
-- UPDATE shipments SET status = 'processing' WHERE status = 'in_progress';
-- UPDATE shipments SET status = 'initiated' WHERE status = 'pending';
