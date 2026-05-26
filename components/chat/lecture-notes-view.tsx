'use client';

import { useEffect, useRef } from 'react';
import { BookOpen, MessageSquare, Flashlight, MousePointer2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { LectureNoteEntry } from '@/lib/types/chat';

const ACTION_ICON_ONLY: Record<string, { Icon: typeof Flashlight; style: string }> = {
  spotlight: {
    Icon: Flashlight,
    style:
      'bg-yellow-50 dark:bg-yellow-500/15 border-yellow-300/40 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
  },
  laser: {
    Icon: MousePointer2,
    style:
      'bg-red-50 dark:bg-red-500/15 border-red-300/40 dark:border-red-500/30 text-red-600 dark:text-red-300',
  },
  play_video: {
    Icon: Play,
    style:
      'bg-yellow-50 dark:bg-yellow-500/15 border-yellow-300/40 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
  },
};

interface LectureNotesViewProps {
  notes: LectureNoteEntry[];
  currentSceneId?: string | null;
}

export function LectureNotesView({ notes, currentSceneId }: LectureNotesViewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentSceneId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-scene-id="${currentSceneId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSceneId]);

  if (notes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-14 h-14 bg-sky-50 dark:bg-sky-900/20 rounded-2xl flex items-center justify-center mb-3 text-sky-400 dark:text-sky-500 ring-1 ring-sky-100 dark:ring-sky-800/30">
          <BookOpen className="w-7 h-7" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('chat.lectureNotes.empty')}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {t('chat.lectureNotes.emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden pr-1 pl-4 py-3 scrollbar-hide">
      {/* Timeline axis */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[5px] top-0 bottom-0 w-[3px] bg-gradient-to-b from-sky-200 via-indigo-200 to-sky-200 dark:from-sky-800 dark:via-indigo-800 dark:to-sky-800 rounded-full" />

        {/* Scene nodes */}
        <div className="space-y-3">
          {notes.map((note, index) => {
            const isCurrent = note.sceneId === currentSceneId;
            const pageNum = index + 1;
            const pageLabel = t('chat.lectureNotes.pageLabel', { n: pageNum });

            return (
              <div
                key={note.sceneId}
                data-scene-id={note.sceneId}
                className="relative pl-6"
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    'absolute left-0 top-4 rounded-full transition-all duration-300',
                    isCurrent
                      ? 'w-3 h-3 -translate-x-1.5 bg-sky-500 dark:bg-sky-400 ring-4 ring-sky-200/60 dark:ring-sky-900/40 shadow-sm shadow-sky-400/40'
                      : 'w-2 h-2 -translate-x-1 bg-slate-300 dark:bg-slate-600',
                  )}
                />

                {/* Card */}
                <div
                  className={cn(
                    'rounded-xl px-3 py-2.5 transition-all duration-200',
                    isCurrent
                      ? 'bg-white dark:bg-slate-800/80 shadow-sm ring-2 ring-sky-400/30 dark:ring-sky-500/20'
                      : 'bg-slate-50/60 dark:bg-slate-800/30',
                  )}
                >
                  {/* Page label row */}
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        'text-[11px] font-bold tracking-wider uppercase',
                        isCurrent ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500',
                      )}
                    >
                      {pageLabel}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-1.5 py-px rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300">
                        {t('chat.lectureNotes.currentPage')}
                      </span>
                    )}
                  </div>

                  {/* Scene title */}
                  <h4 className="text-[14px] font-bold text-slate-800 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
                    <BookOpen className={cn('w-3.5 h-3.5 shrink-0', isCurrent ? 'text-sky-500' : 'text-slate-400')} />
                    {note.sceneTitle}
                  </h4>

                  {/* Divider line */}
                  <div className={cn('h-px mb-2', isCurrent ? 'bg-gradient-to-r from-sky-200 to-transparent dark:from-sky-700' : 'bg-slate-200/50 dark:bg-slate-700/30')} />

                  {/* Ordered items */}
                  <div className="space-y-1">
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
                      return rows.map((row, i) => {
                        if (row.kind === 'discussion') {
                          return (
                            <div
                              key={i}
                              className="my-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200/60 dark:border-amber-700/30 border-l-[3px] border-l-amber-400 dark:border-l-amber-500 bg-amber-50/60 dark:bg-amber-900/10 px-2.5 py-2"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                              <span className="text-[13px] leading-snug text-amber-800 dark:text-amber-300 font-medium">
                                {row.label}
                              </span>
                            </div>
                          );
                        }
                        const actions = row.inlineActions;
                        return (
                          <p
                            key={i}
                            className="text-[13px] leading-[1.8] text-slate-700 dark:text-slate-300"
                          >
                            {actions.map((a, j) => {
                              const cfg = ACTION_ICON_ONLY[a];
                              if (!cfg) return null;
                              const { Icon, style } = cfg;
                              return (
                                <span
                                  key={j}
                                  className={cn(
                                    'inline-flex items-center justify-center w-4 h-4 rounded-full border align-middle mr-0.5',
                                    style,
                                  )}
                                >
                                  <Icon className="w-2.5 h-2.5" />
                                </span>
                              );
                            })}
                            {row.kind === 'speech' ? row.text : null}
                          </p>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
