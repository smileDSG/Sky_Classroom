'use client';

import { useState, useEffect } from 'react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { MistakeBook } from '@/components/sky/learning/mistake-book';
import { KnowledgeGraphView } from '@/components/sky/learning/knowledge-graph-view';
import { LearningStats } from '@/components/sky/learning/learning-stats';
import { ReviewPlan } from '@/components/sky/learning/review-plan';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';

const TABS = [
  { key: 'mistakes', label: '错题本', icon: '📋' },
  { key: 'review', label: '复习计划', icon: '🧠' },
  { key: 'graph', label: '知识图谱', icon: '🗺️' },
  { key: 'stats', label: '学习统计', icon: '📊' },
] as const;

export default function LearningPage() {
  const [activeTab, setActiveTab] = useState<string>('mistakes');

  useEffect(() => {
    syncMistakesFromQuizzes();
  }, []);

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold text-gray-900">📊 学习数据</h2>

        <div className="mt-4 flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-[#4A90D9] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === 'mistakes' && <MistakeBook />}
          {activeTab === 'review' && <ReviewPlan />}
          {activeTab === 'graph' && <KnowledgeGraphView />}
          {activeTab === 'stats' && <LearningStats />}
        </div>
      </div>
    </SkyAppShell>
  );
}
