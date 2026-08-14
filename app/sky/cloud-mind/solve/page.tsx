'use client';

import { SolvePage } from '@/components/sky/solve/solve-page';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

export default function CloudMindSolvePage() {
  return (
    <SkyAppShell section="resources" fullBleed>
      <div className="relative min-h-[calc(100dvh-4rem)] bg-[var(--probe-void)]">
        {/* Starfield */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <CelestialCanvas starCount={120} parallax={false} nebula grid={false} horizonGlow />
        </div>
        {/* Ambient glow */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-[var(--probe-primary)]/4 blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[var(--probe-accent)]/3 blur-[120px]" />
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-6 pt-6 pb-12">
          <SolvePage />
        </div>
      </div>
    </SkyAppShell>
  );
}
