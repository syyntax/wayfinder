import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import './AuthPages.css';

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [registrationPending, setRegistrationPending] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Access codes do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        displayName: formData.displayName || formData.username,
      });

      // Check if registration requires approval
      if (response.pending_approval) {
        setRegistrationPending(true);
        toast.success('Registration submitted - awaiting approval');
      } else {
        toast.success(response.message || 'Registration successful');
        navigate('/dashboard');
      }
    } catch (error) {
      const message = error.errors
        ? error.errors.map((e) => e.msg).join(', ')
        : error.message;
      toast.error(message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Show pending approval success screen
  if (registrationPending) {
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
              <p className="auth-subtitle">Registration Submitted</p>
            </div>

            <div className="registration-pending-content">
              <div className="pending-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h2>Awaiting Administrator Approval</h2>
              <p className="pending-message">
                Your operator profile has been submitted and is pending review by a system administrator.
              </p>
              <div className="pending-details">
                <div className="pending-detail-item">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <span>You will receive an email notification once your account is approved.</span>
                </div>
                <div className="pending-detail-item">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>This usually takes 1-2 business days. Contact your administrator for expedited access.</span>
                </div>
              </div>
              <Link to="/login" className="btn btn-primary btn-lg w-full">
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20 }}>
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Return to Login
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
            <p className="auth-subtitle">Operator Registration</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-row">
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
                <label htmlFor="username" className="form-label">
                  <span className="label-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </span>
                  Callsign
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="shadow_runner"
                  required
                  autoComplete="username"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="displayName" className="form-label">
                <span className="label-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                  </svg>
                </span>
                Display Name (Optional)
              </label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                placeholder="Your display name"
                autoComplete="name"
                className="form-input"
              />
            </div>

            <div className="form-row">
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
                  placeholder="Min 8 chars, mixed case + number"
                  required
                  autoComplete="new-password"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  <span className="label-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                  Confirm Code
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your access code"
                  required
                  autoComplete="new-password"
                  className="form-input"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Initializing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20 }}>
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
                  </svg>
                  Create Operator Profile
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already an Operator?{' '}
              <Link to="/login" className="auth-link">
                Access Terminal
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

export default RegisterPage;
