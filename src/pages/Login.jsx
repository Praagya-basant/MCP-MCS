import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { Logo } from '@/shared/components/Logo';
import { ROLE_HOME } from '@/shared/utils/constants';
import { cn } from '@/shared/utils/cn';

export default function Login() {
  const { session, role, signIn, loading: authLoading } = useAuth();
  const toast = useToast();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!authLoading && session && role) {
    const redirectTo = location.state?.from || ROLE_HOME[role] || '/login';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      toast.success('Signed in successfully');
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Incorrect email or password.' : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row animate-[fadeIn_0.4s_ease]">
      {/* Left — brand panel */}
      <div className="relative flex flex-col items-center justify-center bg-ink text-white px-8 py-16 md:w-1/2 md:min-h-screen">
        <div className="flex flex-col items-center">
          <Logo variant="white" className="h-10 md:h-12 w-auto object-contain" />
          <p className="mt-4 text-caption tracking-[0.15em] uppercase text-white/50">
            furniture | lighting | homedecor
          </p>
        </div>
        <p className="absolute bottom-10 left-0 right-0 text-center text-caption text-white/40">
          Signed Sample Management System
        </p>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-16 md:py-0">
        <div className="w-full max-w-[360px]">
          <h1 className="text-heading font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-body text-ink-secondary">Sign in to your BASANT SSM account.</p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-body font-medium text-ink">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@basant.info"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="interactive h-9 rounded-control border border-border bg-white px-3 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-body font-medium text-ink">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="interactive h-9 rounded-control border border-border bg-white px-3 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink"
              />
            </div>

            {error && <p className="text-caption text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'interactive w-full h-[42px] rounded-control bg-ink text-white font-medium',
                'hover:bg-[#2b2b2b] disabled:bg-ink/40 disabled:text-white/70 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {submitting && (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              Sign in
            </button>
          </form>

          <p className="mt-8 text-caption text-ink-muted">Access is managed by your administrator.</p>
        </div>
      </div>
    </div>
  );
}
