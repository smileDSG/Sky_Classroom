import { Suspense } from 'react';
import SlidesPage from '@/components/sky/slides/slides-page';

export default function SlidesPageRoute() {
  return (
    <Suspense fallback={null}>
      <SlidesPage />
    </Suspense>
  );
}
