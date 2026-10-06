'use client';

import type { AnimationStep } from '@/lib/animation/types';

export function SubtitleBar({ step }: { step: AnimationStep }) {
  return (
    <div className="rounded-xl border bg-muted/40 px-4 py-3 text-center">
      <p className="mb-1 text-sm font-medium text-primary">{step.title}</p>
      <p className="text-sm leading-relaxed text-foreground/90">{step.narration}</p>
    </div>
  );
}
