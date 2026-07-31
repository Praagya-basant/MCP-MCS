import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/utils/cn';
import { Modal } from '@/shared/components/Modal';
import { AccountMenuContent } from '@/shared/components/AccountMenuContent';
import { useFeedback } from '@/shared/context/FeedbackContext';
import { IconUser } from '@/shared/components/icons';

/**
 * Mobile-only (`md:hidden`) primary navigation — a floating glass pill,
 * not an edge-to-edge bar, replacing the sidebar entirely below the md
 * breakpoint per "no hamburger menus, bottom nav is the navigation."
 * `items` is capped at 4 real routes by each role's Layout; the 5th slot
 * is always "Profile", which opens a bottom sheet (reusing Modal's mobile
 * bottom-sheet behavior) with the same account content Topbar's desktop
 * dropdown shows. Destinations that don't fit in the primary 4
 * (`moreItems`, e.g. Admin's Halls/Feedback/Settings) are listed inside
 * that same Profile sheet rather than a separate menu — still not a
 * hamburger, just a second thing the one bottom-sheet trigger can show.
 */
export function BottomNav({ items, moreItems = [] }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { unreadCount } = useFeedback() || {};
  const badgeValues = { feedbackUnread: unreadCount || 0 };

  return (
    <>
      <nav
        className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 flex items-stretch gap-0.5 px-2 py-1.5 rounded-pill border border-white/20 bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(18,18,18,0.85)] backdrop-blur-[20px] shadow-float"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="interactive relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-h-[44px] min-w-[52px]">
            {({ isActive }) => (
              <>
                <span className="relative flex items-center justify-center w-9 h-9">
                  {isActive && (
                    <motion.span
                      layoutId="bottomNavActive"
                      className="absolute inset-0 rounded-full bg-accent/12"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <motion.span
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className={cn('relative flex items-center justify-center w-[22px] h-[22px] [&>svg]:w-full [&>svg]:h-full', isActive ? 'text-accent' : 'text-ink-muted')}
                  >
                    {item.icon}
                  </motion.span>
                </span>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 12 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[10px] font-medium leading-3 text-accent overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="interactive relative flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-h-[44px] min-w-[52px]"
        >
          <span className="relative flex items-center justify-center w-9 h-9">
            <IconUser className={cn('w-[22px] h-[22px]', profileOpen ? 'text-accent' : 'text-ink-muted')} />
          </span>
          <AnimatePresence initial={false}>
            {profileOpen && (
              <motion.span
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 12 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="text-[10px] font-medium leading-3 text-accent overflow-hidden whitespace-nowrap"
              >
                Profile
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </nav>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title="Profile">
        <AccountMenuContent onClose={() => setProfileOpen(false)} />

        {moreItems.length > 0 && (
          <>
            <div className="border-t border-border my-1" />
            <p className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-widest text-ink-muted">
              More
            </p>
            {moreItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setProfileOpen(false)}
                className="interactive w-full flex items-center gap-2 px-3 py-2.5 text-body text-ink-secondary hover:bg-surface-subtle hover:text-ink"
              >
                <span className="w-4 h-4 shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.badgeKey && badgeValues[item.badgeKey] > 0 && (
                  <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-ink text-[10px] font-medium flex items-center justify-center">
                    {badgeValues[item.badgeKey]}
                  </span>
                )}
              </NavLink>
            ))}
          </>
        )}
      </Modal>
    </>
  );
}
