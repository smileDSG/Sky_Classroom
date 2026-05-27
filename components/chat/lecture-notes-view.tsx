'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, MessageSquare, Flashlight, MousePointer2, Play, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { LectureNoteEntry } from '@/lib/types/chat';

const ACTION_CONFIG: Record<string, { Icon: typeof Flashlight; label: string; style: string }> = {
  spotlight: {
    Icon: Flashlight,
    label: '聚光灯',
    style: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300/40 dark:border-amber-500/30 text-amber-700 dark:text-amber-300',
  },
  laser: {
    Icon: MousePointer2,
    label: '激光笔',
    style: 'bg-red-100 dark:bg-red-900/30 border-red-300/40 dark:border-red-500/30 text-red-600 dark:text-red-300',
  },
  play_video: {
    Icon: Play,
    label: '播放视频',
    style: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300/40 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
  },
};

interface LectureNotesViewProps {
  notes: LectureNoteEntry[];
  currentSceneId?: string | null;
}

export function LectureNotesView({ notes, currentSceneId }: LectureNotesViewProps) {
  const { t } = useI18n();
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(currentSceneId ?? null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const wheelThrottleRef = useRef(0);

  // Sync expanded scene with currentSceneId
  useEffect(() => {
    if (currentSceneId) {
      setExpandedSceneId(currentSceneId);
      // Scroll filmstrip to show current scene
      requestAnimationFrame(() => {
        const el = filmstripRef.current?.querySelector(`[data-film-scene="${currentSceneId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      });
    }
  }, [currentSceneId]);

  // Mouse wheel on filmstrip → switch scenes
  const handleFilmstripWheel = useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      if (now - wheelThrottleRef.current < 300) return; // throttle
      wheelThrottleRef.current = now;

      e.preventDefault();
      const direction = e.deltaY > 0 || e.deltaX > 0 ? 1 : -1;
      const activeIdx = notes.findIndex((n) => n.sceneId === expandedSceneId);
      const nextIdx = Math.max(0, Math.min(notes.length - 1, activeIdx + direction));
      const nextScene = notes[nextIdx]?.sceneId;
      if (nextScene) {
        setExpandedSceneId(nextScene);
        // Scroll filmstrip to show the new active scene
        requestAnimationFrame(() => {
          const el = filmstripRef.current?.querySelector(`[data-film-scene="${nextScene}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
        });
      }
    },
    [expandedSceneId, notes],
  );

  if (notes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-gradient-to-br from-sky-100 to-indigo-100 dark:from-sky-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mb-4 text-sky-400 dark:text-sky-500 shadow-inner">
          <BookOpen className="w-8 h-8" />
        </div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          {t('chat.lectureNotes.empty')}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
          {t('chat.lectureNotes.emptyHint')}
        </p>
      </div>
    );
  }

  const activeIdx = notes.findIndex((n) => n.sceneId === expandedSceneId);
  const activeNote = activeIdx >= 0 ? notes[activeIdx] : null;

  return (
    <div className="flex flex-col h-full">
      {/* ── Stage: Current Scene Hero Card ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 scrollbar-hide">
        {activeNote ? (
          <div className="animate-fade-in-up">
            {/* Scene header bar */}
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-sky-300/30">
                {activeIdx + 1}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {t('chat.lectureNotes.pageLabel', { n: activeIdx + 1 })}
              </span>
              {activeNote.sceneId === currentSceneId && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300">
                  <Sparkles className="w-3 h-3" />
                  当前页
                </span>
              )}
            </div>

            {/* Scene title */}
            <h3 className="text-[18px] font-extrabold text-slate-800 dark:text-slate-100 mb-4 leading-tight">
              {activeNote.sceneTitle}
            </h3>

            {/* Content items */}
            <div className="space-y-3">
              {(() => {
                type Row =
                  | { kind: 'speech'; inlineActions: string[]; text: string }
                  | { kind: 'discussion'; label?: string }
                  | { kind: 'trailing'; inlineActions: string[] };
                const rows: Row[] = [];
                let pendingInline: string[] = [];
                for (const item of activeNote.items) {
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
                        className="flex items-start gap-2.5 rounded-xl border border-amber-300/50 dark:border-amber-600/30 bg-gradient-to-r from-amber-50/80 to-amber-100/40 dark:from-amber-900/15 dark:to-transparent p-3.5"
                      >
                        <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        </div>
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-0.5">课堂讨论</div>
                          <div className="text-[14px] leading-snug text-amber-800 dark:text-amber-200 font-medium">
                            {row.label}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  const actions = row.inlineActions;
                  return (
                    <div key={i} className="text-[14px] leading-[1.85] text-slate-700 dark:text-slate-300">
                      {actions.map((a, j) => {
                        const cfg = ACTION_CONFIG[a];
                        if (!cfg) return null;
                        const { Icon, label, style } = cfg;
                        return (
                          <span
                            key={j}
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium mr-1.5 mb-1 align-middle',
                              style,
                            )}
                          >
                            <Icon className="w-3 h-3" />
                            {label}
                          </span>
                        );
                      })}
                      {row.kind === 'speech' && (
                        <span className="leading-[1.85]">{row.text}</span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            点击下方胶片条选择一页
          </div>
        )}
      </div>

      {/* ── Filmstrip: Horizontal Scene Navigation ── */}
      <div className="shrink-0 border-t border-slate-200/60 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
        <div
          ref={filmstripRef}
          onWheel={handleFilmstripWheel}
          className="flex gap-2 overflow-x-auto scrollbar-hide p-2.5 px-3 group"
        >
          {notes.map((note, index) => {
            const isActive = note.sceneId === expandedSceneId;
            const isCurrent = note.sceneId === currentSceneId;
            const pageNum = index + 1;

            return (
              <button
                key={note.sceneId}
                data-film-scene={note.sceneId}
                onClick={() => setExpandedSceneId(note.sceneId)}
                className={cn(
                  'shrink-0 w-[100px] rounded-xl border-2 transition-all duration-200 overflow-hidden text-left group',
                  isActive
                    ? 'border-sky-400 dark:border-sky-500 shadow-md shadow-sky-200/40 dark:shadow-sky-900/30 scale-[1.02]'
                    : 'border-slate-200/60 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm',
                )}
              >
                {/* Mini thumbnail header */}
                <div className={cn(
                  'h-8 flex items-center justify-center text-xs font-bold transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white'
                    : isCurrent
                      ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400',
                )}>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {pageNum}
                  </span>
                </div>

                {/* Preview text */}
                <div className="p-1.5">
                  <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 truncate leading-tight">
                    {note.sceneTitle}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {note.items.find((i) => i.kind === 'speech')?.text?.slice(0, 20) || '—'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
