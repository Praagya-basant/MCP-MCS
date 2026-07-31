import { useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { useAuth } from '@/shared/context/AuthContext';
import { initials, formatLastLogin } from '@/shared/utils/formatters';
import { IconMessage, IconLogout } from '@/shared/components/icons';
import { SendFeedbackModal } from '@/shared/components/SendFeedbackModal';
import { ROLES } from '@/shared/utils/constants';

// Reuses the existing semantic status colors (blue/green already defined
// for in-transit/in-hall) rather than introducing new ad-hoc palette
// tokens just for avatars.
const AVATAR_COLORS = {
  [ROLES.SUPER_ADMIN]: 'bg-ink',
  [ROLES.HALL_MANAGER]: 'bg-status-in-transit-text',
  [ROLES.MERCHANT]: 'bg-status-in-hall-text',
};

/**
 * The profile block + Support + Sign out — extracted out of Topbar so the
 * exact same content can also render inside the mobile Profile sheet
 * (BottomNav's 5th tab), which has no desktop-dropdown container to live
 * in. `onClose` is called at the moment a menu action is taken (Support
 * click or Sign out click), not when SendFeedbackModal itself later
 * closes — that's what collapses the dropdown/sheet the same way the
 * original inline Topbar version did.
 */
export function AccountMenuContent({ onClose }) {
  const { profile, role, user, signOut } = useAuth();
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
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div
          className={cn(
            'w-8 h-8 rounded-full text-white flex items-center justify-center text-caption font-medium shrink-0 select-none',
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
      {lastLogin && <p className="px-3 pb-2.5 text-[11px] text-ink-muted truncate">Last login: {lastLogin}</p>}

      {role !== ROLES.SUPER_ADMIN && (
        <>
          <div className="border-t border-border my-1" />
          <button
            onClick={handleSupportClick}
            className="interactive w-full flex items-center gap-2 px-3 py-2.5 md:py-2 text-body text-ink-secondary hover:bg-surface-subtle hover:text-ink"
          >
            <IconMessage className="w-4 h-4" />
            Support
          </button>
        </>
      )}

      <div className="border-t border-border my-1" />

      <button
        onClick={handleSignOut}
        className="interactive w-full flex items-center gap-2 px-3 py-2.5 md:py-2 text-body text-ink-secondary hover:bg-surface-subtle hover:text-ink"
      >
        <IconLogout className="w-4 h-4" />
        Sign out
      </button>

      <SendFeedbackModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}
