'use client';

import { useState, useCallback, useEffect } from 'react';
import { Clock, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeachingPanel } from '@/components/sky/solve/teaching-panel';
import { TeachingHistoryPanel } from '@/components/sky/solve/teaching-history-panel';
import { WorkspaceShell } from '@/components/sky/layout/workspace-shell';
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
    <WorkspaceShell
      title="智能授课"
      description="AI 导师根据你的学习情况规划教案，逐段讲解知识点。"
      mode="run"
      status={
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={cn(
            'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
            showHistory
              ? 'border-[#5B8DEF] bg-[#5B8DEF]/10 text-[#315fbc]'
              : 'border-[#E4EDF7] bg-white text-slate-600 hover:border-[#5B8DEF]/40',
          )}
        >
          <Clock className="h-4 w-4" /> 历史星图
        </button>
      }
      panel={
        <div data-testid="teaching-config-panel" className="space-y-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <GraduationCap className="h-4 w-4 text-[#5B8DEF]" /> 授课参数
          </div>
          <p className="text-xs leading-5 text-slate-500">主题、难度和节奏会根据学情自动调整。</p>
          <div className="rounded-lg bg-[#F5F9FF] px-3 py-2 text-xs leading-5 text-slate-600">
            {personalizationNotice ?? '输入主题后开始生成个性化教案。'}
          </div>
        </div>
      }
      main={
        <div data-testid="teaching-main-workspace" className="min-w-0">
          <TeachingPanel
            viewHistoryItem={historyItem}
            onViewedHistory={handleViewedHistory}
            initialTopic={initialTopic}
            personalizationNotice={personalizationNotice}
            personalizationPolicy={personalizationPolicy}
            personalizationContext={personalizationContext}
          />
        </div>
      }
      aside={
        <div data-testid="teaching-ai-advice" className="space-y-4">
          {showHistory ? (
            <TeachingHistoryPanel
              onSelect={handleSelectHistory}
              onClose={() => setShowHistory(false)}
              refreshKey={historyRefreshKey}
            />
          ) : (
            <div className="rounded-xl border border-[#E4EDF7] bg-white p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                <GraduationCap className="h-4 w-4 text-[#34C7B6]" /> AI 授课建议
              </div>
              <p className="text-xs leading-5 text-slate-500">
                先输入一个明确主题。生成后可在主区域逐段阅读、提问并提交掌握反馈。
              </p>
            </div>
          )}
        </div>
      }
    />
  );
}
