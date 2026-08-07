import { AnimatePresence, motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/core/context/ThemeContext';
import { cn } from '@/core/utils/cn';

/**
 * Icon-only sun/moon toggle (Topbar desktop, AccountMenuContent — which
 * also renders inside the mobile Profile sheet, so this one component
 * covers both placements the design spec calls for). `variant="switch"`
 * renders a pill track instead, used inline in menus where a labeled
 * control reads better than a bare icon button.
 */
export function ThemeToggle({ variant = 'icon', className }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'switch') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
        onClick={toggleTheme}
        className={cn(
          'interactive relative w-11 h-6 rounded-pill shrink-0',
          isDark ? 'bg-accent' : 'bg-surface-subtle border border-border',
          className
        )}
      >
        <motion.span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-card shadow-card flex items-center justify-center text-ink"
          animate={{ left: isDark ? 22 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        >
          {isDark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
        </motion.span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={toggleTheme}
      className={cn(
        'interactive relative w-9 h-9 flex items-center justify-center rounded-control text-ink-secondary hover:bg-surface-subtle hover:text-ink overflow-hidden',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          className="flex items-center justify-center"
        >
          {isDark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
