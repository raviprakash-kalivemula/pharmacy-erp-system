// src/App.js - WITH DARK MODE SUPPORT
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import Dashboard from './components/pages/Dashboard';
import SalesPerformance from './components/pages/SalesPerformance';
import Inventory from './components/pages/Inventory';
import Billing from './components/pages/Billing';
import Purchase from './components/pages/Purchase';
import Customers from './components/pages/Customers';
import Transactions from './components/pages/Transactions';
import Reports from './components/pages/Reports';
import SalesReport from './components/pages/SalesReport';
import AdminUsers from './components/pages/AdminUsers';
import Analytics from './components/pages/Analytics';
import Settings from './components/pages/Settings';
import Login from './components/pages/Login';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  Users,
  Receipt,
  FileText,
  BarChart3,
  Settings as SettingsIcon,
  X
} from 'lucide-react';
import './App.css';

// ==========================================
// THEME CONTEXT & PROVIDER
// ==========================================
const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('pharmacy-theme');
    if (savedTheme) return savedTheme;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('pharmacy-theme', theme);

    // Apply to document
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userRole, setUserRole] = useState(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr).role : 'viewer';
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('access_token');
  });
  const { theme, toggleTheme } = useTheme();

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setIsLoggedIn(!!localStorage.getItem('access_token'));
      const userStr = localStorage.getItem('user');
      setUserRole(userStr ? JSON.parse(userStr).role : 'viewer');
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'F1' },
    { id: 'inventory', label: 'Inventory', icon: Package, shortcut: 'F3' },
    { id: 'billing', label: 'Billing', icon: ShoppingCart, shortcut: 'F2' },
    { id: 'purchase', label: 'Purchase', icon: ShoppingBag },
    { id: 'customers', label: 'Customers', icon: Users, shortcut: 'F4' },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'sales', label: 'Sales Report', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'sales-performance', label: 'Sales Performance', icon: BarChart3, shortcut: 'F5' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  // Insert Admin Users menu item for admins
  if (userRole === 'admin') {
    // Check if not already added to avoid duplicates if re-rendering issues occur
    const hasAdmin = menuItems.some(i => i.id === 'admin-users');
    if (!hasAdmin) {
      const settingsIndex = menuItems.findIndex(i => i.id === 'settings');
      menuItems.splice(settingsIndex, 0, { id: 'admin-users', label: 'User Management', icon: Users });
    }
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'sales-performance':
        return <SalesPerformance />;
      case 'inventory':
        return <Inventory />;
      case 'billing':
        return <Billing />;
      case 'purchase':
        return <Purchase />;
      case 'customers':
        return <Customers />;
      case 'transactions':
        return <Transactions />;
      case 'reports':
        return <Reports />;
      case 'analytics':
        return <Analytics />;
      case 'sales':
        return <SalesReport />;
      case 'admin-users':
        return <AdminUsers />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <Toaster position="top-right" />
        <Login onLoginSuccess={() => setIsLoggedIn(true)} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: theme === 'dark' ? '#1f2937' : '#ffffff',
            color: theme === 'dark' ? '#f9fafb' : '#111827',
          },
        }}
      />

      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-blue-600 dark:bg-gray-800 text-white transition-all duration-300 flex flex-col sidebar-transition border-r border-blue-700 dark:border-gray-700`}>
          {/* Header */}
          <div className="p-4 border-b border-blue-500 dark:border-gray-700">
            <div className="flex items-center justify-between">
              {sidebarOpen && (
                <div className="fade-in">
                  <h1 className="text-xl font-bold">Sri Raghavendra Medical</h1>
                  <p className="text-xs text-blue-200 dark:text-gray-400">Complete Pharmacy ERP</p>
                </div>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-blue-500 dark:hover:bg-gray-700 rounded-lg transition-colors ml-auto"
                title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                {sidebarOpen ? <X size={20} /> : <LayoutDashboard size={20} />}
              </button>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 
                    transition-all duration-200 relative group
                    ${isActive
                      ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-r-4 border-blue-600 dark:border-blue-400'
                      : 'text-white dark:text-gray-300 hover:bg-blue-500 dark:hover:bg-gray-700'
                    }
                    ${!sidebarOpen && 'justify-center'}
                  `}
                  title={!sidebarOpen ? item.label : ''}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="font-medium fade-in flex-1 text-left">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-xs opacity-60 bg-white/10 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          {item.shortcut}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className={`p-4 border-t border-blue-500 dark:border-gray-700 ${!sidebarOpen && 'text-center'}`}>
            {sidebarOpen ? (
              <div className="fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-blue-200 dark:text-gray-400">Connected</span>
                </div>
                <p className="text-xs text-blue-300 dark:text-gray-500">v1.0.0</p>
              </div>
            ) : (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mx-auto"></div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <div className="p-6">
              {renderContent()}
            </div>
          </ErrorBoundary>
        </main>

        {/* Close layout */}
      </div>
    </ErrorBoundary>
  );
}

// ==========================================
// APP WITH THEME PROVIDER
// ==========================================
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}