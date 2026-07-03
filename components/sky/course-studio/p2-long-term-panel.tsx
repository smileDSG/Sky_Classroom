'use client';

import { CalendarDays, Film, GraduationCap, Repeat2, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

interface VideoGenerationHandoff {
  status: 'ready_for_generation';
  providerHint: string;
  scenes: Array<{
    sceneId: string;
    title: string;
    durationSeconds: number;
  }>;
}

interface WeeklyLearningPlan {
  weekIndex: number;
  theme: string;
  goals: string[];
  reviewItems: string[];
  estimatedMinutes: number;
}

interface SpacedReviewItem {
  knowledgePoint: string;
  dueInDays: number;
  priority: string;
}

interface MasteryEstimate {
  knowledgePoint: string;
  mastery: number;
  stability: number;
  nextReviewInDays: number;
}

interface ClassGroupProfile {
  learnerCount: number;
  weakPointTrends: Array<{
    knowledgePoint: string;
    affectedLearners: number;
    averageMastery: number;
  }>;
  tierRecommendations: Array<{
    tier: string;
    learnerCount: number;
    focus: string;
  }>;
  teacherActions: string[];
}

interface P2Enhancements {
  videoHandoff: VideoGenerationHandoff;
  weeklyPlan: WeeklyLearningPlan[];
  spacedReviews: SpacedReviewItem[];
  masteryEstimates: MasteryEstimate[];
  classGroupProfile: ClassGroupProfile;
}

export function CourseStudioP2LongTermPanel({ p2 }: { p2: P2Enhancements }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">P2 Long-Term</h2>
        </div>
        <Badge variant="outline" className="h-7 rounded-full px-3">
          video + review + class trends
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Film className="h-4 w-4" />
            Video handoff
          </div>
          <div className="text-xs leading-5 text-slate-600 dark:text-slate-300">
            {p2.videoHandoff.providerHint} / {p2.videoHandoff.status}
          </div>
          <div className="mt-2 space-y-1">
            {p2.videoHandoff.scenes.slice(0, 3).map((scene) => (
              <div
                key={scene.sceneId}
                className="rounded-lg bg-white px-2 py-1 text-xs dark:bg-slate-950/70"
              >
                {scene.title} · {scene.durationSeconds}s
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <CalendarDays className="h-4 w-4" />
            4-week plan
          </div>
          <div className="space-y-2">
            {p2.weeklyPlan.map((week) => (
              <div
                key={week.weekIndex}
                className="rounded-lg bg-white px-2 py-2 text-xs dark:bg-slate-950/70"
              >
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  Week {week.weekIndex}: {week.theme}
                </div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {week.estimatedMinutes} min · {week.reviewItems.length} reviews
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Repeat2 className="h-4 w-4" />
            Spaced review
          </div>
          <div className="space-y-2">
            {p2.spacedReviews.slice(0, 4).map((item) => (
              <div
                key={item.knowledgePoint}
                className="rounded-lg bg-white px-2 py-2 text-xs dark:bg-slate-950/70"
              >
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  {item.knowledgePoint}
                </div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  due in {item.dueInDays}d · {item.priority}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <TrendingUp className="h-4 w-4" />
            Class trends
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {p2.classGroupProfile.learnerCount} demo learners
          </div>
          <div className="mt-2 space-y-2">
            {p2.classGroupProfile.weakPointTrends.slice(0, 3).map((trend) => (
              <div
                key={trend.knowledgePoint}
                className="rounded-lg bg-white px-2 py-2 text-xs dark:bg-slate-950/70"
              >
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  {trend.knowledgePoint}
                </div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {trend.affectedLearners} learners · mastery {trend.averageMastery}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
            Mastery model
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {p2.masteryEstimates.slice(0, 4).map((item) => (
              <div
                key={item.knowledgePoint}
                className="rounded-lg bg-white px-2 py-2 text-xs dark:bg-slate-950/70"
              >
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  {item.knowledgePoint}
                </div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  mastery {item.mastery} · stability {Math.round(item.stability * 100)}% · review{' '}
                  {item.nextReviewInDays}d
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
            Teacher actions
          </div>
          <div className="space-y-2">
            {p2.classGroupProfile.teacherActions.map((action) => (
              <div
                key={action}
                className="rounded-lg bg-white px-2 py-2 text-xs text-slate-600 dark:bg-slate-950/70 dark:text-slate-300"
              >
                {action}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
