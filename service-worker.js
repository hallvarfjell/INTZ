// service-worker.js
// INTZ v10.1 – SPA-cache
// Oppdatert for dashboard/øktbygger FIX.

const CACHE =
  "intervall-cache-v101-dashboard-no-reset-v1";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./spa-router.js",
  "./supabase-client.js",
  "./cloud-sync.js",
  "./settings-core.js",
  "./settings-view.js",
  "./log-view.js",
  "./main.js",
  "./builder.js",
  "./results.js"
];

self.addEventListener(
  "install",
  event => {
    self.skipWaiting();

    event.waitUntil(
      caches
        .open(CACHE)
        .then(cache =>
          cache.addAll(
            APP_ASSETS
          )
        )
    );
  }
);

self.addEventListener(
  "activate",
  event => {
    event.waitUntil(
      (async () => {
        const names =
          await caches.keys();

        await Promise.all(
          names
            .filter(
              name =>
                name !== CACHE
            )
            .map(
              name =>
                caches.delete(
                  name
                )
            )
        );

        await self.clients.claim();
      })()
    );
  }
);

self.addEventListener(
  "fetch",
  event => {
    const request =
      event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const url =
      new URL(request.url);

    if (
      url.origin ===
      self.location.origin
    ) {
      event.respondWith(
        (async () => {
          try {
            const response =
              await fetch(request);

            if (
              response &&
              response.ok
            ) {
              const cache =
                await caches.open(
                  CACHE
                );

              await cache.put(
                request,
                response.clone()
              );
            }

            return response;
          } catch (error) {
            const cached =
              await caches.match(
                request
              );

            if (cached) {
              return cached;
            }

            throw error;
          }
        })()
      );

      return;
    }

    event.respondWith(
      caches
        .match(request)
        .then(
          cached =>
            cached ||
            fetch(request)
        )
    );
  }
);