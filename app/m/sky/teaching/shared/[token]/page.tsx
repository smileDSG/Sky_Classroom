'use client';

import { useParams } from 'next/navigation';
import { MobileSkyFrame } from '@/components/mobile/mobile-sky-frame';

export default function MobileSharedTeachingPage() {
  const params = useParams<{ token: string }>();
  return <MobileSkyFrame src={`/sky/teaching/shared/${params.token}`} />;
}
