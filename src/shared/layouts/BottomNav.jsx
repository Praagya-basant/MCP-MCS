import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { Modal } from '@/shared/components/Modal';
import { AccountMenuContent } from '@/shared/components/AccountMenuContent';
import { useFeedback } from '@/shared/context/FeedbackContext';
import { IconUser } from '@/shared/components/icons';

/**
 * Mobile-only (`md:hidden`) primary navigation — replaces the sidebar
 * entirely below the md breakpoint, per "no hamburger menus, bottom nav
 * is the navigation." `items` is capped at 4 real routes by each role's
 * Layout; the 5th slot is always "Profile", which opens a bottom sheet
 * (reusing Modal's mobile bottom-sheet behavior) with the same account
 * content Topbar's desktop dropdown shows. Destinations that don't fit in
 * the primary 4 (`moreItems`, e.g. Admin's Halls/Feedback/Settings) are
 * listed inside that same Profile sheet rather than a separate menu —
 * still not a hamburger, just a second thing the one bottom-sheet trigger
 * can show.
 */
export function BottomNav({ items, moreItems = [] }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { unreadCount } = useFeedback() || {};
  const badgeValues = { feedbackUnread: unreadCount || 0 };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white border-t border-border flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'interactive flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5',
                isActive ? 'text-ink' : 'text-ink-muted'
              )
            }
          >
            <span className="w-5 h-5">{item.icon}</span>
            <span className="text-[10px] font-medium truncate px-1">{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className={cn(
            'interactive flex-1 min-h-[44px] flex flex-col items-center justify-center gap-0.5',
            profileOpen ? 'text-ink' : 'text-ink-muted'
          )}
        >
          <IconUser className="w-5 h-5" />
          <span className="text-[10px] font-medium">Profile</span>
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
                  <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-white text-[10px] font-medium flex items-center justify-center">
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
