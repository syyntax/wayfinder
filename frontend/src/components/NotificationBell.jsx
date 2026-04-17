import { useState, useRef, useEffect } from 'react';
import useNotificationStore from '../store/notificationStore';
import NotificationItem from './NotificationItem';
import './NotificationBell.css';

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    fetchNotifications,
    markAllAsRead,
    startPolling,
    stopPolling,
  } = useNotificationStore();

  // Start polling on mount, stop on unmount
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications(0, 20);
    }
  }, [isOpen, notifications.length, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle load more
  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      fetchNotifications(notifications.length, 20);
    }
  };

  // Handle mark all as read
  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  // Format badge count
  const getBadgeCount = () => {
    if (unreadCount > 9) return '9+';
    return unreadCount.toString();
  };

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        className="notification-bell__button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="notification-bell__icon">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-bell__badge" aria-hidden="true">
            {getBadgeCount()}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown__header">
            <h3 className="notification-dropdown__title">Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="notification-dropdown__mark-read"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-dropdown__content">
            {isLoading && notifications.length === 0 ? (
              <div className="notification-dropdown__loading">
                <div className="spinner"></div>
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-dropdown__empty">
                <svg viewBox="0 0 20 20" fill="currentColor" className="notification-dropdown__empty-icon">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
                <p>No notifications yet</p>
                <span>You will be notified when something happens</span>
              </div>
            ) : (
              <>
                <div className="notification-dropdown__list">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClose={() => setIsOpen(false)}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="notification-dropdown__footer">
                    <button
                      className="notification-dropdown__load-more"
                      onClick={handleLoadMore}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
