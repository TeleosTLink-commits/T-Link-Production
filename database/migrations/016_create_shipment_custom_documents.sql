-- ============================================================================
-- Migration 016: Shipment Custom Documents
-- ============================================================================
-- Purpose: Allow staff to attach arbitrary customs / shipping documents to a
--          shipment (e.g. certificates, import permits, country-specific customs
--          forms) beyond the auto-generated Commercial Invoice and Packing List.
--
-- Files are stored on Cloudinary in production and on local disk in development,
-- mirroring the existing study-documents storage pattern. Only the metadata and
-- resolved file path/URL are persisted here.
--
-- Safe to re-run: uses IF NOT EXISTS guards.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS shipment_custom_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL DEFAULT 'Other',
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    notes TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipment_custom_documents_shipment
    ON shipment_custom_documents(shipment_id);
