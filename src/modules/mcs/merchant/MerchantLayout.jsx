import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { useAuth } from '@/shared/context/AuthContext';
import { IconGrid, IconBox, IconHistory, IconAlert, IconDownload } from '@/shared/components/icons';

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
];

// 5 real routes don't fit the 4-slot bottom nav (5th slot is always
// Profile) — Export is the least-frequently-tapped one, so it moves into
// the Profile sheet's "More" list instead.
const mobileNavItems = navSections[0].items.slice(0, 4);
const mobileMoreItems = navSections[0].items.slice(4);

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
