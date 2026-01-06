import React from 'react';

const ManufacturerPortal: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Manufacturer Access Portal</h1>
      <p>Read-only external portal for manufacturer users</p>
      <p style={{ color: '#666', marginTop: '20px' }}>This page is under construction. Features will include:</p>
      <ul style={{ color: '#666' }}>
        <li>View CoAs for your company's products</li>
        <li>Access reference standards documentation</li>
        <li>Read-only access (no edit capabilities)</li>
        <li>Filtered view based on manufacturer company</li>
        <li>Download certificates and documentation</li>
      </ul>
    </div>
  );
};

export default ManufacturerPortal;
