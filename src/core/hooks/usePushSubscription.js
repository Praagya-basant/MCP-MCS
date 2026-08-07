import { useEffect, useRef } from 'react';
import { useAuth } from '@/core/auth/AuthContext';
import { subscribeToPush, isPushSupported } from '@/core/notifications/pushApi';

/**
 * Silently attempts to (re-)establish this device's push subscription once
 * per authenticated session — a no-op everywhere push isn't supported. If
 * permission was already granted or denied in an earlier session, this
 * just re-syncs the subscription row (or does nothing) instead of
 * re-prompting; the browser's own permission prompt only ever fires when
 * there's no existing subscription and permission is still 'default'.
 */
export function usePushSubscription() {
  const { profile } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (!profile?.id || attempted.current || !isPushSupported()) return;
    attempted.current = true;
    subscribeToPush(profile.id).catch(() => {});
  }, [profile?.id]);
}
