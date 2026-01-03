import React, { useState, useEffect } from 'react';
import { LogIn, AlertCircle, UserPlus, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import apiService from '../../api';
import { useTheme } from '../../App';
import GoogleLoginButton from '../common/GoogleLoginButton';

export default function Login({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isOTP, setIsOTP] = useState(false);
  const [signupStep, setSignupStep] = useState(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpEmail, setOtpEmail] = useState('');
  const { theme } = useTheme();

  // OTP Timer Effect
  useEffect(() => {
    let interval;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(t => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!otpEmail.trim()) {
      setError('Please enter your email');
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);

    try {
      const response = await apiService.requestOTP(otpEmail, 'login');

      if (response.data?.success) {
        setOtpSent(true);
        setOtpTimer(600); // 10 minutes
        toast.success(`OTP sent to ${otpEmail}`);
      } else {
        const msg = response.data?.message || 'Failed to send OTP';
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error('OTP request error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to send OTP. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!otpCode.trim()) {
      setError('Please enter the OTP code');
      toast.error('Please enter the OTP code');
      return;
    }

    setLoading(true);

    try {
      const response = await apiService.verifyOTP(otpEmail, otpCode, 'login');

      if (response.data?.success) {
        toast.success('OTP verified! Logging in...');
        // Clear form
        setOtpEmail('');
        setOtpCode('');
        setOtpSent(false);
        setOtpTimer(0);
        setIsOTP(false);
        // Call the callback to update App state
        setTimeout(() => {
          onLoginSuccess();
        }, 100);
      } else {
        const msg = response.data?.message || 'OTP verification failed';
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'OTP verification failed. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    setError('');

    // Validation
    if (!username.trim()) {
      setError('Please enter username');
      toast.error('Please enter username');
      return;
    }
    if (!password.trim()) {
      setError('Please enter password');
      toast.error('Please enter password');
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting login with:', { username });

      const response = await apiService.login(username, password, rememberMe);
      console.log('Login response:', response);
      console.log('Token in localStorage:', localStorage.getItem('access_token'));

      if (response.data?.success) {
        // Verify token was actually stored
        const storedToken = localStorage.getItem('access_token');
        if (storedToken) {
          toast.success('Login successful!');
          // Call the callback to update App state - this triggers dashboard navigation
          setTimeout(() => {
            onLoginSuccess();
          }, 100);
        } else {
          // If token wasn't stored, create it manually from response
          if (response.data?.data?.accessToken) {
            localStorage.setItem('access_token', response.data.data.accessToken);
            if (response.data?.data?.refreshToken) {
              localStorage.setItem('refresh_token', response.data.data.refreshToken);
            }
            if (response.data?.data?.user) {
              localStorage.setItem('user', JSON.stringify(response.data.data.user));
            }
            if (response.data?.data?.expiresAt) {
              localStorage.setItem('token_exp', new Date(response.data.data.expiresAt).getTime().toString());
            }
            console.log('Token manually stored from response');
            toast.success('Login successful!');
            setTimeout(() => {
              onLoginSuccess();
            }, 100);
          } else {
            setError('Token not received from server');
            toast.error('Login failed: No token received');
          }
        }
      } else {
        const msg = response.data?.message || 'Login failed';
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    // Step 1: Request OTP
    if (signupStep === 1) {
      // Validation
      if (!username || !email || !password || !confirmPassword) {
        setError('All fields are required');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      setLoading(true);

      try {
        // Request OTP for signup
        const response = await apiService.requestOTP(email, 'signup');

        if (response.data?.success) {
          toast.success(`Verification code sent to ${email}`);
          setSignupStep(2);
          setOtpTimer(600); // 10 minutes
        } else {
          setError(response.data?.message || 'Failed to send verification code');
        }
      } catch (err) {
        const message = err.response?.data?.message || 'Signup failed. Try another email or username.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Step 2: Verify & Create Account
    if (signupStep === 2) {
      if (!otpCode || otpCode.length !== 6) {
        setError('Please enter the 6-digit verification code');
        return;
      }

      setLoading(true);

      try {
        // Pass OTP code to register endpoint
        // Note: We need to update apiService.register to accept otpCode
        const response = await apiService.register(username, email, password, otpCode);

        if (response.data?.success) {
          toast.success('Account created successfully! Please wait for admin approval.');
          // Clear form
          setUsername('');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setOtpCode('');
          setSignupStep(1);
          // Switch back to sign in
          setIsSignUp(false);
        }
      } catch (err) {
        const message = err.response?.data?.message || 'Signup failed. Please check the code and try again.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }
  };


  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-blue-100'
      } transition-colors`}>
      <div className={`w-full max-w-md p-8 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
            <LogIn className={`w-8 h-8 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-600'}`} />
          </div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Sri Raghavendra Medical
          </h1>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Pharmacy ERP System
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => {
              setIsSignUp(false);
              setIsOTP(false);
              setSignupStep(1);
              setError('');
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm ${!isSignUp && !isOTP
              ? theme === 'dark'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-600 text-white'
              : theme === 'dark'
                ? 'text-gray-300 hover:text-white'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
          <button
            onClick={() => {
              setIsSignUp(true);
              setIsOTP(false);
              setSignupStep(1);
              setError('');
            }}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm ${isSignUp
              ? theme === 'dark'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-600 text-white'
              : theme === 'dark'
                ? 'text-gray-300 hover:text-white'
                : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <UserPlus className="w-4 h-4" />
            Sign Up
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className={`text-sm ${theme === 'dark' ? 'text-red-300' : 'text-red-700'}`}>
              {error}
            </p>
          </div>
        )}

        {/* Sign In Form */}
        {!isSignUp ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                disabled={loading}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                disabled={loading}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <label htmlFor="rememberMe" className={`ml-2 text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${loading
                ? 'bg-blue-400 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Demo Credentials */}
            <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
              } border ${theme === 'dark' ? 'border-blue-800' : 'border-blue-200'}`}>
              <p className={`text-xs font-semibold mb-2 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                }`}>
                Demo Credentials:
              </p>
              <p className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                Username: <span className="font-mono font-bold">admin</span>
              </p>
              <p className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                Password: <span className="font-mono font-bold">Admin@123</span>
              </p>
            </div>
          </form>
        ) : isOTP ? (
          /* OTP Login Form */
          <form onSubmit={otpSent ? handleVerifyOTP : handleRequestOTP} className="space-y-4">
            {!otpSent ? (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${loading
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </>
            ) : (
              <>
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'} border ${theme === 'dark' ? 'border-blue-800' : 'border-blue-200'}`}>
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                    OTP sent to {otpEmail}
                  </p>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                    Time remaining: {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                  </p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Enter OTP Code
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength="6"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono ${theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${loading || otpCode.length !== 6
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {loading ? 'Verifying OTP...' : 'Verify OTP'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                    setOtpTimer(0);
                  }}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                >
                  Change Email
                </button>
              </>
            )}
          </form>
        ) : (
          /* Sign Up Form */
          <form onSubmit={handleSignUp} className="space-y-4">
            {!signupStep || signupStep === 1 ? (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${loading
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </>
            ) : (
              /* Signup Step 2: Verification */
              <>
                <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'} border ${theme === 'dark' ? 'border-blue-800' : 'border-blue-200'}`}>
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
                    Verification code sent to {email}
                  </p>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                    Please check your inbox to complete registration.
                  </p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength="6"
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono ${theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      }`}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${loading
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </button>

                <button
                  type="button"
                  onClick={() => setSignupStep(1)}
                  className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }`}
                >
                  Back
                </button>
              </>
            )}
          </form>
        )}

        {/* Google OAuth Divider */}
        <div className="mt-6 relative">
          <div className="absolute inset-0 flex items-center">
            <div className={`w-full border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={`px-2 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Login Button */}
        <div className="mt-6">
          <GoogleLoginButton
            isSignUp={isSignUp}
            onSuccess={(user) => {
              if (user?.pending) {
                toast.info('Your account is pending admin approval');
              } else if (onLoginSuccess && typeof onLoginSuccess === 'function') {
                onLoginSuccess();
              } else {
                window.location.href = '/dashboard';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
