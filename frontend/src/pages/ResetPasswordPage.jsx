import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { passwordResetApi } from '../utils/api';
import './AuthPages.css';

/**
 * Calculate password strength score (0-4)
 * 0 = Very Weak, 1 = Weak, 2 = Fair, 3 = Good, 4 = Strong
 */
function calculatePasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };

  let score = 0;

  // Length checks
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;

  // Character variety checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 0.5;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 0.5;

  // Normalize to 0-4 scale
  score = Math.min(4, Math.floor(score));

  const levels = [
    { label: 'Very Weak', color: '#ef4444' },
    { label: 'Weak', color: '#f97316' },
    { label: 'Fair', color: '#eab308' },
    { label: 'Good', color: '#22c55e' },
    { label: 'Strong', color: '#06b6d4' },
  ];

  return {
    score,
    label: levels[score].label,
    color: levels[score].color,
  };
}

function PasswordStrengthIndicator({ password }) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="password-strength">
      <div className="strength-bars">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`strength-bar ${index <= strength.score - 1 ? 'active' : ''}`}
            style={{
              backgroundColor: index <= strength.score - 1 ? strength.color : undefined,
            }}
          />
        ))}
      </div>
      <span className="strength-label" style={{ color: strength.color }}>
        {strength.label}
      </span>
    </div>
  );
}

function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({
    password: '',
    confirmPassword: '',
  });

  // Verify token on mount
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setErrorMessage('Invalid reset link. Please request a new password reset.');
        setIsVerifying(false);
        return;
      }

      try {
        await passwordResetApi.verifyToken(token);
        setIsValidToken(true);
      } catch (error) {
        setErrorMessage(
          error.message ||
          'This password reset link is invalid or has expired. Please request a new one.'
        );
      } finally {
        setIsVerifying(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear errors as user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = { password: '', confirmPassword: '' };
    let isValid = true;

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain a lowercase letter';
      isValid = false;
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain an uppercase letter';
      isValid = false;
    } else if (!/\d/.test(formData.password)) {
      newErrors.password = 'Password must contain a number';
      isValid = false;
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await passwordResetApi.resetPassword(token, formData.password);
      setIsSuccess(true);
      toast.success('Password reset successful!');

      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Password reset successful. Please log in with your new password.' },
        });
      }, 3000);
    } catch (error) {
      toast.error(error.message || 'Failed to reset password');
      if (error.message?.includes('expired') || error.message?.includes('invalid')) {
        setIsValidToken(false);
        setErrorMessage(error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while verifying token
  if (isVerifying) {
    return (
      <div className="auth-page">
        <div className="auth-background">
          <div className="grid-overlay"></div>
        </div>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-logo">
                <svg viewBox="0 0 100 100" className="logo-svg spinning">
                  <defs>
                    <linearGradient id="loadingGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b3daf" />
                      <stop offset="50%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="35" fill="none" stroke="url(#loadingGlow)" strokeWidth="2" />
                  <circle cx="50" cy="50" r="25" fill="none" stroke="url(#loadingGlow)" strokeWidth="1.5" strokeDasharray="4 2" />
                </svg>
              </div>
              <h1 className="auth-title">WAYFINDER</h1>
              <p className="auth-subtitle">Verifying Reset Link...</p>
            </div>
            <div className="loading-indicator">
              <div className="pulse-ring"></div>
              <p>Please wait while we verify your reset link</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Invalid or expired token state
  if (!isValidToken && !isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-background">
          <div className="grid-overlay"></div>
        </div>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-logo error-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="error-icon">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1 className="auth-title">Link Invalid</h1>
              <p className="auth-subtitle">Unable to process reset request</p>
            </div>

            <div className="error-content">
              <p className="error-message">{errorMessage}</p>
              <div className="error-actions">
                <Link to="/login" className="btn btn-primary btn-lg w-full">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Return to Login
                </Link>
              </div>
            </div>
          </div>
          <div className="auth-decorations">
            <div className="circuit-line circuit-1"></div>
            <div className="circuit-line circuit-2"></div>
            <div className="circuit-line circuit-3"></div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-background">
          <div className="grid-overlay"></div>
        </div>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-logo success-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="success-icon">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h1 className="auth-title">Success</h1>
              <p className="auth-subtitle">Password Reset Complete</p>
            </div>

            <div className="success-content">
              <p className="success-message">
                Your password has been successfully reset.
              </p>
              <p className="success-note">
                Redirecting you to the login page in a moment...
              </p>
              <Link to="/login" className="btn btn-primary btn-lg w-full">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                Go to Login Now
              </Link>
            </div>
          </div>
          <div className="auth-decorations">
            <div className="circuit-line circuit-1"></div>
            <div className="circuit-line circuit-2"></div>
            <div className="circuit-line circuit-3"></div>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
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
                  <linearGradient id="resetGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8b3daf" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="35" fill="none" stroke="url(#resetGlow)" strokeWidth="2" />
                <circle cx="50" cy="50" r="25" fill="none" stroke="url(#resetGlow)" strokeWidth="1.5" strokeDasharray="4 2" />
                <path d="M50 15 L55 30 L50 25 L45 30 Z" fill="url(#resetGlow)" />
                <path d="M50 85 L45 70 L50 75 L55 70 Z" fill="url(#resetGlow)" />
                <path d="M15 50 L30 45 L25 50 L30 55 Z" fill="url(#resetGlow)" />
                <path d="M85 50 L70 55 L75 50 L70 45 Z" fill="url(#resetGlow)" />
                <circle cx="50" cy="50" r="8" fill="url(#resetGlow)" />
                <circle cx="50" cy="50" r="4" fill="#0a0a0f" />
              </svg>
            </div>
            <h1 className="auth-title">WAYFINDER</h1>
            <p className="auth-subtitle">Create New Access Code</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <span className="label-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                </span>
                New Access Code
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter new access code"
                  required
                  autoComplete="new-password"
                  className={`form-input ${errors.password ? 'input-error' : ''}`}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <PasswordStrengthIndicator password={formData.password} />
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                <span className="label-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
                Confirm Access Code
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new access code"
                  required
                  autoComplete="new-password"
                  className={`form-input ${errors.confirmPassword ? 'input-error' : ''}`}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
              {formData.confirmPassword && formData.password === formData.confirmPassword && !errors.confirmPassword && (
                <span className="field-success">Passwords match</span>
              )}
            </div>

            <div className="password-requirements">
              <p className="requirements-title">Password requirements:</p>
              <ul className="requirements-list">
                <li className={formData.password.length >= 8 ? 'met' : ''}>
                  At least 8 characters
                </li>
                <li className={/[A-Z]/.test(formData.password) ? 'met' : ''}>
                  One uppercase letter
                </li>
                <li className={/[a-z]/.test(formData.password) ? 'met' : ''}>
                  One lowercase letter
                </li>
                <li className={/\d/.test(formData.password) ? 'met' : ''}>
                  One number
                </li>
              </ul>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner"></span>
                  Resetting Password...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Reset Access Code
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Remember your password?{' '}
              <Link to="/login" className="auth-link">
                Return to Login
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
    </div>
  );
}

export default ResetPasswordPage;
