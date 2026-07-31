import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { Logo } from '@/shared/components/Logo';
import { ROLE_HOME } from '@/shared/utils/constants';
import { cn } from '@/shared/utils/cn';

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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left — brand panel. Deliberately NOT theme-aware (bg-[#121212],
          not bg-ink) — this is fixed brand chrome, not app UI, so it stays
          dark regardless of the light/dark toggle. Content is vertically
          anchored at 40% (not 50%) of the panel height on desktop for a
          more intentional feel; on mobile the panel is content-sized, so
          it just centers normally. */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-[#121212] text-white px-8 py-16 md:w-1/2 md:min-h-screen shadow-[inset_-1px_0_0_rgba(0,0,0,0.1)]">
        <div className="login-grain absolute inset-0 opacity-[0.05]" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/[0.03] blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-white/[0.04] blur-3xl" aria-hidden="true" />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center md:absolute md:left-1/2 md:top-[40%] md:w-full md:-translate-x-1/2 md:-translate-y-1/2 md:px-8"
        >
          <Logo variant="white" className="h-10 md:h-12 w-auto object-contain" />
          <p className="mt-4 text-caption tracking-[0.15em] uppercase text-white/50">
            furniture | lighting | homedecor
          </p>
          <div className="mt-6 w-10 h-px bg-white/15" />
        </motion.div>
      </div>

      {/* Right — login card */}
      <div className="flex flex-1 items-center justify-center bg-card px-6 py-16 md:py-0">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[380px] bg-card border border-border rounded-2xl shadow-lift px-7 py-8 md:px-9 md:py-10"
        >
          <h1 className="text-heading font-semibold text-ink select-none">Sign in</h1>
          <p className="mt-1.5 text-body text-ink-secondary">Welcome back to BASANT.</p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5" noValidate>
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
                className="interactive h-12 rounded-control border border-border bg-card px-3.5 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-[3px] focus:ring-accent/20 focus:border-accent"
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
                className="interactive h-12 rounded-control border border-border bg-card px-3.5 text-body text-ink placeholder:text-ink-muted focus:outline-none focus:ring-[3px] focus:ring-accent/20 focus:border-accent"
              />
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
                'interactive w-full h-12 rounded-control bg-accent text-accent-ink font-semibold',
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

          <p className="mt-7 text-center text-caption text-ink-muted">Contact your admin for access.</p>
        </motion.div>
      </div>
    </div>
  );
}
