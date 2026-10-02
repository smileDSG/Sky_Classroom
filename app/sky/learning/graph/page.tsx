import { LearningFeaturePage } from '@/components/sky/learning/learning-feature-page';
import { MasteryCurveCard } from '@/components/sky/dashboard/mastery-curve-card';
import { MistakeTrendCard } from '@/components/sky/dashboard/mistake-trend-card';

export default function LearningGraphPage() {
  return (
    <>
      <LearningFeaturePage activeFeature="graph" />
      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-950 dark:text-white">成长可见</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <MasteryCurveCard />
          <MistakeTrendCard />
        </div>
      </section>
    </>
  );
}
