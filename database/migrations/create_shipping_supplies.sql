-- Create shipping supplies table
CREATE TABLE IF NOT EXISTS shipping_supplies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  un_box_type VARCHAR(50),
  inner_packing_type VARCHAR(100),
  dot_sp_number VARCHAR(50),
  item_number VARCHAR(100),
  purchased_from VARCHAR(255),
  price_per_unit VARCHAR(50),
  count INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Import initial data
INSERT INTO shipping_supplies (un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count)
VALUES 
  ('4GV/X 4.0/S/25', 'Metal Can', '9168', 'KHMS-66340', 'LabelMaster', '$44.35', 20),
  ('4GV/X 2.9/S/23', 'Plastic Capsulock', '21488', 'UNIPCAPSULOCSP-32-R2', 'LabelMaster', '$29.22', 10),
  ('4GV/X 2.9/S/23', 'Plastic Capsulock', 'NA', 'NA', 'NA', 'NA', 2),
  ('4GV/X 8.9/S/25', 'Cardboard Capsule', 'NA', 'NA', 'NA', 'NA', 5),
  ('4GV/X 10/S/25', 'Cardboard 4 Partition', 'NA', 'S-22147', 'ULINE', '$61 for 15', 2),
  ('4GV/X 3.1/S/24', 'Cardboard', 'NA', 'NA', 'NA', 'NA', 4)
ON CONFLICT DO NOTHING;
