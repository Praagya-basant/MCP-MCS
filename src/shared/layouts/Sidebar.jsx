import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/utils/cn';
import { Logo } from '@/shared/components/Logo';

/**
 * Renders one or more nav sections. Each module (mcs, and eventually mcp)
 * supplies its own section — this component just lays them out, so a
 * second module can register another section without touching this file.
 */
export function Sidebar({ sections, subtitle }) {
  return (
    <aside className="w-[240px] shrink-0 h-screen sticky top-0 bg-sidebar border-r border-border flex flex-col">
      <div className="h-16 flex flex-col justify-center gap-1 px-5 border-b border-border shrink-0">
        <Logo variant="black" className="h-5 w-auto object-contain" />
        {subtitle && <div className="text-caption text-ink-secondary leading-tight truncate">{subtitle}</div>}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 flex flex-col gap-5">
        {sections.map((section) => (
          <div key={section.title || 'main'}>
            {section.title && (
              <div className="px-2 mb-1.5 text-caption font-medium uppercase tracking-wide text-ink-muted">
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
                      'interactive relative h-9 flex items-center gap-2.5 rounded-lg px-2.5 text-body',
                      isActive
                        ? 'bg-white text-ink font-medium shadow-card'
                        : 'text-ink-secondary hover:bg-surface-subtle hover:text-ink'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-ink" />
                      )}
                      <span className="w-4 h-4 shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
