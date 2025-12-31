# Google Sign-In Integration Guide

## Completed Components ✅

1. **Database Migration** - `/backend/migrations/20251230_add_google_oauth.sql`
   - ✅ Created `user_sessions` table
   - ✅ Created `oauth_accounts` table  
   - ✅ Added `google_id`, `signup_method`, `signup_pending_approval` columns to users table

2. **Frontend AuthContext** - `/frontend/src/contexts/AuthContext.js`
   - ✅ Centralized auth state management
   - ✅ Token refresh logic (5 min before expiry)
   - ✅ Login/logout/signup methods
   - ✅ Session persistence

3. **GoogleLoginButton Component** - `/frontend/src/components/common/GoogleLoginButton.jsx`
   - ✅ Google login button with signup form
   - ✅ Handles both login and signup flows
   - ✅ Admin approval pending UI

4. **ProtectedRoute Wrapper** - `/frontend/src/components/common/ProtectedRoute.jsx`
   - ✅ Checks authentication before rendering
   - ✅ Token expiry validation
   - ✅ Loading state

5. **Backend Google OAuth Routes** - `/backend/routes/google-auth.js`
   - ✅ POST `/auth/google/callback` - Exchange Google token for JWT
   - ✅ POST `/auth/google/register` - Guided signup with admin approval
   - ✅ POST `/auth/google/link` - Link Google account to existing user
   - ✅ Session creation and validation

---

## Remaining Setup Tasks

### 1. Install Dependencies

**Frontend:**
```bash
cd frontend
npm install @react-oauth/google
# Optional: for better error handling
npm install react-hot-toast
```

**Backend:**
```bash
cd backend
npm install google-auth-library
```

### 2. Update AuthService (Backend)

Add to `/backend/services/authService.js` before the `module.exports`:

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

Then add to `module.exports`:
```javascript
module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  decodeToken,
  verifyGoogleToken,    // ADD THIS
  generateJWT            // ADD THIS
};
```

### 3. Register Google Routes (Backend)

In `/backend/server.js`, add these lines after other route imports:

```javascript
const googleAuthRoutes = require('./routes/google-auth');

// ... other middleware setup ...

// Register routes
app.use('/auth', googleAuthRoutes);
app.use('/auth', authRoutes);  // Keep existing auth routes
```

### 4. Update API Interceptor (Frontend)

In `/frontend/src/api.js`, replace the response interceptor with auto-refresh logic:

```javascript
// Track refreshing state
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

// Response interceptor with auto-refresh
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

### 5. Update Login Component

In `/frontend/src/components/pages/Login.jsx`, integrate the GoogleLoginButton:

```jsx
import GoogleLoginButton from '../common/GoogleLoginButton';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // ... other state ...

  const handleGoogleSuccess = (user) => {
    if (user?.pending) {
      // Show pending approval message
      toast.info('Your account is pending admin approval');
    } else {
      // Navigate to dashboard
      navigate('/');
    }
  };

  return (
    <div className="space-y-6">
      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ... existing form ... */}
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>

      {/* Google Login Button */}
      <GoogleLoginButton onSuccess={handleGoogleSuccess} />
    </div>
  );
};
```

### 6. Update App.js (Frontend)

Wrap your app with GoogleOAuthProvider:

```jsx
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function App() {
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

### 7. Environment Variables

**Frontend** - `/frontend/.env.local`:
```
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
REACT_APP_API_BASE_URL=http://localhost:5000
```

**Backend** - `/backend/.env`:
```
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
JWT_SECRET=your-secure-secret-change-me
JWT_ALGORITHM=HS256
TOKEN_EXPIRY=24h
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_TIME=900000
```

### 8. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:3000`
   - `http://localhost:5000`
   - Your production domain
6. Copy Client ID and Client Secret

### 9. Run Database Migration

```bash
cd backend
mysql -u root -p your_database < migrations/20251230_add_google_oauth.sql
```

Or use your migration runner if you have one.

---

## Testing Checklist

- [ ] Google login button appears on Login page
- [ ] Clicking Google button opens Google login
- [ ] Existing user can log in with Google
- [ ] New user sees signup form with guided registration
- [ ] Admin receives notification of pending user
- [ ] After admin approval, user can log in
- [ ] Token refresh happens 5 minutes before expiry
- [ ] Token auto-refresh on 401 response works
- [ ] User data persists across page refresh
- [ ] Logout clears all session data
- [ ] ProtectedRoute redirects unauthenticated users to login

---

## Optional Enhancements

1. **Link existing account to Google**:
   - In Settings, add option to link Google account
   - Use POST `/auth/google/link` endpoint

2. **User Profile Picture**:
   - Store `picture` from Google profile in database
   - Display in sidebar next to username

3. **Scopes**:
   - Current: `profile` and `email` (minimal)
   - Can add more if needed

4. **Refresh Token**:
   - Store refresh token in httpOnly cookie (more secure)
   - Use for longer-lived sessions

---

## Troubleshooting

**"Invalid Google token" error**:
- Check GOOGLE_CLIENT_ID matches in frontend and backend
- Ensure google-auth-library is installed
- Verify token isn't expired (tokens are valid for ~1 hour)

**"User not found" but user exists**:
- Check if `google_id` is stored in database
- Verify email matches between Google and database

**Token refresh not working**:
- Check `/auth/refresh` endpoint exists
- Verify token is stored in localStorage
- Check Authorization header in network tab

**CORS errors**:
- Ensure backend has CORS enabled
- Check allowed origins include frontend URL

---

## Next Steps

1. Run the database migration
2. Install dependencies
3. Add environment variables
4. Complete the file edits above
5. Get Google OAuth credentials
6. Test the complete flow
7. Deploy to production

Need help with any step? Check the error messages and logs!
