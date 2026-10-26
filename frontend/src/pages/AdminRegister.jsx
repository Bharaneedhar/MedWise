import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
  Building2,
} from 'lucide-react';

const AdminRegister = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, isAuthenticated, user } = useAuth();
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

    // 1. Validate required fields
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please provide Name, Email, and Password.');
      return;
    }

    // 2. Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please provide a valid administrative email address.');
      return;
    }

    // 3. Validate password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    // 4. Validate password confirmation
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Admin registration requires only name, email, password, and role 'admin'
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role: 'admin',
      });
      // Admin does not need profile completion; redirect straight to appointments portal
      navigate('/admin/appointments', { replace: true });
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Registration failed. Please try again.';
      setError(msg);
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
              <Shield className="brand-logo-icon" />
              <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.85rem' }}>
                ADMINISTRATION DESK
              </span>
            </div>

            <h1 className="brand-title">MEDWISE</h1>
            <h2 className="brand-subtitle">Hospital Admin Registration</h2>

            <p className="brand-description">
              Create an administrative account to oversee outpatient patient verification, admission vitals, and physician appointment scheduling.
            </p>

            <ul className="brand-highlights">
              <li className="brand-highlight-item">
                <CheckCircle2 className="highlight-check-icon" />
                <span>Outpatient Registration & Scheduling</span>
              </li>
              <li className="brand-highlight-item">
                <CheckCircle2 className="highlight-check-icon" />
                <span>Pre-Consultation Vitals Recording</span>
              </li>
              <li className="brand-highlight-item">
                <CheckCircle2 className="highlight-check-icon" />
                <span>Doctor Daily Schedule Integration</span>
              </li>
            </ul>
          </div>

          <div className="brand-footer">
            <span>MedWise Administrative Security</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={16} />
              <span>JWT Encrypted</span>
            </div>
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2 className="auth-heading">Register Administrator</h2>
            <p className="auth-subheading">
              Enter your official name and credentials to create an admin account.
            </p>
          </div>

          {error && (
            <div className="alert-box error" role="alert" style={{ marginBottom: '1.25rem' }}>
              <AlertCircle className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-name">
                Full Name
              </label>
              <div className="input-with-icon">
                <User className="input-icon" size={18} />
                <input
                  id="admin-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-reg-email">
                Official Email Address
              </label>
              <div className="input-with-icon">
                <Mail className="input-icon" size={18} />
                <input
                  id="admin-reg-email"
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
              <label className="form-label" htmlFor="admin-reg-password">
                Password (min. 6 characters)
              </label>
              <div className="input-with-icon">
                <Lock className="input-icon" size={18} />
                <input
                  id="admin-reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Create secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

            {/* Confirm Password Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-reg-confirm-password">
                Confirm Password
              </label>
              <div className="input-with-icon">
                <Lock className="input-icon" size={18} />
                <input
                  id="admin-reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="admin-register-submit"
              className="btn-primary auth-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Admin Account...' : 'Complete Admin Registration'}
            </button>
          </form>

          {/* Links */}
          <div className="auth-switch-prompt" style={{ marginTop: '1.5rem' }}>
            <span>Already have an administrator account? </span>
            <Link to="/admin/login" className="auth-switch-link" style={{ color: 'var(--accent-teal)' }}>
              Sign In as Admin
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

export default AdminRegister;
