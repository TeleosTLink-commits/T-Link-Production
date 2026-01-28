import React, { useState, useRef, useEffect } from 'react';
import './HelpButton.css';

interface HelpButtonProps {
  userType: 'internal' | 'manufacturer';
}

const HelpButton: React.FC<HelpButtonProps> = ({ userType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      ? '/docs/USER_MANUAL_AJWA_LABS.md'
      : '/docs/USER_MANUAL_MANUFACTURERS.md';
    
    window.open(manualPath, '_blank');
    setIsOpen(false);
  };

  const handleOpenQuickReview = () => {
    // Only available for internal users (Ajwa Labs staff)
    if (userType === 'internal') {
      window.open('/docs/AJWA_LABS_QUICK_REVIEW.html', '_blank');
      setIsOpen(false);
    }
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
            
            {userType === 'internal' && (
              <button className="help-menu-item" onClick={handleOpenQuickReview}>
                <span className="menu-icon">📋</span>
                <div className="menu-text">
                  <span className="menu-title">Quick Review Form</span>
                  <span className="menu-desc">Submit feedback</span>
                </div>
              </button>
            )}

            <a href="/support" className="help-menu-item">
              <span className="menu-icon">✉️</span>
              <div className="menu-text">
                <span className="menu-title">Contact Support</span>
                <span className="menu-desc">Get help from our team</span>
              </div>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpButton;
