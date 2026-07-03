'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSettingsStore } from '@/lib/store/settings';
import { runStartupCacheCheck } from '@/lib/utils/cache-recovery';

function isPublicSkyLearningRoute(pathname?: string | null): boolean {
  return (
    pathname?.startsWith('/sky/software-cup') ||
    pathname?.startsWith('/sky/cloud-mind/course-studio') ||
    pathname?.startsWith('/sky/study-lab') ||
    false
  );
}

/**
 * Fetches server-configured providers on mount and merges into settings store.
 * Also runs a one-time cache health check to auto-clear corrupted entries.
 * Renders nothing — purely a side-effect component.
 */
export function ServerProvidersInit() {
  const pathname = usePathname();
  const fetchServerProviders = useSettingsStore((state) => state.fetchServerProviders);
  const skipServerProviders = isPublicSkyLearningRoute(pathname);

  useEffect(() => {
    if (skipServerProviders) return;
    fetchServerProviders();
    runStartupCacheCheck();
  }, [fetchServerProviders, skipServerProviders]);

  return null;
}
