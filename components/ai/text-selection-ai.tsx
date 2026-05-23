'use client';

import { useEffect, useState, useCallback } from 'react';

interface TextSelectionAIProps {
  onAsk: (text: string) => void;
}

export function TextSelectionAI({ onAsk }: TextSelectionAIProps) {
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);

  const handleMouseUp = useCallback(() => {
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
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  if (!selection) return null;

  return (
    <button
      className="fixed z-[60] -translate-x-1/2 -translate-y-full rounded-lg bg-[#4A90D9] px-3 py-1.5 text-sm text-white shadow-lg hover:bg-[#3A7BC8] transition-colors"
      style={{ left: selection.x, top: selection.y }}
      onClick={() => {
        onAsk(selection.text);
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }}
    >
      AI 解释
    </button>
  );
}
