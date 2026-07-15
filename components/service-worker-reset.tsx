'use client';

import { useEffect } from 'react';

const CHUNK_RECOVERY_KEY = 'openmaic-dev-chunk-recovery';

function isChunkLoadError(reason: unknown) {
  const text =
    reason instanceof Error
      ? `${reason.name} ${reason.message} ${reason.stack ?? ''}`
      : String(reason ?? '');

  return (
    text.includes('ChunkLoadError') ||
    text.includes('Loading chunk') ||
    text.includes('Failed to load chunk') ||
    text.includes('dynamically imported module')
  );
}

export function ServiceWorkerReset() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const clearDevCaches = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
        }

        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(
            names.filter((name) => name.startsWith('openmaic-')).map((name) => caches.delete(name)),
          );
        }
      } catch (error) {
        console.warn('[ServiceWorkerReset] Failed to clear development service worker:', error);
      }
    };

    const recoverFromChunkError = async (reason: unknown) => {
      if (!isChunkLoadError(reason)) return;
      if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === '1') return;
      sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');
      await clearDevCaches();
      window.location.reload();
    };

    const handleError = (event: ErrorEvent) => {
      recoverFromChunkError(event.error ?? event.message);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      recoverFromChunkError(event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    clearDevCaches();

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
