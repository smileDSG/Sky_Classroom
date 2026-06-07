'use client';

import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────

export type ChainPhase =
  | 'checking'
  | 'analyzing'
  | 'routing'
  | 'solving'
  | 'verifying'
  | 'correcting'
  | 'knowledge'
  | 'similar'
  | 'done';

// ── Phase config ───────────────────────────────────────────────────

interface PhaseConfig {
  label: string;
  shortLabel: string;
}

const PHASE_CONFIG: Record<ChainPhase, PhaseConfig> = {
  checking:   { label: '正在查询题库...', shortLabel: '查库' },
  analyzing:  { label: '正在分析题目...', shortLabel: '分析' },
  routing:    { label: '正在路由到解题 Agent...', shortLabel: '路由' },
  solving:    { label: 'AI 正在解题中...', shortLabel: '解题' },
  verifying:  { label: '正在校验答案...', shortLabel: '校验' },
  correcting: { label: '正在修正答案...', shortLabel: '修正' },
  knowledge:  { label: '正在提取知识点...', shortLabel: '知识点' },
  similar:    { label: '正在检索类似题...', shortLabel: '类似题' },
  done:       { label: '解题完成', shortLabel: '完成' },
};

// Progress percentages for the bar
const PHASE_PROGRESS: Record<ChainPhase, string> = {
  checking:   '10%',
  analyzing:  '20%',
  routing:    '30%',
  solving:    '55%',
  verifying:  '75%',
  correcting: '80%',
  knowledge:  '90%',
  similar:    '95%',
  done:       '100%',
};

// ── Component ────────────────────────────────────────────────────────

interface ChainProgressProps {
  phase: ChainPhase;
  className?: string;
}

export function ChainProgress({ phase, className }: ChainProgressProps) {
  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG.solving;
  const progress = PHASE_PROGRESS[phase] ?? '50%';

  const orderedPhases: ChainPhase[] = [
    'checking', 'analyzing', 'solving', 'verifying', 'knowledge', 'similar', 'done',
  ];

  const currentIdx = orderedPhases.indexOf(phase);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Animated spinner + label */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
          {config.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="h-1.5 rounded-full bg-sky-200 dark:bg-sky-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-700 ease-in-out"
            style={{ width: progress }}
          />
        </div>
      </div>

      {/* Phase steps */}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {orderedPhases.map((p, i) => (
          <span
            key={p}
            className={cn(
              'transition-colors',
              i <= currentIdx
                ? 'text-sky-600 dark:text-sky-400 font-medium'
                : 'text-muted-foreground/50',
            )}
          >
            {PHASE_CONFIG[p].shortLabel}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Get the display label for a phase (for legacy code) */
export function getPhaseLabel(phase: string): string {
  const chainPhase = phase as ChainPhase;
  return PHASE_CONFIG[chainPhase]?.label ?? '处理中...';
}

/** Get the progress percentage string for a phase */
export function getPhaseProgress(phase: string): string {
  const chainPhase = phase as ChainPhase;
  return PHASE_PROGRESS[chainPhase] ?? '10%';
}
