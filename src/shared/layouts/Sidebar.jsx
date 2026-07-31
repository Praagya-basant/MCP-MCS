import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { Logo } from '@/shared/components/Logo';
import { useAuth } from '@/shared/context/AuthContext';
import { useFeedback } from '@/shared/context/FeedbackContext';

const CONTACT_EMAIL = 'praagya@basant.info';

/**
 * Renders one or more nav sections. Each module (mcs, and eventually mcp)
 * supplies its own section — this component just lays them out, so a
 * second module can register another section without touching this file.
 * `subtitle` doubles as the role line shown under the signed-in user's
 * name (each role layout already passes its role label here for the
 * Topbar's context label, so it's reused rather than threading a new prop).
 *
 * A nav item can carry a `badgeKey` (see AdminLayout's Feedback entry) to
 * show a live count pill next to its label — currently only
 * `feedbackUnread`, sourced from FeedbackContext, but the lookup is
 * generic so a future badge just needs its own key added to `badgeValues`.
 */
export function Sidebar({ sections, subtitle }) {
  const { profile } = useAuth();
  const { unreadCount } = useFeedback() || {};

  const badgeValues = { feedbackUnread: unreadCount || 0 };

  return (
    <aside className="hidden md:flex w-[240px] shrink-0 h-screen sticky top-0 bg-sidebar border-r border-border flex-col">
      <div className="min-h-[64px] flex items-center px-6 py-6 border-b border-border shrink-0">
        <Logo variant="black" className="h-5 w-auto object-contain" />
      </div>

      {profile && (
        <div className="px-6 py-4 border-b border-border shrink-0">
          <p className="text-[13px] font-medium text-ink truncate">{profile.full_name}</p>
          {subtitle && <p className="mt-0.5 text-[11px] text-ink-muted truncate">{subtitle}</p>}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4 flex flex-col gap-5 select-none">
        {sections.map((section) => (
          <div key={section.title || 'main'}>
            {section.title && (
              <div className="mt-6 mb-1.5 pl-4 text-[10px] font-medium uppercase tracking-widest text-ink-muted">
                {section.title}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'interactive relative h-9 flex items-center gap-2 rounded-md px-3 text-body',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15',
                      isActive
                        ? 'bg-surface-subtle text-ink font-medium'
                        : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-ink" />
                      )}
                      <span className="w-4 h-4 shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                      {item.badgeKey && badgeValues[item.badgeKey] > 0 && (
                        <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-ink text-[10px] font-medium flex items-center justify-center">
                          {badgeValues[item.badgeKey]}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Quiet footer line — not styled as a feature. */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="interactive select-none block px-3 py-1 text-[11px] text-ink-muted hover:text-ink-secondary"
        >
          Contact admin for support
        </a>
      </div>
    </aside>
  );
}
