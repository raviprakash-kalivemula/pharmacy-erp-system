# Google OAuth Integration - Quick Setup Checklist

## Phase 1: Install Dependencies (5 min)

```bash
# Frontend
cd frontend
npm install @react-oauth/google

# Backend  
cd ../backend
npm install google-auth-library
```

- [ ] @react-oauth/google installed
- [ ] google-auth-library installed

---

## Phase 2: Get Google Credentials (15 min)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Pharmacy ERP"
3. Enable APIs:
   - Google+ API
   - OAuth 2.0
4. Create OAuth 2.0 Web Credentials:
   - Type: Web application
   - Authorized redirect URIs:
     ```
     http://localhost:3000
     http://localhost:5000
     https://yourdomain.com (production)
     ```
5. Copy Client ID and Secret

- [ ] Project created
- [ ] Google+ API enabled
- [ ] OAuth credentials created
- [ ] Client ID copied: `_________________`
- [ ] Client Secret copied: `_________________`

---

## Phase 3: Environment Setup (5 min)

### Frontend - `/frontend/.env.local`
```
REACT_APP_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
REACT_APP_API_BASE_URL=http://localhost:5000
```

### Backend - `/backend/.env`
```
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
JWT_SECRET=your-super-secret-key-change-me
JWT_ALGORITHM=HS256
TOKEN_EXPIRY=24h
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000
```

- [ ] Frontend .env.local created
- [ ] Backend .env updated
- [ ] GOOGLE_CLIENT_ID added
- [ ] GOOGLE_CLIENT_SECRET added

---

## Phase 4: Database Setup (5 min)

Run the migration:
```bash
cd backend
mysql -u root -p your_database < migrations/20251230_add_google_oauth.sql
```

Or if using a migration runner:
```bash
npm run migrate
```

Verify tables created:
```sql
SHOW TABLES;  -- Should see 'user_sessions' and 'oauth_accounts'
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users' AND COLUMN_NAME='google_id';
```

- [ ] Migration executed
- [ ] user_sessions table created
- [ ] oauth_accounts table created
- [ ] google_id column added to users

---

## Phase 5: Backend Code Updates (10 min)

### 1. Update `/backend/services/authService.js`

After the `decodeToken()` function, ADD:

```javascript
// Verify Google ID Token
async function verifyGoogleToken(googleToken) {
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified
    };
  } catch (error) {
    throw new Error('Google token verification failed: ' + error.message);
  }
}

// Generate JWT for authenticated users
function generateJWT(userData) {
  return jwt.sign({
    id: userData.id,
    username: userData.username,
    email: userData.email,
    role: userData.role
  }, JWT_SECRET, {
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    expiresIn: TOKEN_EXPIRY
  });
}
```

Update module.exports to include:
```javascript
module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  decodeToken,
  verifyGoogleToken,   // ADD
  generateJWT          // ADD
};
```

- [ ] verifyGoogleToken() added
- [ ] generateJWT() added
- [ ] Exports updated

### 2. Update `/backend/server.js`

After other route imports, ADD:
```javascript
const googleAuthRoutes = require('./routes/google-auth');
```

Before other route registrations, ADD:
```javascript
app.use('/auth', googleAuthRoutes);
```

- [ ] Google routes imported
- [ ] Routes registered

---

## Phase 6: Frontend Code Updates (15 min)

### 1. Update `/frontend/src/api.js`

Replace the entire response interceptor (lines ~35-48) with this:

```javascript
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
        const response = await authApi.post('/auth/refresh');
        const { token } = response.data?.data || {};
        
        if (token) {
          localStorage.setItem('access_token', token);
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          processQueue(null, token);
          return api(originalRequest);
        }
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        localStorage.removeItem('token_exp');
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

- [ ] Response interceptor updated with auto-refresh

### 2. Update `/frontend/src/components/pages/Login.jsx`

Add to imports at top:
```javascript
import GoogleLoginButton from '../common/GoogleLoginButton';
import { useAuth } from '../../contexts/AuthContext';
```

Add to component (after email/password form):
```jsx
<div className="relative">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="px-2 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400">Or continue with</span>
  </div>
</div>

<GoogleLoginButton 
  onSuccess={(user) => {
    if (user?.pending) {
      toast.info('Your account is pending admin approval');
    } else {
      navigate('/');
    }
  }} 
/>
```

- [ ] GoogleLoginButton imported
- [ ] useAuth imported
- [ ] GoogleLoginButton added to JSX

### 3. Update `/frontend/src/App.js`

Add to imports:
```javascript
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
```

Wrap your AppContent with providers:
```javascript
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ProtectedRoute>
          <AppContent />
        </ProtectedRoute>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
```

- [ ] GoogleOAuthProvider imported
- [ ] AuthProvider imported
- [ ] ProtectedRoute imported
- [ ] Providers wrapped around AppContent

---

## Phase 7: Testing (10 min)

### Start Servers
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm start
```

### Test Scenarios

1. **Login Flow**
   - [ ] Go to http://localhost:3000
   - [ ] See Google login button
   - [ ] Click and authenticate with Google
   - [ ] Redirected to dashboard
   - [ ] See username in header/sidebar

2. **New User Signup**
   - [ ] Use different Google account
   - [ ] See "Sign up" form
   - [ ] Fill username and role
   - [ ] Submit
   - [ ] See "Pending approval" message
   - [ ] Admin goes to Settings → User Management
   - [ ] Approves user
   - [ ] User can now login

3. **Token Refresh**
   - [ ] Login successfully
   - [ ] Wait ~30 seconds
   - [ ] Check network tab for `/auth/refresh` call
   - [ ] Should happen ~5 min before expiry

4. **Page Refresh**
   - [ ] Login
   - [ ] Refresh page (F5)
   - [ ] Should stay logged in
   - [ ] User info should persist

5. **Logout**
   - [ ] Click logout
   - [ ] Should redirect to login
   - [ ] localStorage should be cleared

---

## Phase 8: Production Prep

- [ ] Set GOOGLE_CLIENT_ID in production environment
- [ ] Set GOOGLE_CLIENT_SECRET securely
- [ ] Update authorized redirect URIs with production domain
- [ ] Use httpOnly cookies instead of localStorage (optional but recommended)
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging
- [ ] Test with real Google credentials

---

## Troubleshooting

**"Sign in with Google button doesn't appear"**
- Check REACT_APP_GOOGLE_CLIENT_ID is in `.env.local`
- Verify GoogleOAuthProvider wraps App
- Check browser console for errors

**"Invalid Google token error"**
- Ensure GOOGLE_CLIENT_ID matches in frontend and backend
- Check token isn't older than 1 hour
- Verify google-auth-library is installed

**"User not found but user exists"**
- Check user's google_id is saved in database
- Verify email matches between Google and database

**"401 errors keep happening"**
- Check /auth/refresh endpoint exists
- Verify token is stored in localStorage
- Check Authorization header in Network tab

---

## Completion Status

| Phase | Status | Time |
|-------|--------|------|
| 1. Install Dependencies | ⏳ | 5 min |
| 2. Get Google Credentials | ⏳ | 15 min |
| 3. Environment Setup | ⏳ | 5 min |
| 4. Database Migration | ⏳ | 5 min |
| 5. Backend Code | ⏳ | 10 min |
| 6. Frontend Code | ⏳ | 15 min |
| 7. Testing | ⏳ | 10 min |
| **Total** | **⏳** | **65 min** |

---

## Files Created/Updated

### ✅ Created
- `/backend/migrations/20251230_add_google_oauth.sql`
- `/backend/routes/google-auth.js`
- `/frontend/src/contexts/AuthContext.js`
- `/frontend/src/components/common/GoogleLoginButton.jsx`
- `/frontend/src/components/common/ProtectedRoute.jsx`

### ⏳ Need Manual Updates
- `/backend/services/authService.js` - Add 2 functions
- `/backend/server.js` - Register routes
- `/frontend/src/api.js` - Update interceptor
- `/frontend/src/components/pages/Login.jsx` - Add GoogleLoginButton
- `/frontend/src/App.js` - Wrap with providers
- `/frontend/.env.local` - Add credentials
- `/backend/.env` - Add credentials

---

## Next Steps

1. Follow checklist above in order
2. Refer to `GOOGLE_OAUTH_SETUP.md` for detailed code snippets
3. Check `GOOGLE_OAUTH_IMPLEMENTATION.md` for architecture overview
4. Test each phase before moving to next

Good luck! 🚀
