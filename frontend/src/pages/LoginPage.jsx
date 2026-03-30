import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { passwordResetApi } from '../utils/api';
import './AuthPages.css';

function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      await passwordResetApi.requestReset(email);
      setIsSuccess(true);
    } catch (error) {
      if (error.status === 503) {
        toast.error('Password reset is not available. Please contact support.');
      } else {
        // For security, show success message even on most errors
        setIsSuccess(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setIsSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content forgot-password-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose} aria-label="Close modal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="modal-header">
          <div className="modal-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="modal-title">Reset Access Code</h2>
          <p className="modal-subtitle">
            {isSuccess
              ? 'Check your inbox for instructions'
              : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {isSuccess ? (
          <div className="forgot-password-success">
            <div className="success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="success-message">
              If an account exists with that email, a password reset link has been sent.
            </p>
            <p className="success-note">
              The link will expire in 1 hour. Please check your spam folder if you don't see it.
            </p>
            <button className="btn btn-primary w-full" onClick={handleClose}>
              Return to Login
            </button>
          </div>
        ) : (
          <form className="forgot-password-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reset-email" className="form-label">
                <span className="label-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </span>
                Email Address
              </label>
              <input
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@wayfinder.io"
                required
                autoComplete="email"
                className="form-input"
                autoFocus
              />
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Sending...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Send Reset Link
                </>
              )}
            </button>

            <button type="button" className="btn btn-ghost w-full" onClick={handleClose}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear pending approval state when user modifies form
    if (pendingApproval) {
      setPendingApproval(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setPendingApproval(false);

    try {
      await login(formData.email, formData.password);
      toast.success('Welcome back, Operator.');
      navigate('/dashboard');
    } catch (error) {
      // Check if error indicates pending approval
      if (error.status === 403 && error.data?.pending_approval) {
        setPendingApproval(true);
      } else {
        toast.error(error.message || 'Authentication failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="grid-overlay"></div>
      </div>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <svg viewBox="0 0 100 100" className="logo-svg">
                <defs>
                  <linearGradient id="authGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b3daf" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="35" fill="none" stroke="url(#authGlow)" strokeWidth="2" />
                <circle cx="50" cy="50" r="25" fill="none" stroke="url(#authGlow)" strokeWidth="1.5" strokeDasharray="4 2" />
                <path d="M50 15 L55 30 L50 25 L45 30 Z" fill="url(#authGlow)" />
                <path d="M50 85 L45 70 L50 75 L55 70 Z" fill="url(#authGlow)" />
                <path d="M15 50 L30 45 L25 50 L30 55 Z" fill="url(#authGlow)" />
                <path d="M85 50 L70 55 L75 50 L70 45 Z" fill="url(#authGlow)" />
                <circle cx="50" cy="50" r="8" fill="url(#authGlow)" />
                <circle cx="50" cy="50" r="4" fill="#0a0a0f" />
              </svg>
            </div>
            <h1 className="auth-title">WAYFINDER</h1>
            <p className="auth-subtitle">Access Terminal</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                <span className="label-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </span>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="operator@wayfinder.io"
                required
                autoComplete="email"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <span className="label-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
                Access Code
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your access code"
                required
                autoComplete="current-password"
                className="form-input"
              />
            </div>

            {pendingApproval && (
              <div className="pending-approval-alert">
                <div className="alert-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="alert-content">
                  <strong>Account Pending Approval</strong>
                  <p>Your account is awaiting administrator approval. You will be notified by email once your account is approved.</p>
                </div>
              </div>
            )}

            <div className="forgot-password-link">
              <button
                type="button"
                className="text-link"
                onClick={() => setShowForgotPassword(true)}
              >
                Forgot your access code?
              </button>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isLoading || pendingApproval}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Authenticating...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20 }}>
                    <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Initialize Session
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              New Operator?{' '}
              <Link to="/register" className="auth-link">
                Request Access
              </Link>
            </p>
          </div>
        </div>

        <div className="auth-decorations">
          <div className="circuit-line circuit-1"></div>
          <div className="circuit-line circuit-2"></div>
          <div className="circuit-line circuit-3"></div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </div>
  );
}

export default LoginPage;
