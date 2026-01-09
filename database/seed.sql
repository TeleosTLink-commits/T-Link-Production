-- T-Link Database Seed Data
-- Initial data for development and testing

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES
('admin', 'admin@teleos.com', '$2a$10$YourHashedPasswordHere', 'System', 'Administrator', 'admin'),
('lab_user', 'lab@teleos.com', '$2a$10$YourHashedPasswordHere', 'Lab', 'Staff', 'lab_staff'),
('logistics_user', 'logistics@teleos.com', '$2a$10$YourHashedPasswordHere', 'Logistics', 'Staff', 'logistics');

-- Insert sample manufacturer companies
INSERT INTO manufacturer_companies (company_name, contact_email, contact_phone, address) VALUES
('Sigma-Aldrich', 'contact@sigmaaldrich.com', '1-800-325-3010', '3050 Spruce Street, St. Louis, MO 63103'),
('Fisher Scientific', 'info@fishersci.com', '1-800-766-7000', '300 Industry Drive, Pittsburgh, PA 15275'),
('VWR International', 'support@vwr.com', '1-800-932-5000', '100 Matsonford Road, Radnor, PA 19087');

-- Insert sample freezers
INSERT INTO freezers (freezer_name, location, temperature_range, capacity_description) VALUES
('Freezer A-1', 'Lab Room 101', '-20°C to -25°C', 'Walk-in freezer, 12 shelf units'),
('Freezer B-2', 'Lab Room 102', '-80°C to -85°C', 'Ultra-low temperature, 8 shelf units'),
('Freezer C-3', 'Storage Room 201', '-20°C', 'Standard upright freezer, 5 shelves');

-- Insert freezer shelves for Freezer A-1
INSERT INTO freezer_shelves (freezer_id, shelf_number, position_description) 
SELECT id, 'A' || n, 'Shelf ' || n || ' - Top Section'
FROM freezers, generate_series(1, 12) AS n
WHERE freezer_name = 'Freezer A-1';

-- Insert chemical hazard classifications
INSERT INTO chemical_hazards (hazard_class, un_number, packing_group, label_requirements, packaging_requirements, handling_instructions) VALUES
('Flammable Liquid', 'UN1170', 'II', 'Flammable Liquid Label, Class 3', 'UN-approved containers, secondary containment', 'Keep away from heat/sparks/open flames. Use explosion-proof equipment.'),
('Corrosive', 'UN1789', 'II', 'Corrosive Label, Class 8', 'Acid-resistant containers, leak-proof packaging', 'Wear protective gloves/clothing/eye protection. Do not mix with incompatible materials.'),
('Oxidizer', 'UN1479', 'III', 'Oxidizer Label, Class 5.1', 'Non-combustible packaging, ventilated', 'Keep away from combustible materials. Store in cool, well-ventilated area.'),
('Toxic Substance', 'UN2810', 'II', 'Toxic Label, Class 6.1', 'Sealed containers, double packaging', 'Avoid inhalation and skin contact. Use in fume hood.'),
('Non-Hazardous', NULL, NULL, 'No special labeling required', 'Standard packaging', 'Follow standard laboratory safety procedures.');

-- Insert shipping supplies
INSERT INTO shipping_supplies (supply_name, supply_type, current_quantity, low_stock_threshold, unit, supplier_name, reorder_quantity) VALUES
('Small Cooler (12" x 12")', 'cooler', 25, 10, 'each', 'Uline', 20),
('Medium Cooler (18" x 18")', 'cooler', 15, 8, 'each', 'Uline', 15),
('Large Cooler (24" x 24")', 'cooler', 10, 5, 'each', 'Uline', 10),
('Dry Ice Labels - Class 9', 'dry_ice_label', 500, 100, 'each', 'Labelmaster', 500),
('UN Box 4G (Small)', 'un_box', 30, 10, 'each', 'Labelmaster', 25),
('UN Box 4GV (Medium)', 'un_box', 25, 10, 'each', 'Labelmaster', 25),
('Bubble Wrap Roll', 'packaging_material', 10, 3, 'roll', 'Uline', 10),
('Foam Insulation Sheets', 'packaging_material', 50, 15, 'sheet', 'Uline', 50),
('Absorbent Pads', 'packaging_material', 100, 25, 'each', 'Fisher Scientific', 100),
('Hazmat Labels - Flammable', 'other', 200, 50, 'each', 'Labelmaster', 200),
('Hazmat Labels - Corrosive', 'other', 200, 50, 'each', 'Labelmaster', 200);

-- Insert sample Test Methods
INSERT INTO test_methods (tm_number, version, title, description, file_path, file_name, is_current_version, status, created_by) 
SELECT 
    'TM-001', '1.0', 'HPLC Analysis of Organic Compounds', 
    'Standard method for high-performance liquid chromatography analysis',
    '/documents/test_methods/TM-001_v1.0.pdf', 'TM-001_v1.0.pdf', true, 'active',
    id FROM users WHERE username = 'admin' LIMIT 1;

INSERT INTO test_methods (tm_number, version, title, description, file_path, file_name, is_current_version, status, created_by) 
SELECT 
    'TM-002', '2.1', 'GC-MS Analysis Protocol', 
    'Gas chromatography-mass spectrometry standard operating procedure',
    '/documents/test_methods/TM-002_v2.1.pdf', 'TM-002_v2.1.pdf', true, 'active',
    id FROM users WHERE username = 'admin' LIMIT 1;

-- Insert sample SOPs
INSERT INTO sops (sop_number, title, description, file_path, file_name, version, effective_date, review_date, created_by) 
SELECT 
    'SOP-LAB-001', 'Laboratory Safety Procedures', 
    'General laboratory safety and emergency procedures',
    '/documents/sops/SOP-LAB-001.pdf', 'SOP-LAB-001.pdf', '3.0', 
    CURRENT_DATE - INTERVAL '6 months', CURRENT_DATE + INTERVAL '18 months',
    id FROM users WHERE username = 'admin' LIMIT 1;

INSERT INTO sops (sop_number, title, description, file_path, file_name, version, effective_date, review_date, created_by) 
SELECT 
    'SOP-QC-002', 'Sample Handling and Storage', 
    'Procedures for proper sample handling, labeling, and storage',
    '/documents/sops/SOP-QC-002.pdf', 'SOP-QC-002.pdf', '2.5', 
    CURRENT_DATE - INTERVAL '3 months', CURRENT_DATE + INTERVAL '21 months',
    id FROM users WHERE username = 'admin' LIMIT 1;

-- Insert sample Certificates of Analysis
INSERT INTO certificates_of_analysis (lot_number, product_name, manufacturer_id, issue_date, expiration_date, file_path, file_name, created_by) 
SELECT 
    'LOT-2024-001-SA', 'Acetonitrile HPLC Grade', 
    mc.id, CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '275 days',
    '/documents/coa/LOT-2024-001-SA.pdf', 'LOT-2024-001-SA.pdf',
    u.id 
FROM manufacturer_companies mc, users u 
WHERE mc.company_name = 'Sigma-Aldrich' AND u.username = 'admin' LIMIT 1;

INSERT INTO certificates_of_analysis (lot_number, product_name, manufacturer_id, issue_date, expiration_date, file_path, file_name, created_by) 
SELECT 
    'LOT-2024-002-FS', 'Methanol 99.9% ACS Grade', 
    mc.id, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE + INTERVAL '20 days',
    '/documents/coa/LOT-2024-002-FS.pdf', 'LOT-2024-002-FS.pdf',
    u.id 
FROM manufacturer_companies mc, users u 
WHERE mc.company_name = 'Fisher Scientific' AND u.username = 'admin' LIMIT 1;

-- Insert sample inventory items
INSERT INTO samples (sample_id, lot_number, sample_name, sample_type, initial_volume, current_volume, unit, low_inventory_threshold, received_date, expiration_date, freezer_id, created_by)
SELECT 
    'SAMP-2024-001', 'LOT-2024-001-SA', 'Acetonitrile HPLC Grade', 'Solvent',
    1000.0, 750.5, 'mL', 200.0, CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE + INTERVAL '275 days',
    f.id, u.id
FROM freezers f, users u
WHERE f.freezer_name = 'Freezer A-1' AND u.username = 'admin' LIMIT 1;

INSERT INTO samples (sample_id, lot_number, sample_name, sample_type, initial_volume, current_volume, unit, low_inventory_threshold, received_date, expiration_date, freezer_id, created_by)
SELECT 
    'SAMP-2024-002', 'LOT-2024-002-FS', 'Methanol 99.9% ACS Grade', 'Solvent',
    500.0, 150.0, 'mL', 100.0, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE + INTERVAL '20 days',
    f.id, u.id
FROM freezers f, users u
WHERE f.freezer_name = 'Freezer A-1' AND u.username = 'admin' LIMIT 1;

-- Note: Passwords above are placeholders. 
-- In the actual application, use bcrypt to hash: admin123 -> actual hash
