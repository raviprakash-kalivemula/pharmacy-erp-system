# Critical Next Steps - Action Required

## 🔴 URGENT: Before Testing

### 1. Update validator.js for New Routes
The auth routes use `validate('requestOtp')`, `validate('verifyOtp')`, etc.
You need to add these to `backend/middleware/validator.js`:

```javascript
// Add to backend/middleware/validator.js - requestOtp validation
case 'requestOtp':
  return schema({
    email: Joi.string().email().required(),
    purpose: Joi.string().valid('login', 'signup', 'password_reset', 'email_verification').default('login')
  });

// Add to backend/middleware/validator.js - verifyOtp validation
case 'verifyOtp':
  return schema({
    email: Joi.string().email().required(),
    otpCode: Joi.string().length(6).required(),
    purpose: Joi.string().valid('login', 'signup', 'password_reset', 'email_verification').default('login')
  });

// Add to backend/middleware/validator.js - refreshToken validation
case 'refreshToken':
  return schema({
    refreshToken: Joi.string().required()
  });
```

### 2. Verify Database Connection Method
Check that your `db.js` uses correct syntax:

```javascript
// backend/config/db.js should have:
const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

// And export either:
module.exports = {
  query: (sql, args) => new Promise(...),
  getConnection: () => ({
    query: (sql, args) => new Promise(...),
    release: () => pool.releaseConnection(...)
  })
};
```

### 3. Check OAuth2Client Import
Ensure `google-auth-library` is installed:

```bash
cd backend
npm list google-auth-library
# If missing:
npm install google-auth-library
```

### 4. Email Template Paths
Verify that `emailService.js` can find templates:
- `backend/templates/emails/otp.ejs`
- `backend/templates/emails/welcome.ejs`
- `backend/templates/emails/password-reset.ejs`
- `backend/templates/emails/email-verification.ejs`

### 5. Import Checks
Verify all new imports in updated files:

**backend/routes/auth.js**:
```javascript
const tokenService = require('../services/tokenService');
const otpService = require('../services/otpService');
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
```

**backend/routes/google-auth.js**:
```javascript
const { OAuth2Client } = require('google-auth-library');
const tokenService = require('../services/tokenService');
const googleOAuthService = require('../services/googleOAuthService');
const { googleOAuthLimiter } = require('../middleware/rateLimiter');
const { AppError } = require('../middleware/errorHandler');
```

**frontend/src/components/pages/Login.jsx**:
```javascript
import { Mail } from 'lucide-react';  // NEW IMPORT
```

---

## 🟡 Configuration Changes Needed

### 1. .env File - EMAIL SECTION
**Current issue**: Email credentials are placeholder
**Action needed**: Update with real SMTP details

**Option A: Gmail (Recommended for Testing)**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # NOT your Gmail password!
SMTP_FROM=Sri Raghavendra Medical <noreply@pharmacy.local>
```

**Get Gmail App Password**:
1. Go to Google Account (myaccount.google.com)
2. Security → 2-Step Verification (enable if not)
3. Security → App passwords
4. Select "Mail" and "Windows Computer"
5. Copy the 16-character password to SMTP_PASS

**Option B: Using SendGrid (For Production)**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-api-key
SMTP_FROM=Sri Raghavendra Medical <noreply@pharmacy.local>
```

### 2. .env File - Google OAuth Section
Verify these are set correctly:
```env
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-secret
```

If missing, get from [Google Cloud Console](https://console.cloud.google.com):
1. Create OAuth 2.0 Client ID (Web application)
2. Authorized JavaScript origins: `http://localhost:3000`
3. Authorized redirect URIs: `http://localhost:3000/auth/google/callback`

### 3. Frontend - Update Frontend Port in .env (if needed)
Check `frontend/.env` or `frontend/package.json`:
```json
// frontend/package.json "proxy" field
"proxy": "http://localhost:5000"
```

Or in `frontend/.env`:
```env
REACT_APP_API_BASE_URL=http://localhost:5000
```

---

## 🔵 Code Validation Checklist

Before running tests, verify:

- [ ] All new files created successfully
- [ ] All old files updated correctly
- [ ] No syntax errors in updated files
- [ ] All imports present and correct
- [ ] Database migration SQL valid
- [ ] .env file has all required variables
- [ ] validator.js has new validation schemas
- [ ] Email credentials configured
- [ ] Google OAuth credentials configured
- [ ] Dependencies installed (google-auth-library, etc.)

**Run this to check for syntax errors**:
```bash
# Backend
cd backend
node -c routes/auth.js
node -c routes/google-auth.js
node -c services/tokenService.js
node -c services/otpService.js

# Frontend
cd ../frontend
npm run build
```

---

## 📋 What Each Component Does (Quick Reference)

### During OTP Login:
1. **User enters email** → Frontend calls `apiService.requestOTP(email)`
2. **Backend receives** → `/auth/request-otp` endpoint
3. **Request validated** → Rate limiter + validator
4. **OTP generated** → `otpService.sendOTPViaEmail()`
5. **Email sent** → `emailService.sendEmail()` + template
6. **User sees timer** → 10 minutes countdown
7. **User enters OTP** → Frontend calls `apiService.verifyOTP(email, code)`
8. **Backend verifies** → `otpService.validateOTP()`
9. **User created** (if new) → with cashier role
10. **Tokens issued** → `tokenService.issueTokens()`
11. **Stored in Local Storage** → access_token + refresh_token
12. **Redirects to dashboard**

### During Token Refresh:
1. **User makes API call** → Gets 401 response
2. **Interceptor catches** → `api.interceptors.response`
3. **Calls refresh** → `apiService.refreshAccessToken()`
4. **Backend processes** → `/auth/refresh-token`
5. **Token rotation** → Old token family invalidated
6. **New token issued** → Same family ID
7. **Local Storage updated** → New tokens stored
8. **Retries request** → With new access token
9. **Response returns** → To frontend

---

## 🚨 Potential Issues & Fixes

### Issue 1: "Cannot find module 'google-auth-library'"
**Fix**: `npm install google-auth-library` in backend folder

### Issue 2: "Unexpected token in JSON at position 0"
**Cause**: Response not JSON, probably HTML error page
**Fix**: Check backend logs for 500 errors

### Issue 3: "Email not arriving"
**Cause**: SMTP credentials wrong or blocked
**Fix**: 
- Test credentials: `npm test` (if test script exists)
- Check Gmail "Less secure apps" setting
- Check spam folder
- Look at server logs

### Issue 4: "OTP created but table doesn't exist"
**Cause**: Migration not run
**Fix**: `mysql -u root -p pharmacy_erp < migrations/20260101_add_otp_and_token_support.sql`

### Issue 5: "Role 'cashier' not in enum"
**Cause**: Users table doesn't have cashier role in enum
**Fix**: Run migration or update enum manually

### Issue 6: "Rate limiter blocking all requests"
**Cause**: In-memory store persists, restart needed
**Fix**: Kill backend process and restart

### Issue 7: "Token verification fails immediately"
**Cause**: JWT_SECRET mismatch between backend and tokenService
**Fix**: Verify JWT_SECRET is same in .env and tokenService.js

---

## 📊 Testing Sequence

**Recommended order**:

1. **Validate Setup** (5 min)
   - Check all files created
   - Verify imports
   - Check .env file

2. **Database** (5 min)
   - Run migration
   - Verify tables created

3. **Backend Only** (10 min)
   - Start backend
   - Check console logs
   - Test /auth/request-otp with curl

4. **Frontend + Backend** (20 min)
   - Start frontend
   - Try each login method
   - Check Local Storage

5. **Token Refresh** (10 min)
   - Login
   - Wait or manually refresh
   - Verify new tokens

6. **Email** (15 min)
   - Request OTP
   - Check inbox
   - Verify email content

7. **Rate Limiting** (10 min)
   - Send 4 OTPs (OK)
   - Send 5th OTP (blocked)

8. **Edge Cases** (15 min)
   - Invalid OTP
   - Expired OTP
   - Dark mode
   - Mobile view

---

## 🎯 Success Metrics

After testing, you should have:

✅ Email/password login working
✅ OTP login working  
✅ Google OAuth working
✅ Tokens refresh automatically
✅ Rate limiting preventing abuse
✅ Dark mode fully functional
✅ Mobile responsive design
✅ All email templates rendering

**Total estimated time**: 1.5 - 2 hours

---

## Final Checklist Before Going Live

- [ ] All tests passing
- [ ] No console errors
- [ ] Email delivery confirmed
- [ ] Rate limiting working
- [ ] Dark mode tested
- [ ] Mobile tested
- [ ] Performance acceptable
- [ ] Security validated
- [ ] Backup strategy in place
- [ ] Logging reviewed

**Once ALL above done**: Ready for deployment!

---

## Support / Debugging Commands

```bash
# Check backend is running
curl http://localhost:5000/api/medicines

# Test OTP endpoint
curl -X POST http://localhost:5000/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","purpose":"login"}'

# Check token validity
node -e "require('jsonwebtoken').verify(process.argv[1], process.env.JWT_SECRET)" <YOUR_TOKEN>

# View database tables
mysql -u root -p pharmacy_erp -e "SHOW TABLES;"

# Check email logs
tail -f backend.log | grep "email\|mail\|otp"

# Check rate limiter status
curl http://localhost:5000/api/admin/rate-limiter-status
```

---

**Need help? Check**:
1. Backend console logs
2. Frontend console (DevTools)
3. Network tab (API calls)
4. Database directly (MySQL)
5. Email queue table
6. .env file (credentials correct?)

**Good luck! You've got this! 💪**
