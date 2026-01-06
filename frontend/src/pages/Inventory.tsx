import React from 'react';

const Inventory: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Precision Inventory & Freezer Management</h1>
      <p>Sample tracking with dynamic volume management</p>
      <p style={{ color: '#666', marginTop: '20px' }}>This page is under construction. Features will include:</p>
      <ul style={{ color: '#666' }}>
        <li>Sample catalog with freezer locations</li>
        <li>Dynamic volume tracking (checkout subtracts from inventory)</li>
        <li>Freezer and shelf management</li>
        <li>Low inventory alerts</li>
        <li>Transaction history for all samples</li>
        <li>Barcode/QR code integration</li>
      </ul>
    </div>
  );
};

export default Inventory;
