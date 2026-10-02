'use client';

import { Suspense, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { StudentProfilePage } from '@/app/sky/student/student-profile-page';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import {
  LEARNING_FEATURES,
  type LearningFeatureKey,
} from '@/components/sky/learning/learning-feature-config';
import { KnowledgeGraphView } from '@/components/sky/learning/knowledge-graph-view';
import { MistakeBook } from '@/components/sky/learning/mistake-book';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { PageTour } from '@/components/sky/tour/page-tour';

interface LearningFeaturePageProps {
  activeFeature: LearningFeatureKey;
}

interface WorkshopMistakeSnapshot extends Omit<MistakeRecord, 'solvedAt' | 'source'> {
  solvedAt: string | number;
  source?: MistakeRecord['source'] | 'classroom-diagnostic';
}

function normalizeSnapshotMistake(mistake: WorkshopMistakeSnapshot): MistakeRecord {
  return {
    ...mistake,
    solvedAt: new Date(mistake.solvedAt),
    source:
      mistake.source === 'classroom-diagnostic'
        ? 'classroom-quiz'
        : (mistake.source as MistakeRecord['source']),
  };
}

export function LearningFeaturePage(props: LearningFeaturePageProps) {
  return (
    <Suspense
      fallback={
        <SkyAppShell>
          <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center text-sm text-muted-foreground">
            加载学习数据...
          </div>
        </SkyAppShell>
      }
    >
      <LearningFeaturePageContent {...props} />
    </Suspense>
  );
}

function LearningFeaturePageContent({ activeFeature }: LearningFeaturePageProps) {
  const mistakes = useSkyClassroomStore((state) => state.mistakes);
  const prioritizeReview = useSkyClassroomStore((state) => state.prioritizeReview);
  const activeMeta =
    LEARNING_FEATURES.find((feature) => feature.key === activeFeature) ?? LEARNING_FEATURES[0];
  const ActiveIcon = activeMeta.icon;

  const tourId: Record<LearningFeatureKey, string> = {
    mistakes: 'learning-mistakes',
    graph: 'learning-graph',
    profile: 'learning-profile',
  };

  const weakPoints = useMemo(() => {
    if (mistakes.length === 0) return [];
    return buildKnowledgeGraph(mistakes).weakPoints;
  }, [mistakes]);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        syncMistakesFromQuizzes();
        const response = await fetch('/api/sky/workshop', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json();
        if (cancelled || !response.ok || !data?.success || !Array.isArray(data.mistakes)) return;

        const normalized = data.mistakes.map(normalizeSnapshotMistake);
        if (data.dataSources?.replaceMistakes) {
          useSkyClassroomStore.setState({ mistakes: normalized });
        } else {
          useSkyClassroomStore.getState().mergeMistakes(normalized);
        }
      } catch {
        /* Keep feature pages usable with local store data. */
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SkyAppShell section="learning">
      <div className=" px-4 pt-6 pb-12 sm:px-6">
        <header
          data-tour-step="feature-header"
          className="mb-6 flex items-center justify-between gap-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
              <ActiveIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
                {activeMeta.label}
              </h1>
              <p className="mt-1 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                {activeMeta.desc}
              </p>
            </div>
          </div>
          <Link
            href="/sky/learning"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:shadow-none dark:hover:bg-white/[0.08]"
          >
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            返回学习工作台
          </Link>
        </header>

        <div data-tour-step="feature-content" className=" space-y-6">
          {activeFeature === 'mistakes' && <MistakeBook />}
          {activeFeature === 'graph' && (
            <div className=" space-y-6">
              <KnowledgeGraphView />
              {weakPoints.length > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-200/15 dark:bg-rose-300/10">
                  <div className="text-sm font-semibold text-rose-700 dark:text-rose-100">
                    薄弱知识点针对性复习
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {weakPoints.map((point) => (
                      <span
                        key={point}
                        className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700 dark:border-rose-200/20 dark:bg-rose-300/10 dark:text-rose-100"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/sky/cloud-mind/quiz?topic=${encodeURIComponent(weakPoints.join('、'))}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-300 px-3 py-2 text-xs font-semibold text-slate-950"
                    >
                      针对出题
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => prioritizeReview(weakPoints)}
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-300 px-3 py-2 text-xs font-semibold text-slate-950"
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      全部加入复习
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeFeature === 'profile' && <StudentProfilePage />}
        </div>
      </div>

      <PageTour id={tourId[activeFeature]} />
    </SkyAppShell>
  );
}
