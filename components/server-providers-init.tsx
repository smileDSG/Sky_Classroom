'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/store/settings';
import { runStartupCacheCheck } from '@/lib/utils/cache-recovery';

/**
 * Fetches server-configured providers on mount and merges into settings store.
 * Also runs a one-time cache health check to auto-clear corrupted entries.
 * Renders nothing — purely a side-effect component.
 */
export function ServerProvidersInit() {
  const fetchServerProviders = useSettingsStore((state) => state.fetchServerProviders);

  useEffect(() => {
    fetchServerProviders();
    runStartupCacheCheck();
  }, [fetchServerProviders]);

  return null;
}
