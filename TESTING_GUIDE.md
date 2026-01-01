# Quick Start Testing Guide

## Pre-requisites
- MySQL server running
- Node.js installed
- Backend running on port 5000
- Frontend running on port 3000

## Step 1: Run Database Migration

```bash
cd backend
# Run the migration SQL file
mysql -u root -p pharmacy_erp < migrations/20260101_add_otp_and_token_support.sql
```

## Step 2: Configure Environment Variables

Edit `backend/.env`:

```env
# EXISTING
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=R@vi1234
MYSQL_DATABASE=pharmacy_erp
PORT=5000

# NEW - UPDATE THESE
JWT_SECRET=8f3e9c2d1a5b4e7c6f9d2a8e1c4b7f3e9c2d5a8b1e4f7c0d3a6e9f2c5b8e1a
REFRESH_TOKEN_SECRET=7c2e1f9a6d3b4e8c1a5f7d2e9c3b6a1f7e4d9c2b5a8e1f4c7d0a3e6f9b2c5

# NEW - Gmail SMTP (for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Sri Raghavendra Medical <noreply@pharmacy.local>

# Google OAuth (keep existing)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret

# NEW - OTP Config
OTP_LENGTH=6
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5

# NEW - Token Config
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
TOKEN_REFRESH_THRESHOLD=5m

# NEW - Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# NEW - CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Important**: For Gmail SMTP:
1. Use app-specific password (not Gmail password)
2. Enable "Less secure apps" or use Gmail App Password
3. Recommended: Use SendGrid or Mailgun for production

## Step 3: Install Dependencies (if needed)

```bash
cd backend
npm install  # Should already be done

cd ../frontend
npm install  # Should already be done
```

## Step 4: Start Services

**Terminal 1 - Backend**:
```bash
cd backend
npm start
# Should see: Server running on port 5000
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm start
# Should open http://localhost:3000 in browser
```

## Step 5: Test Authentication Flows

### Test 1: Email/Password Login (Existing)
1. Click **Sign In** tab
2. Enter username: `admin`
3. Enter password: `Admin@123`
4. Click **Sign In**
5. ✅ Should redirect to dashboard with token stored

**Verify**:
- Open DevTools → Application → Local Storage
- See `access_token` and `refresh_token`
- Both should be valid JWTs

---

### Test 2: OTP Email Login (NEW)
1. Click **OTP Login** tab
2. Enter email: `test@example.com` (use real email)
3. Click **Send OTP**
4. ✅ Check email inbox for OTP (should arrive in <30 seconds)
5. Enter the 6-digit code
6. Click **Verify OTP**
7. ✅ Should login if user exists, create account if new

**Verify**:
- Local Storage has `access_token` + `refresh_token`
- User logged in with correct role

---

### Test 3: Google OAuth (Existing Flow)
1. See **Or continue with** section
2. Click **Sign in with Google**
3. Select your Google account
4. ✅ Should exchange token and login

**Verify**:
- Tokens stored in Local Storage
- Dashboard accessible

---

### Test 4: Token Refresh
1. Login via any method
2. Wait until access token is about to expire (15 min)
3. Make any API call
4. ✅ Auto-refresh should happen
5. New token stored in Local Storage

**Test manually**:
```javascript
// In DevTools Console
const refreshToken = localStorage.getItem('refresh_token');
await fetch('http://localhost:5000/auth/refresh-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
}).then(r => r.json()).then(d => {
  console.log('New token:', d.data.accessToken);
  localStorage.setItem('access_token', d.data.accessToken);
});
```

---

### Test 5: Rate Limiting
1. Try to send OTP 4 times to same email (should work)
2. Try 5th time within 60 minutes
3. ✅ Should get 429 error: "Too many requests, retry in X minutes"

```javascript
// Simulate in browser console
for(let i = 0; i < 6; i++) {
  await apiService.requestOTP('test@test.com', 'login')
    .then(r => console.log(`Request ${i+1}:`, r.status))
    .catch(e => console.log(`Request ${i+1}:`, e.response?.status));
}
```

---

### Test 6: Dark Mode + Responsive Design
1. Look for theme toggle (moon/sun icon)
2. ✅ OTP Login tab and form work in dark mode
3. Resize browser to mobile size (375px)
4. ✅ Form still works and looks good

---

## Debugging Tips

### Check Logs
```bash
# Terminal 1 (backend)
# Should see logs like:
# INFO: OTP requested for test@example.com
# INFO: OTP verified for user 123
# INFO: Tokens issued for user 123
```

### Check Database
```bash
# In MySQL CLI
use pharmacy_erp;

# View OTP records
SELECT * FROM otp_codes WHERE email = 'test@example.com' ORDER BY created_at DESC;

# View user sessions
SELECT * FROM user_sessions WHERE user_id = 1 ORDER BY created_at DESC;

# View token blacklist
SELECT * FROM token_blacklist WHERE expires_at > NOW();

# View OAuth accounts
SELECT * FROM oauth_accounts;

# View login logs
SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 10;
```

### Check Email Queue
```bash
# If emails fail to send
SELECT * FROM email_queue WHERE status = 'failed' ORDER BY created_at DESC;
```

### Common Issues

**Issue**: OTP not arriving
- **Check**: SMTP credentials in `.env`
- **Check**: Email not in spam folder
- **Check**: Backend logs for email errors
- **Check**: Email queue table for failed records

**Issue**: "Too many requests" immediately
- **Check**: Rate limiter in-memory store
- **Solution**: Restart backend to clear
- **Long-term**: Use Redis for rate limiter in production

**Issue**: Google OAuth fails
- **Check**: GOOGLE_CLIENT_ID is correct
- **Check**: Frontend callback URL matches Google Console
- **Check**: Token expiry not exceeded

**Issue**: Tokens not stored in Local Storage
- **Check**: Not in private/incognito mode
- **Check**: Local Storage not disabled
- **Check**: API response has accessToken field

---

## Performance Testing

### Test Token Refresh Under Load
```bash
# Use Apache Bench or similar
ab -n 100 -c 10 -p data.json -T application/json \
  http://localhost:5000/auth/refresh-token
```

### Check Memory Usage
```bash
# Monitor backend process
npm install -g pm2
pm2 start server.js
pm2 monit
```

---

## Success Criteria

✅ All tests passed when:

1. **Email/Password Login**
   - Existing users can login
   - JWT tokens stored correctly
   - Dashboard accessible

2. **OTP Login**
   - OTP email arrives within 1 minute
   - 6-digit code works
   - New users can signup via OTP
   - Existing users can login via OTP

3. **Google OAuth**
   - Works with new and existing accounts
   - Correct role assigned
   - Tokens issued

4. **Token Refresh**
   - Auto-refresh on 401 response
   - Manual refresh works
   - Concurrent requests handled
   - Token rotation prevents replay

5. **Rate Limiting**
   - Returns 429 when limit exceeded
   - Includes Retry-After header
   - Resets after time window
   - Different limits for different endpoints

6. **Email Service**
   - OTP emails arrive
   - Welcome emails work
   - Password reset emails work
   - Failed emails queued and retried

7. **UI/UX**
   - OTP Login tab functional
   - Dark mode works
   - Mobile responsive
   - Timer counts down correctly
   - Error messages display

---

## Next Phase: Deployment

Once all tests pass:

1. **Production Setup**
   - Use actual domain/email
   - Set real database credentials
   - Configure SendGrid/Mailgun
   - Update CORS origins
   - Enable HTTPS

2. **Database Maintenance**
   - Setup scheduled cleanup tasks
   - Monitor size growth
   - Implement backups

3. **Monitoring**
   - Setup error tracking (Sentry)
   - Monitor rate limiter hits
   - Track email delivery
   - Monitor token refresh rate

---

**Good luck with testing! Let me know if you hit any issues.**
