'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Trash2,
  BookOpen,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MathRenderer } from './math-renderer';
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
import { listQuestionBankEntries, deleteQuestionBankEntry } from '@/lib/solve/question-bank';
import type { QuestionBankEntry } from '@/lib/solve/types';

interface HistoryPanelProps {
  onLoad?: (entry: QuestionBankEntry) => void;
  onClose?: () => void;
  className?: string;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}

const AGENT_LABELS: Record<string, string> = {
  universal: '通用',
  science: '理科',
  humanities: '文科',
};

export function HistoryPanel({ onLoad, onClose, className }: HistoryPanelProps) {
  const [entries, setEntries] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listQuestionBankEntries(50);
      setEntries(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteQuestionBankEntry(deleteTarget);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget));
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  return (
    <>
      <Card className={className}>
        <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-transparent dark:from-sky-950/30 dark:to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-sky-500" />
                历史记录
              </CardTitle>
              <CardDescription>题库中已保存的解题记录</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              返回搜题
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchEntries}>
                重试
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">暂无历史记录</p>
              <p className="text-xs text-muted-foreground">解题成功后会自动保存到题库</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-3 p-4 transition-colors hover:bg-muted/30 cursor-pointer"
                    onClick={() => onLoad?.(entry)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40">
                      <BookOpen className="h-4 w-4 text-sky-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug line-clamp-2">
                        <MathRenderer content={entry.problemText} />
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          答案：<MathRenderer content={entry.answer} />
                        </span>
                        {entry.agentId && (
                          <Badge variant="secondary" className="text-xs">
                            {AGENT_LABELS[entry.agentId] ?? entry.agentId}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(entry.solvedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(entry.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复，确定要删除这道题目吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
