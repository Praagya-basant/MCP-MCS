import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
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
    <div className="min-h-screen flex flex-col md:flex-row animate-[fadeIn_0.4s_ease]">
      {/* Left — brand panel. Content is vertically anchored at 40% (not
          50%) of the panel height on desktop for a more intentional feel;
          on mobile the panel is content-sized, so it just centers normally. */}
      <div
        className="relative flex flex-col items-center justify-center bg-ink text-white px-8 py-16 md:w-1/2 md:min-h-screen shadow-[inset_-1px_0_0_rgba(0,0,0,0.1)]"
      >
        <div className="flex flex-col items-center md:absolute md:left-1/2 md:top-[40%] md:w-full md:-translate-x-1/2 md:-translate-y-1/2 md:px-8">
          <Logo variant="white" className="h-10 md:h-12 w-auto object-contain" />
          <p className="mt-4 text-caption tracking-[0.15em] uppercase text-white/50">
            furniture | lighting | homedecor
          </p>
          <div className="mt-6 w-10 h-px bg-white/15" />
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-16 md:py-0">
        <div className="w-full max-w-[360px]">
          <h1 className="text-heading font-semibold text-ink select-none">Sign in</h1>

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
        </div>
      </div>
    </div>
  );
}
