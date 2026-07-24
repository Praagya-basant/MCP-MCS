import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { IconGrid, IconBuilding, IconLayers, IconUsers, IconBox, IconMove } from '@/shared/components/icons';

const navSections = [
  {
    title: 'MCS',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: <IconGrid />, end: true },
      { to: '/admin/buyers', label: 'Buyers', icon: <IconBuilding /> },
      { to: '/admin/halls', label: 'Halls', icon: <IconLayers /> },
      { to: '/admin/users', label: 'Users', icon: <IconUsers /> },
      { to: '/admin/samples', label: 'Samples', icon: <IconBox /> },
      { to: '/admin/movements', label: 'Movements', icon: <IconMove /> },
    ],
  },
];

export default function AdminLayout() {
  return (
    <DashboardLayout navSections={navSections} sidebarSubtitle="Admin" contextLabel="Admin" />
  );
}
