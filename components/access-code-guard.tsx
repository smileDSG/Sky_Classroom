'use client';

import { useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AccessCodeModal } from '@/components/access-code-modal';

function isPublicSkyLearningRoute(pathname?: string | null): boolean {
  return (
    pathname?.startsWith('/sky/software-cup') ||
    pathname?.startsWith('/sky/cloud-mind/course-studio') ||
    pathname?.startsWith('/sky/study-lab') ||
    false
  );
}

export function AccessCodeGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const skipAccessCode = isPublicSkyLearningRoute(pathname);
  const [status, setStatus] = useState<{
    enabled: boolean;
    authenticated: boolean;
    loading: boolean;
  }>({ enabled: false, authenticated: false, loading: true });

  useEffect(() => {
    if (skipAccessCode) {
      return;
    }

    let cancelled = false;
    fetch('/api/access-code/status')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setStatus({
            enabled: data.enabled,
            authenticated: data.authenticated,
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Default to requiring auth on error — safer than silently disabling
          setStatus({ enabled: true, authenticated: false, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [skipAccessCode]);

  const needsAuth = !status.loading && status.enabled && !status.authenticated;

  if (skipAccessCode) {
    return <>{children}</>;
  }

  return (
    <>
      {needsAuth && (
        <AccessCodeModal
          open={true}
          onSuccess={() => setStatus((s) => ({ ...s, authenticated: true }))}
        />
      )}
      {children}
    </>
  );
}
