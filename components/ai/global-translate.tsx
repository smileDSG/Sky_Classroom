'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Languages, X } from 'lucide-react';
import { TranslatePopover } from '@/components/ai/translate-popover';
import { detectLanguage, type DetectLang } from '@/lib/utils/language-detect';

const DEFAULT_TARGET: DetectLang = 'zh';
const MIN_SELECTION_LENGTH = 2;
const MAX_SELECTION_LENGTH = 5000;

interface TranslateState {
  text: string;
  sourceLang: DetectLang;
  position: { x: number; y: number };
}

/**
 * Global text-selection translator.
 *
 * Select text → a big floating "翻译" button appears near the selection.
 * Clicks anywhere else dismiss it. No right-click needed — fires on mouseup,
 * before any browser translation UI.
 *
 * Mount under <SkyAppShell> for classroom-wide coverage, or on the home page.
 */
export function GlobalTranslate() {
  const [selection, setSelection] = useState<TranslateState | null>(null);
  const [translate, setTranslate] = useState<TranslateState | null>(null);
  const [targetLang] = useState<DetectLang>(DEFAULT_TARGET);

  // ── Text-selection handler (mouseup) ──────────────────────────────

  const handleMouseUp = useCallback(() => {
    try {
      // Small delay so the browser finalises the selection
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel) return;

        const text = sel.toString().trim();
        if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) {
          setSelection(null);
          return;
        }

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const sourceLang = detectLanguage(text);

        setSelection({
          text,
          sourceLang,
          position: {
            x: Math.min(rect.left + rect.width / 2, window.innerWidth - 180),
            y: Math.max(rect.top - 52, 8),
          },
        });
      }, 150);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // ── Dismiss ───────────────────────────────────────────────────────

  const dismissAll = useCallback(() => {
    setSelection(null);
    setTranslate(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!selection && !translate) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-translate-ui]')) return;
      dismissAll();
    };
    const t = setTimeout(() => document.addEventListener('click', close, true), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close, true);
    };
  }, [selection, translate, dismissAll]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissAll();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismissAll]);

  // ── Translation trigger ───────────────────────────────────────────

  const handleTranslate = useCallback(() => {
    if (!selection) return;
    setTranslate({ ...selection });
    setSelection(null);
  }, [selection]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Floating translation button — appears on text selection */}
      {selection &&
        createPortal(
          <div
            data-translate-ui
            className="fixed z-[99998] flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
            style={{
              left: Math.max(selection.position.x - 90, 8),
              top: selection.position.y,
            }}
          >
            <button
              onClick={handleTranslate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-2xl shadow-sky-500/30 hover:from-sky-600 hover:to-blue-700 active:scale-95 transition-all font-medium text-sm"
            >
              <Languages className="w-4 h-4" />
              <span>翻译</span>
            </button>
            <button
              onClick={dismissAll}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shadow-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>,
          document.body,
        )}

      {/* Translation result popover */}
      {translate && (
        <TranslatePopover
          text={translate.text}
          sourceLang={translate.sourceLang}
          targetLang={targetLang}
          position={translate.position}
          onClose={dismissAll}
        />
      )}
    </>
  );
}
