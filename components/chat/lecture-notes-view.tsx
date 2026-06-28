'use client';

import { useEffect, useRef } from 'react';
import { BookOpen, Flashlight, MessageSquare, MousePointer2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LectureNoteEntry } from '@/lib/types/chat';

const ACTION_ICON_ONLY: Record<string, { Icon: typeof Flashlight; label: string; style: string }> =
  {
    spotlight: {
      Icon: Flashlight,
      label: '聚光',
      style:
        'bg-yellow-50 dark:bg-yellow-500/15 border-yellow-300/50 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
    },
    laser: {
      Icon: MousePointer2,
      label: '激光笔',
      style:
        'bg-red-50 dark:bg-red-500/15 border-red-300/50 dark:border-red-500/30 text-red-600 dark:text-red-300',
    },
    play_video: {
      Icon: Play,
      label: '播放',
      style:
        'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300/50 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    },
  };

interface LectureNotesViewProps {
  notes: LectureNoteEntry[];
  currentSceneId?: string | null;
}

export function LectureNotesView({ notes, currentSceneId }: LectureNotesViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentSceneId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-scene-id="${currentSceneId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentSceneId]);

  if (notes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-300 ring-1 ring-violet-100 dark:bg-violet-900/20 dark:text-violet-500 dark:ring-violet-800/30">
          <BookOpen className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          播放课程后，讲解笔记会显示在这里
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">点击播放按钮开始授课</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 scrollbar-hide"
    >
      {notes.map((note, index) => {
        const isCurrent = note.sceneId === currentSceneId;
        const pageNum = index + 1;

        return (
          <section
            key={note.sceneId}
            data-scene-id={note.sceneId}
            className={cn(
              'relative mb-3 rounded-xl px-3.5 py-3 transition-colors duration-200 last:mb-0',
              isCurrent
                ? 'bg-violet-50/80 ring-1 ring-violet-200/70 dark:bg-violet-950/25 dark:ring-violet-700/30'
                : 'bg-slate-50/70 ring-1 ring-slate-200/60 dark:bg-slate-900/45 dark:ring-slate-800',
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  isCurrent
                    ? 'bg-violet-500 shadow-sm shadow-violet-400/40'
                    : 'bg-slate-300 dark:bg-slate-600',
                )}
              />
              <span
                className={cn(
                  'text-xs font-semibold',
                  isCurrent
                    ? 'text-violet-600 dark:text-violet-300'
                    : 'text-slate-400 dark:text-slate-500',
                )}
              >
                Page {pageNum}
              </span>
              {isCurrent && (
                <span className="rounded-full bg-violet-100 px-1.5 py-px text-[11px] font-bold text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                  Current
                </span>
              )}
            </div>

            <h4 className="mb-2.5 pl-4 text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
              {note.sceneTitle}
            </h4>

            <div className="space-y-2 pl-4">
              {(() => {
                type Row =
                  | { kind: 'speech'; inlineActions: string[]; text: string }
                  | { kind: 'discussion'; label?: string }
                  | { kind: 'trailing'; inlineActions: string[] };

                const rows: Row[] = [];
                let pendingInline: string[] = [];

                for (const item of note.items) {
                  if (item.kind === 'action' && item.type === 'discussion') {
                    if (pendingInline.length > 0) {
                      rows.push({ kind: 'trailing', inlineActions: pendingInline });
                      pendingInline = [];
                    }
                    rows.push({ kind: 'discussion', label: item.label });
                  } else if (item.kind === 'action') {
                    pendingInline.push(item.type);
                  } else {
                    rows.push({ kind: 'speech', inlineActions: pendingInline, text: item.text });
                    pendingInline = [];
                  }
                }

                if (pendingInline.length > 0) {
                  rows.push({ kind: 'trailing', inlineActions: pendingInline });
                }

                return rows.map((row, rowIndex) => {
                  if (row.kind === 'discussion') {
                    return (
                      <div
                        key={rowIndex}
                        className="my-2 flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/70 px-2.5 py-2 dark:border-amber-700/30 dark:bg-amber-900/10"
                      >
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                        <span className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
                          {row.label}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <p
                      key={rowIndex}
                      className="text-sm leading-[1.8] text-slate-700 dark:text-slate-300"
                    >
                      {row.inlineActions.map((action, actionIndex) => {
                        const cfg = ACTION_ICON_ONLY[action];
                        if (!cfg) return null;
                        const { Icon, label, style } = cfg;
                        return (
                          <span
                            key={actionIndex}
                            className={cn(
                              'mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full border align-middle',
                              style,
                            )}
                            title={label}
                          >
                            <Icon className="h-2.5 w-2.5" />
                          </span>
                        );
                      })}
                      {row.kind === 'speech' ? row.text : null}
                    </p>
                  );
                });
              })()}
            </div>
          </section>
        );
      })}
    </div>
  );
}
