import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';
const AUTH_BASE_URL = 'http://localhost:5000'; // Auth endpoints are outside /api

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Create separate auth axios instance (no auto JWT attachment)
const authApi = axios.create({
  baseURL: AUTH_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach JWT automatically if available
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {
    // ignore storage access errors
  }
  return config;
});

// Token refresh tracking
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Handle 401 with auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error?.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await authApi.post('/auth/refresh-token', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data?.data || {};

        if (accessToken) {
          localStorage.setItem('access_token', accessToken);
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
          }
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          processQueue(null, accessToken);
          return api(originalRequest);
        }
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        localStorage.removeItem('token_exp');
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Generic request methods
const apiService = {
  // Generic GET/POST/PUT/DELETE
  get: (url, config = {}) => api.get(url, config),
  post: (url, data, config = {}) => api.post(url, data, config),
  put: (url, data, config = {}) => api.put(url, data, config),
  delete: (url, config = {}) => api.delete(url, config),

  // Auth
  login: async (username, password, remember = false) => {
    const res = await authApi.post('/auth/login', { username, password, remember_me: remember });
    // Backend response format: { success: true, data: { accessToken, refreshToken, user, expiresAt }, message }
    if (res.data?.success && res.data?.data) {
      const { accessToken, refreshToken, user, expiresAt } = res.data.data;
      if (accessToken && user) {
        try {
          localStorage.setItem('access_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
          }
          localStorage.setItem('user', JSON.stringify(user));
          if (expiresAt) {
            localStorage.setItem('token_exp', new Date(expiresAt).getTime().toString());
          }
          if (remember) {
            localStorage.setItem('remember_me', 'true');
          }
        } catch (_) { }
      }
    }
    return res;
  },

  // OTP Authentication Methods
  requestOTP: async (email, purpose = 'login') => {
    const res = await authApi.post('/auth/request-otp', { email, purpose });
    return res;
  },

  verifyOTP: async (email, otpCode, purpose = 'login') => {
    const res = await authApi.post('/auth/verify-otp', { email, otpCode, purpose });
    // Store tokens and user info similar to login
    if (res.data?.success && res.data?.data) {
      const { accessToken, refreshToken, user, expiresAt } = res.data.data;
      if (accessToken && user) {
        try {
          localStorage.setItem('access_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
          }
          localStorage.setItem('user', JSON.stringify(user));
          if (expiresAt) {
            localStorage.setItem('token_exp', new Date(expiresAt).getTime().toString());
          }
        } catch (_) { }
      }
    }
    return res;
  },

  // Token Refresh
  refreshAccessToken: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const res = await authApi.post('/auth/refresh-token', { refreshToken });
    if (res.data?.success && res.data?.data) {
      const { accessToken, refreshToken: newRefreshToken, expiresAt } = res.data.data;
      if (accessToken) {
        try {
          localStorage.setItem('access_token', accessToken);
          if (newRefreshToken) {
            localStorage.setItem('refresh_token', newRefreshToken);
          }
          if (expiresAt) {
            localStorage.setItem('token_exp', new Date(expiresAt).getTime().toString());
          }
        } catch (_) { }
      }
    }
    return res;
  },

  register: async (username, email, password, otp) => {
    const res = await authApi.post('/auth/signup', { username, email, password, otp });
    return res;
  },
  getCurrentUser: () => api.get('/auth/me'),
  logout: async () => {
    try {
      await authApi.post('/auth/logout', {});
    } catch (_) { }
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_exp');
      localStorage.removeItem('user');
    } catch (_) { }
    return Promise.resolve();
  },

  // Medicines
  getMedicines: () => api.get('/medicines'),
  getMedicine: (id) => api.get(`/medicines/${id}`),
  getMedicineBatches: (id) => api.get(`/medicines/${id}/batches`),
  getAvailableBatches: (id) => api.get(`/medicines/${id}/available-batches`),
  addMedicine: (data) => api.post('/medicines', data),
  updateMedicine: (id, data) => api.put(`/medicines/${id}`, data),
  deleteMedicine: (id) => api.delete(`/medicines/${id}`),
  getLowStock: () => api.get('/medicines/alerts/low-stock'),
  getExpiringMedicines: () => api.get('/medicines/alerts/expiring'),

  // Customers
  getCustomers: () => api.get('/customers'),
  getCustomer: (id) => api.get(`/customers/${id}`),
  addCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
  deleteCustomer: (id) => api.delete(`/customers/${id}`),

  // Sales (Create transaction)
  getSales: () => api.get('/sales'),
  getSale: (id) => api.get(`/sales/${id}`),
  createSale: (data) => api.post('/sales', data),
  updateSalePayment: (id, data) => api.put(`/sales/${id}/payment`, data),
  deleteSale: (id) => api.delete(`/sales/${id}`),
  getSalesReport: (startDate, endDate) =>
    api.get('/sales/reports/summary', { params: { start_date: startDate, end_date: endDate } }),

  // Transactions (NEW - for transaction history page)
  getTransactions: () => api.get('/sales'),
  getTransactionDetails: (invoiceNo) => api.get(`/sales/${invoiceNo}`),
  updateTransactionPayment: (invoiceNo, data) => api.put(`/sales/${invoiceNo}/payment`, data),
  deleteTransaction: (invoiceNo) => api.delete(`/sales/${invoiceNo}`),

  // Purchases
  getPurchases: () => api.get('/purchases'),
  getPurchase: (id) => api.get(`/purchases/${id}`),
  addPurchase: (data) => api.post('/purchases/manual', data),
  updatePurchase: (id, data) => api.put(`/purchases/${id}`, data),
  deletePurchase: (id) => api.delete(`/purchases/${id}`),
  importPurchaseCSV: (formData) => api.post('/purchases/import-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  // Suppliers
  getSuppliers: () => api.get('/suppliers'),
  addSupplier: (data) => api.post('/purchases/suppliers', data),

  // Dashboard
  getDashboard: () => api.get('/dashboard'),

  // Analytics
  getAnalyticsSalesTrends: (days = 30) => api.get('/analytics/sales-trends', { params: { days } }),
  getAnalyticsInventoryForecast: () => api.get('/analytics/inventory-forecast'),
  getAnalyticsProfitLoss: (months = 12) => api.get('/analytics/profit-loss', { params: { months } }),
  getAnalyticsCustomers: () => api.get('/analytics/customers'),
  getAnalyticsDashboard: () => api.get('/analytics/dashboard'),
  getAnalyticsTopMedicines: (limit = 10) => api.get('/analytics/top-medicines', { params: { limit } }),

  // Settings
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),

  // Admin - RBAC & Advanced Features
  // Audit Logs
  getAuditLogs: (filters) => api.get('/admin/audit-logs', { params: filters }),
  getAuditSummary: (days = 30) => api.get('/admin/audit-summary', { params: { days } }),
  getUserActivity: (userId, limit = 50) => api.get(`/admin/user-activity/${userId}`, { params: { limit } }),
  exportAuditLogs: (filters) => api.get('/admin/audit-export', { params: filters }),

  // Backup & Restore
  createBackup: (description) => api.post('/admin/backup', { description }),
  getBackups: () => api.get('/admin/backups'),
  downloadBackup: (backupId) => api.get(`/admin/backup/${backupId}/download`),
  restoreBackup: (backupId, confirm) => api.post(`/admin/backup/${backupId}/restore`, { confirm }),
  deleteBackup: (backupId) => api.delete(`/admin/backup/${backupId}`),

  // Data Export
  exportMedicines: () => api.get('/admin/export/medicines'),
  exportMedicinesExcel: () => api.get('/admin/export/medicines-excel'),
  exportCustomers: () => api.get('/admin/export/customers'),
  exportSales: (startDate, endDate) => api.get('/admin/export/sales', { params: { startDate, endDate } }),
  exportInventory: () => api.get('/admin/export/inventory'),

  // System Settings
  getSystemSettings: () => api.get('/admin/settings'),
  updateSystemSetting: (key, value) => api.put(`/admin/settings/${key}`, { value }),

  // User Management
  getUsers: () => api.get('/admin/users'),
  createUser: (userData) => api.post('/admin/users', userData),
  updateUserRole: (userId, role) => api.put(`/admin/users/${userId}/role`, { role }),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`)
};

export default apiService;