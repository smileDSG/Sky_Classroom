'use client';

import { useState, useCallback } from 'react';
import { Clock, GraduationCap } from 'lucide-react';
import { TeachingPanel } from '@/components/sky/solve/teaching-panel';
import { TeachingHistoryPanel } from '@/components/sky/solve/teaching-history-panel';
import type { TeachingHistoryItem } from '@/lib/teaching/teaching-job-client';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';

export function TeachingPage() {
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
      {/* Header — "授课控制台" */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--teaching-primary)]/25 to-[var(--teaching-warm)]/15 border border-[var(--teaching-primary)]/25 shadow-[0_0_12px_var(--teaching-glow)]">
            <GraduationCap className="h-6 w-6 text-[var(--teaching-primary-bright)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--teaching-text)] teaching-glow-text">
              星际讲堂
            </h2>
            <p className="text-sm text-[var(--teaching-muted)]">
              AI 导师为你规划教案，逐段讲解知识点
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            showHistory
              ? 'teaching-button-primary text-[var(--teaching-text)]'
              : 'border border-[var(--teaching-border)] text-[var(--teaching-muted)] hover:text-[var(--teaching-primary-bright)] hover:border-[var(--teaching-primary)]/50 hover:bg-[var(--teaching-primary)]/10'
          }`}
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

      <TeachingPanel viewHistoryItem={historyItem} onViewedHistory={handleViewedHistory} />
    </div>
  );
}
