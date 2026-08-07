import { useAuth } from '@/core/auth/AuthContext';
import { NotificationBell } from '@/core/components/NotificationBell';
import { ThemeToggle } from '@/core/components/ThemeToggle';
import { ROLES } from '@/core/utils/constants';

/** Role-appropriate context label — hall name for managers, buyer name for merchants, "Admin" otherwise. */
function useContextLabel() {
  const { profile, role } = useAuth();
  if (role === ROLES.HALL_MANAGER) return profile?.hall?.name || 'Manager';
  if (role === ROLES.MERCHANT) return profile?.buyer?.name || 'Merchant';
  return 'Admin';
}

/**
 * Top bar — desktop-only. Account access (avatar/name/sign-out) lives in
 * the Sidebar's bottom user section now, not here, so this is just the
 * context label plus the two right-aligned utility controls.
 */
export function Topbar() {
  const contextLabel = useContextLabel();

  return (
    <header className="h-16 shrink-0 border-b border-border bg-bg sticky top-0 z-10 flex items-center justify-between px-6 gap-4">
      <span className="text-body font-medium text-ink truncate select-none">{contextLabel}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <ThemeToggle />
        <NotificationBell />
      </div>
    </header>
  );
}
