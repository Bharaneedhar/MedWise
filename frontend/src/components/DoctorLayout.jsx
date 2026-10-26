import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../services/profileService';
import {
  Stethoscope,
  LayoutDashboard,
  Users,
  Calendar,
  Pill,
  AlertTriangle,
  BarChart3,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Award,
} from 'lucide-react';

const DoctorLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState(null);

  const dropdownRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDocProfile = async () => {
      try {
        const data = await getMyProfile();
        if (isMounted && data && data.profile) {
          setDoctorProfile(data.profile);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Doctor profile load note:', err.message);
        }
      }
    };
    fetchDocProfile();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const doctorName = user?.name || doctorProfile?.name || 'Dr. Physician';
  const specialization = doctorProfile?.specialization || 'General Medicine';
  const regNumber = doctorProfile?.medicalRegistrationNumber || 'Reg. Verified';
  const profilePhoto = doctorProfile?.profilePhoto || user?.profilePhoto;

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
              style={{ background: 'var(--primary-600)', color: 'white', flexShrink: 0 }}
            >
              <Stethoscope size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nav-brand-title" style={{ fontSize: '1.15rem' }}>MEDWISE</div>
              <div
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  color: 'var(--primary-600)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Doctor Portal
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
              to="/doctor/dashboard"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/doctor/patients"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <Users size={18} />
              <span>My Patients</span>
            </NavLink>

            <NavLink
              to="/doctor/consultations"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <Calendar size={18} />
              <span>Consultations</span>
            </NavLink>

            <NavLink
              to="/doctor/prescriptions"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <Pill size={18} />
              <span>Prescriptions</span>
            </NavLink>

            <NavLink
              to="/doctor/medwise-reviews"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <AlertTriangle size={18} />
              <span>MedWise Reviews</span>
            </NavLink>

            <NavLink
              to="/doctor/clinical-overview"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <BarChart3 size={18} />
              <span>Clinical Overview</span>
            </NavLink>

            <NavLink
              to="/doctor/profile"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <User size={18} />
              <span>My Profile</span>
            </NavLink>
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="portal-sidebar-footer">
          <button
            id="doctor-sidebar-logout-btn"
            type="button"
            className="portal-logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
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
                  background: 'var(--primary-50)',
                  color: 'var(--primary-700)',
                  borderColor: 'var(--primary-200)',
                }}
              >
                Clinical Decision Support
              </span>
            </div>
          </div>

          {/* TOP RIGHT DOCTOR PROFILE MENU */}
          <div className="profile-dropdown-wrapper" ref={dropdownRef}>
            <button
              id="doctor-profile-dropdown-trigger"
              type="button"
              className={`profile-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt={doctorName}
                  className="user-avatar-circle"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="user-avatar-circle"
                  style={{ background: 'var(--primary-100)', color: 'var(--primary-700)' }}
                >
                  {doctorName.replace(/^Dr\.\s*/i, '').charAt(0).toUpperCase() || 'D'}
                </div>
              )}

              <div className="user-details" style={{ textAlign: 'left' }}>
                <span className="user-name">{doctorName}</span>
                <span className="user-role-tag" style={{ color: 'var(--primary-600)' }}>
                  {specialization}
                </span>
              </div>

              <ChevronDown size={14} style={{ color: 'var(--slate-400)', marginLeft: '0.25rem' }} />
            </button>

            {dropdownOpen && (
              <div className="profile-dropdown-menu" role="menu" style={{ width: '290px' }}>
                <div className="dropdown-user-header">
                  <div className="dropdown-user-name">{doctorName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>
                    {specialization}
                  </div>
                  <div
                    className="dropdown-pid-badge"
                    style={{
                      background: 'var(--primary-50)',
                      color: 'var(--primary-700)',
                      marginTop: '0.4rem',
                    }}
                  >
                    <Award size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                    Reg: {regNumber}
                  </div>
                </div>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/doctor/profile');
                  }}
                >
                  <User size={16} />
                  <span>My Profile</span>
                </button>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  id="doctor-top-logout-btn"
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

        {/* BODY */}
        <main className="portal-content-body">{children}</main>
      </div>
    </div>
  );
};

export default DoctorLayout;
