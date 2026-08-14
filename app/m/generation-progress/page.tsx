'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { MobileGenerationStatusCard } from '@/components/mobile/generation/mobile-generation-status-card';
import { MobileGenerationSteps } from '@/components/mobile/generation/mobile-generation-steps';
import { MobileGenerationDone } from '@/components/mobile/generation/mobile-generation-done';
import { MobileOutlineReview } from '@/components/mobile/generation/mobile-outline-review';
import { useClassroomJob } from '@/lib/hooks/use-classroom-job';
import { useSettingsStore } from '@/lib/store/settings';
import { removeActiveJobEntry } from '@/lib/classroom/classroom-session';
import { ArrowLeft } from 'lucide-react';

function MobileGenerationProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const {
    phase,
    step,
    progress,
    message,
    outlines,
    outlinesMeta,
    scenesGenerated,
    totalScenes,
    result,
    error,
    cancelling,
    approving,
    stepLabel,
    handleApproveOutline,
    handleCancel,
    setOutlines,
  } = useClassroomJob(jobId);

  const alwaysReview = useSettingsStore((s) => s.reviewOutlineEnabled);
  const setAlwaysReview = useSettingsStore((s) => s.setReviewOutlineEnabled);

  const handleGoToClassroom = () => {
    if (result?.classroomId) {
      removeActiveJobEntry(jobId!);
      router.push(`/m/classroom/${result.classroomId}`);
    }
  };

  const handleBackHome = () => {
    router.push('/m/sky');
  };

  return (
    <MobileSkyShell fullBleed>
      <div className="space-y-4 px-4 pb-28 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackHome}
            className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-[#0d1728] text-slate-200 transition-colors active:bg-[#172436]"
            aria-label="返回"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">课堂生成</h1>
            <p className="text-xs text-slate-400">{jobId ? jobId.slice(0, 8) : '无任务'}</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Done */}
        {phase === 'done' && result && (
          <MobileGenerationDone
            scenesCount={result.scenesCount}
            onGoToClassroom={handleGoToClassroom}
          />
        )}

        {/* Reviewing */}
        {phase === 'reviewing' && outlines && (
          <MobileOutlineReview
            outlines={outlines}
            totalScenes={outlinesMeta?.totalScenes ?? outlines.length}
            alwaysReview={alwaysReview}
            onAlwaysReviewChange={setAlwaysReview}
            onOutlinesChange={setOutlines}
            onConfirm={handleApproveOutline}
            onCancel={handleCancel}
            isLoading={approving}
            isCancelling={cancelling}
          />
        )}

        {/* Loading / Generating / Generating slides */}
        {(phase === 'loading' || phase === 'generating' || phase === 'generating_slides') && (
          <div className="space-y-4">
            <MobileGenerationStatusCard
              phase={phase}
              stepLabel={stepLabel}
              progress={progress}
            />
            <MobileGenerationSteps
              step={step}
              scenesGenerated={scenesGenerated}
              totalScenes={totalScenes}
            />

            {message && (
              <div className="rounded-2xl border border-white/10 bg-[#0d1728] p-4 text-center text-sm text-slate-400 shadow-xl">
                {message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleBackHome}
                className="rounded-2xl border border-white/10 bg-[#172436] py-3.5 text-sm font-bold text-slate-200 transition-colors active:bg-[#1f2f45]"
              >
                返回首页
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-2xl border border-red-500/20 bg-red-500/10 py-3.5 text-sm font-bold text-red-200 transition-colors active:bg-red-500/20 disabled:opacity-50"
              >
                {cancelling ? '取消中...' : '取消生成'}
              </button>
            </div>
          </div>
        )}
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}

export default function MobileGenerationProgressPage() {
  return (
    <Suspense fallback={null}>
      <MobileGenerationProgressContent />
    </Suspense>
  );
}
