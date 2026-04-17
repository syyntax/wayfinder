import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import { authApi, userApi, mailApi, userManagementApi, appSettingsApi } from '../utils/api';
import './SettingsPage.css';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuthStore();
  const { reset: resetNotifications } = useNotificationStore();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile state
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // Mail settings state (Super Admin only)
  const [mailSettings, setMailSettings] = useState({
    mail_provider: 'smtp',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: true,
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: 'Wayfinder',
    sendgrid_from_email: '',
    sendgrid_from_name: 'Wayfinder',
    sendgrid_api_key_configured: false
  });
  const [testEmail, setTestEmail] = useState('');
  const [isLoadingMailSettings, setIsLoadingMailSettings] = useState(false);
  const [isSavingMailSettings, setIsSavingMailSettings] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // User Management state (Super Admin only)
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [usersSearch, setUsersSearch] = useState('');
  const [usersSearchInput, setUsersSearchInput] = useState('');

  // Create User form state
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    display_name: '',
    password: '',
    confirmPassword: '',
    role: 'member'
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserErrors, setCreateUserErrors] = useState({});

  // Delete User modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // App Settings state (registration approval)
  const [appSettings, setAppSettings] = useState({
    registration_requires_approval: false
  });
  const [isLoadingAppSettings, setIsLoadingAppSettings] = useState(false);
  const [isUpdatingAppSettings, setIsUpdatingAppSettings] = useState(false);

  // Pending Users state
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingUsersLoading, setPendingUsersLoading] = useState(false);
  const [isApprovingUser, setIsApprovingUser] = useState(null);
  const [isRejectingUser, setIsRejectingUser] = useState(null);

  // Reject User modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [userToReject, setUserToReject] = useState(null);

  // Load mail settings when tab changes to mail (Super Admin only)
  useEffect(() => {
    if (activeTab === 'mail' && user?.role === 'super_admin') {
      loadMailSettings();
    }
  }, [activeTab, user?.role]);

  // Load users when tab changes to users (Super Admin only)
  useEffect(() => {
    if (activeTab === 'users' && user?.role === 'super_admin') {
      loadUsers();
      loadAppSettings();
      loadPendingUsers();
    }
  }, [activeTab, user?.role, usersPagination.page, usersSearch]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (usersSearchInput !== usersSearch) {
        setUsersSearch(usersSearchInput);
        setUsersPagination(prev => ({ ...prev, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [usersSearchInput]);

  const loadMailSettings = async () => {
    setIsLoadingMailSettings(true);
    try {
      const response = await mailApi.getSettings();
      if (response.data) {
        setMailSettings({
          mail_provider: response.data.mail_provider || 'smtp',
          smtp_host: response.data.smtp_host || '',
          smtp_port: response.data.smtp_port || 587,
          smtp_secure: response.data.smtp_secure ?? true,
          smtp_username: response.data.smtp_username || '',
          smtp_password: response.data.smtp_password || '',
          from_email: response.data.from_email || '',
          from_name: response.data.from_name || 'Wayfinder',
          sendgrid_from_email: response.data.sendgrid_from_email || '',
          sendgrid_from_name: response.data.sendgrid_from_name || 'Wayfinder',
          sendgrid_api_key_configured: response.data.sendgrid_api_key_configured || false
        });
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load mail settings');
    } finally {
      setIsLoadingMailSettings(false);
    }
  };

  // App Settings functions
  const loadAppSettings = async () => {
    setIsLoadingAppSettings(true);
    try {
      const response = await appSettingsApi.getSettings();
      if (response.data) {
        setAppSettings({
          registration_requires_approval: response.data.registration_requires_approval || false
        });
      }
    } catch (error) {
      console.error('Failed to load app settings:', error);
    } finally {
      setIsLoadingAppSettings(false);
    }
  };

  const handleToggleRegistrationApproval = async () => {
    const newValue = !appSettings.registration_requires_approval;
    setIsUpdatingAppSettings(true);
    try {
      const response = await appSettingsApi.updateSettings({
        registration_requires_approval: newValue
      });
      setAppSettings({
        registration_requires_approval: response.data.registration_requires_approval
      });
      toast.success(response.message || `Registration approval ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setIsUpdatingAppSettings(false);
    }
  };

  // Pending Users functions
  const loadPendingUsers = async () => {
    setPendingUsersLoading(true);
    try {
      const response = await userManagementApi.getPendingUsers();
      if (response.data) {
        setPendingUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Failed to load pending users:', error);
    } finally {
      setPendingUsersLoading(false);
    }
  };

  const handleApproveUser = async (userId) => {
    setIsApprovingUser(userId);
    try {
      const response = await userManagementApi.approveUser(userId);
      toast.success(response.message || 'User approved successfully');
      // Remove from pending list and refresh users
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to approve user');
    } finally {
      setIsApprovingUser(null);
    }
  };

  const handleOpenRejectModal = (userItem) => {
    setUserToReject(userItem);
    setRejectModalOpen(true);
  };

  const handleCloseRejectModal = () => {
    setRejectModalOpen(false);
    setUserToReject(null);
  };

  const handleRejectUser = async () => {
    if (!userToReject) return;

    setIsRejectingUser(userToReject.id);
    try {
      const response = await userManagementApi.rejectUser(userToReject.id);
      toast.success(response.message || 'User registration rejected');
      // Remove from pending list
      setPendingUsers(prev => prev.filter(u => u.id !== userToReject.id));
      handleCloseRejectModal();
    } catch (error) {
      toast.error(error.message || 'Failed to reject user');
    } finally {
      setIsRejectingUser(null);
    }
  };

  // User Management functions
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await userManagementApi.getAllUsers({
        page: usersPagination.page,
        limit: usersPagination.limit,
        search: usersSearch
      });
      if (response.data) {
        setUsers(response.data.users || []);
        setUsersPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 0
        }));
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const validateNewUserForm = () => {
    const errors = {};

    // Username validation
    if (!newUser.username) {
      errors.username = 'Username is required';
    } else if (newUser.username.length < 3 || newUser.username.length > 30) {
      errors.username = 'Username must be between 3 and 30 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(newUser.username)) {
      errors.username = 'Username can only contain letters, numbers, underscores, and dashes';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newUser.email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(newUser.email)) {
      errors.email = 'Invalid email format';
    }

    // Display name validation
    if (newUser.display_name && newUser.display_name.length > 100) {
      errors.display_name = 'Display name must not exceed 100 characters';
    }

    // Password validation
    if (!newUser.password) {
      errors.password = 'Password is required';
    } else {
      const passwordErrors = [];
      if (newUser.password.length < 8) passwordErrors.push('at least 8 characters');
      if (!/[A-Z]/.test(newUser.password)) passwordErrors.push('one uppercase letter');
      if (!/[a-z]/.test(newUser.password)) passwordErrors.push('one lowercase letter');
      if (!/[0-9]/.test(newUser.password)) passwordErrors.push('one number');

      if (passwordErrors.length > 0) {
        errors.password = `Password must contain ${passwordErrors.join(', ')}`;
      }
    }

    // Confirm password validation
    if (!newUser.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (newUser.password !== newUser.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Role validation
    if (!['super_admin', 'admin', 'member'].includes(newUser.role)) {
      errors.role = 'Invalid role selected';
    }

    setCreateUserErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getPasswordStrength = (password) => {
    if (!password) return { level: 0, label: '', color: '' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { level: 1, label: 'Weak', color: 'var(--color-blood-red)' };
    if (strength <= 4) return { level: 2, label: 'Medium', color: 'var(--color-warning, #f59e0b)' };
    return { level: 3, label: 'Strong', color: 'var(--color-toxic-green, #10b981)' };
  };

  const passwordStrength = useMemo(() => getPasswordStrength(newUser.password), [newUser.password]);

  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!validateNewUserForm()) {
      return;
    }

    setIsCreatingUser(true);
    try {
      const response = await userManagementApi.createUser({
        username: newUser.username,
        email: newUser.email,
        display_name: newUser.display_name || undefined,
        password: newUser.password,
        role: newUser.role
      });

      toast.success(response.message || 'User created successfully');

      // Reset form
      setNewUser({
        username: '',
        email: '',
        display_name: '',
        password: '',
        confirmPassword: '',
        role: 'member'
      });
      setCreateUserErrors({});

      // Reload users list
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleOpenDeleteModal = (userItem) => {
    setUserToDelete(userItem);
    setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setUserToDelete(null);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    try {
      const response = await userManagementApi.deleteUser(userToDelete.id);
      toast.success(response.message || 'User deleted successfully');
      handleCloseDeleteModal();
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const canDeleteUser = (userItem) => {
    // Cannot delete self
    if (userItem.id === user?.id) return false;
    // Cannot delete other super admins
    if (userItem.role === 'super_admin') return false;
    return true;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'super_admin':
        return 'role-badge role-super-admin';
      case 'admin':
        return 'role-badge role-admin';
      default:
        return 'role-badge role-member';
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      default:
        return 'Member';
    }
  };

  const getUserInitials = (userItem) => {
    if (userItem.display_name) {
      return userItem.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return userItem.username[0].toUpperCase();
  };

  const handleSaveMailSettings = async () => {
    // Validate based on provider
    if (mailSettings.mail_provider === 'smtp') {
      if (!mailSettings.smtp_host) {
        toast.error('SMTP host is required');
        return;
      }
      if (!mailSettings.from_email) {
        toast.error('From email address is required');
        return;
      }
    } else if (mailSettings.mail_provider === 'sendgrid') {
      if (!mailSettings.sendgrid_api_key_configured) {
        toast.error('SendGrid API key is not configured in the server environment');
        return;
      }
      if (!mailSettings.sendgrid_from_email) {
        toast.error('SendGrid from email address is required');
        return;
      }
    }

    setIsSavingMailSettings(true);
    try {
      const response = await mailApi.updateSettings(mailSettings);
      if (response.data) {
        setMailSettings({
          mail_provider: response.data.mail_provider || 'smtp',
          smtp_host: response.data.smtp_host || '',
          smtp_port: response.data.smtp_port || 587,
          smtp_secure: response.data.smtp_secure ?? true,
          smtp_username: response.data.smtp_username || '',
          smtp_password: response.data.smtp_password || '',
          from_email: response.data.from_email || '',
          from_name: response.data.from_name || 'Wayfinder',
          sendgrid_from_email: response.data.sendgrid_from_email || '',
          sendgrid_from_name: response.data.sendgrid_from_name || 'Wayfinder',
          sendgrid_api_key_configured: response.data.sendgrid_api_key_configured || false
        });
      }
      toast.success('Mail settings saved successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to save mail settings');
    } finally {
      setIsSavingMailSettings(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSendingTestEmail(true);
    try {
      await mailApi.sendTestEmail(testEmail);
      toast.success(`Test email sent to ${testEmail}`);
    } catch (error) {
      toast.error(error.message || 'Failed to send test email');
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await authApi.updateProfile({
        display_name: displayName.trim(),
        username: username.trim(),
      });
      updateUser(response.data.user);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Current password is required');
      return;
    }
    if (!newPassword) {
      toast.error('New password is required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate file size
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('File size must be less than 5 MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    setSelectedAvatarFile(file);
  };

  const handleAvatarUpload = async () => {
    if (!selectedAvatarFile) {
      toast.error('Please select an image first');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const response = await userApi.uploadAvatar(selectedAvatarFile);
      updateUser(response.data.user);
      setAvatarPreview(null);
      setSelectedAvatarFile(null);
      toast.success('Avatar updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!user?.avatar_url) return;

    setIsDeletingAvatar(true);
    try {
      const response = await userApi.deleteAvatar();
      updateUser(response.data.user);
      toast.success('Avatar removed successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to remove avatar');
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const handleCancelAvatarPreview = () => {
    setAvatarPreview(null);
    setSelectedAvatarFile(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleLogout = () => {
    resetNotifications();
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <button className="back-button" onClick={() => navigate('/dashboard')}>
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="settings-title">Settings</h1>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav">
            <button
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              Profile
            </button>
            <button
              className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Security
            </button>
            <button
              className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              Preferences
            </button>
            {user?.role === 'super_admin' && (
              <button
                className={`nav-item ${activeTab === 'mail' ? 'active' : ''}`}
                onClick={() => setActiveTab('mail')}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                Mail Server
              </button>
            )}
            {user?.role === 'super_admin' && (
              <button
                className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                User Management
              </button>
            )}
            <div className="nav-divider" />
            <button className="nav-item danger" onClick={handleLogout}>
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
              Sign Out
            </button>
          </nav>

          <div className="settings-content">
            {activeTab === 'profile' && (
              <div className="settings-panel">
                <h2 className="panel-title">Profile Settings</h2>
                <p className="panel-description">
                  Manage your account information and how others see you.
                </p>

                <div className="profile-section">
                  <div className="avatar-upload-section">
                    <div className="avatar-preview-container">
                      <div className="avatar-large-upload">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar preview" />
                        ) : user?.avatar_url ? (
                          <img src={user.avatar_url} alt={displayName} />
                        ) : (
                          <span className="avatar-initials">{(displayName || username || 'U')[0].toUpperCase()}</span>
                        )}
                        {avatarPreview && (
                          <div className="avatar-preview-badge">Preview</div>
                        )}
                      </div>
                      {!avatarPreview && (
                        <button
                          className="avatar-change-overlay"
                          onClick={() => avatarInputRef.current?.click()}
                          title="Change avatar"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" />
                          </svg>
                          <span>Change</span>
                        </button>
                      )}
                    </div>

                    <div className="avatar-controls">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleAvatarSelect}
                        className="avatar-file-input"
                        id="avatar-upload"
                      />

                      {avatarPreview ? (
                        <div className="avatar-preview-actions">
                          <button
                            className="btn btn-primary"
                            onClick={handleAvatarUpload}
                            disabled={isUploadingAvatar}
                          >
                            {isUploadingAvatar ? (
                              <>
                                <span className="upload-spinner"></span>
                                Uploading...
                              </>
                            ) : (
                              'Save Avatar'
                            )}
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={handleCancelAvatarPreview}
                            disabled={isUploadingAvatar}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="avatar-action-buttons">
                          <button
                            className="btn btn-secondary"
                            onClick={() => avatarInputRef.current?.click()}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            Upload Avatar
                          </button>
                          {user?.avatar_url && (
                            <button
                              className="btn btn-danger-outline"
                              onClick={handleAvatarDelete}
                              disabled={isDeletingAvatar}
                            >
                              {isDeletingAvatar ? 'Removing...' : 'Remove Avatar'}
                            </button>
                          )}
                        </div>
                      )}

                      <p className="avatar-requirements">
                        JPEG, PNG, or WebP. Max 5 MB.
                      </p>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="form-group">
                      <label>Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your display name"
                      />
                      <span className="form-hint">This is how others will see you</span>
                    </div>

                    <div className="form-group">
                      <label>Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Your username"
                      />
                      <span className="form-hint">Used for mentions and your profile URL</span>
                    </div>

                    <div className="form-group">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="disabled"
                      />
                      <span className="form-hint">Email cannot be changed</span>
                    </div>

                    <div className="form-actions">
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>

                {user?.role === 'super_admin' && (
                  <div className="admin-badge-section">
                    <div className="admin-badge">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Super Administrator</span>
                    </div>
                    <p className="admin-hint">You have full system access</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'security' && (
              <div className="settings-panel">
                <h2 className="panel-title">Security Settings</h2>
                <p className="panel-description">
                  Keep your account secure by using a strong password.
                </p>

                <div className="form-section">
                  <h3 className="section-subtitle">Change Password</h3>

                  <div className="form-group">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                    <span className="form-hint">Minimum 8 characters</span>
                  </div>

                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      className="btn btn-primary"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>

                <div className="security-info">
                  <h3 className="section-subtitle">Active Sessions</h3>
                  <div className="session-item current">
                    <div className="session-icon">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="session-info">
                      <span className="session-name">Current Session</span>
                      <span className="session-detail">This device - Active now</span>
                    </div>
                    <span className="badge badge-green">Current</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="settings-panel">
                <h2 className="panel-title">Preferences</h2>
                <p className="panel-description">
                  Customize your Wayfinder experience.
                </p>

                <div className="preference-section">
                  <h3 className="section-subtitle">Notifications</h3>
                  <div className="preference-item">
                    <div className="preference-info">
                      <span className="preference-label">Email Notifications</span>
                      <span className="preference-desc">Receive email updates about your boards</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="preference-item">
                    <div className="preference-info">
                      <span className="preference-label">Due Date Reminders</span>
                      <span className="preference-desc">Get notified before tasks are due</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="preference-section">
                  <h3 className="section-subtitle">Display</h3>
                  <div className="preference-item">
                    <div className="preference-info">
                      <span className="preference-label">Compact View</span>
                      <span className="preference-desc">Show more cards on screen</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="preference-item">
                    <div className="preference-info">
                      <span className="preference-label">Show Card IDs</span>
                      <span className="preference-desc">Display unique identifiers on cards</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="preference-section">
                  <h3 className="section-subtitle">Keyboard Shortcuts</h3>
                  <p className="preference-desc">
                    Press <kbd>?</kbd> anywhere in the app to see available keyboard shortcuts.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'mail' && user?.role === 'super_admin' && (
              <div className="settings-panel mail-settings-panel">
                <div className="panel-header-with-badge">
                  <div>
                    <h2 className="panel-title">Mail Server Configuration</h2>
                    <p className="panel-description">
                      Configure email settings for sending notifications. Choose between SMTP or SendGrid Web API.
                    </p>
                  </div>
                  <span className="super-admin-badge">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Super Admin Only
                  </span>
                </div>

                {isLoadingMailSettings ? (
                  <div className="mail-settings-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading mail settings...</span>
                  </div>
                ) : (
                  <>
                    {/* Mail Provider Selection */}
                    <div className="mail-settings-section">
                      <h3 className="section-subtitle">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                        Mail Provider
                      </h3>

                      <div className="mail-provider-selector">
                        <div className="provider-options">
                          <label className={`provider-option ${mailSettings.mail_provider === 'smtp' ? 'selected' : ''}`}>
                            <input
                              type="radio"
                              name="mail_provider"
                              value="smtp"
                              checked={mailSettings.mail_provider === 'smtp'}
                              onChange={(e) => setMailSettings({ ...mailSettings, mail_provider: e.target.value })}
                            />
                            <div className="provider-content">
                              <div className="provider-icon">
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="provider-info">
                                <span className="provider-name">SMTP Server</span>
                                <span className="provider-desc">Traditional email server connection</span>
                              </div>
                            </div>
                          </label>

                          <label className={`provider-option ${mailSettings.mail_provider === 'sendgrid' ? 'selected' : ''} ${!mailSettings.sendgrid_api_key_configured ? 'disabled' : ''}`}>
                            <input
                              type="radio"
                              name="mail_provider"
                              value="sendgrid"
                              checked={mailSettings.mail_provider === 'sendgrid'}
                              onChange={(e) => setMailSettings({ ...mailSettings, mail_provider: e.target.value })}
                              disabled={!mailSettings.sendgrid_api_key_configured}
                            />
                            <div className="provider-content">
                              <div className="provider-icon sendgrid">
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="provider-info">
                                <span className="provider-name">SendGrid Web API</span>
                                <span className="provider-desc">HTTP API (works on platforms blocking SMTP)</span>
                                {!mailSettings.sendgrid_api_key_configured && (
                                  <span className="provider-warning">API key not configured in server environment</span>
                                )}
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* SMTP Settings - shown when SMTP is selected */}
                    {mailSettings.mail_provider === 'smtp' && (
                      <>
                        <div className="mail-settings-section">
                          <h3 className="section-subtitle">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                            </svg>
                            SMTP Server Settings
                          </h3>

                          <div className="mail-form-grid">
                            <div className="form-group">
                              <label>SMTP Host <span className="required">*</span></label>
                              <input
                                type="text"
                                value={mailSettings.smtp_host}
                                onChange={(e) => setMailSettings({ ...mailSettings, smtp_host: e.target.value })}
                                placeholder="smtp.gmail.com"
                              />
                              <span className="form-hint">Your mail server hostname (e.g., smtp.gmail.com)</span>
                            </div>

                            <div className="form-group">
                              <label>SMTP Port</label>
                              <input
                                type="number"
                                value={mailSettings.smtp_port}
                                onChange={(e) => setMailSettings({ ...mailSettings, smtp_port: parseInt(e.target.value) || 587 })}
                                placeholder="587"
                                min="1"
                                max="65535"
                              />
                              <span className="form-hint">Common ports: 587 (TLS), 465 (SSL), 25 (insecure)</span>
                            </div>

                            <div className="form-group checkbox-group">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={mailSettings.smtp_secure}
                                  onChange={(e) => setMailSettings({ ...mailSettings, smtp_secure: e.target.checked })}
                                />
                                <span className="checkbox-custom"></span>
                                <span className="checkbox-text">
                                  Use Secure Connection (TLS/SSL)
                                  <span className="checkbox-hint">Enable for encrypted connections (recommended)</span>
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="mail-settings-section">
                          <h3 className="section-subtitle">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            Authentication
                          </h3>

                          <div className="mail-form-grid">
                            <div className="form-group">
                              <label>SMTP Username</label>
                              <input
                                type="text"
                                value={mailSettings.smtp_username}
                                onChange={(e) => setMailSettings({ ...mailSettings, smtp_username: e.target.value })}
                                placeholder="your-email@example.com"
                                autoComplete="off"
                              />
                              <span className="form-hint">Usually your email address</span>
                            </div>

                            <div className="form-group">
                              <label>SMTP Password</label>
                              <input
                                type="password"
                                value={mailSettings.smtp_password}
                                onChange={(e) => setMailSettings({ ...mailSettings, smtp_password: e.target.value })}
                                placeholder={mailSettings.smtp_password === '********' ? 'Password is set' : 'Enter password'}
                                autoComplete="new-password"
                              />
                              <span className="form-hint">For Gmail, use an App Password</span>
                            </div>
                          </div>
                        </div>

                        <div className="mail-settings-section">
                          <h3 className="section-subtitle">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                            Sender Information
                          </h3>

                          <div className="mail-form-grid">
                            <div className="form-group">
                              <label>From Email Address <span className="required">*</span></label>
                              <input
                                type="email"
                                value={mailSettings.from_email}
                                onChange={(e) => setMailSettings({ ...mailSettings, from_email: e.target.value })}
                                placeholder="noreply@example.com"
                              />
                              <span className="form-hint">Email address that will appear as the sender</span>
                            </div>

                            <div className="form-group">
                              <label>From Name</label>
                              <input
                                type="text"
                                value={mailSettings.from_name}
                                onChange={(e) => setMailSettings({ ...mailSettings, from_name: e.target.value })}
                                placeholder="Wayfinder"
                              />
                              <span className="form-hint">Display name for the sender</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* SendGrid Settings - shown when SendGrid is selected */}
                    {mailSettings.mail_provider === 'sendgrid' && (
                      <div className="mail-settings-section">
                        <h3 className="section-subtitle">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                          </svg>
                          SendGrid Configuration
                        </h3>

                        <div className="sendgrid-api-notice">
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <strong>API Key Status:</strong> {mailSettings.sendgrid_api_key_configured ? (
                              <span className="api-key-configured">Configured via SENDGRID_WEB_API_KEY environment variable</span>
                            ) : (
                              <span className="api-key-not-configured">Not configured - set SENDGRID_WEB_API_KEY in server environment</span>
                            )}
                          </div>
                        </div>

                        <div className="mail-form-grid">
                          <div className="form-group">
                            <label>From Email Address <span className="required">*</span></label>
                            <input
                              type="email"
                              value={mailSettings.sendgrid_from_email}
                              onChange={(e) => setMailSettings({ ...mailSettings, sendgrid_from_email: e.target.value })}
                              placeholder="wayfinder@yourdomain.com"
                            />
                            <span className="form-hint">Must be verified in your SendGrid account</span>
                          </div>

                          <div className="form-group">
                            <label>From Name</label>
                            <input
                              type="text"
                              value={mailSettings.sendgrid_from_name}
                              onChange={(e) => setMailSettings({ ...mailSettings, sendgrid_from_name: e.target.value })}
                              placeholder="Wayfinder"
                            />
                            <span className="form-hint">Display name for the sender</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mail-settings-actions">
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveMailSettings}
                        disabled={isSavingMailSettings}
                      >
                        {isSavingMailSettings ? (
                          <>
                            <span className="btn-spinner"></span>
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                            </svg>
                            Save Settings
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mail-test-section">
                      <h3 className="section-subtitle">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        Test Configuration
                      </h3>
                      <p className="section-description">
                        Send a test email to verify your SMTP configuration is working correctly.
                      </p>

                      <div className="test-email-form">
                        <div className="form-group test-email-input">
                          <label>Test Email Address</label>
                          <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="your-email@example.com"
                          />
                        </div>
                        <button
                          className="btn btn-secondary test-email-btn"
                          onClick={handleSendTestEmail}
                          disabled={isSendingTestEmail || !testEmail}
                        >
                          {isSendingTestEmail ? (
                            <>
                              <span className="btn-spinner"></span>
                              Sending...
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                              </svg>
                              Send Test Email
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'users' && user?.role === 'super_admin' && (
              <div className="settings-panel user-management-panel">
                <div className="panel-header-with-badge">
                  <div>
                    <h2 className="panel-title">User Management</h2>
                    <p className="panel-description">
                      Add, view, and manage user accounts in your Wayfinder instance.
                    </p>
                  </div>
                  <span className="super-admin-badge">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Super Admin Only
                  </span>
                </div>

                {/* Registration Settings Section */}
                <div className="user-management-section registration-settings-section">
                  <h3 className="section-subtitle">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    Registration Settings
                  </h3>

                  <div className="registration-approval-toggle">
                    <div className="toggle-info">
                      <span className="toggle-label">Require Approval for New Registrations</span>
                      <span className="toggle-description">
                        When enabled, new user registrations require Super Admin approval before users can login.
                        The first user (Super Admin) is always auto-approved.
                      </span>
                    </div>
                    <label className={`toggle-switch-large ${isUpdatingAppSettings || isLoadingAppSettings ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={appSettings.registration_requires_approval}
                        onChange={handleToggleRegistrationApproval}
                        disabled={isUpdatingAppSettings || isLoadingAppSettings}
                      />
                      <span className="toggle-slider-large"></span>
                    </label>
                  </div>

                  {appSettings.registration_requires_approval && (
                    <div className="approval-status-indicator enabled">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Registration approval is <strong>enabled</strong> - new users must be approved before they can login</span>
                    </div>
                  )}
                </div>

                {/* Pending Approvals Section */}
                {appSettings.registration_requires_approval && (
                  <div className="user-management-section pending-approvals-section">
                    <div className="pending-approvals-header">
                      <h3 className="section-subtitle">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        Pending Approvals
                        {pendingUsers.length > 0 && (
                          <span className="pending-count-badge">{pendingUsers.length}</span>
                        )}
                      </h3>
                    </div>

                    {pendingUsersLoading ? (
                      <div className="pending-users-loading">
                        <div className="loading-spinner"></div>
                        <span>Loading pending users...</span>
                      </div>
                    ) : pendingUsers.length === 0 ? (
                      <div className="pending-users-empty">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p>No pending approvals</p>
                        <span>All registration requests have been processed.</span>
                      </div>
                    ) : (
                      <div className="pending-users-list">
                        {pendingUsers.map((pendingUser) => (
                          <div key={pendingUser.id} className="pending-user-card">
                            <div className="pending-user-avatar">
                              {pendingUser.avatar_url ? (
                                <img src={pendingUser.avatar_url} alt={pendingUser.display_name || pendingUser.username} />
                              ) : (
                                <span>{getUserInitials(pendingUser)}</span>
                              )}
                            </div>
                            <div className="pending-user-info">
                              <span className="pending-user-name">{pendingUser.display_name || pendingUser.username}</span>
                              <span className="pending-user-username">@{pendingUser.username}</span>
                              <span className="pending-user-email">{pendingUser.email}</span>
                              <span className="pending-user-date">
                                Registered {formatDate(pendingUser.created_at)}
                              </span>
                            </div>
                            <div className="pending-user-actions">
                              <button
                                className="btn btn-approve"
                                onClick={() => handleApproveUser(pendingUser.id)}
                                disabled={isApprovingUser === pendingUser.id || isRejectingUser === pendingUser.id}
                              >
                                {isApprovingUser === pendingUser.id ? (
                                  <>
                                    <span className="btn-spinner"></span>
                                    Approving...
                                  </>
                                ) : (
                                  <>
                                    <svg viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Approve
                                  </>
                                )}
                              </button>
                              <button
                                className="btn btn-reject"
                                onClick={() => handleOpenRejectModal(pendingUser)}
                                disabled={isApprovingUser === pendingUser.id || isRejectingUser === pendingUser.id}
                              >
                                {isRejectingUser === pendingUser.id ? (
                                  <>
                                    <span className="btn-spinner"></span>
                                    Rejecting...
                                  </>
                                ) : (
                                  <>
                                    <svg viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Reject
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Create User Section */}
                <div className="user-management-section create-user-section">
                  <h3 className="section-subtitle">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                    </svg>
                    Create New User
                  </h3>

                  <form onSubmit={handleCreateUser} className="create-user-form">
                    <div className="create-user-grid">
                      <div className="form-group">
                        <label>Username <span className="required">*</span></label>
                        <input
                          type="text"
                          value={newUser.username}
                          onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                          placeholder="johndoe"
                          className={createUserErrors.username ? 'error' : ''}
                        />
                        {createUserErrors.username && (
                          <span className="form-error">{createUserErrors.username}</span>
                        )}
                        <span className="form-hint">3-30 characters, letters, numbers, underscore, dash</span>
                      </div>

                      <div className="form-group">
                        <label>Email Address <span className="required">*</span></label>
                        <input
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          placeholder="john@example.com"
                          className={createUserErrors.email ? 'error' : ''}
                        />
                        {createUserErrors.email && (
                          <span className="form-error">{createUserErrors.email}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Display Name</label>
                        <input
                          type="text"
                          value={newUser.display_name}
                          onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                          placeholder="John Doe"
                          className={createUserErrors.display_name ? 'error' : ''}
                        />
                        {createUserErrors.display_name && (
                          <span className="form-error">{createUserErrors.display_name}</span>
                        )}
                        <span className="form-hint">Optional, max 100 characters</span>
                      </div>

                      <div className="form-group">
                        <label>Role <span className="required">*</span></label>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          className={`role-select ${createUserErrors.role ? 'error' : ''}`}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                        {createUserErrors.role && (
                          <span className="form-error">{createUserErrors.role}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Password <span className="required">*</span></label>
                        <input
                          type="password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          placeholder="Enter password"
                          autoComplete="new-password"
                          className={createUserErrors.password ? 'error' : ''}
                        />
                        {newUser.password && (
                          <div className="password-strength">
                            <div className="password-strength-bar">
                              <div
                                className="password-strength-fill"
                                style={{
                                  width: `${(passwordStrength.level / 3) * 100}%`,
                                  backgroundColor: passwordStrength.color
                                }}
                              />
                            </div>
                            <span className="password-strength-label" style={{ color: passwordStrength.color }}>
                              {passwordStrength.label}
                            </span>
                          </div>
                        )}
                        {createUserErrors.password && (
                          <span className="form-error">{createUserErrors.password}</span>
                        )}
                        <span className="form-hint">Min 8 chars, uppercase, lowercase, number</span>
                      </div>

                      <div className="form-group">
                        <label>Confirm Password <span className="required">*</span></label>
                        <input
                          type="password"
                          value={newUser.confirmPassword}
                          onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                          placeholder="Confirm password"
                          autoComplete="new-password"
                          className={createUserErrors.confirmPassword ? 'error' : ''}
                        />
                        {createUserErrors.confirmPassword && (
                          <span className="form-error">{createUserErrors.confirmPassword}</span>
                        )}
                      </div>
                    </div>

                    <div className="create-user-actions">
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isCreatingUser}
                      >
                        {isCreatingUser ? (
                          <>
                            <span className="btn-spinner"></span>
                            Creating User...
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                            </svg>
                            Create User
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* User List Section */}
                <div className="user-management-section user-list-section">
                  <div className="user-list-header">
                    <h3 className="section-subtitle">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      All Users
                      <span className="user-count-badge">{usersPagination.total}</span>
                    </h3>

                    <div className="user-search">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="search-icon">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                      <input
                        type="text"
                        value={usersSearchInput}
                        onChange={(e) => setUsersSearchInput(e.target.value)}
                        placeholder="Search by username or email..."
                        className="user-search-input"
                      />
                      {usersSearchInput && (
                        <button
                          className="search-clear"
                          onClick={() => {
                            setUsersSearchInput('');
                            setUsersSearch('');
                          }}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {usersLoading ? (
                    <div className="users-loading">
                      <div className="loading-spinner"></div>
                      <span>Loading users...</span>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="users-empty">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <p>{usersSearch ? 'No users found matching your search.' : 'No users found.'}</p>
                    </div>
                  ) : (
                    <>
                      <div className="users-table-container">
                        <table className="users-table">
                          <thead>
                            <tr>
                              <th>User</th>
                              <th>Email</th>
                              <th>Role</th>
                              <th>Workspaces</th>
                              <th>Created</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map((userItem) => (
                              <tr key={userItem.id} className={userItem.id === user?.id ? 'current-user' : ''}>
                                <td>
                                  <div className="user-cell">
                                    <div className="user-avatar-small">
                                      {userItem.avatar_url ? (
                                        <img src={userItem.avatar_url} alt={userItem.display_name || userItem.username} />
                                      ) : (
                                        <span>{getUserInitials(userItem)}</span>
                                      )}
                                    </div>
                                    <div className="user-info">
                                      <span className="user-display-name">
                                        {userItem.display_name || userItem.username}
                                        {userItem.id === user?.id && <span className="you-badge">You</span>}
                                      </span>
                                      <span className="user-username">@{userItem.username}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="user-email">{userItem.email}</td>
                                <td>
                                  <span className={getRoleBadgeClass(userItem.role)}>
                                    {getRoleDisplayName(userItem.role)}
                                  </span>
                                </td>
                                <td className="user-workspace-count">{userItem.workspace_count}</td>
                                <td className="user-created">{formatDate(userItem.created_at)}</td>
                                <td>
                                  <button
                                    className="btn-delete-user"
                                    onClick={() => handleOpenDeleteModal(userItem)}
                                    disabled={!canDeleteUser(userItem)}
                                    title={
                                      userItem.id === user?.id
                                        ? 'Cannot delete your own account'
                                        : userItem.role === 'super_admin'
                                        ? 'Cannot delete Super Admin accounts'
                                        : 'Delete user'
                                    }
                                  >
                                    <svg viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {usersPagination.totalPages > 1 && (
                        <div className="users-pagination">
                          <button
                            className="pagination-btn"
                            onClick={() => setUsersPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                            disabled={usersPagination.page <= 1}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Previous
                          </button>
                          <span className="pagination-info">
                            Page {usersPagination.page} of {usersPagination.totalPages}
                          </span>
                          <button
                            className="pagination-btn"
                            onClick={() => setUsersPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                            disabled={usersPagination.page >= usersPagination.totalPages}
                          >
                            Next
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {deleteModalOpen && userToDelete && (
        <div className="modal-overlay" onClick={handleCloseDeleteModal}>
          <div className="delete-user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete User</h3>
              <button className="modal-close" onClick={handleCloseDeleteModal}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="delete-warning">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>This action cannot be undone!</span>
              </div>

              <p className="delete-message">
                Are you sure you want to delete this user? This will permanently remove:
              </p>

              <ul className="delete-consequences">
                <li>All workspaces they own</li>
                <li>All boards, lists, and cards in their workspaces</li>
                <li>All their comments and assignments</li>
                <li>All attachments and checklists</li>
              </ul>

              <div className="user-to-delete-info">
                <div className="user-avatar-medium">
                  {userToDelete.avatar_url ? (
                    <img src={userToDelete.avatar_url} alt={userToDelete.display_name || userToDelete.username} />
                  ) : (
                    <span>{getUserInitials(userToDelete)}</span>
                  )}
                </div>
                <div className="user-details">
                  <span className="user-name">{userToDelete.display_name || userToDelete.username}</span>
                  <span className="user-email-small">{userToDelete.email}</span>
                  <span className={getRoleBadgeClass(userToDelete.role)}>
                    {getRoleDisplayName(userToDelete.role)}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleCloseDeleteModal}
                disabled={isDeletingUser}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteUser}
                disabled={isDeletingUser}
              >
                {isDeletingUser ? (
                  <>
                    <span className="btn-spinner"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Delete User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject User Confirmation Modal */}
      {rejectModalOpen && userToReject && (
        <div className="modal-overlay" onClick={handleCloseRejectModal}>
          <div className="reject-user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reject Registration</h3>
              <button className="modal-close" onClick={handleCloseRejectModal}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="reject-warning">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>This action cannot be undone!</span>
              </div>

              <p className="reject-message">
                Are you sure you want to reject this registration request? The user's account will be permanently deleted.
              </p>

              <div className="user-to-reject-info">
                <div className="user-avatar-medium">
                  {userToReject.avatar_url ? (
                    <img src={userToReject.avatar_url} alt={userToReject.display_name || userToReject.username} />
                  ) : (
                    <span>{getUserInitials(userToReject)}</span>
                  )}
                </div>
                <div className="user-details">
                  <span className="user-name">{userToReject.display_name || userToReject.username}</span>
                  <span className="user-email-small">{userToReject.email}</span>
                  <span className="user-registered">Registered {formatDate(userToReject.created_at)}</span>
                </div>
              </div>

              <p className="reject-email-notice">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                An email notification will be sent to the user if mail is configured.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleCloseRejectModal}
                disabled={isRejectingUser}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleRejectUser}
                disabled={isRejectingUser}
              >
                {isRejectingUser ? (
                  <>
                    <span className="btn-spinner"></span>
                    Rejecting...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Reject Registration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
