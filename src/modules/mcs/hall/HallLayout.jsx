import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { useAuth } from '@/shared/context/AuthContext';
import { IconGrid, IconBox, IconPlus, IconMove } from '@/shared/components/icons';

const navSections = [
  {
    title: 'MCS',
    items: [
      { to: '/hall/dashboard', label: 'Dashboard', icon: <IconGrid />, end: true },
      { to: '/hall/samples', label: 'Samples', icon: <IconBox /> },
      { to: '/hall/add-sample', label: 'Add Sample', icon: <IconPlus /> },
      { to: '/hall/movements', label: 'Movements', icon: <IconMove /> },
    ],
  },
];

export default function HallLayout() {
  const { profile } = useAuth();
  const hallNumber = profile?.hall?.hall_number;

  return (
    <DashboardLayout
      navSections={navSections}
      sidebarSubtitle="Manager"
      contextLabel={hallNumber ? `Hall ${hallNumber}` : 'Manager'}
    />
  );
}
