import { useState } from 'react';
import { cn } from '@/core/utils/cn';
import { useAuth } from '@/core/auth/AuthContext';
import { initials, formatLastLogin } from '@/core/utils/formatters';
import { IconMessage, IconLogout } from '@/core/components/icons';
import { SendFeedbackModal } from '@/core/components/SendFeedbackModal';
import { ThemeToggle } from '@/core/components/ThemeToggle';
import { useTheme } from '@/core/context/ThemeContext';
import { ROLES, ROLE_LABELS } from '@/core/utils/constants';
import { Sun, Moon } from 'lucide-react';

// Reuses the existing semantic status colors (blue/green already defined
// for in-transit/in-hall) rather than introducing new ad-hoc palette
// tokens just for avatars.
const AVATAR_COLORS = {
  [ROLES.SUPER_ADMIN]: 'bg-ink',
  [ROLES.HALL_MANAGER]: 'bg-status-in-transit-text',
  [ROLES.MERCHANT]: 'bg-status-in-hall-text',
};

/**
 * The profile block + theme toggle + Support + Sign out — rendered inside
 * the Sidebar's bottom user-info dropdown. `onClose` is called at the
 * moment a menu action is taken (Support click or Sign out click), not
 * when SendFeedbackModal itself later closes — that's what collapses the
 * dropdown the same way the original inline Topbar version did.
 */
export function AccountMenuContent({ onClose }) {
  const { profile, role, user, signOut } = useAuth();
  const { theme } = useTheme();
  const [supportOpen, setSupportOpen] = useState(false);

  const avatarColor = AVATAR_COLORS[role] || 'bg-ink';
  const lastLogin = formatLastLogin(user?.last_sign_in_at);

  function handleSupportClick() {
    onClose?.();
    setSupportOpen(true);
  }

  function handleSignOut() {
    onClose?.();
    signOut();
  }

  return (
    <>
      <div className="px-3 py-3 flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-full text-white flex items-center justify-center text-body font-semibold shrink-0 select-none',
            avatarColor
          )}
        >
          {initials(profile?.full_name)}
        </div>
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink truncate">{profile?.full_name}</p>
          <p className="text-caption text-ink-secondary truncate">{profile?.email}</p>
        </div>
      </div>
      <div className="px-3 pb-2.5 flex items-center gap-2">
        <span className="inline-flex items-center rounded-pill bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
          {ROLE_LABELS[role] || role}
        </span>
        {lastLogin && <span className="text-[11px] text-ink-muted truncate">Last login {lastLogin}</span>}
      </div>

      <div className="border-t border-border my-1" />

      <div className="w-full flex items-center justify-between gap-2 px-3 py-2 text-body text-ink-secondary">
        <span className="flex items-center gap-2">
          {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
        </span>
        <ThemeToggle variant="switch" />
      </div>

      {role !== ROLES.SUPER_ADMIN && (
        <>
          <div className="border-t border-border my-1" />
          <button
            onClick={handleSupportClick}
            className="interactive w-full flex items-center gap-2 px-3 py-2 text-body text-ink-secondary hover:bg-surface-subtle hover:text-ink"
          >
            <IconMessage className="w-4 h-4" />
            Support
          </button>
        </>
      )}

      <div className="border-t border-border my-1" />

      <button
        onClick={handleSignOut}
        className="interactive w-full flex items-center gap-2 px-3 py-2 text-body text-ink-secondary hover:bg-surface-subtle hover:text-ink"
      >
        <IconLogout className="w-4 h-4" />
        Sign out
      </button>

      <SendFeedbackModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
