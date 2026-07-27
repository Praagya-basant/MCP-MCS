import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/shared/context/AuthContext';
import { countUnreadFeedback } from '@/shared/lib/feedbackApi';
import { ROLES } from '@/shared/utils/constants';

const FeedbackContext = createContext(null);

/**
 * Tracks the admin-only unread feedback count for the sidebar's
 * "Feedback" nav badge. Lives above the router (see App.jsx) so the
 * count survives navigation and can be refreshed on demand — e.g. by the
 * Admin Feedback page right after marking a message read — without a
 * full page reload or prop-drilling through every layout.
 */
export function FeedbackProvider({ children }) {
  const { role } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (role !== ROLES.SUPER_ADMIN) {
      setUnreadCount(0);
      return;
    }
    try {
      setUnreadCount(await countUnreadFeedback());
    } catch {
      // Best-effort badge — a failed count fetch shouldn't surface anywhere.
    }
  }, [role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <FeedbackContext.Provider value={{ unreadCount, refresh }}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  return useContext(FeedbackContext);
}
