import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/utils/cn';
import { useAuth } from '@/shared/context/AuthContext';
import { initials } from '@/shared/utils/formatters';
import { IconChevronDown } from '@/shared/components/icons';
import { AccountMenuContent } from '@/shared/components/AccountMenuContent';
import { NotificationBell } from '@/shared/components/NotificationBell';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { Logo } from '@/shared/components/Logo';
import { ROLES } from '@/shared/utils/constants';

const AVATAR_COLORS = {
  [ROLES.SUPER_ADMIN]: 'bg-ink',
  [ROLES.HALL_MANAGER]: 'bg-status-in-transit-text',
  [ROLES.MERCHANT]: 'bg-status-in-hall-text',
};

/** Finds the current page's nav label for the mobile top bar's centered title, falling back to the role's sidebarSubtitle. */
function currentPageTitle(navSections, pathname, fallback) {
  for (const section of navSections || []) {
    for (const item of section.items) {
      if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return item.label;
    }
  }
  return fallback;
}

export function Topbar({ contextLabel, navSections, sidebarSubtitle }) {
  const location = useLocation();
  const { profile, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const avatarColor = AVATAR_COLORS[role] || 'bg-ink';
  const pageTitle = currentPageTitle(navSections, location.pathname, sidebarSubtitle);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-bg sticky top-0 z-10">
      {/* Mobile: logo left, page title center, notification bell right.
          Account access moves to BottomNav's Profile tab on mobile — no
          hamburger, bottom nav is the only navigation. */}
      <div className="md:hidden h-full flex items-center justify-between px-4">
        <Logo variant="black" className="h-4 w-auto object-contain" />
        <span className="text-body font-medium text-ink truncate select-none">{pageTitle}</span>
        <NotificationBell className="-mr-1.5" />
      </div>

      {/* Desktop: context label left, notification bell + account dropdown right. */}
      <div className="hidden md:flex h-full items-center justify-between px-6 gap-4">
        <div className="min-w-0">
          {contextLabel && <span className="text-body font-medium text-ink truncate select-none">{contextLabel}</span>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeToggle />
          <NotificationBell />

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

            <AnimatePresence>
              {menuOpen && (
                <>
                  {/* Full-viewport blur behind the dropdown — click-to-
                      dismiss doubles up with the existing outside-click
                      handler, purely a visual/premium touch. */}
                  <motion.div
                    className="fixed inset-0 z-10 backdrop-blur-[2px] bg-black/5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => setMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    className="absolute right-0 mt-1.5 w-60 bg-card border border-border rounded-lg shadow-dropdown py-1.5 origin-top-right z-20"
                  >
                    <AccountMenuContent onClose={() => setMenuOpen(false)} />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
