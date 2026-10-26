import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatPatientId } from '../utils/patientUtils';
import {
  HeartPulse,
  LayoutDashboard,
  User,
  Stethoscope,
  Pill,
  LogOut,
  ChevronDown,
  CreditCard,
  Menu,
  X,
} from 'lucide-react';

const PatientLayout = ({ children, patientProfile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    setSidebarOpen(false);
    await logout();
    navigate('/login');
  };

  const pid = formatPatientId(patientProfile?.mobileNumber || user?.mobileNumber);
  const patientName = user?.name || patientProfile?.name || 'Patient';
  const profilePhoto = patientProfile?.profilePhoto || user?.profilePhoto;

  return (
    <div className="portal-layout-container">
      {/* MOBILE BACKDROP */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* LEFT SIDEBAR */}
      <aside className={`portal-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div>
          {/* BRAND */}
          <div className="portal-sidebar-brand">
            <div
              className="user-avatar-circle"
              style={{ background: 'var(--accent-emerald)', color: 'white', flexShrink: 0 }}
            >
              <HeartPulse size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nav-brand-title" style={{ fontSize: '1.15rem' }}>MEDWISE</div>
              <div
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  color: 'var(--accent-emerald)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Patient Portal
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              type="button"
              className="portal-mobile-toggle"
              onClick={() => setSidebarOpen(false)}
              style={{ marginLeft: 'auto' }}
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          </div>

          {/* NAVIGATION LINKS */}
          <nav className="portal-sidebar-nav">
            <NavLink
              to="/patient/dashboard"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/patient/profile"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <User size={18} />
              <span>My Profile</span>
            </NavLink>

            <NavLink
              to="/patient/consultations"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <Stethoscope size={18} />
              <span>My Consultations</span>
            </NavLink>

            <NavLink
              to="/patient/prescriptions"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <Pill size={18} />
              <span>My Prescriptions</span>
            </NavLink>
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="portal-sidebar-footer">
          <button
            id="sidebar-logout-btn"
            type="button"
            className="portal-logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN LAYOUT WRAPPER */}
      <div className="portal-main-wrapper">
        {/* TOPBAR */}
        <header className="portal-topbar">
          <div className="portal-topbar-left">
            <button
              type="button"
              className="portal-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span className="nav-brand-title" style={{ fontSize: '1.1rem' }}>MEDWISE</span>
              <span
                className="nav-brand-subtitle"
                style={{
                  background: 'var(--accent-emerald-light)',
                  color: 'var(--accent-emerald)',
                  borderColor: '#a7f3d0',
                }}
              >
                Clinical Portal
              </span>
            </div>
          </div>

          {/* TOP RIGHT PROFILE MENU */}
          <div className="profile-dropdown-wrapper" ref={dropdownRef}>
            <button
              id="top-profile-menu-trigger"
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
                    <CreditCard
                      size={12}
                      style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }}
                    />
                    {pid}
                  </div>
                </div>

                <div className="dropdown-divider" />

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

                <div className="dropdown-divider" />

                <button
                  type="button"
                  id="top-profile-logout-btn"
                  className="dropdown-item logout"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="portal-content-body">{children}</main>
      </div>
    </div>
  );
};

export default PatientLayout;
