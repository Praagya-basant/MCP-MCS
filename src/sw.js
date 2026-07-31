import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// injectManifest strategy (not generateSW) — this file is the actual
// service worker source, bundled as-is by vite-plugin-pwa with
// self.__WB_MANIFEST replaced by the real precache list. Switched from
// generateSW specifically so `push`/`notificationclick` listeners below
// can exist at all — generateSW's fully-generated output has no hook for
// custom event listeners.
self.skipWaiting();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST);

// Same two runtime-caching rules the old generateSW `workbox.runtimeCaching`
// config had: Google Fonts never change once fetched (cache-first);
// Supabase API calls prefer a fresh network response but fall back to the
// last-known one within 8s instead of hanging when offline/flaky.
registerRoute(
  ({ url }) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i.test(url.href),
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ url }) => /^https:\/\/.*\.supabase\.co\/.*/i.test(url.href),
  new NetworkFirst({
    cacheName: 'supabase-api',
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Web push payloads are sent empty (see send-notification's sendWebPush())
// — no RFC 8291 payload encryption, VAPID auth only — so this always shows
// a generic prompt; the real content is whatever's unread in the bell once
// the app is opened. event.data is intentionally never read.
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('BASANT', {
      body: 'You have new activity — tap to view.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});
