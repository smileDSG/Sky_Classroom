'use client';

import { useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarClock } from 'lucide-react';
import { StudentProfilePage } from '@/app/sky/student/student-profile-page';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import {
  LEARNING_FEATURES,
  type LearningFeatureKey,
} from '@/components/sky/learning/learning-feature-config';
import { KnowledgeGraphView } from '@/components/sky/learning/knowledge-graph-view';
import { LearningStats } from '@/components/sky/learning/learning-stats';
import { MistakeBook } from '@/components/sky/learning/mistake-book';
import { ReviewPlan } from '@/components/sky/learning/review-plan';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { cn } from '@/lib/utils';

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

export function LearningFeaturePage({ activeFeature }: LearningFeaturePageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mistakes = useSkyClassroomStore((state) => state.mistakes);
  const prioritizeReview = useSkyClassroomStore((state) => state.prioritizeReview);
  const activeMeta =
    LEARNING_FEATURES.find((feature) => feature.key === activeFeature) ?? LEARNING_FEATURES[0];
  const ActiveIcon = activeMeta.icon;

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

        useSkyClassroomStore.getState().mergeMistakes(data.mistakes.map(normalizeSnapshotMistake));
      } catch {
        /* Keep feature pages usable with local store data. */
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleReviewAutoStartConsumed = useCallback(() => {
    if (searchParams.get('dailyTask') !== '1') return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('dailyTask');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-5 pb-8">
        <section className="overflow-hidden rounded-[24px] border border-cyan-100/10 bg-[#07111f]/95 shadow-[0_24px_72px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex flex-col gap-4 border-b border-cyan-100/10 bg-[linear-gradient(135deg,#123346_0%,#0d2438_52%,#0b1729_100%)] px-5 py-5 md:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Link
                href="/sky/learning"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/[0.09]"
              >
                <ArrowLeft className="h-4 w-4" />
                返回天梯工坊
              </Link>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200/25 bg-emerald-300/10 text-emerald-100">
                  <ActiveIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold leading-tight text-white">
                    {activeMeta.label}
                  </h1>
                  <p className="mt-1 text-sm text-slate-300">{activeMeta.desc}</p>
                </div>
              </div>
            </div>

            <nav className="max-w-full overflow-x-auto">
              <div className="flex min-w-max rounded-2xl border border-cyan-100/10 bg-[#081423]/80 p-1">
                {LEARNING_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  const active = feature.key === activeFeature;
                  return (
                    <Link
                      key={feature.key}
                      href={feature.href}
                      className={cn(
                        'flex min-w-[112px] items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors',
                        active
                          ? 'bg-emerald-300 text-slate-950 shadow-[0_8px_24px_rgba(52,211,153,0.14)]'
                          : 'text-slate-300 hover:bg-white/[0.05] hover:text-slate-100',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="block truncate text-xs font-semibold">{feature.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>

          <div className="bg-[#07111f]/70 p-4">
            <div className="rounded-2xl border border-cyan-100/10 bg-slate-950/20 p-3 lg:p-4">
              {activeFeature === 'mistakes' && <MistakeBook />}
              {activeFeature === 'review' && (
                <ReviewPlan
                  autoStart={searchParams.get('dailyTask') === '1'}
                  onAutoStartConsumed={handleReviewAutoStartConsumed}
                />
              )}
              {activeFeature === 'graph' && (
                <div className="space-y-4">
                  <KnowledgeGraphView />
                  {weakPoints.length > 0 && (
                    <div className="rounded-2xl border border-rose-200/15 bg-rose-300/10 p-4">
                      <div className="text-sm font-semibold text-rose-100">
                        薄弱知识点针对性复习
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {weakPoints.map((point) => (
                          <span
                            key={point}
                            className="rounded-full border border-rose-200/20 bg-rose-300/10 px-3 py-1 text-xs font-medium text-rose-100"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/sky/cloud-mind/quiz?topic=${encodeURIComponent(weakPoints.join('、'))}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-950"
                        >
                          针对出题
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => prioritizeReview(weakPoints)}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-950"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          全部加入复习
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeFeature === 'stats' && <LearningStats />}
              {activeFeature === 'profile' && <StudentProfilePage />}
            </div>
          </div>
        </section>
      </div>
    </SkyAppShell>
  );
}
