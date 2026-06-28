'use client';

import { useState, useCallback } from 'react';
import { Clock, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeachingPanel } from '@/components/sky/solve/teaching-panel';
import { TeachingHistoryPanel } from '@/components/sky/solve/teaching-history-panel';
import type { TeachingHistoryItem } from '@/lib/teaching/teaching-job-client';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';

interface TeachingPageProps {
  initialTopic?: string;
  personalizationNotice?: string | null;
}

export function TeachingPage({ initialTopic, personalizationNotice }: TeachingPageProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<{
    topic: string;
    plan?: LessonPlan;
    sections?: { section: LessonSection; chunks: ContentChunk[] }[];
  } | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const handleSelectHistory = useCallback((item: TeachingHistoryItem) => {
    setHistoryItem({
      topic: item.topic,
      plan: item.plan,
      sections: item.sections,
    });
    setShowHistory(false);
  }, []);

  const handleViewedHistory = useCallback(() => {
    setHistoryItem(null);
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header — hero-style title bar */}
      <div
        className="rounded-2xl border bg-gradient-to-br from-[var(--teaching-surface)] to-[var(--teaching-surface-elevated)] p-5 shadow-sm backdrop-blur-sm flex items-center justify-between gap-4"
        style={{ borderColor: 'var(--teaching-border)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-slate-200/50 dark:from-indigo-400/20 dark:via-violet-400/10 dark:to-slate-800/50 border border-indigo-500/20 dark:border-indigo-400/20 shadow-[0_0_20px_-4px_var(--teaching-glow)]">
            <GraduationCap className="h-7 w-7 text-[var(--teaching-primary)]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--teaching-text)]">
              星际讲堂
            </h2>
            <p className="text-sm text-[var(--teaching-muted)] mt-0.5">
              AI 导师为你规划教案，逐段讲解知识点
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all shrink-0',
            showHistory
              ? 'teaching-button-primary text-[var(--teaching-text)]'
              : 'border border-[var(--teaching-border)] text-[var(--teaching-muted)] hover:text-[var(--teaching-primary-bright)] hover:border-[var(--teaching-border-strong)] hover:bg-[var(--teaching-primary)]/10',
          )}
        >
          <Clock className="h-4 w-4" />
          历史星图
        </button>
      </div>

      {/* History Panel (toggle) */}
      {showHistory && (
        <div className="mb-6">
          <TeachingHistoryPanel
            onSelect={handleSelectHistory}
            onClose={() => setShowHistory(false)}
            refreshKey={historyRefreshKey}
          />
        </div>
      )}

      <TeachingPanel
        viewHistoryItem={historyItem}
        onViewedHistory={handleViewedHistory}
        initialTopic={initialTopic}
        personalizationNotice={personalizationNotice}
      />
    </div>
  );
}
