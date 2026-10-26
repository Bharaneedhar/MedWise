import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';

const AdminLayout = ({ children }) => {
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
    navigate('/admin/login');
  };

  const adminName = user?.name || 'Administrator';
  const adminEmail = user?.email || 'admin@medwise.org';

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
              style={{ background: 'var(--accent-teal)', color: 'white', flexShrink: 0 }}
            >
              <Shield size={18} />
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-title">MEDWISE</span>
              <span className="sidebar-brand-subtitle">Admin Portal</span>
            </div>
          </div>

          {/* ADMIN BADGE BANNER */}
          <div
            style={{
              margin: '0.75rem 1rem 1.25rem 1rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(13, 148, 136, 0.08)',
              border: '1px solid rgba(13, 148, 136, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-teal)', flexShrink: 0 }} />
            <div style={{ fontSize: '0.75rem', color: 'var(--slate-700)', fontWeight: 600 }}>
              Appointment Desk
            </div>
          </div>

          {/* NAV ITEMS */}
          <nav className="portal-sidebar-nav">
            <NavLink
              to="/admin/appointments"
              className={({ isActive }) => `portal-nav-item ${isActive ? 'active' : ''}`}
            >
              <Calendar className="portal-nav-icon" size={18} />
              <span>Book Appointment</span>
            </NavLink>
          </nav>
        </div>

        {/* SIDEBAR FOOTER: USER CARD */}
        <div className="portal-sidebar-footer">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.85rem',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--slate-50)',
              border: '1px solid var(--slate-200)',
            }}
          >
            <div
              className="user-avatar-circle"
              style={{
                width: '38px',
                height: '38px',
                minWidth: '38px',
                borderRadius: '50%',
                background: 'var(--accent-teal)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {adminName.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'var(--slate-900)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={adminName}
              >
                {adminName}
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--accent-teal)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Admin
              </div>
            </div>
            <button
              type="button"
              id="admin-sidebar-logout-btn"
              onClick={handleLogout}
              title="Sign Out"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--slate-200)',
                background: 'white',
                color: 'var(--danger-600)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--danger-50)';
                e.currentTarget.style.borderColor = 'var(--danger-200)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = 'var(--slate-200)';
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA */}
      <div className="portal-main-wrapper">
        {/* TOPBAR */}
        <header className="portal-topbar">
          <div className="portal-topbar-left">
            <button
              type="button"
              className="portal-mobile-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle menu"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--accent-teal)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '2px',
                }}
              >
                <Shield size={12} /> Hospital Administration
              </span>
              <h1
                style={{
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: 'var(--slate-900)',
                  margin: 0,
                  lineHeight: 1.25,
                  letterSpacing: '-0.02em',
                }}
              >
                Appointment Booking & Scheduling
              </h1>
            </div>
          </div>

          {/* TOPBAR USER MENU */}
          <div className="profile-dropdown-wrapper" ref={dropdownRef}>
            <button
              id="admin-profile-dropdown-trigger"
              type="button"
              className={`profile-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <div
                className="user-avatar-circle"
                style={{
                  width: '32px',
                  height: '32px',
                  fontSize: '0.85rem',
                  background: 'var(--accent-teal)',
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                {adminName.charAt(0).toUpperCase()}
              </div>

              <div className="user-details" style={{ textAlign: 'left' }}>
                <span className="user-name">{adminName}</span>
                <span className="user-role-tag" style={{ color: 'var(--accent-teal)' }}>
                  Admin
                </span>
              </div>

              <ChevronDown
                size={14}
                style={{
                  color: 'var(--slate-400)',
                  marginLeft: '0.25rem',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {/* DROPDOWN MENU */}
            {dropdownOpen && (
              <div
                className="profile-dropdown-menu"
                role="menu"
                style={{ width: '260px', right: 0 }}
              >
                <div className="dropdown-user-header">
                  <div className="dropdown-user-name">{adminName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>
                    {adminEmail}
                  </div>
                  <div
                    className="dropdown-pid-badge"
                    style={{
                      background: 'rgba(13, 148, 136, 0.1)',
                      color: 'var(--accent-teal)',
                      marginTop: '0.4rem',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                    }}
                  >
                    Admin
                  </div>
                </div>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  id="admin-dropdown-logout-btn"
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

        {/* CONTENT */}
        <main className="portal-content-body portal-content-area">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
