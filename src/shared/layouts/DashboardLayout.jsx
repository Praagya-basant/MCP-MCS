import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/shared/layouts/Sidebar';
import { Topbar } from '@/shared/layouts/Topbar';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

/**
 * Shared shell for every authenticated role. Each role's route tree wraps
 * itself with this layout and supplies its own nav sections + a fixed
 * context label (hall number / buyer name / "Admin"). Per-page
 * titles and actions live inside each page via <PageHeader>, not here.
 * Module 2 (MCP) reuses this exact layout — it just registers its own
 * nav sections alongside MCS's.
 */
export function DashboardLayout({ navSections, sidebarSubtitle, contextLabel }) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar sections={navSections} subtitle={sidebarSubtitle} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar contextLabel={contextLabel} />
        <main className="flex-1 p-6 md:p-8">
          {/* Subtle per-page fade — remounts (and re-animates) on every
              route change since `key` is the pathname. */}
          <div key={location.pathname} className="animate-[fadeIn_0.15s_ease]">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
