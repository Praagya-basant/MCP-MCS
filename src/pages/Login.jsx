import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/core/auth/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { Logo } from '@/core/components/Logo';
import { ROLE_HOME } from '@/core/utils/constants';
import { cn } from '@/core/utils/cn';

// Only ever follow a same-site path (must start with "/", not "//" —
// the latter is protocol-relative and would silently redirect off-site).
function safeRedirect(raw) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
}

export default function Login() {
  const { session, role, signIn, loading: authLoading } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirectTo'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!authLoading && session && role) {
    return <Navigate to={redirectTo || ROLE_HOME[role] || '/login'} replace />;
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
    <div className="min-h-screen flex">
      {/* Left 55% — brand panel. Deliberately NOT theme-aware (fixed
          #1A1A1A) — this is brand chrome, not app UI, so it stays dark
          regardless of the light/dark toggle. Logo is anchored at 40% of
          the panel height, not 50%, for a more intentional feel. No
          border between panels — separation comes from a subtle inset
          shadow instead. */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-[#1A1A1A] text-white basis-[55%] min-h-screen shadow-[inset_-1px_0_0_rgba(0,0,0,0.15)]">
        <div className="login-grain absolute inset-0 opacity-[0.05]" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/[0.03] blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-white/[0.04] blur-3xl" aria-hidden="true" />

        <div className="absolute left-1/2 top-[40%] w-full -translate-x-1/2 -translate-y-1/2 px-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            <Logo variant="white" className="h-14 w-auto object-contain" />
            <p className="mt-5 text-caption tracking-[0.15em] uppercase text-white/50">
              furniture | lighting | homedecor
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right 45% — no card, floating fields directly on the surface. */}
      <div className="flex items-center justify-center bg-bg basis-[45%] min-h-screen px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[360px]"
        >
          <h1 className="text-[24px] leading-none font-bold text-ink select-none">Sign in</h1>
          <p className="mt-2 text-body text-ink-secondary">Welcome back to BASANT.</p>

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
                className="interactive h-9 rounded-control border border-border bg-bg px-3 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-body font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="interactive h-9 w-full rounded-control border border-border bg-bg pl-3 pr-9 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-[1.5px] focus:ring-ink focus:border-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="interactive absolute right-0 top-0 h-9 w-9 flex items-center justify-center text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-caption text-error"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={submitting}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={cn(
                'interactive w-full h-[42px] rounded-control bg-accent text-accent-ink font-medium',
                'hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed',
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
            </motion.button>
          </form>

          <p className="mt-7 text-center text-caption text-ink-muted">Contact your administrator for access.</p>
        </motion.div>
      </div>
    </div>
  );
}
