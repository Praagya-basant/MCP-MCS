import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import {
  IconGrid,
  IconLayers,
  IconUsers,
  IconBox,
  IconMove,
  IconMessage,
  IconHistory,
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
      { to: '/admin/validity-requests', label: 'Validity Requests', icon: <IconHistory /> },
      { to: '/admin/shift-requests', label: 'Shift Requests', icon: <IconLayers /> },
      // badgeKey is read by Sidebar to render a live unread-count pill —
      // see FeedbackContext.
      { to: '/admin/feedback', label: 'Feedback', icon: <IconMessage />, badgeKey: 'feedbackUnread' },
      { to: '/admin/settings', label: 'Settings', icon: <IconSettings /> },
    ],
  },
  {
    title: 'MCP',
    items: [
      { to: '/admin/mcp/dashboard', label: 'Dashboard', icon: <IconGrid /> },
      { to: '/admin/mcp/panels', label: 'Panels', icon: <IconLayers /> },
    ],
  },
];

// Bottom nav only fits 4 real routes + the always-present Profile tab —
// the rest (Halls/Validity Requests/Shift Requests/Feedback/Settings/MCP)
// live in the Profile sheet's "More" list instead (see BottomNav).
const mobileNavItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: <IconGrid />, end: true },
  { to: '/admin/team', label: 'Team', icon: <IconUsers /> },
  { to: '/admin/samples', label: 'Samples', icon: <IconBox /> },
  { to: '/admin/movements', label: 'Movements', icon: <IconMove /> },
];

const mobileMoreItems = [
  { to: '/admin/halls', label: 'Halls', icon: <IconLayers /> },
  { to: '/admin/validity-requests', label: 'Validity Requests', icon: <IconHistory /> },
  { to: '/admin/shift-requests', label: 'Shift Requests', icon: <IconLayers /> },
  { to: '/admin/feedback', label: 'Feedback', icon: <IconMessage />, badgeKey: 'feedbackUnread' },
  { to: '/admin/settings', label: 'Settings', icon: <IconSettings /> },
  { to: '/admin/mcp/dashboard', label: 'MCP Dashboard', icon: <IconGrid /> },
  { to: '/admin/mcp/panels', label: 'Panels', icon: <IconLayers /> },
];

export default function AdminLayout() {
  return (
    <DashboardLayout
      navSections={navSections}
      sidebarSubtitle="Admin"
      contextLabel="Admin"
      mobileNavItems={mobileNavItems}
      mobileMoreItems={mobileMoreItems}
    />
  );
}
