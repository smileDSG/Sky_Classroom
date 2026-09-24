'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight, Clock } from 'lucide-react';
import type { StageListItem } from '@/lib/utils/stage-storage';
import type { Slide } from '@/lib/types/slides';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';

const PREVIEW_COUNT = 4;

// 右列「继续学习」：最近几堂课的紧凑列表。
// 重命名/删除等管理操作留给下方完整网格，这里只负责"快速回到上次的地方"。
export function ContinueLearning({
  classrooms,
  thumbnails,
  formatDate,
}: {
  classrooms: StageListItem[];
  thumbnails: Record<string, Slide>;
  formatDate: (ts: number) => string;
}) {
  const router = useRouter();

  if (classrooms.length === 0) return null;

  const recent = [...classrooms].sort((a, b) => b.updatedAt - a.updatedAt);
  const preview = recent.slice(0, PREVIEW_COUNT);
  const hasMore = classrooms.length > PREVIEW_COUNT;

  return (
    <section aria-label="继续学习">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">继续学习</h2>
        {hasMore ? (
          <a
            href="#classroom-grid"
            className="text-xs text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
          >
            全部 {classrooms.length} 个课堂
          </a>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            共 {classrooms.length} 个课堂
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-700/60 dark:bg-slate-900">
        {preview.map((classroom) => {
          const slide = thumbnails[classroom.id];
          return (
            <button
              key={classroom.id}
              type="button"
              onClick={() => router.push(`/classroom/${classroom.id}`)}
              onMouseEnter={() => router.prefetch(`/classroom/${classroom.id}`)}
              className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <div className="relative h-9 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                {slide ? (
                  <ThumbnailSlide
                    slide={slide}
                    size={64}
                    viewportSize={slide.viewportSize ?? 1000}
                    viewportRatio={slide.viewportRatio ?? 0.5625}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-300 dark:text-slate-600">
                    <Clock className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {classroom.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  {classroom.sceneCount} 页 · {formatDate(classroom.updatedAt)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-sky-600 dark:text-slate-600 dark:group-hover:text-sky-400" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
