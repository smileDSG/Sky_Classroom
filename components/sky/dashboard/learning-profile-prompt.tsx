import Link from 'next/link';
import { ArrowRight, UserRoundPen } from 'lucide-react';
import type { LearningOnboardingStatus } from '@/lib/onboarding/types';

export function LearningProfilePrompt({
  status,
}: {
  status: LearningOnboardingStatus | undefined;
}) {
  if (status !== 'skipped') return null;

  return (
    <Link
      href="/sky/onboarding?mode=edit&redirect=%2Fsky"
      aria-label="完善学习画像"
      className="group flex min-h-11 items-center gap-3 rounded-md border border-indigo-200/70 bg-indigo-50/60 px-3 py-2.5 text-left transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-indigo-800/50 dark:bg-indigo-950/25 dark:hover:bg-indigo-950/40"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
        <UserRoundPen className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">完善学习画像</span>
        <span className="block text-xs leading-5 text-muted-foreground">
          补充学科情况和讲解偏好，让诊断与推荐更贴合你。
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
