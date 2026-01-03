import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api';

/**
 * GoogleLoginButton - Handles Google OAuth login and signup flow
 * Shows guided signup if user doesn't exist
 */
const GoogleLoginButton = ({ onSuccess, isSignUp = false }) => {
  const { googleLogin, googleSignup } = useAuth();
  const [showSignupForm, setShowSignupForm] = useState(false);
  const [signupStep, setSignupStep] = useState('profile'); // 'profile' or 'otp'
  const [signupData, setSignupData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'pharmacist',
    googleToken: null,
    googleName: ''
  });
  const [otpData, setOtpData] = useState({
    code: '',
    loading: false,
    error: ''
  });
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      const googleToken = credentialResponse.credential;

      // Try to login existing user
      const loginResult = await googleLogin(googleToken);

      if (loginResult.success) {
        const msg = isSignUp ? 'Account linked successfully!' : 'Successfully logged in with Google!';
        toast.success(msg);
        onSuccess?.(loginResult.user);
      } else if (loginResult.pending) {
        toast.success(loginResult.message);
        // Show pending approval UI
        onSuccess?.({ pending: true, user: loginResult.user });
      } else if (loginResult.newUser) {
        // Show signup form for new user
        toast.success('Please complete your profile to continue');
        
        // Decode JWT to get user info (basic info without verification)
        const base64Url = googleToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const googleData = JSON.parse(jsonPayload);
        
        // Slugify name to create username suggestion
        const slugifyName = (name) => {
          return name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .replace(/-+/g, '_');
        };
        
        setSignupData(prev => ({
          ...prev,
          googleToken,
          email: googleData.email || '',
          googleName: googleData.name || '',
          username: slugifyName(googleData.name || '')
        }));
        setSignupStep('profile');
        setShowSignupForm(true);
      } else {
        toast.error(loginResult.error || 'Login failed');
      }
    } catch (error) {
      toast.error('Google login error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error('Failed to login with Google');
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    
    if (!signupData.username.trim()) {
      toast.error('Username is required');
      return;
    }

    if (!signupData.password.trim()) {
      toast.error('Password is required');
      return;
    }

    try {
      setLoading(true);
      
      const response = await api.auth.requestOTP(signupData.email, 'signup');
      
      if (response.success) {
        toast.success('Verification code sent to your email');
        setSignupStep('otp');
        setOtpData({ code: '', loading: false, error: '' });
      } else {
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error) {
      toast.error('Error sending OTP: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (!otpData.code.trim()) {
      toast.error('Verification code is required');
      return;
    }

    try {
      setOtpData(prev => ({ ...prev, loading: true, error: '' }));
      
      // Call Google register endpoint with OTP, password, and role
      const response = await api.post('/auth/google/register', {
        idToken: signupData.googleToken,
        username: signupData.username,
        password: signupData.password,
        role: signupData.role,
        email: signupData.email,
        otpCode: otpData.code.trim()
      });
      
      if (response.data?.success) {
        toast.success('Account created successfully! Waiting for admin approval.');
        setShowSignupForm(false);
        setSignupStep('profile');
        onSuccess?.({ pending: true, user: response.data?.data?.user || { email: signupData.email } });
      } else {
        setOtpData(prev => ({ ...prev, error: response.data?.message || 'Failed to create account' }));
        toast.error(response.data?.message || 'Account creation failed');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Error creating account';
      setOtpData(prev => ({ ...prev, error: errorMsg }));
      toast.error(errorMsg);
    } finally {
      setOtpData(prev => ({ ...prev, loading: false }));
    }
  };

  if (showSignupForm) {
    return (
      <div className="space-y-4 p-4 bg-blue-50 dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Complete Your Profile
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Please fill in your details. An admin will review and approve your account.
        </p>

        {signupStep === 'profile' ? (
          // Step 1: Profile Information
          <form onSubmit={handleRequestOTP} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                value={signupData.username}
                onChange={(e) =>
                  setSignupData(prev => ({ ...prev, username: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Choose a username"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email (from Google)
              </label>
              <input
                type="email"
                value={signupData.email}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Email is verified by Google and cannot be changed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={signupData.password}
                onChange={(e) =>
                  setSignupData(prev => ({ ...prev, password: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                placeholder="Create a strong password"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Requested Role
              </label>
              <select
                value={signupData.role}
                onChange={(e) =>
                  setSignupData(prev => ({ ...prev, role: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="pharmacist">Pharmacist</option>
                <option value="viewer">Viewer</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition"
              >
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </button>
              <button
                type="button"
                onClick={() => setShowSignupForm(false)}
                disabled={loading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          // Step 2: OTP Verification
          <form onSubmit={handleVerifyOTP} className="space-y-3">
            <div className="bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                A verification code has been sent to <strong>{signupData.email}</strong>. Please enter it below.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Verification Code
              </label>
              <input
                type="text"
                value={otpData.code}
                onChange={(e) =>
                  setOtpData(prev => ({ ...prev, code: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
                placeholder="000000"
                maxLength="6"
                disabled={otpData.loading}
              />
              {otpData.error && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{otpData.error}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={otpData.loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition"
              >
                {otpData.loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
              <button
                type="button"
                onClick={() => setSignupStep('profile')}
                disabled={otpData.loading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-2 rounded-lg transition"
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        text={isSignUp ? "signup_with" : "signin_with"}
        width="300"
        locale="en"
      />
    </div>
  );
};

export default GoogleLoginButton;
