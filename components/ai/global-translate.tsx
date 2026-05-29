'use client';

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Languages } from 'lucide-react';
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
 * Global right-click text translator.
 *
 * Select text anywhere on the page → right-click → floating "翻译" menu appears.
 * Click the option to open a streaming translation popover.
 *
 * Mount under <SkyAppShell> for classroom-wide coverage, or on the home page.
 */
export function GlobalTranslate() {
  const [menu, setMenu] = useState<TranslateState | null>(null);
  const [translate, setTranslate] = useState<TranslateState | null>(null);
  const [targetLang] = useState<DetectLang>(DEFAULT_TARGET);

  // ── Right-click handler ───────────────────────────────────────────

  const handleContextMenu = useCallback((e: MouseEvent) => {
    try {
      const target = e.target as HTMLElement;

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (target.closest('[contenteditable="true"]')) return;
      if (target.closest('[data-translate-popover]')) return;

      const sel = window.getSelection();
      if (!sel) return;

      const text = sel.toString().trim();
      if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) return;

      e.preventDefault();
      e.stopPropagation();

      const sourceLang = detectLanguage(text);

      setMenu({
        text,
        sourceLang,
        position: { x: e.clientX, y: e.clientY },
      });
    } catch {
      // Never let the handler break right-click entirely
    }
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu, true);
    return () => document.removeEventListener('contextmenu', handleContextMenu, true);
  }, [handleContextMenu]);

  // ── Dismiss ───────────────────────────────────────────────────────

  const dismissAll = useCallback(() => {
    setMenu(null);
    setTranslate(null);
  }, []);

  // Close menu on any click outside
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-translate-menu]') || target.closest('[data-translate-popover]')) return;
      dismissAll();
    };
    // delay registration so the current right-click doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('click', close, true), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', close, true);
    };
  }, [menu, dismissAll]);

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
    if (!menu) return;
    setTranslate({ ...menu });
    setMenu(null);
  }, [menu]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      {menu &&
        createPortal(
          <div
            data-translate-menu
            className="fixed z-[99998]"
            style={{ left: Math.min(menu.position.x, window.innerWidth - 140), top: Math.min(menu.position.y, window.innerHeight - 60) }}
          >
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl py-1 min-w-[120px]">
              <button
                onClick={handleTranslate}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
              >
                <Languages className="w-4 h-4 text-sky-500" />
                <span>翻译</span>
              </button>
            </div>
          </div>,
          document.body,
        )}

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
