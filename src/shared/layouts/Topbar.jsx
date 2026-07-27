import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { initials } from '@/shared/utils/formatters';
import { IconChevronDown, IconLogout, IconMessage } from '@/shared/components/icons';
import { SendFeedbackModal } from '@/shared/components/SendFeedbackModal';
import { ROLES } from '@/shared/utils/constants';

export function Topbar({ contextLabel }) {
  const { profile, role, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-white flex items-center justify-between px-6 gap-4 sticky top-0 z-10">
      <div className="min-w-0">
        {contextLabel && <span className="text-body font-medium text-ink truncate">{contextLabel}</span>}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="interactive flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-control hover:bg-surface-subtle"
          >
            <div className="w-[26px] h-[26px] rounded-full bg-ink text-white flex items-center justify-center text-caption font-medium">
              {initials(profile?.full_name)}
            </div>
            <span className="text-body text-ink hidden sm:block max-w-[140px] truncate">
              {profile?.full_name}
            </span>
            <IconChevronDown className="w-3.5 h-3.5 text-ink-secondary" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-border rounded-lg shadow-lg py-1.5 animate-[fadeIn_0.15s_ease]">
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-body font-medium text-ink truncate">{profile?.full_name}</p>
                <p className="text-caption text-ink-secondary truncate">{profile?.email}</p>
              </div>
              {role !== ROLES.SUPER_ADMIN && (
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
              )}
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
