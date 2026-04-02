'use strict';

// TODO: bump CACHE_NAME (e.g. fe-civil-v2) every time you deploy changes to CSS/JS/HTML
const CACHE_NAME = 'fe-civil-v11';
const APP_SHELL  = [
  './index.html',
  './css/styles.css',
  './js/utils.js',
  './js/storage.js',
  './js/data/baseline.js',
  './js/data/subjects.js',
  './js/engine/calculations.js',
  './js/engine/spacedRepetition.js',
  './js/engine/adaptive.js',
  './js/engine/scheduler.js',
  './js/state.js',
  './js/ui/ui-dashboard.js',
  './js/ui/ui-plan.js',
  './js/ui/ui-sessions.js',
  './js/ui/ui-subjects.js',
  './js/ui/ui-revision.js',
  './js/ui/ui-resources.js',
  './js/ui/ui-assessments.js',
  './js/ui/ui-analytics.js',
  './js/ui/ui-settings.js',
  './js/app.js',
  './icons/icon.svg',
  './manifest.json',
];

// Pre-cache the app shell on install (individual failures don't block install)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(APP_SHELL.map(url =>
        cache.add(url).catch(err => console.warn(`[sw] Failed to cache ${url}:`, err))
      ))
    )
  );
  self.skipWaiting();
});

// Delete old caches on activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for app shell; network-only for Google APIs
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Never intercept Google auth / Drive API calls
  if (url.includes('googleapis.com') || url.includes('accounts.google.com')) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
