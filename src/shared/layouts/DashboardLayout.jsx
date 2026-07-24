import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/shared/layouts/Sidebar';
import { Topbar } from '@/shared/layouts/Topbar';

/**
 * Shared shell for every authenticated role. Each role's route tree wraps
 * itself with this layout and supplies its own nav sections + a fixed
 * context label (hall number / buyer name / "Admin"). Per-page
 * titles and actions live inside each page via <PageHeader>, not here.
 * Module 2 (MCP) reuses this exact layout — it just registers its own
 * nav sections alongside MCS's.
 */
export function DashboardLayout({ navSections, sidebarSubtitle, contextLabel }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar sections={navSections} subtitle={sidebarSubtitle} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar contextLabel={contextLabel} />
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
