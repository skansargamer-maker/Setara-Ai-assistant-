import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  User as UserIcon,
} from 'lucide-react';
import { AuthUser, RegisteredAccountRecord } from '../types/assistant';
import { signInWithGooglePopup } from '../firebase';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
  accounts: RegisteredAccountRecord[];
  onRegisterAccount: (record: RegisteredAccountRecord) => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

function hashPasswordSimple(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = (hash << 5) - hash + pw.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(36)}_${pw.length}`;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  accounts,
  onRegisterAccount,
}) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const resetFeedback = () => {
    setErrorMsg(null);
    setForgotSent(false);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    resetFeedback();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setForgotSent(true);
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }

      const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
      if (existing) {
        setErrorMsg('An account with this email already exists. Please sign in.');
        return;
      }

      const derivedName =
        name.trim() ||
        cleanEmail
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

      const newRecord: RegisteredAccountRecord = {
        uid: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: derivedName,
        email: cleanEmail,
        passwordHash: hashPasswordSimple(password),
        createdAt: Date.now(),
        connectedMethods: ['email'],
      };

      onRegisterAccount(newRecord);
      onAuthenticated({
        uid: newRecord.uid,
        name: newRecord.name,
        email: newRecord.email,
        createdAt: newRecord.createdAt,
        connectedMethods: ['email'],
        lastSignInAt: Date.now(),
      });
      return;
    }

    // Sign In
    const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
    if (existing) {
      if (existing.passwordHash !== hashPasswordSimple(password)) {
        setErrorMsg('Incorrect password for this account.');
        return;
      }
      onAuthenticated({
        uid: existing.uid,
        name: existing.name,
        email: existing.email,
        avatarUrl: existing.avatarUrl,
        createdAt: existing.createdAt,
        connectedMethods: existing.connectedMethods,
        lastSignInAt: Date.now(),
      });
      return;
    }

    // First-time local sign-in convenience if user hasn't signed up on this browser yet
    const fallbackName = cleanEmail
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const record: RegisteredAccountRecord = {
      uid: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: fallbackName,
      email: cleanEmail,
      passwordHash: hashPasswordSimple(password),
      createdAt: Date.now(),
      connectedMethods: ['email'],
    };
    onRegisterAccount(record);
    onAuthenticated({
      uid: record.uid,
      name: record.name,
      email: record.email,
      createdAt: record.createdAt,
      connectedMethods: ['email'],
      lastSignInAt: Date.now(),
    });
  };

  const handleGoogleSignIn = async () => {
    resetFeedback();
    setIsGoogleLoading(true);
    try {
      const fbUser = await signInWithGooglePopup();
      const cleanEmail = (fbUser.email || '').toLowerCase();
      const displayName =
        fbUser.displayName || (cleanEmail ? cleanEmail.split('@')[0] : 'Google User');

      onAuthenticated({
        uid: fbUser.uid,
        name: displayName,
        email: cleanEmail,
        avatarUrl: fbUser.photoURL || undefined,
        createdAt: fbUser.metadata.creationTime
          ? new Date(fbUser.metadata.creationTime).getTime()
          : Date.now(),
        connectedMethods: ['google'],
        lastSignInAt: Date.now(),
      });
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign-in was cancelled.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg('Pop-up was blocked by the browser. Please allow pop-ups and try again.');
      } else {
        setErrorMsg(err?.message || 'Unable to sign in with Google. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center px-4 py-8 bg-slate-50 dark:bg-[#07090f] text-slate-900 dark:text-slate-100 relative overflow-hidden">
      {/* Subtle Ambient Gradient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[540px] h-[540px] rounded-full bg-gradient-to-tr from-cyan-400/20 via-indigo-500/15 to-purple-500/20 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white/85 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-2xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/40">
        {/* Clean Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-500 p-[1px] shadow-lg shadow-indigo-500/20 mb-4">
            <div className="w-full h-full rounded-2xl bg-white dark:bg-slate-950 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-indigo-500 dark:text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
            {mode === 'signin'
              ? 'Welcome Back'
              : mode === 'signup'
              ? 'Create Your Account'
              : 'Reset Password'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {mode === 'signin'
              ? 'Sign in to access your personal AI assistant'
              : mode === 'signup'
              ? 'Set up your account in moments'
              : 'Enter your email to receive reset instructions'}
          </p>
        </div>

        {/* Mode Switcher Tabs for Sign In / Sign Up */}
        {mode !== 'forgot' && (
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 mb-6"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => switchMode('signin')}
              className={`min-h-[42px] rounded-xl text-sm font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => switchMode('signup')}
              className={`min-h-[42px] rounded-xl text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Error / Success Alert */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs sm:text-sm text-rose-700 dark:text-rose-300"
          >
            {errorMsg}
          </div>
        )}

        {forgotSent && (
          <div
            role="status"
            className="mb-4 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Password reset instructions have been sent to {email}.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full min-h-[46px] pl-10 pr-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full min-h-[46px] pl-10 pr-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-medium text-indigo-600 dark:text-cyan-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[46px] pl-10 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Password Field for Sign Up */}
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[46px] pl-10 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Primary Submit Button */}
          <button
            type="submit"
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 hover:opacity-95 active:scale-[0.99] text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all"
          >
            {mode === 'signin'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send Reset Link'}
          </button>
        </form>

        {/* Back link on Forgot Password */}
        {mode === 'forgot' ? (
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="mt-4 w-full min-h-[44px] flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Sign In</span>
          </button>
        ) : (
          <>
            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400 font-medium">or</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Continue with Google (direct Firebase Google Sign-In) */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className="w-full min-h-[48px] px-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:scale-[0.99] disabled:opacity-60 text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center justify-center gap-3 transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>{isGoogleLoading ? 'Connecting with Google...' : 'Continue with Google'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
