import { Suspense } from 'react';
import SlidesPage from '@/components/sky/slides/slides-page';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

export default function SlidesPageRoute() {
  return (
    <SkyAppShell>
      <Suspense fallback={null}>
        <SlidesPage />
      </Suspense>
    </SkyAppShell>
  );
}
