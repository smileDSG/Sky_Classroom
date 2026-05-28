/**
 * Usage progress bar component.
 * Shows current usage vs limit with color-coded status.
 */

'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

interface UsageData {
  planType: string;
  llmCalls: { current: number; limit: number };
  generationCount: { current: number; limit: number };
  resetAt: number;
}

export function UsageProgress() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usage/check', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success) setUsage(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !usage) return null;

  const pct = (current: number, limit: number) => (limit === 0 ? 0 : Math.round((current / limit) * 100));
  const barColor = (p: number) => (p > 90 ? 'bg-red-500' : p > 70 ? 'bg-yellow-500' : 'bg-green-500');

  const resetTime = usage.resetAt ? new Date(usage.resetAt).toLocaleTimeString() : '';

  return (
    <div className="space-y-3 p-3 rounded-lg border bg-card text-sm">
      {resetTime && <div className="text-xs text-muted-foreground text-right">Resets at {resetTime}</div>}
      {usage.llmCalls.limit > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>AI Calls</span>
            <span className="text-muted-foreground">
              {usage.llmCalls.current}/{usage.llmCalls.limit}
            </span>
          </div>
          <Progress
            value={pct(usage.llmCalls.current, usage.llmCalls.limit)}
            className={`h-2 ${barColor(pct(usage.llmCalls.current, usage.llmCalls.limit))}`}
          />
        </div>
      )}
      {usage.generationCount.limit > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Generations</span>
            <span className="text-muted-foreground">
              {usage.generationCount.current}/{usage.generationCount.limit}
            </span>
          </div>
          <Progress
            value={pct(usage.generationCount.current, usage.generationCount.limit)}
            className={`h-2 ${barColor(pct(usage.generationCount.current, usage.generationCount.limit))}`}
          />
        </div>
      )}
    </div>
  );
}
