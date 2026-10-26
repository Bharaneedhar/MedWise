import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

/**
 * Route protection component with role-based access control and profile completion enforcement
 * @param {Array<string>} allowedRoles - Optional array of authorized roles ('doctor', 'pharmacist', 'patient')
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // 1. While authentication/session state is loading, render Loading component
  if (loading) {
    return <Loading message="Verifying clinical credentials..." />;
  }

  // 2. Unauthenticated visitor: redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Authenticated user with INCOMPLETE profile
  if (user.profileCompleted === false) {
    // If already on /complete-profile, render CompleteProfile normally without redirect loop
    if (location.pathname === '/complete-profile') {
      return children;
    }
    // Otherwise redirect to /complete-profile
    return <Navigate to="/complete-profile" replace />;
  }

  // 4. Authenticated user with COMPLETED profile manually visiting /complete-profile
  if (location.pathname === '/complete-profile') {
    const roleDashboardMap = {
      doctor: '/doctor/dashboard',
      pharmacist: '/pharmacist/dashboard',
      patient: '/patient/dashboard',
      admin: '/admin/appointments',
    };
    const targetDashboard = roleDashboardMap[user.role] || '/login';
    return <Navigate to={targetDashboard} replace />;
  }

  // 5. Role-based authorization check for dashboards
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const roleDashboardMap = {
      doctor: '/doctor/dashboard',
      pharmacist: '/pharmacist/dashboard',
      patient: '/patient/dashboard',
      admin: '/admin/appointments',
    };
    const targetDashboard = roleDashboardMap[user.role] || '/login';
    return <Navigate to={targetDashboard} replace />;
  }

  // 6. Authorized and profile complete
  return children;
};

export default ProtectedRoute;
