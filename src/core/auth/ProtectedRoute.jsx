import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/core/auth/AuthContext';
import { ROLE_HOME } from '@/core/utils/constants';

/**
 * Gates a route subtree behind auth + role membership.
 * - Not logged in -> /login?redirectTo=<current path>, so Login can send
 *   the user back where they were headed (e.g. an email deep link).
 * - Logged in but wrong role -> redirected to their own home, not stuck in limbo
 */
export function ProtectedRoute({ allowedRoles }) {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-border-strong border-t-ink rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    const redirectTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
  }

  return <Outlet />;
}
