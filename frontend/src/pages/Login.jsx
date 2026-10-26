import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Stethoscope,
} from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Helper to redirect to correct destination based on role and profile status
  const redirectAfterAuth = (currentUser) => {
    if (!currentUser) return;

    if (currentUser.profileCompleted === false) {
      navigate('/complete-profile', { replace: true });
      return;
    }

    const roleRoutes = {
      doctor: '/doctor/dashboard',
      pharmacist: '/pharmacist/dashboard',
      patient: '/patient/dashboard',
      admin: '/admin/appointments',
    };
    const destination = roleRoutes[currentUser.role] || '/login';
    navigate(destination, { replace: true });
  };

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      redirectAfterAuth(user);
    }
  }, [isAuthenticated, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Frontend validation
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const loggedInUser = await login({ email: email.trim(), password });
      redirectAfterAuth(loggedInUser);
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* LEFT BRANDING PANEL */}
        <div className="auth-branding-panel">
          <div className="brand-header">
            <div className="brand-logo-badge">
              <Stethoscope className="brand-logo-icon" />
              <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.85rem' }}>
                CLINICAL PORTAL
              </span>
            </div>

            <h1 className="brand-title">MEDWISE</h1>
            <h2 className="brand-subtitle">Clinical Decision Support Portal</h2>

            <p className="brand-description">
              Supporting safer and more informed outpatient prescription management through clinical decision support and medication safety alerts.
            </p>

            <ul className="brand-highlights">
              <li className="brand-highlight-item">
                <CheckCircle2 className="highlight-check-icon" />
                <span>Prescription Auditing</span>
              </li>
              <li className="brand-highlight-item">
                <CheckCircle2 className="highlight-check-icon" />
                <span>Drug Interaction Alerts</span>
              </li>
              <li className="brand-highlight-item">
                <CheckCircle2 className="highlight-check-icon" />
                <span>Clinical Review</span>
              </li>
            </ul>
          </div>

          <div className="brand-footer">
            <span>MedWise Clinical Security Standard</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={16} />
              <span>JWT Encrypted</span>
            </div>
          </div>
        </div>

        {/* RIGHT AUTHENTICATION FORM PANEL */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2 className="auth-heading">Welcome Back</h2>
            <p className="auth-subheading">Sign in to continue to MedWise</p>
          </div>

          {error && (
            <div className="alert-box error" role="alert">
              <AlertCircle className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="email-input">
                Email Address
              </label>
              <div className="input-wrapper">
                <Mail className="input-icon-left" />
                <input
                  id="email-input"
                  type="email"
                  className="form-input has-left-icon"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password-input">
                Password
              </label>
              <div className="input-wrapper">
                <Lock className="input-icon-left" />
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input has-left-icon has-right-icon"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner-sm"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="auth-footer-nav">
              Don't have an account?{' '}
              <Link to="/register" style={{ fontWeight: 600 }}>
                Create Account
              </Link>
            </div>

            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--slate-200)',
                textAlign: 'center',
                fontSize: '0.8rem',
              }}
            >
              <span style={{ color: 'var(--slate-500)' }}>Hospital Administrator? </span>
              <Link to="/admin/login" style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>
                Admin Appointment Desk
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
