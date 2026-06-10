'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Trash2, BookOpen, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
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
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-500" />
              授课历史
            </CardTitle>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {/* Search */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索授课主题..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-6 text-sm text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {searchFilter ? '没有匹配的记录' : '暂无授课历史'}
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 rounded-lg border border-sky-100 dark:border-sky-900/30 bg-white/60 dark:bg-slate-800/60 p-3 hover:border-sky-300 dark:hover:border-sky-700 transition-colors cursor-pointer"
                    onClick={() => onSelect?.(item)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-900/20">
                      <BookOpen className="h-4 w-4 text-sky-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.plan?.title || item.topic}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {formatTime(item.createdAt)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {item.totalSections || item.sections?.length || 0} 章节
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(item.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复，确定要删除这份教案吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
