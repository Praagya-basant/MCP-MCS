import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { useAuth } from '@/shared/context/AuthContext';
import { IconGrid, IconBox, IconMove } from '@/shared/components/icons';

// "Add Sample" is intentionally not in the nav — it's reached via the
// primary action button on /hall/samples instead, keeping the sidebar
// to the pages a manager actually navigates between. The route/page
// itself is untouched.
const navSections = [
  {
    title: 'MCS',
    items: [
      { to: '/hall/dashboard', label: 'Dashboard', icon: <IconGrid />, end: true },
      { to: '/hall/samples', label: 'Samples', icon: <IconBox /> },
      { to: '/hall/movements', label: 'Movements', icon: <IconMove /> },
    ],
  },
];

// All 3 routes fit in the bottom nav with room to spare — no overflow
// into the Profile sheet's "More" list needed for this role.
const mobileNavItems = navSections[0].items;

export default function HallLayout() {
  const { profile } = useAuth();

  return (
    <DashboardLayout
      navSections={navSections}
      sidebarSubtitle="Manager"
      contextLabel={profile?.hall?.name || 'Manager'}
      mobileNavItems={mobileNavItems}
    />
  );
}
