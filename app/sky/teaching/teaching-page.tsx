'use client';

import { useState, useCallback } from 'react';
import { BookOpen, Clock } from 'lucide-react';
import { TeachingPanel } from '@/components/sky/solve/teaching-panel';
import { TeachingHistoryPanel } from '@/components/sky/solve/teaching-history-panel';
import { Button } from '@/components/ui/button';
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
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI 智能授课</h2>
            <p className="text-sm text-muted-foreground">
              输入授课主题，AI 将根据学情自动生成个性化教案，后台持续运行
            </p>
          </div>
        </div>
        <Button
          variant={showHistory ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowHistory((v) => !v)}
          className={showHistory ? 'bg-sky-500 hover:bg-sky-600' : ''}
        >
          <Clock className="h-4 w-4 mr-1.5" />
          历史记录
        </Button>
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
      />
    </div>
  );
}
