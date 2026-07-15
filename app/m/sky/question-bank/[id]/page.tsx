'use client';

import { useParams } from 'next/navigation';
import { MobileSkyFrame } from '@/components/mobile/mobile-sky-frame';

export default function MobileQuestionBankDetailPage() {
  const params = useParams<{ id: string }>();
  return <MobileSkyFrame src={`/sky/question-bank/${params.id}`} />;
}
