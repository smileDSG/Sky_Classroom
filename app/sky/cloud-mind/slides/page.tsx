'use client';

import { Suspense, useEffect, useState } from 'react';
import SlidesPage from '@/components/sky/slides/slides-page';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';

export default function CloudMindSlidesPage() {
  const [initialTopic, setInitialTopic] = useState<string | undefined>();
  const [personalizationNotice, setPersonalizationNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/sky/cloud-mind/personalization-context')
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: PersonalizationContext }) => {
        if (cancelled || !json.success || !json.data) return;

        const context = json.data;
        const recommendedTopic =
          context.learningPath?.next ?? context.weakPoints[0]?.knowledgePoint;

        if (recommendedTopic) {
          setInitialTopic(recommendedTopic);
          setPersonalizationNotice(`已根据天梯工坊为你预设：${recommendedTopic} / 按薄弱点组课`);
        }
      })
      .catch(() => {
        /* personalization is optional */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Suspense fallback={null}>
      <SlidesPage initialTopic={initialTopic} personalizationNotice={personalizationNotice} />
    </Suspense>
  );
}
