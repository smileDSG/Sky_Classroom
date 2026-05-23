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

  // Auto-scroll to the current scene note
  useEffect(() => {
    if (!currentSceneId || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-scene-id="${currentSceneId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSceneId]);

  // Empty state
  if (notes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/20 rounded-2xl flex items-center justify-center mb-3 text-sky-300 dark:text-sky-600 ring-1 ring-sky-100 dark:ring-sky-800/30">
          <BookOpen className="w-6 h-6" />
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
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-hide"
    >
      {notes.map((note, index) => {
        const isCurrent = note.sceneId === currentSceneId;
        const pageNum = index + 1;
        const pageLabel = t('chat.lectureNotes.pageLabel', { n: pageNum });

        return (
          <div
            key={note.sceneId}
            data-scene-id={note.sceneId}
            className={cn(
              'relative mb-3 last:mb-0 rounded-lg px-3 py-2.5 transition-colors duration-200',
              isCurrent
                ? 'bg-sky-50/80 dark:bg-sky-950/25 ring-1 ring-sky-200/60 dark:ring-sky-700/30'
                : 'bg-slate-50/50 dark:bg-slate-800/30',
            )}
          >
            {/* Page label row */}
            <div className="flex items-center gap-2 mb-1.5">
              {/* Timeline dot */}
              <div
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  isCurrent
                    ? 'bg-sky-500 dark:bg-sky-400 shadow-sm shadow-sky-400/40'
                    : 'bg-slate-300 dark:bg-slate-600',
                )}
              />
              <span
                className={cn(
                  'text-xs font-semibold tracking-wide',
                  isCurrent
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-slate-400 dark:text-slate-500',
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
            <h4 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 mb-1.5 leading-snug pl-4">
              {note.sceneTitle}
            </h4>

            {/* Ordered items: spotlight/laser inline at sentence start, discussion as card */}
            <div className="pl-4 space-y-1">
              {(() => {
                // Build render rows: group inline actions (spotlight/laser) with next speech,
                // but render discussion as its own block
                type Row =
                  | { kind: 'speech'; inlineActions: string[]; text: string }
                  | { kind: 'discussion'; label?: string }
                  | { kind: 'trailing'; inlineActions: string[] };
                const rows: Row[] = [];
                let pendingInline: string[] = [];
                for (const item of note.items) {
                  if (item.kind === 'action' && item.type === 'discussion') {
                    // Flush pending inline actions as trailing if any
                    if (pendingInline.length > 0) {
                      rows.push({
                        kind: 'trailing',
                        inlineActions: pendingInline,
                      });
                      pendingInline = [];
                    }
                    rows.push({ kind: 'discussion', label: item.label });
                  } else if (item.kind === 'action') {
                    pendingInline.push(item.type);
                  } else {
                    rows.push({
                      kind: 'speech',
                      inlineActions: pendingInline,
                      text: item.text,
                    });
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
                        className="my-1.5 flex items-start gap-1.5 rounded-md border border-amber-200/60 dark:border-amber-700/30 bg-amber-50/60 dark:bg-amber-900/10 px-2 py-1.5"
                      >
                        <MessageSquare className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-xs leading-snug text-amber-800 dark:text-amber-300">
                          {row.label}
                        </span>
                      </div>
                    );
                  }
                  const actions = row.kind === 'trailing' ? row.inlineActions : row.inlineActions;
                  return (
                    <p
                      key={i}
                      className="text-[13px] leading-[1.8] text-gray-700 dark:text-gray-300"
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
        );
      })}
    </div>
  );
}
