import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './NotificationBell.css';

interface Notification {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  link?: string;
  count?: number;
}

interface Stats {
  expiring_30_days: string | number;
  expired_samples: string | number;
}

interface SupplyStats {
  low_stock: string | number;
}

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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

  const fetchNotifications = async () => {
    try {
      const newNotifications: Notification[] = [];

      // Fetch sample stats - expiring items
      try {
        const sampleResponse = await api.get('/sample-inventory/stats');
        const stats: Stats = sampleResponse.data.data;

        // Parse as integers to avoid string concatenation
        const expiredCount = parseInt(String(stats.expired_samples), 10) || 0;
        const expiringCount = parseInt(String(stats.expiring_30_days), 10) || 0;

        if (expiredCount > 0) {
          newNotifications.push({
            id: 'expired',
            type: 'danger',
            title: 'Expired CoA',
            message: `${expiredCount} sample${expiredCount > 1 ? 's have' : ' has'} expired CoA`,
            link: '/inventory',
            count: expiredCount,
          });
        }

        if (expiringCount > 0) {
          newNotifications.push({
            id: 'expiring',
            type: 'warning',
            title: 'Expiring Soon',
            message: `${expiringCount} sample${expiringCount > 1 ? 's' : ''} expiring within 30 days`,
            link: '/inventory',
            count: expiringCount,
          });
        }
      } catch (err) {
        console.error('Error fetching sample stats:', err);
      }

      // Fetch supply stats - low stock (less than 2 items)
      try {
        const supplyResponse = await api.get('/sample-inventory/supply-stats');
        const supplyStats: SupplyStats = supplyResponse.data.data;

        const lowStockCount = parseInt(String(supplyStats.low_stock), 10) || 0;

        if (lowStockCount > 0) {
          newNotifications.push({
            id: 'low-supplies',
            type: 'warning',
            title: 'Low Shipping Supplies',
            message: `${lowStockCount} supply item${lowStockCount > 1 ? 's' : ''} below 2 units`,
            link: '/shipments',
            count: lowStockCount,
          });
        }
      } catch (err) {
        console.log('Supply stats not available');
      }

      setNotifications(newNotifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total - ensure we're adding numbers
  const totalCount = notifications.reduce((sum, n) => sum + (n.count || 1), 0);
  const hasUrgent = notifications.some(n => n.type === 'danger');

  const handleNotificationClick = (notification: Notification) => {
    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'danger': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button 
        className={`notification-bell-btn ${hasUrgent ? 'has-urgent' : ''} ${totalCount > 0 ? 'has-notifications' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <svg 
          className="bell-icon" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {totalCount > 0 && (
          <span className={`notification-badge ${hasUrgent ? 'urgent' : ''}`}>
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {notifications.length > 0 && (
              <span className="notification-count">{totalCount} alert{totalCount !== 1 ? 's' : ''}</span>
            )}
          </div>
          
          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <span className="empty-icon">✓</span>
                <p>All clear! No alerts.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`notification-item ${notification.type}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <span className="notification-icon">{getIcon(notification.type)}</span>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                  </div>
                  <span className="notification-arrow">→</span>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button onClick={() => { navigate('/inventory'); setIsOpen(false); }}>
                View Inventory
              </button>
              <button onClick={() => { navigate('/shipments'); setIsOpen(false); }}>
                View Shipments
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
