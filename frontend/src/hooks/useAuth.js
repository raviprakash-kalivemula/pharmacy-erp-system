/**
 * useAuth Hook
 * Provides authentication context and user information
 */

import api from '../api';

export const useAuth = () => {
  try {
    const user = localStorage.getItem('user');
    return {
      user: user ? JSON.parse(user) : null,
      isAuthenticated: !!user,
      logout: async () => {
        try {
          await api.logout();
        } catch (error) {
          console.error('Logout error:', error);
        }
      }
    };
  } catch (error) {
    console.error('Auth error:', error);
    return {
      user: null,
      isAuthenticated: false,
      logout: async () => {}
    };
  }
};

export default useAuth;
