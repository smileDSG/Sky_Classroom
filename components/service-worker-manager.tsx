'use client';

import { useEffect } from 'react';

export function ServiceWorkerManager() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Development: aggressively unregister any stale service workers so
    // Turbopack can serve fresh chunks on every rebuild. Caching static
    // chunks via SW caused stale lucide-react modules to be served after
    // rebuilds, leading to "module factory is not available" errors.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {
          // ignore
        });
      }
    });
  }, []);

  return null;
}
