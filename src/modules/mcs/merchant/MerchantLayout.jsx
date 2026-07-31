import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { useAuth } from '@/shared/context/AuthContext';
import { IconGrid, IconBox, IconHistory, IconAlert, IconDownload, IconLayers } from '@/shared/components/icons';

const navSections = [
  {
    title: 'MCS',
    items: [
      { to: '/merchant/dashboard', label: 'Dashboard', icon: <IconGrid />, end: true },
      { to: '/merchant/samples', label: 'Samples', icon: <IconBox /> },
      { to: '/merchant/history', label: 'History', icon: <IconHistory /> },
      { to: '/merchant/recalls', label: 'Recalls', icon: <IconAlert /> },
      { to: '/merchant/export', label: 'Export', icon: <IconDownload /> },
    ],
  },
  {
    title: 'MCP',
    items: [
      { to: '/merchant/mcp/dashboard', label: 'Dashboard', icon: <IconGrid /> },
      { to: '/merchant/mcp/panels', label: 'Panels', icon: <IconLayers /> },
    ],
  },
];

// 5 MCS routes don't fit the 4-slot bottom nav (5th slot is always
// Profile) — Export is the least-frequently-tapped one, so it (and
// Panels) move into the Profile sheet's "More" list instead.
const mobileNavItems = navSections[0].items.slice(0, 4);
const mobileMoreItems = [...navSections[0].items.slice(4), ...navSections[1].items];

export default function MerchantLayout() {
  const { profile } = useAuth();
  const buyerName = profile?.buyer?.name;

  return (
    <DashboardLayout
      navSections={navSections}
      sidebarSubtitle="Merchant"
      contextLabel={buyerName || 'Merchant'}
      mobileNavItems={mobileNavItems}
      mobileMoreItems={mobileMoreItems}
    />
  );
}
