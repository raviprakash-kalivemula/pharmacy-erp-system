import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../api';

/**
 * AuthContext - Centralized authentication state management
 * Handles token storage, user data, and login/logout operations
 */
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedToken = localStorage.getItem('access_token');
        const storedUser = localStorage.getItem('user');
        const storedExpiry = localStorage.getItem('token_exp');

        if (storedToken && storedUser) {
          // Check if token is still valid
          if (storedExpiry && new Date(storedExpiry) > new Date()) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            setIsLoggedIn(true);
            setTokenExpiry(new Date(storedExpiry));
          } else {
            // Token expired, clear storage
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            localStorage.removeItem('token_exp');
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Set up token refresh interval (refresh 5 minutes before expiry)
  useEffect(() => {
    if (!tokenExpiry) return;

    const refreshInterval = setInterval(() => {
      const now = new Date();
      const timeUntilExpiry = tokenExpiry - now;
      const fiveMinutes = 5 * 60 * 1000;

      if (timeUntilExpiry <= fiveMinutes && timeUntilExpiry > 0) {
        refreshToken();
      }
    }, 60000); // Check every minute

    return () => clearInterval(refreshInterval);
  }, [tokenExpiry]);

  /**
   * Refresh the authentication token
   */
  const refreshToken = useCallback(async () => {
    try {
      const response = await api.post('/auth/refresh');
      if (response.data?.data?.token) {
        const newToken = response.data.data.token;
        const expiresAt = response.data.data.expiresAt;

        setToken(newToken);
        setTokenExpiry(new Date(expiresAt));
        localStorage.setItem('access_token', newToken);
        localStorage.setItem('token_exp', expiresAt);

        return newToken;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return null;
    }
  }, []);

  /**
   * Email/password login
   */
  const login = useCallback((userData, token, expiresAt) => {
    setUser(userData);
    setToken(token);
    setIsLoggedIn(true);
    setTokenExpiry(new Date(expiresAt));

    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token_exp', expiresAt);
  }, []);

  /**
   * Google OAuth login
   */
  const googleLogin = useCallback(async (googleToken) => {
    try {
      setLoading(true);

      // Exchange Google token for app JWT
      const response = await axios.post('http://localhost:5000/auth/google/callback', {
        idToken: googleToken
      });

      if (response.data?.data) {
        const { token, user, expiresAt } = response.data.data;

        // Check if user is pending approval
        if (user.signup_pending_approval) {
          setUser(user);
          // Don't set as logged in yet, show pending approval message
          return {
            success: false,
            pending: true,
            message: 'Your account is pending admin approval',
            user
          };
        }

        // Successful login
        login(user, token, expiresAt);
        return { success: true, user };
      }
    } catch (error) {
      console.error('Google login error:', error);

      // Check if it's a new user signup flow
      if (error.response?.status === 404 || error.response?.data?.code === 'USER_NOT_FOUND') {
        return {
          success: false,
          newUser: true,
          message: 'Account not found. Please complete signup.',
          googleToken
        };
      }

      return {
        success: false,
        error: error.response?.data?.message || 'Google login failed'
      };
    } finally {
      setLoading(false);
    }
  }, [login]);

  /**
   * Google signup (guided registration)
   */
  const googleSignup = useCallback(async (googleToken, userData) => {
    try {
      setLoading(true);

      const response = await axios.post('http://localhost:5000/auth/google/register', {
        idToken: googleToken,
        username: userData.username,
        email: userData.email,
        role: userData.role || 'viewer',
        otp: userData.otp
      });

      if (response.data?.data) {
        // User created and pending approval
        setUser(response.data.data.user);
        return {
          success: true,
          pending: true,
          message: 'Account created! Waiting for admin approval.',
          user: response.data.data.user
        };
      }
    } catch (error) {
      console.error('Google signup error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Signup failed'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Logout and clear all auth data
   */
  const logout = useCallback(async () => {
    try {
      // Call backend logout endpoint
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state and storage regardless
      setUser(null);
      setToken(null);
      setIsLoggedIn(false);
      setTokenExpiry(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.removeItem('token_exp');
    }
  }, []);

  /**
   * Update user data
   */
  const updateUser = useCallback((newUserData) => {
    setUser(newUserData);
    localStorage.setItem('user', JSON.stringify(newUserData));
  }, []);

  const value = {
    user,
    token,
    loading,
    isLoggedIn,
    tokenExpiry,
    login,
    googleLogin,
    googleSignup,
    logout,
    updateUser,
    refreshToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
