import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Trash2,
  BookOpen,
  ChevronRight,
  AlertCircle,
  Loader2,
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
      <Card className={className}>
        <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-transparent dark:from-sky-950/30 dark:to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-sky-500" />
                历史记录
              </CardTitle>
              <CardDescription>所有拍照搜题记录</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectMode ? (
                <>
                  <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                    取消
                  </Button>
                  <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
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
                  >
                    多选
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    返回搜题
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索历史记录..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 text-sm"
              />
              {searchFilter && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">暂无历史记录</p>
              <p className="text-xs text-muted-foreground">拍照搜题后会自动保存记录</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
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
            <div className="border-t p-3 flex items-center justify-between bg-muted/30">
              <span className="text-sm text-muted-foreground">
                已选 {selectedKeys.size} 项
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBatchDeleteConfirm(true)}
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
        className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30 cursor-pointer"
        onClick={() => (selectMode ? onToggleSelect() : onLoad?.(entry))}
      >
        {selectMode && (
          <div className="mt-0.5 shrink-0" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
            {selected ? (
              <CheckSquare className="h-5 w-5 text-sky-500" />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        {entry.problemImage && (
          <img
            src={entry.problemImage}
            alt="题目图片"
            className="h-10 w-10 shrink-0 rounded-md border object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-normal line-clamp-1">
            <MathRenderer content={entry.problemText} />
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              已解答
            </Badge>
            {entry.agentId && (
              <span className="text-[10px] px-1.5 py-0 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
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
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
      className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30 cursor-pointer"
      onClick={() => (selectMode ? onToggleSelect() : onLoad?.(matchedBank ?? record))}
    >
      {selectMode && (
        <div className="mt-0.5 shrink-0" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
          {selected ? (
            <CheckSquare className="h-5 w-5 text-sky-500" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isSuccess
            ? 'bg-green-100 dark:bg-green-900/40'
            : isFailed
              ? 'bg-red-100 dark:bg-red-900/40'
              : 'bg-gray-100 dark:bg-gray-800'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : isFailed ? (
          <AlertCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {record.problemImage && (
        <img
          src={record.problemImage}
          alt="题目图片"
          className="h-10 w-10 shrink-0 rounded-md border object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-normal line-clamp-1 truncate">{record.query}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
              <span className="text-destructive">{record.error}</span>
            </>
          )}
        </div>
      </div>
      {!selectMode && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}
