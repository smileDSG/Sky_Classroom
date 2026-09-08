'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const KagamiPanelGuard = dynamic(
  () => import('@/components/ai/kagami-panel-guard').then((module) => module.KagamiPanelGuard),
  { ssr: false },
);
const ClassroomJobPoller = dynamic(
  () => import('@/components/classroom-job-poller').then((module) => module.ClassroomJobPoller),
  { ssr: false },
);
const SlidesJobPoller = dynamic(
  () => import('@/components/slides-job-poller').then((module) => module.SlidesJobPoller),
  { ssr: false },
);

export function DeferredGlobalServices() {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;

  // Public auth/gap routes have no classroom or slides jobs to poll.
  const isAuthPage = pathname.startsWith('/auth') || pathname.startsWith('/m/auth');

  return (
    <>
      <KagamiPanelGuard />
      {!isAuthPage && pathname !== '/' && <ClassroomJobPoller />}
      {!isAuthPage && <SlidesJobPoller />}
    </>
  );
}
