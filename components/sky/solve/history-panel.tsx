import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Trash2,
  BookOpen,
  ChevronRight,
  AlertCircle,
  Search,
  XCircle,
  Camera,
  CheckCircle2,
  AlertCircle as AlertCircleIcon,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MathRenderer } from './math-renderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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
import { Input } from '@/components/ui/input';
import type { QuestionBankEntry } from '@/lib/solve/types';
import { useSearchHistoryStore } from '@/lib/store/search-history';
import type { SearchRecord } from '@/lib/store/search-history';

/** Unified history item: either a bank entry (has full solution) or a search-only record */
export type UnifiedHistoryItem =
  | { kind: 'bank'; entry: QuestionBankEntry; matchedSearch?: SearchRecord }
  | { kind: 'search'; record: SearchRecord; matchedBank?: QuestionBankEntry };

interface HistoryPanelProps {
  onLoad?: (entry: QuestionBankEntry | SearchRecord) => void;
  onClose?: () => void;
  className?: string;
  /** Triggers a re-fetch when changed (e.g. after a solve completes) */
  refreshKey?: number;
}

function formatTime(ts: number): string {
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

/** Get a stable key for a unified item */
function getItemKey(item: UnifiedHistoryItem): string {
  return item.kind === 'bank' ? `bank-${item.entry.id}` : `search-${item.record.id}`;
}

export function HistoryPanel({ onLoad, onClose, className, refreshKey }: HistoryPanelProps) {
  const [bankEntries, setBankEntries] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const searchRecords = useSearchHistoryStore((s) => s.records);
  const deleteSearchRecords = useSearchHistoryStore((s) => s.deleteRecords);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sky/question-bank?limit=50');
      const data = await res.json();
      setBankEntries(data?.data?.questions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, refreshKey]);

  // Merge bank entries + search records into unified chronological list
  const unifiedItems = useMemo((): UnifiedHistoryItem[] => {
    const bankMap = new Map(bankEntries.map((e) => [e.problemText, e]));
    const searchMap = new Map(searchRecords.map((r) => [r.query, r]));

    const items: UnifiedHistoryItem[] = [];

    // Bank entries — each may have a linked search record
    for (const entry of bankEntries) {
      const matchedSearch = searchMap.get(entry.problemText);
      items.push({ kind: 'bank', entry, matchedSearch });
    }

    // Search records without matching bank entries
    for (const record of searchRecords) {
      if (!bankMap.has(record.query)) {
        items.push({ kind: 'search', record });
      }
    }

    // Sort by time descending
    items.sort((a, b) => {
      const ta = a.kind === 'bank' ? a.entry.solvedAt : a.record.timestamp;
      const tb = b.kind === 'bank' ? b.entry.solvedAt : b.record.timestamp;
      return tb - ta;
    });

    return items;
  }, [bankEntries, searchRecords]);

  const filteredItems = searchFilter
    ? unifiedItems.filter((item) => {
        const text = item.kind === 'bank' ? item.entry.problemText : item.record.query;
        return text.toLowerCase().includes(searchFilter.toLowerCase());
      })
    : unifiedItems;

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredItems.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredItems.map(getItemKey)));
    }
  };

  const handleBatchDelete = useCallback(async () => {
    const bankIds: string[] = [];
    const searchIds: string[] = [];

    for (const item of filteredItems) {
      const key = getItemKey(item);
      if (!selectedKeys.has(key)) continue;
      if (item.kind === 'bank') bankIds.push(item.entry.id);
      else searchIds.push(item.record.id);
    }

    // Delete bank entries via API
    if (bankIds.length > 0) {
      try {
        await fetch(`/api/sky/question-bank?ids=${bankIds.join(',')}`, { method: 'DELETE' });
        setBankEntries((prev) => prev.filter((e) => !bankIds.includes(e.id)));
      } catch (e) {
        setError(e instanceof Error ? e.message : '删除失败');
      }
    }

    // Delete search records from store
    if (searchIds.length > 0) {
      deleteSearchRecords(searchIds);
    }

    setSelectedKeys(new Set());
    setSelectMode(false);
    setShowBatchDeleteConfirm(false);
  }, [filteredItems, selectedKeys, deleteSearchRecords]);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedKeys(new Set());
  };

  return (
    <>
      <Card className={cn('probe-panel overflow-hidden', className)}>
        <CardHeader className="probe-header-gradient">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-[var(--probe-text)]">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--probe-primary)]/25 to-[var(--probe-accent)]/15 border border-[var(--probe-border)] shadow-[0_0_8px_var(--probe-glow)]">
                  <Clock className="h-4 w-4 text-[var(--probe-primary-bright)]" />
                </div>
                历史星图
              </CardTitle>
              <CardDescription className="mt-1 text-[var(--probe-muted)]">
                所有探测记录
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exitSelectMode}
                    className="text-[var(--probe-muted)] hover:text-[var(--probe-text)]"
                  >
                    取消
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="text-[var(--probe-primary-bright)] hover:bg-[var(--probe-primary)]/15"
                  >
                    {selectedKeys.size === filteredItems.length ? '取消全选' : '全选'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectMode(true)}
                    disabled={filteredItems.length === 0}
                    className="text-[var(--probe-muted)] hover:text-[var(--probe-primary-bright)] hover:bg-[var(--probe-primary)]/15"
                  >
                    多选
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="text-[var(--probe-muted)] hover:text-[var(--probe-text)]"
                  >
                    返回搜题
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--probe-muted)]" />
              <Input
                placeholder="搜索探测记录..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 text-sm probe-panel border-[var(--probe-border)] text-[var(--probe-text)] placeholder:text-[var(--probe-muted)] focus-visible:ring-[var(--probe-glow)] focus-visible:border-[var(--probe-primary)] focus-visible:shadow-[0_0_8px_var(--probe-glow)]"
              />
              {searchFilter && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--probe-muted)] hover:text-[var(--probe-text)]"
                  onClick={() => setSearchFilter('')}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="relative h-8 w-8">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-[var(--probe-primary)] border-t-transparent shadow-[0_0_12px_var(--probe-glow)]" />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--probe-error)]/15 border border-[var(--probe-error)]/25">
                <AlertCircle className="h-6 w-6 text-[var(--probe-error)]" />
              </div>
              <p className="text-sm text-[var(--probe-error)]">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchEntries}
                className="border-[var(--probe-border-strong)] text-[var(--probe-text)] hover:bg-[var(--probe-primary)]/15 hover:border-[var(--probe-primary)]"
              >
                重试
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--probe-primary)]/15 to-[var(--probe-accent)]/10 border border-[var(--probe-border)]">
                <BookOpen className="h-8 w-8 text-[var(--probe-muted)]" />
              </div>
              <p className="mt-4 text-sm text-[var(--probe-muted)]">暂无探测记录</p>
              <p className="text-xs text-[var(--probe-muted)]">探测信号后会自动保存记录</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-[var(--probe-border)]">
                {filteredItems.map((item) => {
                  const key = getItemKey(item);
                  return (
                    <HistoryItemRow
                      key={key}
                      item={item}
                      selectMode={selectMode}
                      selected={selectedKeys.has(key)}
                      onToggleSelect={() => toggleSelect(key)}
                      onLoad={onLoad}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Batch delete bar */}
          {selectMode && selectedKeys.size > 0 && (
            <div className="border-t border-[var(--probe-border)] p-3 flex items-center justify-between bg-gradient-to-r from-[var(--probe-primary)]/10 to-transparent">
              <span className="text-sm font-medium text-[var(--probe-primary-bright)]">
                已选 {selectedKeys.size} 项
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBatchDeleteConfirm(true)}
                className="shadow-[0_0_8px_rgba(248,113,113,0.3)]"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                删除
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch delete confirmation */}
      <AlertDialog open={showBatchDeleteConfirm} onOpenChange={setShowBatchDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedKeys.size} 条记录吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Individual row renderer ─────────────────────────────────── */

function HistoryItemRow({
  item,
  selectMode,
  selected,
  onToggleSelect,
  onLoad,
}: {
  item: UnifiedHistoryItem;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onLoad?: (entry: QuestionBankEntry | SearchRecord) => void;
}) {
  if (item.kind === 'bank') {
    const { entry } = item;
    return (
      <div
        className="group flex items-start gap-3 px-4 py-2.5 transition-all hover:bg-[var(--probe-primary)]/10 hover:shadow-[inset_0_0_12px_var(--probe-glow)] cursor-pointer"
        onClick={() => (selectMode ? onToggleSelect() : onLoad?.(entry))}
      >
        {selectMode && (
          <div
            className="mt-0.5 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
          >
            {selected ? (
              <CheckSquare className="h-5 w-5 text-[var(--probe-primary-bright)] drop-shadow-[0_0_4px_var(--probe-glow)]" />
            ) : (
              <Square className="h-5 w-5 text-[var(--probe-muted)]" />
            )}
          </div>
        )}
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--probe-success)]/20 to-[var(--probe-success)]/10 border border-[var(--probe-success)]/25 shadow-[0_0_6px_rgba(52,211,153,0.2)]">
          <CheckCircle2 className="h-4 w-4 text-[var(--probe-success)]" />
        </div>
        {entry.problemImage && (
          <img
            src={entry.problemImage}
            alt="题目图片"
            className="h-10 w-10 shrink-0 rounded-lg border border-[var(--probe-border)] object-cover shadow-[0_0_4px_var(--probe-glow)]"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-normal line-clamp-1 text-[var(--probe-text)]">
            <MathRenderer content={entry.problemText} />
          </p>
          <div className="flex items-center gap-2 text-xs text-[var(--probe-muted)]">
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] border-[var(--probe-success)]/30 text-[var(--probe-success)]"
            >
              已解答
            </Badge>
            {entry.agentId && (
              <span className="text-[10px] px-1.5 py-0 rounded bg-[var(--probe-primary)]/15 text-[var(--probe-primary-bright)] border border-[var(--probe-primary)]/25">
                {entry.agentId === 'universal'
                  ? '通用'
                  : entry.agentId === 'science'
                    ? '理科'
                    : entry.agentId === 'humanities'
                      ? '文科'
                      : '批改'}
              </span>
            )}
            <span>·</span>
            <span>{formatTime(entry.solvedAt)}</span>
          </div>
        </div>
        {!selectMode && (
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--probe-muted)] group-hover:text-[var(--probe-primary-bright)] transition-colors" />
        )}
      </div>
    );
  }

  // search-only
  const { record, matchedBank } = item;
  const isSuccess = record.status === 'success';
  const isFailed = record.status === 'failed';

  return (
    <div
      className="group flex items-start gap-3 px-4 py-2.5 transition-all hover:bg-[var(--probe-primary)]/10 hover:shadow-[inset_0_0_12px_var(--probe-glow)] cursor-pointer"
      onClick={() => (selectMode ? onToggleSelect() : onLoad?.(matchedBank ?? record))}
    >
      {selectMode && (
        <div
          className="mt-0.5 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
        >
          {selected ? (
            <CheckSquare className="h-5 w-5 text-[var(--probe-primary-bright)] drop-shadow-[0_0_4px_var(--probe-glow)]" />
          ) : (
            <Square className="h-5 w-5 text-[var(--probe-muted)]" />
          )}
        </div>
      )}
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
          isSuccess
            ? 'bg-gradient-to-br from-[var(--probe-success)]/20 to-[var(--probe-success)]/10 border-[var(--probe-success)]/25 shadow-[0_0_6px_rgba(52,211,153,0.2)]'
            : isFailed
              ? 'bg-gradient-to-br from-[var(--probe-error)]/20 to-[var(--probe-error)]/10 border-[var(--probe-error)]/25 shadow-[0_0_6px_rgba(248,113,113,0.2)]'
              : 'bg-[var(--probe-primary)]/15 border-[var(--probe-primary)]/25'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-[var(--probe-success)]" />
        ) : isFailed ? (
          <AlertCircleIcon className="h-4 w-4 text-[var(--probe-error)]" />
        ) : (
          <Clock className="h-4 w-4 text-[var(--probe-muted)]" />
        )}
      </div>
      {record.problemImage && (
        <img
          src={record.problemImage}
          alt="题目图片"
          className="h-10 w-10 shrink-0 rounded-lg border border-[var(--probe-border)] object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-normal line-clamp-1 truncate text-[var(--probe-text)]">
          {record.query}
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--probe-muted)]">
          <span className="flex items-center gap-0.5">
            {record.type === 'image' ? (
              <Camera className="h-3 w-3" />
            ) : record.type === 'voice' ? (
              ''
            ) : (
              '✏️'
            )}
            {record.type === 'image' ? '拍照' : record.type === 'voice' ? '语音' : '文字'}
          </span>
          <span>·</span>
          <span>{formatTime(record.timestamp)}</span>
          {record.error && (
            <>
              <span>·</span>
              <span className="text-[var(--probe-error)]">{record.error}</span>
            </>
          )}
        </div>
      </div>
      {!selectMode && (
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--probe-muted)] group-hover:text-[var(--probe-primary-bright)] transition-colors" />
      )}
    </div>
  );
}
