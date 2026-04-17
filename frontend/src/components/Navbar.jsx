import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import NotificationBell from './NotificationBell';
import './Navbar.css';

function Navbar() {
  const { user, logout } = useAuthStore();
  const { reset: resetNotifications } = useNotificationStore();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    resetNotifications();
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-brand">
          <svg viewBox="0 0 100 100" className="brand-icon">
            <defs>
              <linearGradient id="navGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b3daf" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="35" fill="none" stroke="url(#navGlow)" strokeWidth="2" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="url(#navGlow)" strokeWidth="1.5" strokeDasharray="4 2" />
            <path d="M50 15 L55 30 L50 25 L45 30 Z" fill="url(#navGlow)" />
            <path d="M50 85 L45 70 L50 75 L55 70 Z" fill="url(#navGlow)" />
            <path d="M15 50 L30 45 L25 50 L30 55 Z" fill="url(#navGlow)" />
            <path d="M85 50 L70 55 L75 50 L70 45 Z" fill="url(#navGlow)" />
            <circle cx="50" cy="50" r="8" fill="url(#navGlow)" />
            <circle cx="50" cy="50" r="4" fill="#0a0a0f" />
          </svg>
          <span className="brand-text">WAYFINDER</span>
        </Link>

        <div className="navbar-actions">
          <NotificationBell />
          <div className="user-menu" ref={dropdownRef}>
            <button
              className="user-button"
              onClick={() => setShowDropdown(!showDropdown)}
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              <div className="user-avatar">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.display_name} />
                ) : (
                  <span>{getInitials(user?.display_name || user?.username || 'U')}</span>
                )}
              </div>
              <span className="user-name">{user?.display_name || user?.username}</span>
              <svg className="dropdown-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {showDropdown && (
              <div className="dropdown-menu">
                <div className="dropdown-header">
                  <span className="dropdown-email">{user?.email}</span>
                  {user?.role === 'super_admin' && (
                    <span className="badge badge-purple">Super Admin</span>
                  )}
                </div>
                <div className="dropdown-divider"></div>
                <Link
                  to="/settings"
                  className="dropdown-item"
                  onClick={() => setShowDropdown(false)}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Settings
                </Link>
                <button className="dropdown-item" onClick={handleLogout}>
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
