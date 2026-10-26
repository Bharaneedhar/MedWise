import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPatientId } from '../utils/patientUtils';
import {
  HeartPulse,
  User,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  CreditCard,
} from 'lucide-react';

const PatientNavbar = ({ patientProfile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  const pid = formatPatientId(patientProfile?.mobileNumber || user?.mobileNumber);
  const patientName = user?.name || patientProfile?.name || 'Patient';
  const profilePhoto = patientProfile?.profilePhoto || user?.profilePhoto;

  return (
    <header className="patient-navbar">
      {/* BRAND */}
      <div className="nav-brand">
        <Link to="/patient/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <div className="user-avatar-circle" style={{ background: 'var(--accent-emerald)', color: 'white' }}>
            <HeartPulse size={18} />
          </div>
          <div>
            <div className="nav-brand-title">MEDWISE</div>
          </div>
          <span className="nav-brand-subtitle" style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)', borderColor: '#a7f3d0' }}>
            Patient Portal
          </span>
        </Link>
      </div>

      {/* NAV LINKS & USER MENU */}
      <div className="nav-user-actions">
        <nav className="nav-links-group">
          <Link
            to="/patient/dashboard"
            className={`nav-link-item ${location.pathname === '/patient/dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/patient/profile"
            className={`nav-link-item ${location.pathname === '/patient/profile' ? 'active' : ''}`}
          >
            <User size={16} />
            <span>My Profile</span>
          </Link>
        </nav>

        {/* PROFILE DROPDOWN */}
        <div className="profile-dropdown-wrapper" ref={dropdownRef}>
          <button
            id="patient-profile-dropdown-trigger"
            type="button"
            className={`profile-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt={patientName}
                className="user-avatar-circle"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div
                className="user-avatar-circle"
                style={{ background: 'var(--accent-emerald-light)', color: 'var(--accent-emerald)' }}
              >
                {patientName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="user-details" style={{ textAlign: 'left' }}>
              <span className="user-name">{patientName}</span>
              <span className="user-role-tag" style={{ color: 'var(--accent-emerald)' }}>
                {pid}
              </span>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--slate-400)', marginLeft: '0.25rem' }} />
          </button>

          {dropdownOpen && (
            <div className="profile-dropdown-menu" role="menu">
              <div className="dropdown-user-header">
                <div className="dropdown-user-name">{patientName}</div>
                <div className="dropdown-pid-badge">
                  <CreditCard size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                  {pid}
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/patient/profile');
                }}
              >
                <User size={16} />
                <span>My Profile</span>
              </button>

              <div className="dropdown-divider"></div>

              <button
                type="button"
                id="patient-logout-btn"
                className="dropdown-item logout"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default PatientNavbar;
