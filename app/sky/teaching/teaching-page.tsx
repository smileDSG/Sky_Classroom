'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, GraduationCap, Star, BookOpen, ChevronRight } from 'lucide-react';
import { TeachingPanel } from '@/components/sky/solve/teaching-panel';
import { TeachingHistoryPanel } from '@/components/sky/solve/teaching-history-panel';
import { fetchTeachingHistory } from '@/lib/teaching/teaching-job-client';
import type { TeachingHistoryItem } from '@/lib/teaching/teaching-job-client';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export function TeachingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const historyId = searchParams.get('history');

  const [showHistory, setShowHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<{
    id: string;
    topic: string;
    plan?: LessonPlan;
    sections?: { section: LessonSection; chunks: ContentChunk[] }[];
    isFavorited?: boolean;
  } | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [favorites, setFavorites] = useState<TeachingHistoryItem[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  const loadFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const data = await fetchTeachingHistory({ favorited: true, limit: 50 });
      setFavorites(data);
    } catch {
      setFavorites([]);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (favoriteDialogOpen) {
      loadFavorites();
    }
  }, [favoriteDialogOpen, loadFavorites]);

  // 根据 URL 参数加载历史记录
  useEffect(() => {
    if (!historyId) {
      setHistoryItem(null);
      return;
    }
    fetchTeachingHistory()
      .then((data) => {
        const item = data.find((i) => i.id === historyId && i.status === 'succeeded');
        if (item) {
          setHistoryItem({
            id: item.id,
            topic: item.topic,
            plan: item.plan,
            sections: item.sections,
            isFavorited: item.isFavorited,
          });
        } else {
          setHistoryItem(null);
        }
      })
      .catch(() => {
        setHistoryItem(null);
      });
  }, [historyId, historyRefreshKey]);

  const handleSelectHistory = useCallback(
    (item: TeachingHistoryItem) => {
      router.push(`/sky/teaching?history=${item.id}`, { scroll: false });
      setShowHistory(false);
    },
    [router],
  );

  const handleViewedHistory = useCallback(() => {
    router.replace('/sky/teaching', { scroll: false });
  }, [router]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header — "授课控制台" */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--teaching-primary)]/25 to-[var(--teaching-warm)]/15 border border-[var(--teaching-primary)]/25 shadow-[0_0_12px_var(--teaching-glow)]">
            <GraduationCap className="h-6 w-6 text-[var(--teaching-primary-bright)]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--teaching-text)] teaching-glow-text">
              星际讲堂
            </h2>
            <p className="text-sm text-[var(--teaching-muted)]">
              AI 导师为你规划教案，逐段讲解知识点
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFavoriteDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium border border-[var(--teaching-border)] text-[var(--teaching-muted)] transition-all hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10"
          >
            <Star className="h-4 w-4" />
            收藏
          </button>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              showHistory
                ? 'teaching-button-primary text-[var(--teaching-text)]'
                : 'border border-[var(--teaching-border)] text-[var(--teaching-muted)] hover:text-[var(--teaching-primary-bright)] hover:border-[var(--teaching-primary)]/50 hover:bg-[var(--teaching-primary)]/10'
            }`}
          >
            <Clock className="h-4 w-4" />
            历史星图
          </button>
        </div>
      </div>

      {/* History Panel (toggle) */}
      {showHistory && (
        <div className="mb-6">
          <TeachingHistoryPanel
            onSelect={handleSelectHistory}
            onClose={() => setShowHistory(false)}
            refreshKey={historyRefreshKey}
          />
        </div>
      )}

      <TeachingPanel
        viewHistoryItem={historyItem}
        viewHistoryJobId={historyItem?.id}
        onViewedHistory={handleViewedHistory}
      />

      {/* ── 收藏教案弹窗 ── */}
      <Dialog open={favoriteDialogOpen} onOpenChange={setFavoriteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-rose-500 fill-current" />
              收藏的教案
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {favoritesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Clock className="h-5 w-5 animate-spin text-rose-500" />
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
                暂无收藏的教案
              </div>
            ) : (
              <ScrollArea className="max-h-[360px]">
                <div className="space-y-2">
                  {favorites.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setFavoriteDialogOpen(false);
                        router.push(`/sky/teaching?history=${item.id}`, { scroll: false });
                      }}
                      className="group w-full flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 p-3 text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
                        <BookOpen className="h-4 w-4 text-rose-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {item.plan?.title || item.topic}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(item.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.totalSections || item.sections?.length || 0} 章节
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
