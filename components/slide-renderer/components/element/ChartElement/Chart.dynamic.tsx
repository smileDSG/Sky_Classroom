'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import Chart component to reduce initial bundle size
const Chart = dynamic(() => import('./Chart').then((m) => ({ default: m.Chart })), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full" />,
});

export { Chart };
