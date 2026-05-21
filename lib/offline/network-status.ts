/**
 * Network status detection hook.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActions: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing] = useState(false);
  const [pendingActions] = useState(0);

  const goOnline = useCallback(() => setIsOnline(true), []);
  const goOffline = useCallback(() => setIsOnline(false), []);

  useEffect(() => {
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [goOnline, goOffline]);

  return { isOnline, isSyncing, pendingActions };
}

/** Register the service worker */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.warn('[PWA] Service Worker registration failed:', err);
    return null;
  }
}
