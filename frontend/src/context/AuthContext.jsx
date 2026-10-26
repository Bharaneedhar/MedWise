import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  register as apiRegister,
  login as apiLogin,
  getCurrentUser as apiGetCurrentUser,
  tokenStorage,
} from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(tokenStorage.getToken());
  const [loading, setLoading] = useState(true);

  // Restore authenticated session when app mounts or token changes
  const restoreUserSession = useCallback(async () => {
    const existingToken = tokenStorage.getToken();
    if (!existingToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiGetCurrentUser();
      if (data && data.success && data.user && data.user.role) {
        setUser(data.user);
        setToken(existingToken);
      } else {
        tokenStorage.removeToken();
        setUser(null);
        setToken(null);
      }
    } catch (error) {
      console.warn('[MedWise Auth] Session restoration failed, clearing token:', error.response?.data?.message || error.message);
      tokenStorage.removeToken();
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreUserSession();
  }, [restoreUserSession]);

  /**
   * Log in user with credentials
   */
  const login = async (credentials) => {
    const data = await apiLogin(credentials);
    if (data.success && data.token) {
      tokenStorage.setToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    }
    throw new Error(data.message || 'Login failed');
  };

  /**
   * Register new user
   */
  const register = async (userData) => {
    const data = await apiRegister(userData);
    if (data.success && data.token) {
      tokenStorage.setToken(data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    }
    throw new Error(data.message || 'Registration failed');
  };

  /**
   * Log out user
   */
  const logout = () => {
    tokenStorage.removeToken();
    setToken(null);
    setUser(null);
  };

  /**
   * Refresh user profile from backend without toggling global loading state.
   * Updates state with fresh profileCompleted status.
   */
  const refreshUser = async () => {
    try {
      const data = await apiGetCurrentUser();
      if (data.success && data.user) {
        setUser(data.user);
        return data.user;
      } else {
        tokenStorage.removeToken();
        setUser(null);
        setToken(null);
        return null;
      }
    } catch (error) {
      console.warn('[MedWise Auth] Refresh failed:', error.response?.data?.message || error.message);
      tokenStorage.removeToken();
      setUser(null);
      setToken(null);
      return null;
    }
  };

  const value = {
    user,
    setUser,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
