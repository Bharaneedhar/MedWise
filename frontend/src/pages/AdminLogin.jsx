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
  Shield,
  Calendar,
  Building2,
} from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in as admin, redirect to admin appointments
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      navigate('/admin/appointments', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide both administrative email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      const loggedInUser = await login({ email: email.trim(), password });
      if (loggedInUser.role === 'admin') {
        navigate('/admin/appointments', { replace: true });
      } else {
        // If non-admin logged in via admin page, redirect to appropriate role portal
        const roleRoutes = {
          doctor: '/doctor/dashboard',
          pharmacist: '/pharmacist/dashboard',
          patient: '/patient/dashboard',
        };
        navigate(roleRoutes[loggedInUser.role] || '/', { replace: true });
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Authentication failed. Please verify credentials.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* LEFT BRANDING PANEL */}
        <div className="auth-branding-panel" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #115e59 100%)' }}>
          <div className="brand-header">
            <div className="brand-logo-badge" style={{ background: 'rgba(255, 255, 255, 0.2)' }}>
              <Shield className="brand-logo-icon" />
              <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.85rem' }}>
                ADMINISTRATION PORTAL
              </span>
            </div>

            <h1 className="brand-title">MEDWISE</h1>
            <h2 className="brand-subtitle">Appointment & Outpatient Scheduling Desk</h2>

            <p className="brand-description">
              Secure administrative access for outpatient patient identification, vital measurement recording, and confirmed physician appointment booking.
            </p>

            <ul className="brand-highlights">
              <li className="brand-highlight-item">
                <CheckCircle2 className="brand-highlight-icon" />
                <span>Patient PID lookup directly against MongoDB records</span>
              </li>
              <li className="brand-highlight-item">
                <CheckCircle2 className="brand-highlight-icon" />
                <span>Admission vitals recording with unit integrity</span>
              </li>
              <li className="brand-highlight-item">
                <CheckCircle2 className="brand-highlight-icon" />
                <span>Real-time conflict prevention for physician schedules</span>
              </li>
            </ul>
          </div>

          <div className="brand-footer-text">
            MedWise Clinical &bull; Hospital Administration &bull; Authorized Personnel Only
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Admin Sign In</h2>
            <p className="auth-form-subtitle">
              Enter hospital administrator credentials to manage appointment booking.
            </p>
          </div>

          {error && (
            <div className="alert-box error" role="alert" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Email Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-email">
                Administrator Email Address
              </label>
              <div className="input-with-icon">
                <Mail className="input-icon" size={18} />
                <input
                  id="admin-email"
                  type="email"
                  className="form-input"
                  placeholder="admin@medwise.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-password">
                Password
              </label>
              <div className="input-with-icon">
                <Lock className="input-icon" size={18} />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="admin-login-submit"
              className="btn-primary auth-submit-btn"
              disabled={isSubmitting}
              style={{ background: 'var(--accent-teal)' }}
            >
              {isSubmitting ? 'Authenticating Admin...' : 'Sign In as Administrator'}
            </button>
          </form>

          {/* Links */}
          <div className="auth-switch-prompt" style={{ marginTop: '1.5rem' }}>
            <span>Need an administrator account? </span>
            <Link to="/admin/register" className="auth-switch-link" style={{ color: 'var(--accent-teal)' }}>
              Register as Admin
            </Link>
          </div>

          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--slate-200)',
              textAlign: 'center',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ color: 'var(--slate-500)' }}>Physician, Pharmacist or Patient? </span>
            <Link to="/login" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
              Return to Clinical Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
