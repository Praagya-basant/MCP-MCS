import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { IconGrid, IconBuilding, IconLayers, IconUsers, IconBox, IconMove, IconMessage } from '@/shared/components/icons';

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
      // badgeKey is read by Sidebar to render a live unread-count pill —
      // see FeedbackContext.
      { to: '/admin/feedback', label: 'Feedback', icon: <IconMessage />, badgeKey: 'feedbackUnread' },
    ],
  },
];

export default function AdminLayout() {
  return (
    <DashboardLayout navSections={navSections} sidebarSubtitle="Admin" contextLabel="Admin" />
  );
}
