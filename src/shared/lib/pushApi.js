import { supabase } from '@/shared/lib/supabaseClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Feature-detected, not platform-detected — deliberately no UA sniffing
 * for "is this Android". Where PushManager exists (Chrome/Edge on
 * Android, and iOS Safari 16.4+ for an installed PWA) it just works;
 * where it doesn't, this silently stays false and email is the only
 * channel, matching the "push on Android, email on iPhone" intent
 * without hardcoding an assumption that stops being true as iOS support
 * improves.
 */
export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

// Web Push's applicationServerKey wants a raw Uint8Array, not the
// base64url string VAPID public keys are normally shared as.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Reuses an existing subscription if the browser already has one for this
 * service worker registration (common on repeat visits); only prompts for
 * permission when there isn't one yet. Upserts on `endpoint` so calling
 * this again (e.g. every login) is always safe — never creates duplicate
 * rows for the same browser/device.
 */
export async function subscribeToPush(profileId) {
  if (!isPushSupported() || Notification.permission === 'denied') return;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: profileId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save push subscription', error);
  }
}
