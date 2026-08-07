import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/app/Sidebar';
import { Topbar } from '@/app/Topbar';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { usePushSubscription } from '@/core/hooks/usePushSubscription';

/**
 * Desktop-only shell for every authenticated role — Sidebar and Topbar are
 * both self-sufficient (read role/profile from AuthContext directly), so
 * every role's route tree in Router.jsx wraps itself with this exact same
 * element, no per-role nav-section props to thread through anymore.
 */
export function Layout() {
  const location = useLocation();
  usePushSubscription();

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 p-8">
          {/* Subtle per-page fade + upward drift — remounts (and
              re-animates) on every route change since `key` is the
              pathname. */}
          <div key={location.pathname} className="animate-[pageIn_0.2s_cubic-bezier(0.16,1,0.3,1)]">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
