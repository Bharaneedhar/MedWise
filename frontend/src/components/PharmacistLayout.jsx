import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Pill,
  LayoutDashboard,
  ClipboardList,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';

const PharmacistLayout = ({ children }) => {
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

  const pharmacistName = user?.name || 'Licensed Pharmacist';

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
              style={{ background: '#0d9488', color: 'white', flexShrink: 0 }}
            >
              <Pill size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nav-brand-title" style={{ fontSize: '1.15rem' }}>MEDWISE</div>
              <div
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  color: '#0d9488',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Pharmacy Portal
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
              to="/pharmacist/dashboard"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/pharmacist/prescriptions"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <ClipboardList size={18} />
              <span>Prescription Queue</span>
            </NavLink>
          </nav>
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="portal-sidebar-footer">
          <button
            id="pharmacist-sidebar-logout-btn"
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
                  background: '#ccfbf1',
                  color: '#0f766e',
                  borderColor: '#99f6e4',
                }}
              >
                Dispensing & Delivery Portal
              </span>
            </div>
          </div>

          {/* TOP RIGHT PHARMACIST PROFILE MENU */}
          <div className="profile-dropdown-wrapper" ref={dropdownRef}>
            <button
              id="pharmacist-profile-dropdown-trigger"
              type="button"
              className={`profile-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <div
                className="user-avatar-circle"
                style={{ background: '#0d9488', color: 'white', fontWeight: 700 }}
              >
                {pharmacistName.charAt(0).toUpperCase()}
              </div>

              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                <span className="user-name" style={{ fontSize: '0.85rem' }}>{pharmacistName}</span>
                <span className="user-role-badge" style={{ color: '#0d9488', fontSize: '0.7rem' }}>Licensed Pharmacist</span>
              </div>

              <ChevronDown size={16} style={{ color: 'var(--slate-400)', marginLeft: '0.25rem' }} />
            </button>

            {/* DROPDOWN MENU */}
            {dropdownOpen && (
              <div className="profile-dropdown-menu">
                <div style={{ padding: '0.5rem 0.85rem', borderBottom: '1px solid var(--slate-100)', marginBottom: '0.35rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--slate-900)' }}>{pharmacistName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{user?.email || 'pharmacist@medwise.com'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 600, marginTop: '0.15rem' }}>Pharmacy Dispensing Role</div>
                </div>

                <button
                  id="pharmacist-dropdown-logout-btn"
                  type="button"
                  className="dropdown-item logout"
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
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

export default PharmacistLayout;
