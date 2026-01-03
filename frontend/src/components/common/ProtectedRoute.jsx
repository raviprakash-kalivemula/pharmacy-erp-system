import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Login from '../pages/Login';

/**
 * ProtectedRoute - Wrapper component that checks authentication before rendering
 * Shows Login page if user is not authenticated or token is invalid
 * Automatically refreshes token before expiry
 */
const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, loading, tokenExpiry } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if token is expired
  if (isLoggedIn && tokenExpiry && new Date(tokenExpiry) <= new Date()) {
    // Token is expired, show login
    return <Login />;
  }

  if (!isLoggedIn) {
    return <Login />;
  }

  return children;
};

export default ProtectedRoute;
