'use client';

/**
 * 学习分析页（T02 / FR-01/02）。
 * 用真实记录呈现：掌握度曲线、进度概览、错题减少趋势。
 * 不再 redirect 到 profile-dashboard。
 */

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { MasteryCurveCard } from '@/components/sky/dashboard/mastery-curve-card';
import { MistakeTrendCard } from '@/components/sky/dashboard/mistake-trend-card';
import { ProgressOverviewCard } from '@/components/sky/dashboard/progress-overview-card';

export default function LearningStatsPage() {
  return (
    <SkyAppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">学习分析</h1>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-300">
            只看真实记录：掌握度曲线、已攻克错题与薄弱点趋势。
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <MasteryCurveCard />
          <ProgressOverviewCard />
          <div className="md:col-span-2">
            <MistakeTrendCard />
          </div>
        </div>
      </div>
    </SkyAppShell>
  );
}
