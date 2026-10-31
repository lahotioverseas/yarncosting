import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react';
import { UserProfile, setStoredUser, setStoredAuthToken } from '../lib/authData';
import { lahotiOverseasLogo } from '../image/logo';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter your Lahoti Overseas email.');
      return;
    }

    if (!cleanPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setStoredUser(data.user);
        setStoredAuthToken(data.token || null);
        onLoginSuccess(data.user);
        return;
      } else {
        setErrorMessage(data.error || 'Invalid credentials. Please verify your email and password.');
        return;
      }
    } catch {
      setErrorMessage('Cannot reach the server. Please check your internet connection and try again.');
    }
  };

  return (
    <div id="login-page-container" className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        
        {/* Top Header & Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-md border border-slate-200">
            <img
              src={lahotiOverseasLogo}
              alt="Lahoti Overseas"
              className="h-12 w-auto max-w-[200px] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase font-sans">
            Lahoti Overseas Limited
          </h1>
          <p className="text-xs font-medium text-slate-600">
            Yarn Export Costing & Pricing Portal • Secure Team Authentication
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          
          {/* Header Banner */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center space-x-3 border-b border-slate-800">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-400/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-wide uppercase font-sans block">
                Staff Authentication
              </span>
              <span className="text-xs text-slate-400">
                Sign in with your official Lahoti Overseas credentials
              </span>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-5">
            {/* Error Message Alert */}
            {errorMessage && (
              <div id="login-error-alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-3 shadow-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block text-rose-950">Authentication Error:</span>
                  <p className="text-rose-800 font-medium">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Standard Manual Login Form */}
            <form id="manual-login-form" onSubmit={handleManualSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="login-email-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                  Official Email
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. yourname@lahotioverseas.com"
                    className="block w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label htmlFor="login-password-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-sans">
                  Password
                </label>
                <div className="relative rounded-lg shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="block w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="btn-submit-manual-login"
                type="submit"
                className="w-full inline-flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-sm shadow-md transition-all cursor-pointer mt-2"
              >
                <Lock className="w-4 h-4" />
                <span>Sign In to Costing Portal</span>
              </button>
            </form>
          </div>

          {/* Footer Info Banner */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Lahoti Overseas Ltd</span>
            </div>
            <span className="font-mono text-slate-400">Cotton Yarn Export Division</span>
          </div>

        </div>

      </div>
    </div>
  );
};
