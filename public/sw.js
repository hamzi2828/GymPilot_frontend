/* GymsPilotPro service worker: installability, an offline page, and push. */

const SHELL_CACHE = 'gympilot-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL])));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Pages come from the network; only when that fails does the offline page
// show. Nothing else is intercepted, so API calls and assets behave exactly
// as they do without a worker.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

// Where a notification may take the member: a page of this site and nothing
// else. A relative path is resolved against the site; a full address on
// another site (or anything that is not http/https) opens the homepage
// instead, so a push cannot send anyone off to a look-alike page.
function sameOriginUrl(raw) {
  try {
    const target = new URL(typeof raw === 'string' && raw ? raw : '/', self.location.origin);
    if (target.origin !== self.location.origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'GymsPilotPro';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/app-icon.svg',
    badge: '/icons/app-icon.svg',
    data: { url: sameOriginUrl(data.url) }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Checked again here: a notification shown by an older copy of this worker
  // carries whatever address it was sent.
  const url = sameOriginUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
