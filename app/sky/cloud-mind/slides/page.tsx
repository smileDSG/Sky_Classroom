'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SlidesPage from '@/components/sky/slides/slides-page';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

export default function CloudMindSlidesPage() {
  const searchParams = useSearchParams();
  const queryTopic = searchParams.get('topic');
  const [initialTopic, setInitialTopic] = useState<string | undefined>();
  const [personalizationNotice, setPersonalizationNotice] = useState<string | null>(null);
  const [personalizationContext, setPersonalizationContext] =
    useState<PersonalizationContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/sky/cloud-mind/personalization-context')
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: PersonalizationContext }) => {
        if (cancelled || !json.success || !json.data) return;

        const context = json.data;
        setPersonalizationContext(context);
        const recommendedTopic =
          queryTopic ??
          context.toolPolicies?.slides.targetTopic ??
          context.tutoringPolicy?.targetTopic ??
          context.learningPath?.next ??
          context.weakPoints[0]?.knowledgePoint;

        if (recommendedTopic) {
          setInitialTopic(recommendedTopic);
          const policy = context.toolPolicies?.slides;
          const difficultyLabel =
            policy?.difficulty === 'easy'
              ? '基础难度'
              : policy?.difficulty === 'hard'
                ? '挑战难度'
                : '标准难度';
          const pacingLabel =
            policy?.pacing === 'remedial'
              ? '补基础节奏'
              : policy?.pacing === 'sprint'
                ? '冲刺节奏'
                : '稳步推进';
          const formatLabel =
            policy?.explanationStyle === 'example_first' ? '例题优先' : '结构化讲解';
          setPersonalizationNotice(
            `学习安排：${recommendedTopic} · ${difficultyLabel} · ${pacingLabel} · ${formatLabel}。课件会优先覆盖需要加强的内容。`,
          );
        }
      })
      .catch(() => {
        /* personalization is optional */
      });

    return () => {
      cancelled = true;
    };
  }, [queryTopic]);

  return (
    <SkyAppShell section="resources" fullBleed>
      <Suspense fallback={null}>
        <SlidesPage
          initialTopic={initialTopic}
          personalizationNotice={personalizationNotice}
          personalizationContext={personalizationContext}
        />
      </Suspense>
    </SkyAppShell>
  );
}
