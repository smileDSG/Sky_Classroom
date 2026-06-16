'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Trash2, BookOpen, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  fetchTeachingHistory,
  deleteTeachingHistory,
  type TeachingHistoryItem,
} from '@/lib/teaching/teaching-job-client';

interface TeachingHistoryPanelProps {
  onSelect?: (item: TeachingHistoryItem) => void;
  onClose?: () => void;
  className?: string;
  refreshKey?: number;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  return d.toLocaleDateString('zh-CN');
}

export function TeachingHistoryPanel({
  onSelect,
  onClose,
  className,
  refreshKey,
}: TeachingHistoryPanelProps) {
  const [items, setItems] = useState<TeachingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeachingHistory();
      setItems(data.filter((i) => i.status === 'succeeded'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteTeachingHistory(deleteTarget);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget));
    } catch {
      // ignore
    }
    setDeleteTarget(null);
  }, [deleteTarget]);

  const filtered = searchFilter
    ? items.filter(
        (i) =>
          i.topic.toLowerCase().includes(searchFilter.toLowerCase()) ||
          i.plan?.title?.toLowerCase().includes(searchFilter.toLowerCase()),
      )
    : items;

  return (
    <>
      {/* ── 历史星图面板 ── */}
      <div
        className={`rounded-xl border backdrop-blur-sm overflow-hidden ${className ?? ''}`}
        style={{
          background: 'var(--teaching-surface)',
          borderColor: 'var(--teaching-border)',
          boxShadow: '0 0 20px -6px rgba(45, 212, 191, 0.08)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 pt-4 pb-3"
          style={{
            background:
              'linear-gradient(135deg, rgba(45, 212, 191, 0.08) 0%, transparent 100%)',
            borderBottom: '1px solid var(--teaching-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--teaching-primary)]" />
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--teaching-text)' }}
              >
                历史星图
              </h3>
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0 text-[var(--teaching-muted)] hover:text-[var(--teaching-primary)]"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* 底部线搜索框 */}
          <div className="relative mt-3 teaching-input-glow">
            <Search
              className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--teaching-muted)' }}
            />
            <input
              placeholder="搜索授课主题..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full h-8 pl-7 pr-2 text-sm bg-transparent border-b border-[var(--teaching-border)] rounded-t focus:border-[var(--teaching-primary)] focus:outline-none focus:ring-0 transition-colors"
              style={{ color: 'var(--teaching-text)' }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: 'var(--teaching-muted)' }}
              />
            </div>
          ) : error ? (
            <div className="text-center py-6 text-sm text-red-400">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6 text-sm" style={{ color: 'var(--teaching-muted)' }}>
              {searchFilter ? '没有匹配的记录' : '暂无授课历史'}
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1.5">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="group relative flex items-center gap-3 rounded-lg p-3 cursor-pointer transition-all duration-200"
                    style={{
                      background: 'rgba(45, 212, 191, 0.02)',
                      borderLeft: '2px solid transparent',
                    }}
                    onClick={() => onSelect?.(item)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(45, 212, 191, 0.06)';
                      e.currentTarget.style.borderLeftColor = 'rgba(45, 212, 191, 0.6)';
                      e.currentTarget.style.boxShadow = 'inset 0 0 12px rgba(45, 212, 191, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(45, 212, 191, 0.02)';
                      e.currentTarget.style.borderLeftColor = 'transparent';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: 'rgba(45, 212, 191, 0.1)',
                        border: '1px solid rgba(45, 212, 191, 0.15)',
                      }}
                    >
                      <BookOpen
                        className="h-4 w-4"
                        style={{ color: 'var(--teaching-primary)' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: 'var(--teaching-text)' }}
                      >
                        {item.plan?.title || item.topic}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--teaching-muted)' }}>
                          {formatTime(item.createdAt)}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-[var(--teaching-border)] text-[var(--teaching-primary)]"
                        >
                          {item.totalSections || item.sections?.length || 0} 章节
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(item.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight
                        className="h-4 w-4"
                        style={{ color: 'var(--teaching-muted)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>

      {/* ── 删除确认弹窗 — 深空风格 ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent
          className="border backdrop-blur-sm"
          style={{
            background: 'linear-gradient(180deg, rgba(20, 16, 8, 0.98), rgba(11, 16, 33, 0.98))',
            borderColor: 'var(--teaching-border)',
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--teaching-text)' }}>
              确认删除
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--teaching-muted)' }}>
              删除后无法恢复，确定要删除这份教案吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-[var(--teaching-border)] text-[var(--teaching-muted)] hover:bg-[var(--teaching-primary)]/10 hover:text-[var(--teaching-text)]"
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-900/30 border border-red-500/30 text-red-300 hover:bg-red-900/50 hover:border-red-500/50"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
