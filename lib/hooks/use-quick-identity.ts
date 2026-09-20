'use client';

import { useEffect, useState } from 'react';
import { getQuickIdentity, type QuickIdentity } from '@/lib/onboarding/quick-onboarding';

export function useQuickIdentity(): QuickIdentity | null {
  const [identity, setIdentity] = useState<QuickIdentity | null>(null);

  useEffect(() => {
    setIdentity(getQuickIdentity());
  }, []);

  return identity;
}
