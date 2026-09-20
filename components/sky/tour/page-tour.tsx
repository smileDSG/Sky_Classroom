'use client';

import { SpotlightTour } from '@/components/sky/tour/spotlight-tour';
import { PAGE_TOURS } from '@/lib/sky/page-tours';

export function PageTour({ id }: { id: string }) {
  const config = PAGE_TOURS[id];
  if (!config) return null;
  return <SpotlightTour steps={config.steps} seenKey={config.seenKey} />;
}
