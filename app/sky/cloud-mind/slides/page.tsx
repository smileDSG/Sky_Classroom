'use client';

import { Suspense } from 'react';
import SlidesPage from '@/components/sky/slides/slides-page';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

export default function CloudMindSlidesPage() {
  return (
    <SkyAppShell>
      <div className="h-[calc(100vh-4rem)]">
        <Suspense fallback={null}>
          <SlidesPage />
        </Suspense>
      </div>
    </SkyAppShell>
  );
}
