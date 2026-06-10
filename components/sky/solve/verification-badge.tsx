'use client';

import { CheckCircle2, AlertTriangle, RotateCcw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────

export interface VerificationData {
  isCorrect: boolean;
  confidence: number;
  reasoning: string;
  suggestedAnswer?: string;
}

export type VerificationStatus =
  | 'verified'      // isCorrect=true, high confidence
  | 'corrected'     // was false, corrected to true
  | 'uncertain'     // low confidence or no verification result
  | 'failed';       // isCorrect=false, not corrected

// ── Component ────────────────────────────────────────────────────────

interface VerificationBadgeProps {
  status: VerificationStatus;
  data?: VerificationData;
  className?: string;
}

const STATUS_CONFIG = {
  verified: {
    icon: CheckCircle2,
    label: '已验证',
    color: 'text-emerald-700 dark:text-emerald-300',
    // Border + background: match existing green badge pattern from solve-page
    bg: 'border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/50',
  },
  corrected: {
    icon: RotateCcw,
    label: '修正后正确',
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/50',
  },
  uncertain: {
    icon: AlertTriangle,
    label: '答案存疑',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50',
  },
  failed: {
    icon: XCircle,
    label: '校验失败',
    color: 'text-red-700 dark:text-red-300',
    bg: 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-950/50',
  },
};

export function VerificationBadge({ status, data, className }: VerificationBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
      config.bg,
      className,
    )}>
      <Icon className={cn('h-3.5 w-3.5', config.color)} />
      <span className={config.color}>{config.label}</span>
      {data && (
        <span className="text-muted-foreground ml-1">
          ({Math.round(data.confidence * 100)}%)
        </span>
      )}
    </div>
  );
}

// ── Helper: derive status from chain result ──────────────────────────

/**
 * Determine the badge status from verification + correction results.
 */
export function getVerificationStatus(
  isCorrect?: boolean,
  wasCorrected?: boolean,
  confidence?: number,
): VerificationStatus {
  if (isCorrect === true) {
    return confidence != null && confidence < 0.7 ? 'uncertain' : 'verified';
  }
  if (wasCorrected) return 'corrected';
  if (isCorrect === false) return 'failed';
  return 'uncertain';
}
