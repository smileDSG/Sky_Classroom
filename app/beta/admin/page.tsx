'use client';

import { useState, useEffect } from 'react';

interface Feedback {
  id: string;
  category: string;
  severity: string;
  quick_tags: string[];
  description: string;
  status: string;
  admin_notes: string | null;
  page_context: { pathname?: string; title?: string } | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: '🐛 Bug',
  suggestion: '💡 建议',
  complaint: '😤 吐槽',
  praise: '👍 赞美',
};

const SEVERITY_LABELS: Record<string, string> = {
  blocker: '🔴 阻碍',
  major: '🟠 影响',
  minor: '🟡 小问题',
  trivial: '⚪ 无所谓',
};

const SEVERITY_ORDER = { blocker: 0, major: 1, minor: 2, trivial: 3 };

export default function BetaAdminPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    fetch(`/api/beta/admin/feedback?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setFeedbacks(data.data || []);
        setLoading(false);
      });
  }, [filterStatus]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/beta/admin/feedback?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status } : f))
    );
  };

  const sorted = [...feedbacks].sort(
    (a, b) => (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 9) - (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 9)
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          Beta 管理后台
        </h1>

        <div className="flex gap-2 mb-6">
          {['', 'new', 'reviewing', 'resolved', 'wontfix'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {s || '全部'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500">加载中...</p>
        ) : sorted.length === 0 ? (
          <p className="text-slate-500">暂无反馈</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((fb) => (
              <div
                key={fb.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{CATEGORY_LABELS[fb.category] || fb.category}</span>
                  <span className="text-sm">{SEVERITY_LABELS[fb.severity] || fb.severity}</span>
                  {fb.quick_tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-400"
                    >
                      {tag}
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-slate-400">
                    {new Date(fb.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                  {fb.description}
                </p>
                {fb.page_context?.pathname && (
                  <p className="text-xs text-slate-400 mb-2">
                    页面: {fb.page_context.pathname} {fb.page_context.title ? `(${fb.page_context.title})` : ''}
                  </p>
                )}
                <div className="flex gap-2">
                  {fb.status === 'new' && (
                    <button
                      onClick={() => updateStatus(fb.id, 'reviewing')}
                      className="px-3 py-1 rounded text-xs bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      标记为处理中
                    </button>
                  )}
                  {fb.status === 'reviewing' && (
                    <button
                      onClick={() => updateStatus(fb.id, 'resolved')}
                      className="px-3 py-1 rounded text-xs bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      标记为已解决
                    </button>
                  )}
                  {(fb.status === 'new' || fb.status === 'reviewing') && (
                    <button
                      onClick={() => updateStatus(fb.id, 'wontfix')}
                      className="px-3 py-1 rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      暂不处理
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
