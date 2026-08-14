# Debug Report: ChunkLoadError from stale Service Worker cache

- Symptom: Next/Turbopack reported `Runtime ChunkLoadError` for dynamic chunks such as `_53a80c61._.js`.
- Root cause: `public/sw.js` used cache-first for `/_next/static/*`, and `proxy.ts` did not allow `/sw.js` or `/manifest.json` through as public static assets. The browser could keep a stale service worker/cache while the dev server rebuilt a different Turbopack module graph.
- Fix:
  - Rewrote `public/sw.js` as valid JavaScript, changed Next static chunks to network-only, and bumped cache names.
  - Added `components/service-worker-reset.tsx` to unregister old service workers and delete `sky_classroom-*` caches in development.
  - Mounted `ServiceWorkerReset` in `app/layout.tsx`.
  - Added `/sw.js` and `/manifest.json` to `proxy.ts` public/static allowlist and matcher exclusion.
- Evidence:
  - `GET /sw.js` returns `200 application/javascript`.
  - `GET /manifest.json` returns `200 application/json`.
  - `GET /_next/static/chunks/_53a80c61._.js` returns `200 application/javascript`.
  - `pnpm exec eslint proxy.ts components/service-worker-reset.tsx app/layout.tsx` passed.
- Status: DONE_WITH_CONCERNS. Browser must reload once after the fix so the old service worker can be unregistered.
