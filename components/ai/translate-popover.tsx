'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetectLang } from '@/lib/utils/language-detect';
import { LANG_LABELS } from '@/lib/utils/language-detect';

export interface TranslatePopoverProps {
  /** The source text being translated */
  text: string;
  /** Detected source language */
  sourceLang: DetectLang;
  /** Target language */
  targetLang: DetectLang;
  /** Pixel position where to show the popover */
  position: { x: number; y: number } | null;
  /** Called when the user dismisses the popover */
  onClose: () => void;
}

/**
 * Streaming translation result popover.
 *
 * Opens near the selected text, calls the streaming translate API,
 * and renders the translated text character-by-character via SSE.
 */
export function TranslatePopover({
  text,
  sourceLang,
  targetLang,
  position,
  onClose,
}: TranslatePopoverProps) {
  const [translation, setTranslation] = useState('');
  const [status, setStatus] = useState<'loading' | 'streaming' | 'done' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // ── Streaming fetch ──────────────────────────────────────────────

  const startTranslation = useCallback(async () => {
    if (!text.trim()) return;
    setStatus('loading');
    setTranslation('');
    setError(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch('/api/sky/cloud-mind/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          text: text.slice(0, 5000),
          sourceLang: sourceLang === 'auto' ? '' : sourceLang,
          targetLang,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '翻译请求失败' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      setStatus('streaming');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // AI SDK v4 stream format: 0:"text content"
          if (trimmed.startsWith('0:')) {
            try {
              const text = JSON.parse(trimmed.slice(2));
              accumulated += text;
              if (mountedRef.current) setTranslation(accumulated);
            } catch {
              // Malformed chunk — skip
            }
            continue;
          }

          // Stream-level error: model overload, safety filter, etc.
          if (trimmed.startsWith('e:')) {
            try {
              const err = JSON.parse(trimmed.slice(2));
              throw new Error(err?.message || '翻译服务暂时不可用');
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) {
                throw new Error('翻译服务出错');
              }
              throw parseErr;
            }
          }

          // Finish event
          if (trimmed.startsWith('d:')) {
            try {
              const data = JSON.parse(trimmed.slice(2));
              if (data?.finishReason === 'error') {
                throw new Error('翻译模型返回错误');
              }
            } catch (parseErr) {
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
          // f:, e:, 3:, etc. — skip silently
        }
      }

      if (mountedRef.current) {
        setTranslation(accumulated || '翻译完成，但未返回结果。');
        setStatus('done');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (mountedRef.current) {
        setError((err as Error).message || '翻译失败，请重试');
        setStatus('error');
      }
    }
  }, [text, sourceLang, targetLang]);

  useEffect(() => {
    mountedRef.current = true;
    startTranslation();
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [startTranslation]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Position calc ────────────────────────────────────────────────

  const popoverStyle: React.CSSProperties = position
    ? {
        left: Math.min(position.x, window.innerWidth - 360),
        top: Math.min(position.y, window.innerHeight - 200),
      }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  const sourceLabel = LANG_LABELS[sourceLang] || sourceLang;
  const targetLabel = LANG_LABELS[targetLang] || targetLang;

  const content = (
    <div className="fixed inset-0 z-[99999]" onClick={onClose}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.21, 1, 0.36, 1] }}
          className="pointer-events-auto absolute w-[340px] max-w-[calc(100vw-2rem)]"
          style={popoverStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div data-translate-popover className="rounded-2xl border border-sky-200/60 dark:border-sky-700/30 bg-white dark:bg-slate-900 shadow-2xl shadow-sky-500/10 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-sky-100 dark:border-sky-800/30 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/50 dark:to-blue-950/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span className="text-xs font-medium text-sky-700 dark:text-sky-300">
                  翻译 · {sourceLabel} → {targetLabel}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4">
              {/* Source text preview */}
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-3 italic border-l-2 border-sky-200 dark:border-sky-700 pl-2">
                {text}
              </p>
              <div className="h-px bg-gradient-to-r from-sky-200/50 to-transparent dark:from-sky-700/30 mb-2" />

              {/* Translation result */}
              {status === 'loading' && (
                <div className="flex items-center gap-1.5 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '120ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '240ms' }} />
                  <span className="text-xs text-slate-400 ml-2">正在翻译…</span>
                </div>
              )}

              {(status === 'streaming' || status === 'done') && (
                <p className={cn(
                  'text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap',
                  status === 'streaming' && 'after:content-["▊"] after:animate-pulse after:text-sky-500',
                )}>
                  {translation}
                </p>
              )}

              {status === 'error' && (
                <div className="py-2">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );

  return createPortal(content, document.body);
}
