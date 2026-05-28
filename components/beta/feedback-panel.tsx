'use client';

import { useState } from 'react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'bug', label: '🐛 Bug 报告' },
  { value: 'suggestion', label: '💡 功能建议' },
  { value: 'complaint', label: '😤 体验吐槽' },
  { value: 'praise', label: '👍 赞美' },
] as const;

const SEVERITIES = [
  { value: 'blocker', label: '🔴 阻碍使用' },
  { value: 'major', label: '🟠 影响体验' },
  { value: 'minor', label: '🟡 小问题' },
  { value: 'trivial', label: '⚪ 无所谓' },
] as const;

const QUICK_TAGS = ['加载慢', 'AI 答非所问', '白屏', '样式错乱', '报错', '效果好', '超预期', '有创意'];

export function FeedbackPanel() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<'bug' | 'suggestion' | 'complaint' | 'praise'>('bug');
  const [severity, setSeverity] = useState<'blocker' | 'major' | 'minor' | 'trivial'>('major');
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('请填写详细描述');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/beta/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: crypto.randomUUID(),
          category,
          severity,
          quick_tags: tags,
          description,
          page_context: {
            url: window.location.href,
            pathname: window.location.pathname,
            title: document.title,
          },
        }),
      });

      if (res.ok) {
        toast.success('反馈已提交，感谢！');
        setCategory('bug');
        setSeverity('major');
        setTags([]);
        setDescription('');
        setOpen(false);
      } else {
        toast.error('提交失败，请重试');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
      >
        <span className="text-lg">🐛</span>
        <span className="text-sm font-medium">反馈</span>
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setOpen(false)} />

      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">提交反馈</h2>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              反馈类型
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    category === c.value
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-2 border-indigo-500'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:border-slate-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              优先级
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    severity === s.value
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 border-2 border-indigo-500'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent hover:border-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              快捷标签
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setTags((prev) =>
                      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    tags.includes(tag)
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              详细描述 *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细描述你遇到的问题或你的建议..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={5}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium transition-colors"
          >
            {submitting ? '提交中...' : '提交反馈'}
          </button>
        </div>
      </div>
    </>
  );
}
