import { useNavigate } from 'react-router-dom';
import useNotificationStore from '../store/notificationStore';
import './NotificationItem.css';

function NotificationItem({ notification, onClose }) {
  const navigate = useNavigate();
  const { markAsRead, deleteNotification } = useNotificationStore();

  // Calculate time ago
  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ago`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours}h ago`;
    }
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return `${days}d ago`;
    }
    return date.toLocaleDateString();
  };

  // Get icon based on notification type
  const getIcon = () => {
    switch (notification.type) {
      case 'comment_added':
        return (
          <svg viewBox="0 0 20 20" fill="currentColor" className="notification-icon notification-icon--comment">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        );
      case 'priority_changed':
        return (
          <svg viewBox="0 0 20 20" fill="currentColor" className="notification-icon notification-icon--priority">
            <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
          </svg>
        );
      case 'label_added':
      case 'label_removed':
        return (
          <svg viewBox="0 0 20 20" fill="currentColor" className="notification-icon notification-icon--label">
            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        );
      case 'workspace_added':
        return (
          <svg viewBox="0 0 20 20" fill="currentColor" className="notification-icon notification-icon--workspace-add">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
        );
      case 'workspace_removed':
        return (
          <svg viewBox="0 0 20 20" fill="currentColor" className="notification-icon notification-icon--workspace-remove">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h3a1 1 0 100-2h-1V7z" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 20 20" fill="currentColor" className="notification-icon">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle click on notification
  const handleClick = async () => {
    // Mark as read if not already
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Close dropdown
    if (onClose) {
      onClose();
    }

    // Navigate based on entity type
    if (notification.entity_type === 'card') {
      // For card notifications, we need to navigate to the board and open the card
      // The entity_id is the card_id - we'll navigate to dashboard and let user find the card
      // A more sophisticated approach would store board_id in the notification
      navigate('/dashboard');
    } else if (notification.entity_type === 'workspace') {
      navigate(`/workspace/${notification.entity_id}`);
    }
  };

  // Handle delete
  const handleDelete = async (e) => {
    e.stopPropagation();
    await deleteNotification(notification.id);
  };

  return (
    <div
      className={`notification-item ${!notification.is_read ? 'notification-item--unread' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      <div className="notification-item__indicator">
        {!notification.is_read && <span className="notification-item__dot" />}
      </div>

      <div className="notification-item__avatar">
        {notification.actor_avatar_url ? (
          <img src={notification.actor_avatar_url} alt={notification.actor_display_name || notification.actor_username} />
        ) : (
          <span>{getInitials(notification.actor_display_name || notification.actor_username)}</span>
        )}
      </div>

      <div className="notification-item__content">
        <div className="notification-item__header">
          <span className="notification-item__title">{notification.title}</span>
          <span className="notification-item__time">{getTimeAgo(notification.created_at)}</span>
        </div>
        <p className="notification-item__message">{notification.message}</p>
      </div>

      <div className="notification-item__icon-wrapper">
        {getIcon()}
      </div>

      <button
        className="notification-item__delete"
        onClick={handleDelete}
        title="Delete notification"
        aria-label="Delete notification"
      >
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

export default NotificationItem;
