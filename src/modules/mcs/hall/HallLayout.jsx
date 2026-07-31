import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { useAuth } from '@/shared/context/AuthContext';
import { IconGrid, IconBox, IconMove, IconLayers } from '@/shared/components/icons';

// "Add Sample"/"Add Panel" are intentionally not in the nav — reached via
// the primary action button on their respective list pages instead,
// keeping the sidebar to the pages a manager actually navigates between.
const navSections = [
  {
    title: 'MCS',
    items: [
      { to: '/hall/dashboard', label: 'Dashboard', icon: <IconGrid />, end: true },
      { to: '/hall/samples', label: 'Samples', icon: <IconBox /> },
      { to: '/hall/movements', label: 'Movements', icon: <IconMove /> },
    ],
  },
  {
    title: 'MCP',
    items: [{ to: '/hall/mcp/panels', label: 'Panels', icon: <IconLayers /> }],
  },
];

// MCS's 3 routes fill the bottom nav; Panels goes in the Profile sheet's
// "More" list instead of displacing one of them.
const mobileNavItems = navSections[0].items;
const mobileMoreItems = navSections[1].items;

export default function HallLayout() {
  const { profile } = useAuth();

  return (
    <DashboardLayout
      navSections={navSections}
      sidebarSubtitle="Manager"
      contextLabel={profile?.hall?.name || 'Manager'}
      mobileNavItems={mobileNavItems}
      mobileMoreItems={mobileMoreItems}
    />
  );
}
