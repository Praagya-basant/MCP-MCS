import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import {
  IconGrid,
  IconLayers,
  IconUsers,
  IconBox,
  IconMove,
  IconMessage,
  IconSettings,
} from '@/shared/components/icons';

const navSections = [
  {
    title: 'MCS',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: <IconGrid />, end: true },
      { to: '/admin/team', label: 'Team & Buyers', icon: <IconUsers /> },
      { to: '/admin/halls', label: 'Halls', icon: <IconLayers /> },
      { to: '/admin/samples', label: 'Samples', icon: <IconBox /> },
      { to: '/admin/movements', label: 'Movements', icon: <IconMove /> },
      // badgeKey is read by Sidebar to render a live unread-count pill —
      // see FeedbackContext.
      { to: '/admin/feedback', label: 'Feedback', icon: <IconMessage />, badgeKey: 'feedbackUnread' },
      { to: '/admin/settings', label: 'Settings', icon: <IconSettings /> },
    ],
  },
];

export default function AdminLayout() {
  return (
    <DashboardLayout navSections={navSections} sidebarSubtitle="Admin" contextLabel="Admin" />
  );
}
