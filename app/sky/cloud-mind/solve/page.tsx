'use client';

import { SolvePage } from '@/components/sky/solve/solve-page';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

export default function CloudMindSolvePage() {
  return (
    <SkyAppShell section="resources" fullBleed>
      <div className="min-h-[calc(100dvh-4rem)] px-4 pb-12 pt-6 sm:px-6">
        <SolvePage />
      </div>
    </SkyAppShell>
  );
}
