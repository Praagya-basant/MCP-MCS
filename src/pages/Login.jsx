import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { useToast } from '@/shared/context/ToastContext';
import { Button } from '@/shared/components/Button';
import { Input, FormField } from '@/shared/components/Input';
import { ROLE_HOME } from '@/shared/utils/constants';

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
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-ink flex items-center justify-center text-white font-semibold text-heading">
            B
          </div>
          <h1 className="mt-4 text-heading font-semibold text-ink">BASANT SSM</h1>
          <p className="mt-1 text-caption text-ink-secondary">Signed Sample Management</p>
        </div>

        <div className="bg-white border border-border rounded-card shadow-card px-8 py-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <FormField label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@basant.info"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            <FormField label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>

            {error && <p className="text-caption text-red-600">{error}</p>}

            <Button type="submit" className="w-full mt-2" loading={submitting}>
              Sign in
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-caption text-ink-muted">
          Accounts are created by your administrator.
        </p>
      </div>
    </div>
  );
}
