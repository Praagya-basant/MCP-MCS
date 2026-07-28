import { useState, useRef, useEffect } from 'react';
import { cn } from '@/shared/utils/cn';
import { useAuth } from '@/shared/context/AuthContext';
import { initials, formatLastLogin } from '@/shared/utils/formatters';
import { IconChevronDown, IconLogout, IconMessage } from '@/shared/components/icons';
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

export function Topbar({ contextLabel }) {
  const { profile, role, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Mounted-vs-visible so the dropdown animates closed instead of
  // vanishing instantly — same pattern as Modal/Drawer.
  useEffect(() => {
    if (menuOpen) {
      setMenuMounted(true);
      const raf = requestAnimationFrame(() => setMenuVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setMenuVisible(false);
    const timer = setTimeout(() => setMenuMounted(false), 150);
    return () => clearTimeout(timer);
  }, [menuOpen]);

  const avatarColor = AVATAR_COLORS[role] || 'bg-ink';
  const lastLogin = formatLastLogin(user?.last_sign_in_at);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-white flex items-center justify-between px-6 gap-4 sticky top-0 z-10">
      <div className="min-w-0">
        {contextLabel && <span className="text-body font-medium text-ink truncate select-none">{contextLabel}</span>}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="interactive flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-control hover:bg-surface-subtle"
          >
            <div
              className={cn(
                'w-[26px] h-[26px] rounded-full text-white flex items-center justify-center text-caption font-medium select-none',
                avatarColor
              )}
            >
              {initials(profile?.full_name)}
            </div>
            <span className="text-body text-ink hidden sm:block max-w-[140px] truncate">
              {profile?.full_name}
            </span>
            <IconChevronDown className="w-3.5 h-3.5 text-ink-secondary" />
          </button>

          {menuMounted && (
            <div
              className={cn(
                'absolute right-0 mt-1.5 w-60 bg-white border border-border rounded-lg shadow-lg py-1.5 origin-top-right transition-all duration-150 ease-out',
                menuVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              )}
            >
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
              {lastLogin && (
                <p className="px-3 pb-2.5 text-[11px] text-ink-muted truncate">Last login: {lastLogin}</p>
              )}

              {role !== ROLES.SUPER_ADMIN && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setSupportOpen(true);
                    }}
                    className="interactive w-full flex items-center gap-2 px-3 py-2 text-body text-ink-secondary hover:bg-surface-subtle hover:text-ink"
                  >
                    <IconMessage className="w-4 h-4" />
                    Support
                  </button>
                </>
              )}

              <div className="border-t border-border my-1" />

              <button
                onClick={signOut}
                className="interactive w-full flex items-center gap-2 px-3 py-2 text-body text-ink-secondary hover:bg-surface-subtle hover:text-ink"
              >
                <IconLogout className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <SendFeedbackModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </header>
  );
}
