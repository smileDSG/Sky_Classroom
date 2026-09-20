'use client';
export const dynamic = 'force-dynamic';

import { TeachingPage } from '@/app/sky/teaching/teaching-page';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import type { TeachingGenerationPolicy } from '@/lib/teaching/personalization-policy';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { PageTour } from '@/components/sky/tour/page-tour';

export default function CloudMindTeachingRoute() {
  return (
    <SkyAppShell section="teaching" fullBleed>
      <Suspense fallback={<CloudMindTeachingFallback />}>
        <CloudMindTeachingContent />
      </Suspense>
    </SkyAppShell>
  );
}

function CloudMindTeachingFallback() {
  return <div className="relative min-h-[calc(100dvh-4rem)] bg-[var(--teaching-void)]" />;
}

function CloudMindTeachingContent() {
  const searchParams = useSearchParams();
  const queryTopic = searchParams.get('topic');
  const showHistoryInitially = searchParams.get('view') === 'history';
  const [contextTopic, setContextTopic] = useState('');
  const [personalizationNotice, setPersonalizationNotice] = useState<string | null>(null);
  const [personalizationPolicy, setPersonalizationPolicy] =
    useState<TeachingGenerationPolicy | null>(null);
  const [personalizationContext, setPersonalizationContext] =
    useState<PersonalizationContext | null>(null);
  const effectiveInitialTopic = queryTopic ?? contextTopic;
  const effectivePersonalizationNotice = personalizationNotice;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sky/cloud-mind/personalization-context')
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: PersonalizationContext }) => {
        if (cancelled || !json.success || !json.data) return;
        const context = json.data;
        setPersonalizationContext(context);
        const recommendedTopic =
          context.tutoringPolicy?.targetTopic ??
          context.learningPath?.next ??
          context.weakPoints[0]?.knowledgePoint;
        const topic = recommendedTopic ?? '\u5165\u95e8\u8bca\u65ad';
        const teachingPolicy = context.toolPolicies?.teaching;
        const policy = teachingPolicy
          ? {
              difficulty: teachingPolicy.difficulty,
              explanationStyle: teachingPolicy.explanationStyle,
              resourceFormats: context.tutoringPolicy?.resourceFormats ?? ['worked_example'],
              pacing: teachingPolicy.pacing,
              reasonCodes: teachingPolicy.reasonCodes,
              profileVersion: context.learnerDecision?.profileVersion ?? 0,
            }
          : null;
        setPersonalizationPolicy(policy);
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
        const styleLabel =
          policy?.explanationStyle === 'principle_first'
            ? '原理优先'
            : policy?.explanationStyle === 'example_first'
              ? '例题优先'
              : policy?.explanationStyle === 'practice_first'
                ? '练习优先'
                : '步骤优先';
        if (!queryTopic && recommendedTopic) setContextTopic(recommendedTopic);
        setPersonalizationNotice(
          queryTopic && policy
            ? `保留你选择的主题；已按你的情况调整为 ${difficultyLabel}、${pacingLabel}、${styleLabel}。`
            : context.learnerDecision
              ? `${context.learnerDecision.summary} ${topic} / 微课讲解`
              : `学习安排：${topic} · ${difficultyLabel} · ${pacingLabel} · ${styleLabel}。`,
        );
      })
      .catch(() => {
        /* keep empty defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [queryTopic]);

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] bg-[var(--teaching-void)]">
      {/* Deep space starfield */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <CelestialCanvas starCount={100} parallax={false} nebula grid={false} />
      </div>
      {/* Aurora ambient glow overlays */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/3 h-[500px] w-[500px] rounded-full bg-[var(--teaching-primary)]/4 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[var(--teaching-accent)]/3 blur-[120px]" />
        <div className="absolute top-1/2 left-0 h-[300px] w-[300px] rounded-full bg-[var(--teaching-primary)]/3 blur-[100px]" />
      </div>

      {/* Content */}
      <div
        className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-12"
        data-tour-step="page-header"
      >
        <div data-tour-step="page-primary">
          <TeachingPage
            initialTopic={effectiveInitialTopic}
            personalizationNotice={effectivePersonalizationNotice}
            personalizationPolicy={personalizationPolicy}
            personalizationContext={personalizationContext}
            showHistoryInitially={showHistoryInitially}
          />
        </div>
      </div>
      <PageTour id="teaching-ai" />
    </div>
  );
}
