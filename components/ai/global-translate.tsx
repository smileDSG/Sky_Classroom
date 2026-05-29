'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Languages } from 'lucide-react';
import { TranslatePopover } from '@/components/ai/translate-popover';
import { detectLanguage, type DetectLang } from '@/lib/utils/language-detect';

const DEFAULT_TARGET: DetectLang = 'zh';
const MIN_SELECTION_LENGTH = 2;
const MAX_SELECTION_LENGTH = 5000;

interface SelectionData {
  text: string;
  sourceLang: DetectLang;
  menuPos: { x: number; y: number };
}

interface TranslateState {
  text: string;
  sourceLang: DetectLang;
  position: { x: number; y: number };
}

/**
 * Global right-click text translator.
 *
 * When text is selected and the user right-clicks, a tiny floating
 * menu appears with a "翻译" option. Clicking it opens the
 * streaming translation popover.
 *
 * Mount under <SkyAppShell> for sky-classroom-wide coverage.
 */
export function GlobalTranslate() {
  const [menu, setMenu] = useState<SelectionData | null>(null);
  const [translate, setTranslate] = useState<TranslateState | null>(null);
  const [targetLang] = useState<DetectLang>(DEFAULT_TARGET);

  // ── Right-click → floating menu ──────────────────────────────────

  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Don't intercept right-click in editable areas — user wants native copy/paste menu
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.closest('[contenteditable="true"]')
    ) return;

    // Don't show menu inside the translate popover itself
    if (target.closest('[data-translate-popover]')) return;

    const sel = window.getSelection();
    if (!sel) return;

    const text = sel.toString().trim();
    if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) {
      setMenu(null);
      return;
    }

    e.preventDefault(); // suppress native context menu when text is selected
    const sourceLang = detectLanguage(text);

    setMenu({
      text,
      sourceLang,
      menuPos: { x: e.clientX, y: e.clientY },
    });
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [handleContextMenu]);

  // ── Dismiss menu / translate on outside interaction ──────────────

  const dismissAll = useCallback(() => {
    setMenu(null);
    setTranslate(null);
  }, []);

  useEffect(() => {
    if (!menu && !translate) return;
    const onClick = () => dismissAll();
    const onScroll = () => dismissAll();
    const id = setTimeout(() => {
      document.addEventListener('click', onClick, { once: true });
      document.addEventListener('scroll', onScroll, { once: true });
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', onClick);
      document.removeEventListener('scroll', onScroll);
    };
  }, [menu, translate, dismissAll]);

  // ── Translation trigger ──────────────────────────────────────────

  const handleTranslate = useCallback(() => {
    if (!menu) return;
    setTranslate({
      text: menu.text,
      sourceLang: menu.sourceLang,
      position: menu.menuPos,
    });
    setMenu(null);
  }, [menu]);

  // ── Keyboard ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissAll();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismissAll]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Floating right-click menu */}
      {menu &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[99998] shadow-xl"
              style={{ left: menu.menuPos.x, top: menu.menuPos.y }}
            >
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 min-w-[120px] overflow-hidden">
                <button
                  onClick={handleTranslate}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                >
                  <Languages className="w-4 h-4 text-sky-500" />
                  <span>翻译</span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}

      {/* Translation popover */}
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
