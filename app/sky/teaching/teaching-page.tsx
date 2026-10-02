'use client';

import { useState, useCallback, useEffect } from 'react';
import { Clock, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeachingPanel } from '@/components/sky/solve/teaching-panel';
import { TeachingHistoryPanel } from '@/components/sky/solve/teaching-history-panel';
import type { TeachingHistoryItem } from '@/lib/teaching/teaching-job-client';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';
import type { TeachingGenerationPolicy } from '@/lib/teaching/personalization-policy';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';

interface TeachingPageProps {
  initialTopic?: string;
  personalizationNotice?: string | null;
  personalizationPolicy?: TeachingGenerationPolicy | null;
  personalizationContext?: PersonalizationContext | null;
  showHistoryInitially?: boolean;
}

export function TeachingPage({
  initialTopic,
  personalizationNotice,
  personalizationPolicy,
  personalizationContext,
  showHistoryInitially = false,
}: TeachingPageProps) {
  const [showHistory, setShowHistory] = useState(showHistoryInitially);
  const [historyItem, setHistoryItem] = useState<{
    topic: string;
    plan?: LessonPlan;
    sections?: { section: LessonSection; chunks: ContentChunk[] }[];
  } | null>(null);
  const [historyRefreshKey] = useState(0);

  useEffect(() => {
    setShowHistory(showHistoryInitially);
  }, [showHistoryInitially]);

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
    <div className=" space-y-6">
      {/* Page header */}
      <div data-tour-step="page-header" className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[var(--teaching-border)] bg-[var(--teaching-primary)]/15 shadow-[0_0_16px_var(--teaching-glow)]">
            <GraduationCap className="h-7 w-7 text-[var(--teaching-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--teaching-text)]">
              星际讲堂
            </h1>
            <p className="mt-0.5 text-sm text-[var(--teaching-muted)]">
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
        personalizationPolicy={personalizationPolicy}
        personalizationContext={personalizationContext}
      />
    </div>
  );
}
