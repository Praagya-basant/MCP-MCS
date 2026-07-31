import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '@/shared/layouts/Sidebar';
import { Topbar } from '@/shared/layouts/Topbar';
import { BottomNav } from '@/shared/layouts/BottomNav';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

/**
 * Shared shell for every authenticated role. Each role's route tree wraps
 * itself with this layout and supplies its own nav sections + a fixed
 * context label (hall number / buyer name / "Admin"). Per-page
 * titles and actions live inside each page via <PageHeader>, not here.
 * Module 2 (MCP) reuses this exact layout — it just registers its own
 * nav sections alongside MCS's.
 *
 * Mobile (<md): Sidebar is hidden entirely, replaced by BottomNav — see
 * `mobileNavItems`/`mobileMoreItems`, curated per role since bottom nav
 * only fits 4 real routes (a 5th, "Profile", is always added by
 * BottomNav itself). `pb-20` keeps content clear of the fixed bottom bar.
 */
export function DashboardLayout({
  navSections,
  sidebarSubtitle,
  contextLabel,
  mobileNavItems,
  mobileMoreItems,
}) {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar sections={navSections} subtitle={sidebarSubtitle} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar contextLabel={contextLabel} navSections={navSections} sidebarSubtitle={sidebarSubtitle} />
        <main className="flex-1 p-4 pb-20 md:p-8 md:pb-8">
          {/* Subtle per-page fade — remounts (and re-animates) on every
              route change since `key` is the pathname. */}
          <div key={location.pathname} className="animate-[fadeIn_0.15s_ease]">
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      {mobileNavItems && <BottomNav items={mobileNavItems} moreItems={mobileMoreItems} />}
    </div>
  );
}
