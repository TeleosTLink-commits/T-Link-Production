import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HelpButton.css';

interface HelpButtonProps {
  userType: 'internal' | 'manufacturer';
}

const HelpButton: React.FC<HelpButtonProps> = ({ userType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenManual = () => {
    // Open the appropriate user manual based on user type
    const manualPath = userType === 'internal' 
      ? '/docs/USER_MANUAL_AJWA_LABS.html'
      : '/docs/USER_MANUAL_MANUFACTURERS.html';
    
    window.open(manualPath, '_blank');
    setIsOpen(false);
  };

  const handleContactSupport = () => {
    const supportPath = userType === 'internal' 
      ? '/internal/support'
      : '/manufacturer/support';
    navigate(supportPath);
    setIsOpen(false);
  };

  return (
    <div className="help-button-container" ref={dropdownRef}>
      <button
        className="help-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Help & Documentation"
      >
        <span className="help-icon">?</span>
        Help
      </button>

      {isOpen && (
        <div className="help-dropdown">
          <div className="help-dropdown-header">
            <h4>Help & Support</h4>
          </div>
          <div className="help-dropdown-content">
            <button className="help-menu-item" onClick={handleOpenManual}>
              <span className="menu-icon">📖</span>
              <div className="menu-text">
                <span className="menu-title">User Manual</span>
                <span className="menu-desc">Complete documentation</span>
              </div>
            </button>

            <button className="help-menu-item" onClick={handleContactSupport}>
              <span className="menu-icon">✉️</span>
              <div className="menu-text">
                <span className="menu-title">Contact Support</span>
                <span className="menu-desc">Get help from our team</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpButton;
