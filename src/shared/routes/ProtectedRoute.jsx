import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/shared/context/AuthContext';
import { ROLE_HOME } from '@/shared/utils/constants';

/**
 * Gates a route subtree behind auth + role membership.
 * - Not logged in -> /login
 * - Logged in but wrong role -> redirected to their own home, not stuck in limbo
 */
export function ProtectedRoute({ allowedRoles }) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-6 h-6 border-2 border-border-strong border-t-ink rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
  }

  return <Outlet />;
}
