import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  Stethoscope,
  Pill,
  HeartPulse,
} from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('doctor'); // default role
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect based on profile status
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      if (user.profileCompleted === false) {
        navigate('/complete-profile', { replace: true });
      } else {
        const roleRoutes = {
          doctor: '/doctor/dashboard',
          pharmacist: '/pharmacist/dashboard',
          patient: '/patient/dashboard',
          admin: '/admin/appointments',
        };
        navigate(roleRoutes[user.role] || '/login', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 1. Required fields check
    if (!name.trim() || !email.trim() || !password || !confirmPassword || !role) {
      setError('Please fill in all required fields.');
      return;
    }

    // 2. Email format validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }

    // 3. Password length check
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    // 4. Password confirmation check
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    // 5. Role check
    if (!['doctor', 'pharmacist', 'patient'].includes(role)) {
      setError('Please select a valid role.');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      navigate('/complete-profile', { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Registration failed. Please try again.';
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

        {/* RIGHT REGISTRATION FORM PANEL */}
        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2 className="auth-heading">Create Your Account</h2>
            <p className="auth-subheading">Join the MedWise clinical care platform</p>
          </div>

          {error && (
            <div className="alert-box error" role="alert">
              <AlertCircle className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="register-name">
                Full Name
              </label>
              <div className="input-wrapper">
                <UserIcon className="input-icon-left" />
                <input
                  id="register-name"
                  type="text"
                  className="form-input has-left-icon"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-email">
                Email Address
              </label>
              <div className="input-wrapper">
                <Mail className="input-icon-left" />
                <input
                  id="register-email"
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
              <label className="form-label">Clinical Role</label>
              <div className="role-grid">
                <button
                  type="button"
                  className={`role-option-card ${role === 'doctor' ? 'selected' : ''}`}
                  onClick={() => setRole('doctor')}
                >
                  <Stethoscope className="role-icon" />
                  <span className="role-title">Doctor</span>
                </button>

                <button
                  type="button"
                  className={`role-option-card ${role === 'pharmacist' ? 'selected' : ''}`}
                  onClick={() => setRole('pharmacist')}
                >
                  <Pill className="role-icon" />
                  <span className="role-title">Pharmacist</span>
                </button>

                <button
                  type="button"
                  className={`role-option-card ${role === 'patient' ? 'selected' : ''}`}
                  onClick={() => setRole('patient')}
                >
                  <HeartPulse className="role-icon" />
                  <span className="role-title">Patient</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-password">
                Password
              </label>
              <div className="input-wrapper">
                <Lock className="input-icon-left" />
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input has-left-icon has-right-icon"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

            <div className="form-group">
              <label className="form-label" htmlFor="register-confirm-password">
                Confirm Password
              </label>
              <div className="input-wrapper">
                <Lock className="input-icon-left" />
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input has-left-icon has-right-icon"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="register-submit-btn"
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner-sm"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                'Create Account'
              )}
            </button>

            <div className="auth-footer-nav">
              Already have an account?{' '}
              <Link to="/login" style={{ fontWeight: 600 }}>
                Sign In
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
              <Link to="/admin/register" style={{ color: 'var(--accent-teal)', fontWeight: 700 }}>
                Admin Account Registration
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
