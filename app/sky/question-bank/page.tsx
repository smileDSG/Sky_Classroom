'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import Link from 'next/link';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import FileQuestion from 'lucide-react/dist/esm/icons/file-question-mark.js';
import Target from 'lucide-react/dist/esm/icons/target.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { QuestionBankRow } from '@/lib/question-bank/types';
import { FilterBar, type FilterValues } from '@/components/sky/question-bank/filter-bar';
import { QuestionCard } from '@/components/sky/question-bank/question-card';
import { QuestionDetailDrawer } from '@/components/sky/question-bank/question-detail-drawer';
import { QuestionFormDialog } from '@/components/sky/question-bank/question-form-dialog';
import { Pagination } from '@/components/sky/question-bank/pagination';
import { EmptyState } from '@/components/sky/question-bank/empty-state';
import { QuestionListSkeleton } from '@/components/sky/question-bank/question-list-skeleton';
import { BatchToolbar } from '@/components/sky/question-bank/batch-toolbar';

const PAGE_SIZE = 10;

interface ListResponse {
  questions: QuestionBankRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function QuestionBankPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Filters from URL
  const filters: FilterValues = useMemo(
    () => ({
      keyword: searchParams.get('keyword') || '',
      subject: searchParams.get('subject') || '',
      difficulty: searchParams.get('difficulty') || '',
      questionType: searchParams.get('questionType') || '',
      verified: searchParams.get('verified') === 'true',
    }),
    [searchParams]
  );

  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  const [items, setItems] = useState<QuestionBankRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<QuestionBankRow | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const updateUrl = useCallback(
    (patch: Partial<FilterValues & { page?: number }>) => {
      const params = new URLSearchParams(searchParams.toString());
      const next = { ...filters, page, ...patch } as FilterValues & { page: number };

      if (next.keyword.trim()) params.set('keyword', next.keyword.trim());
      else params.delete('keyword');

      if (next.subject) params.set('subject', next.subject);
      else params.delete('subject');

      if (next.difficulty) params.set('difficulty', next.difficulty);
      else params.delete('difficulty');

      if (next.questionType) params.set('questionType', next.questionType);
      else params.delete('questionType');

      if (next.verified) params.set('verified', 'true');
      else params.delete('verified');

      if (next.page > 1) params.set('page', String(next.page));
      else params.delete('page');

      router.replace(`${pathname}?${params.toString()}`);
    },
    [filters, page, pathname, router, searchParams]
  );

  const fetchList = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(safePage));
    params.set('limit', String(PAGE_SIZE));
    if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim());
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.questionType) params.set('questionType', filters.questionType);
    if (filters.verified) params.set('verified', 'true');

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/sky/question-bank?${params.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || '加载失败');
      const data = json as ListResponse;
      setItems(data.questions);
      setTotal(data.total);
      // Clear selection when list changes
      setSelectedIds((prev) => prev.filter((id) => data.questions.some((q) => q.id === id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [filters, safePage]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleFilterChange = useCallback(
    (patch: Partial<FilterValues>) => {
      updateUrl({ ...patch, page: 1 });
    },
    [updateUrl]
  );

  const handleClearFilters = useCallback(() => {
    updateUrl({ keyword: '', subject: '', difficulty: '', questionType: '', verified: false, page: 1 });
  }, [updateUrl]);

  const handlePageChange = useCallback(
    (p: number) => {
      updateUrl({ page: p });
    },
    [updateUrl]
  );

  const openDrawer = (q: QuestionBankRow) => {
    setActiveQuestion(q);
    setDrawerOpen(true);
  };

  const handleQuestionUpdated = (updated: QuestionBankRow) => {
    setItems((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setActiveQuestion(updated);
  };

  const handleQuestionDeleted = (id: string) => {
    setItems((prev) => prev.filter((q) => q.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setActiveQuestion(null);
    setDrawerOpen(false);
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map((q) => q.id) : []);
  };

  const handleBatchVerify = async (verified: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/sky/question-bank?id=${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verified }),
          }).then((r) => r.json())
        )
      );
      setItems((prev) =>
        prev.map((q) => (selectedIds.includes(q.id) ? { ...q, verified } : q))
      );
      setSelectedIds([]);
    } catch {
      setError('批量操作失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`确定删除选中的 ${selectedIds.length} 道题目吗？`)) return;
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/sky/question-bank?id=${id}`, { method: 'DELETE' }).then((r) => r.json())
        )
      );
      setItems((prev) => prev.filter((q) => !selectedIds.includes(q.id)));
      setSelectedIds([]);
    } catch {
      setError('批量删除失败');
    }
  };

  const handleBatchExport = () => {
    const payload = items.filter((q) => selectedIds.includes(q.id));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `题库导出_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchQuiz = () => {
    const params = new URLSearchParams();
    params.set('mode', 'bank');
    if (selectedIds.length > 0) params.set('ids', selectedIds.join(','));
    router.push(`/sky/cloud-mind/quiz?${params.toString()}`);
  };

  const handleQuizFromFilters = () => {
    const params = new URLSearchParams();
    params.set('mode', 'bank');
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.difficulty) params.set('difficulty', filters.difficulty);
    if (filters.questionType) params.set('questionType', filters.questionType);
    if (filters.verified) params.set('verified', 'true');
    if (filters.keyword.trim()) params.set('keyword', filters.keyword.trim());
    router.push(`/sky/cloud-mind/quiz?${params.toString()}`);
  };

  const hasActiveFilters = Boolean(
    filters.keyword.trim() ||
      filters.subject ||
      filters.difficulty ||
      filters.questionType ||
      filters.verified
  );

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-6xl space-y-6 pb-24">
        {/* Breadcrumb */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/sky" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-sky-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            摘星锦囊
          </Link>
          <span className="text-slate-300">/</span>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-sky-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">题库中心</span>
          </div>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-sky-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <BookOpen className="h-5 w-5 text-sky-200" />
                </div>
                <span className="text-xs font-medium text-sky-200 tracking-wider uppercase">智能题库</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">题库中心</h1>
              <p className="text-sky-100 text-base max-w-lg">
                汇聚全平台积累的精选题目，支持按学科、难度、题型多维筛选，快速定位所需练习
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-sm text-sky-100 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <FileQuestion className="h-4 w-4" />
                共 {total} 题
              </div>
              <Button
                onClick={() => setFormDialogOpen(true)}
                className="bg-white text-sky-600 hover:bg-sky-50 shadow-lg"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                新增题目
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <FilterBar values={filters} onChange={handleFilterChange} onClear={handleClearFilters} />
        </motion.div>

        {/* Results header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={items.length > 0 && selectedIds.length === items.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              全选
            </label>
            <span className="text-xs text-slate-400">
              已加载 {items.length} 题 / 共 {total} 题
            </span>
          </div>

          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuizFromFilters}
              className="gap-1.5 text-sky-600 border-sky-200 hover:bg-sky-50 dark:border-sky-800 dark:hover:bg-sky-900/30"
            >
              <Target className="h-4 w-4" />
              从筛选结果生成练习
            </Button>
          )}
        </motion.div>

        {/* List */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-4">
          {loading && items.length === 0 && <QuestionListSkeleton count={PAGE_SIZE} />}

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {!loading && items.length === 0 && !error && (
            <EmptyState hasFilters={hasActiveFilters} onClearFilters={handleClearFilters} />
          )}

          {items.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx + (safePage - 1) * PAGE_SIZE}
              selected={selectedIds.includes(q.id)}
              onSelectChange={(checked) => toggleSelect(q.id, checked)}
              onClick={() => openDrawer(q)}
            />
          ))}

          {totalPages > 1 && !loading && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
            />
          )}
        </motion.div>
      </div>

      <QuestionDetailDrawer
        question={activeQuestion}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdated={handleQuestionUpdated}
        onDeleted={handleQuestionDeleted}
      />

      <QuestionFormDialog
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        onSaved={() => fetchList()}
      />

      <BatchToolbar
        selectedIds={selectedIds}
        totalCount={items.length}
        onSelectAll={handleSelectAll}
        onVerify={handleBatchVerify}
        onDelete={handleBatchDelete}
        onExport={handleBatchExport}
        onQuiz={handleBatchQuiz}
        onClear={() => setSelectedIds([])}
      />
    </SkyAppShell>
  );
}
