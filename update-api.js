const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/src/api.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the response interceptor with enhanced version
const oldInterceptor = `// Handle 401 by clearing token (optionally redirect to /login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_exp');
      } catch (_) {}
      // Optional redirect:
      // if (window?.location?.pathname !== '/login') window.location = '/login';
    }
    return Promise.reject(error);
  }
);`;

const newInterceptor = `// Track if we're already refreshing to avoid multiple refresh requests
let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (token) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback) => {
  refreshSubscribers.push(callback);
};

// Enhanced response interceptor with auto-token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - attempt token refresh
    if (error?.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Already refreshing, queue this request
        return new Promise(resolve => {
          addRefreshSubscriber(token => {
            originalRequest.headers.Authorization = \`Bearer \${token}\`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh token
        const response = await authApi.post('/auth/refresh', {});
        
        if (response.data?.data?.token) {
          const newToken = response.data.data.token;
          const expiresAt = response.data.data.expiresAt;

          // Update stored token
          localStorage.setItem('access_token', newToken);
          localStorage.setItem('token_exp', expiresAt);

          // Update authorization header and retry original request
          originalRequest.headers.Authorization = \`Bearer \${newToken}\`;
          onRefreshed(newToken);
          isRefreshing = false;

          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        try {
          localStorage.removeItem('access_token');
          localStorage.removeItem('token_exp');
          localStorage.removeItem('user');
        } catch (_) {}
        
        isRefreshing = false;
        return Promise.reject(refreshError);
      }
    }

    // Other 401 errors or other status codes
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_exp');
        localStorage.removeItem('user');
      } catch (_) {}
    }

    return Promise.reject(error);
  }
);`;

content = content.replace(oldInterceptor, newInterceptor);

fs.writeFileSync(filePath, content);
console.log('✓ Updated api.js with token refresh interceptor');
