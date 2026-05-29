'use client';

import { useEffect, useState, useCallback } from 'react';
import { Languages } from 'lucide-react';
import { TranslatePopover } from '@/components/ai/translate-popover';
import { detectLanguage, type DetectLang } from '@/lib/utils/language-detect';

const DEFAULT_TARGET: DetectLang = 'zh';

interface TextSelectionAIProps {
  onAsk?: (text: string) => void;
}

export function TextSelectionAI({ onAsk }: TextSelectionAIProps = {}) {
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [translating, setTranslating] = useState<{ text: string; sourceLang: DetectLang; x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleMouseUp = useCallback(() => {
    try {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || !sel.toString().trim()) {
          setSelection(null);
          return;
        }
        const text = sel.toString().trim();
        if (text.length < 2 || text.length > 500) {
          setSelection(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelection({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
      }, 100);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleTranslate = useCallback(() => {
    if (!selection) return;
    try {
      const sl = detectLanguage(selection.text);
      setTranslating({ text: selection.text, sourceLang: sl, x: selection.x, y: selection.y });
    } catch {
      // ignore
    }
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, [selection]);

  return (
    <>
      {/* DEBUG indicator */}
      {mounted && (
        <div
          style={{
            position: 'fixed',
            bottom: 4,
            right: 4,
            zIndex: 99999,
            background: '#ef4444',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: 3,
            fontSize: 10,
            fontFamily: 'monospace',
            opacity: 0.9,
          }}
        >
          译
        </div>
      )}

      {selection && (
        <div
          className="fixed z-[60] -translate-x-1/2 -translate-y-full flex items-center gap-1.5"
          style={{ left: selection.x, top: selection.y }}
        >
          {onAsk && (
            <button
              className="rounded-lg bg-[#4A90D9] px-3 py-1.5 text-sm text-white shadow-lg hover:bg-[#3A7BC8] transition-colors"
              onClick={() => {
                onAsk(selection.text);
                setSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              AI 解释
            </button>
          )}
          <button
            onClick={handleTranslate}
            className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-sm text-white shadow-lg shadow-sky-500/30 hover:from-sky-600 hover:to-blue-700 transition-colors flex items-center gap-1"
          >
            <Languages className="w-3.5 h-3.5" />
            翻译
          </button>
        </div>
      )}

      {translating && (
        <TranslatePopover
          text={translating.text}
          sourceLang={translating.sourceLang}
          targetLang={DEFAULT_TARGET}
          position={{ x: translating.x, y: translating.y }}
          onClose={() => setTranslating(null)}
        />
      )}
    </>
  );
}
