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
  expiring_30_days: number;
  expired_samples: number;
  samples_missing_coa: number;
  samples_missing_sds: number;
}

interface SupplyStats {
  reorder_needed: number;
  low_stock: number;
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

      // Fetch sample stats
      try {
        const sampleResponse = await api.get('/sample-inventory/stats');
        const stats: Stats = sampleResponse.data.data;

        if (stats.expired_samples > 0) {
          newNotifications.push({
            id: 'expired',
            type: 'danger',
            title: 'Expired Samples',
            message: `${stats.expired_samples} sample${stats.expired_samples > 1 ? 's have' : ' has'} expired CoA`,
            link: '/inventory',
            count: stats.expired_samples,
          });
        }

        if (stats.expiring_30_days > 0) {
          newNotifications.push({
            id: 'expiring',
            type: 'warning',
            title: 'Expiring Soon',
            message: `${stats.expiring_30_days} sample${stats.expiring_30_days > 1 ? 's' : ''} expiring within 30 days`,
            link: '/inventory',
            count: stats.expiring_30_days,
          });
        }

        if (stats.samples_missing_coa > 0) {
          newNotifications.push({
            id: 'missing-coa',
            type: 'info',
            title: 'Missing CoA',
            message: `${stats.samples_missing_coa} sample${stats.samples_missing_coa > 1 ? 's' : ''} without CoA document`,
            link: '/inventory',
            count: stats.samples_missing_coa,
          });
        }
      } catch (err) {
        console.error('Error fetching sample stats:', err);
      }

      // Fetch supply stats
      try {
        const supplyResponse = await api.get('/sample-inventory/supply-stats');
        const supplyStats: SupplyStats = supplyResponse.data.data;

        if (supplyStats.reorder_needed > 0) {
          newNotifications.push({
            id: 'reorder',
            type: 'danger',
            title: 'Reorder Supplies',
            message: `${supplyStats.reorder_needed} shipping supplie${supplyStats.reorder_needed > 1 ? 's need' : ' needs'} reorder`,
            link: '/internal/supplies',
            count: supplyStats.reorder_needed,
          });
        }

        if (supplyStats.low_stock > 0) {
          newNotifications.push({
            id: 'low-stock',
            type: 'warning',
            title: 'Low Stock',
            message: `${supplyStats.low_stock} supplie${supplyStats.low_stock > 1 ? 's are' : ' is'} running low`,
            link: '/internal/supplies',
            count: supplyStats.low_stock,
          });
        }
      } catch (err) {
        // Supply stats endpoint might not exist yet, that's ok
        console.log('Supply stats not available');
      }

      setNotifications(newNotifications);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

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
              <button onClick={() => { navigate('/internal/supplies'); setIsOpen(false); }}>
                View Supplies
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
