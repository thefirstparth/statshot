/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
};

const SHARE_CACHE = 'sweatshot-share';

// Android share target: stash the shared file locally, then hand over to the app.
// (iOS ignores share_target; that's expected.)
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const file = form.getAll('file').find((v): v is File => typeof v !== 'string');
        if (file) {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put('/shared-file', new Response(file, { headers: { 'Content-Type': 'application/octet-stream' } }));
        }
      } catch {
        // Fall through: the app opens normally.
      }
      return Response.redirect('/?shared=1', 303);
    })(),
  );
});

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// Offline navigation (including /?shared=1) is served from the precached shell.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));
