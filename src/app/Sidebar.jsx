import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/core/utils/cn';
import { useAuth } from '@/core/auth/AuthContext';
import { useFeedback } from '@/core/context/FeedbackContext';
import { initials } from '@/core/utils/formatters';
import { Logo } from '@/core/components/Logo';
import { AccountMenuContent } from '@/core/components/AccountMenuContent';
import { ROLES, ROLE_LABELS } from '@/core/utils/constants';
import {
  IconGrid,
  IconBox,
  IconMove,
  IconLayers,
  IconUsers,
  IconHistory,
  IconBell,
  IconMessage,
  IconSettings,
  IconDownload,
  IconChevronDown,
} from '@/core/components/icons';

const COLLAPSE_STORAGE_KEY = 'basant-sidebar-collapsed';

function roleBase(role) {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.CUSTOM) return '/admin';
  if (role === ROLES.HALL_MANAGER) return '/hall';
  return '/merchant';
}

function getMcsNavItems(role) {
  const base = roleBase(role);
  if (role === ROLES.MERCHANT) {
    return [
      { to: `${base}/dashboard`, label: 'Dashboard', icon: <IconGrid />, end: true },
      { to: `${base}/samples`, label: 'Samples', icon: <IconBox /> },
      { to: `${base}/history`, label: 'History', icon: <IconHistory /> },
      { to: `${base}/recalls`, label: 'Recalls', icon: <IconMessage /> },
      { to: `${base}/export`, label: 'Export', icon: <IconDownload /> },
    ];
  }
  return [
    { to: `${base}/dashboard`, label: 'Dashboard', icon: <IconGrid />, end: true },
    { to: `${base}/samples`, label: 'Samples', icon: <IconBox /> },
    { to: `${base}/movements`, label: 'Movements', icon: <IconMove /> },
  ];
}

function getMcpNavItems(role) {
  const base = roleBase(role);
  const items = [
    { to: `${base}/mcp/dashboard`, label: 'Dashboard', icon: <IconGrid />, end: true },
    { to: `${base}/mcp/panels`, label: 'Panels', icon: <IconLayers /> },
  ];
  if (role !== ROLES.MERCHANT) items.push({ to: `${base}/mcp/movements`, label: 'Movements', icon: <IconMove /> });
  return items;
}

// Cross-module admin oversight — not tied to MCS or MCP specifically, so it
// sits below the module switcher rather than inside either module's list.
// `customKey` is which custom_permissions toggle unlocks this item for a
// role: 'custom' user — omitted means super_admin only (never shown to
// custom, regardless of toggles: Feedback/Settings stay admin-only).
const ADMIN_PLATFORM_ITEMS = [
  { to: '/admin/team', label: 'Team & Buyers', icon: <IconUsers />, customKey: 'view_all_buyers' },
  { to: '/admin/halls', label: 'Halls', icon: <IconLayers />, customKey: 'view_all_buyers' },
  { to: '/admin/validity-requests', label: 'Validity Requests', icon: <IconHistory /> },
  { to: '/admin/shift-requests', label: 'Shift Requests', icon: <IconMove /> },
  { to: '/admin/notifications', label: 'Notifications', icon: <IconBell /> },
  { to: '/admin/feedback', label: 'Feedback', icon: <IconMessage />, badgeKey: 'feedbackUnread' },
  { to: '/admin/settings', label: 'Settings', icon: <IconSettings /> },
];

function NavItem({ item, collapsed, badgeValues }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'interactive relative h-9 flex items-center gap-2 rounded-md px-3 text-body',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15',
          isActive ? 'bg-surface-subtle text-ink font-medium' : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-ink" />}
          <span className="w-4 h-4 shrink-0">{item.icon}</span>
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && item.badgeKey && badgeValues[item.badgeKey] > 0 && (
            <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-ink text-[10px] font-medium flex items-center justify-center">
              {badgeValues[item.badgeKey]}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/**
 * Fixed 240px (56px collapsed) left sidebar — desktop-only, no mobile
 * fallback. Self-sufficient: reads role/profile straight from AuthContext
 * rather than receiving nav data as a prop chain, so every role route in
 * Router.jsx wraps itself with the exact same <Layout/>. The MCS/MCP pill
 * switcher determines which nav list renders based on the current route
 * (no separate state to desync from the URL); admin also gets a second,
 * always-visible section for cross-module platform pages.
 */
export function Sidebar() {
  const { profile, role } = useAuth();
  const { unreadCount } = useFeedback() || {};
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const badgeValues = { feedbackUnread: unreadCount || 0 };
  const activeModule = location.pathname.includes('/mcp/') ? 'mcp' : 'mcs';
  const base = roleBase(role);
  const customPermissions = profile?.custom_permissions || {};
  let navItems = activeModule === 'mcp' ? getMcpNavItems(role) : getMcsNavItems(role);
  if (role === ROLES.CUSTOM && !customPermissions.view_movements) {
    navItems = navItems.filter((item) => item.label !== 'Movements');
  }
  const platformItems =
    role === ROLES.SUPER_ADMIN
      ? ADMIN_PLATFORM_ITEMS
      : role === ROLES.CUSTOM
        ? ADMIN_PLATFORM_ITEMS.filter((item) => item.customKey && customPermissions[item.customKey])
        : [];
  const avatarColor =
    role === ROLES.SUPER_ADMIN ? 'bg-ink' : role === ROLES.HALL_MANAGER ? 'bg-status-in-transit-text' : 'bg-status-in-hall-text';

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 240 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      className="shrink-0 h-screen sticky top-0 bg-sidebar border-r border-border flex flex-col overflow-hidden"
    >
      <div className={cn('min-h-[64px] flex items-center border-b border-border shrink-0', collapsed ? 'justify-center px-0' : 'px-6')}>
        {collapsed ? (
          <span className="w-7 h-7 rounded-md bg-ink text-white flex items-center justify-center text-caption font-semibold select-none">B</span>
        ) : (
          <Logo variant="black" className="h-5 w-auto object-contain" />
        )}
      </div>

      {/* MCS / MCP module switcher */}
      <div className={cn('shrink-0 py-3', collapsed ? 'px-2' : 'px-3')}>
        <div className={cn('flex rounded-control bg-surface-subtle p-0.5', collapsed && 'flex-col gap-0.5')}>
          <button
            type="button"
            onClick={() => navigate(`${base}/dashboard`)}
            className={cn(
              'interactive flex-1 h-7 rounded-[5px] text-caption font-medium',
              activeModule === 'mcs' ? 'bg-accent text-accent-ink' : 'text-ink-secondary hover:text-ink'
            )}
          >
            MCS
          </button>
          <button
            type="button"
            onClick={() => navigate(`${base}/mcp/dashboard`)}
            className={cn(
              'interactive flex-1 h-7 rounded-[5px] text-caption font-medium',
              activeModule === 'mcp' ? 'bg-accent text-accent-ink' : 'text-ink-secondary hover:text-ink'
            )}
          >
            MCP
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4 flex flex-col gap-0.5 select-none">
        {navItems.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} badgeValues={badgeValues} />
        ))}

        {platformItems.length > 0 && (
          <>
            {!collapsed && (
              <div className="mt-6 mb-1.5 pl-3 text-[10px] font-medium uppercase tracking-widest text-ink-muted">Admin</div>
            )}
            {collapsed && <div className="mt-4 mb-1 h-px bg-border mx-1" />}
            {platformItems.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} badgeValues={badgeValues} />
            ))}
          </>
        )}
      </nav>

      {/* User info + dropdown */}
      <div className="shrink-0 border-t border-border relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={cn('interactive w-full flex items-center gap-2.5 px-3 py-3 hover:bg-surface-subtle', collapsed && 'justify-center')}
        >
          <div className={cn('w-8 h-8 rounded-full text-white flex items-center justify-center text-caption font-medium shrink-0 select-none', avatarColor)}>
            {initials(profile?.full_name)}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 text-left">
                <p className="text-caption font-medium text-ink truncate">{profile?.full_name}</p>
                <p className="text-[11px] text-ink-muted truncate">{ROLE_LABELS[role] || role}</p>
              </div>
              <IconChevronDown className="w-3.5 h-3.5 text-ink-secondary ml-auto shrink-0" />
            </>
          )}
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className="absolute bottom-full mb-1.5 bg-card border border-border rounded-lg shadow-dropdown py-1.5 z-20"
              style={collapsed ? { left: '100%', bottom: 8, marginLeft: 8, width: 240 } : { left: 8, right: 8 }}
            >
              <AccountMenuContent onClose={() => setMenuOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="interactive shrink-0 h-9 flex items-center justify-center border-t border-border text-ink-muted hover:text-ink hover:bg-surface-subtle"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <IconChevronDown className={cn('w-4 h-4 transition-transform duration-200', collapsed ? '-rotate-90' : 'rotate-90')} />
      </button>
    </motion.aside>
  );
}
