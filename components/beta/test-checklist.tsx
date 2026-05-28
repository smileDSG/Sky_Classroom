'use client';

import { useState } from 'react';

interface TestCase {
  id: string;
  label: string;
}

interface TestCategory {
  id: string;
  label: string;
  icon: string;
  cases: TestCase[];
}

const TEST_CATEGORIES: TestCategory[] = [
  {
    id: 'core',
    label: '核心功能',
    icon: '🎯',
    cases: [
      { id: 'core-1', label: '输入话题生成完整课程' },
      { id: 'core-2', label: '与 AI 老师/同学互动讨论' },
      { id: 'core-3', label: '白板画图/写字功能' },
      { id: 'core-4', label: 'TTS 语音播报' },
    ],
  },
  {
    id: 'scenes',
    label: '互动场景',
    icon: '📝',
    cases: [
      { id: 'scenes-1', label: '幻灯片讲解' },
      { id: 'scenes-2', label: '交互式模拟实验' },
      { id: 'scenes-3', label: '3D 可视化' },
      { id: 'scenes-4', label: '在线编程' },
    ],
  },
  {
    id: 'quiz',
    label: '测验与评估',
    icon: '🧪',
    cases: [
      { id: 'quiz-1', label: '单选题作答 + AI 批改' },
      { id: 'quiz-2', label: '多选题作答' },
      { id: 'quiz-3', label: '简答题 AI 评分' },
      { id: 'quiz-4', label: '课程结束页状态保持' },
    ],
  },
  {
    id: 'export',
    label: '导出与分享',
    icon: '📦',
    cases: [
      { id: 'export-1', label: '导出 PPTX（格式完好）' },
      { id: 'export-2', label: '导出交互式 HTML' },
      { id: 'export-3', label: '导出完整课堂 ZIP' },
    ],
  },
  {
    id: 'ux',
    label: '体验与性能',
    icon: '🎨',
    cases: [
      { id: 'ux-1', label: '页面加载速度' },
      { id: 'ux-2', label: 'AI 响应速度' },
      { id: 'ux-3', label: '深色模式切换' },
    ],
  },
];

const QUICK_TAGS = ['效果好', '有bug', '速度慢', '结果不准确', '崩溃', '超预期', '有创意', '样式错乱'];

interface CaseFeedback {
  completed: boolean;
  rating: number;
  tags: string[];
  notes: string;
}

export function TestChecklist() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, CaseFeedback>>({});

  const updateCase = (caseId: string, updates: Partial<CaseFeedback>) => {
    setFeedback((prev) => ({
      ...prev,
      [caseId]: { completed: false, rating: 0, tags: [], notes: '', ...prev[caseId], ...updates },
    }));
  };

  const completedCount = Object.values(feedback).filter((f) => f.completed).length;
  const totalCases = TEST_CATEGORIES.reduce((sum, c) => sum + c.cases.length, 0);
  const progress = totalCases > 0 ? Math.round((completedCount / totalCases) * 100) : 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">📋</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">内测测试清单</h2>
          <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
            {completedCount}/{totalCases} 已完成 ({progress}%)
          </span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {TEST_CATEGORIES.map((cat) => {
        const isExpanded = expandedCategory === cat.id;
        const catCompleted = cat.cases.filter((c) => feedback[c.id]?.completed).length;

        return (
          <div key={cat.id} className="mb-3">
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-left"
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="font-medium text-slate-900 dark:text-white">{cat.label}</span>
              <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                {catCompleted}/{cat.cases.length}
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="mt-1 ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2 py-2">
                {cat.cases.map((tc) => {
                  const fc = feedback[tc.id] || { completed: false, rating: 0, tags: [], notes: '' };
                  const caseExpanded = expandedCase === tc.id;

                  return (
                    <div key={tc.id}>
                      <button
                        onClick={() => {
                          if (!fc.completed) {
                            updateCase(tc.id, { completed: true });
                          }
                          setExpandedCase(caseExpanded ? null : tc.id);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                      >
                        <span
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            fc.completed
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {fc.completed && '✓'}
                        </span>
                        <span className={`text-sm ${fc.completed ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                          {tc.label}
                        </span>
                      </button>

                      {caseExpanded && (
                        <div className="ml-8 mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
                          <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                              评分
                            </label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  onClick={() => updateCase(tc.id, { rating: star })}
                                  className="text-2xl transition-transform hover:scale-110"
                                >
                                  {star <= fc.rating ? '★' : '☆'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                              快捷标签
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {QUICK_TAGS.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => {
                                    const tags = fc.tags.includes(tag)
                                      ? fc.tags.filter((t) => t !== tag)
                                      : [...fc.tags, tag];
                                    updateCase(tc.id, { tags });
                                  }}
                                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                    fc.tags.includes(tag)
                                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                              备注（可选）
                            </label>
                            <textarea
                              value={fc.notes}
                              onChange={(e) => updateCase(tc.id, { notes: e.target.value })}
                              placeholder="描述你遇到的具体问题，或你对这个功能的评价..."
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              rows={2}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
