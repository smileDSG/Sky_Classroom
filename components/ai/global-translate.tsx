'use client';

import { useEffect, useState, useCallback } from 'react';
import { Languages } from 'lucide-react';
import { detectLanguage } from '@/lib/utils/language-detect';
import type { DetectLang } from '@/lib/utils/language-detect';

const TARGET: DetectLang = 'zh';

export function GlobalTranslate() {
  const [btn, setBtn] = useState<{ text: string; x: number; y: number } | null>(null);
  const [popup, setPopup] = useState<{ text: string; src: DetectLang; x: number; y: number } | null>(null);
  const [rt, setRt] = useState('');       // translated text
  const [st, setSt] = useState<'idle' | 'loading' | 'streaming' | 'done'>('idle');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── detect selection on mouseup ──────────────────────────────────

  const onMouseUp = useCallback(() => {
    setTimeout(() => {
      try {
        const sel = window.getSelection();
        if (!sel) return;
        const t = sel.toString().trim();
        if (t.length < 2 || t.length > 500) { setBtn(null); return; }
        const r = sel.getRangeAt(0).getBoundingClientRect();
        setBtn({ text: t, x: r.left + r.width / 2, y: r.top - 10 });
      } catch { /* ignore */ }
    }, 120);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseUp]);

  // ── translate ────────────────────────────────────────────────────

  const doTranslate = useCallback(async () => {
    if (!btn) return;
    const src = detectLanguage(btn.text);
    setPopup({ text: btn.text, src, x: btn.x, y: btn.y });
    setBtn(null);
    setRt('');
    setSt('loading');

    try {
      const res = await fetch('/api/sky/cloud-mind/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: btn.text, sourceLang: src === 'auto' ? '' : src, targetLang: TARGET, stream: true }),
      });
      if (!res.ok) throw new Error('翻译失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const dec = new TextDecoder();
      let buf = '', acc = '';
      setSt('streaming');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() || '';
        for (const ln of lines) {
          if (ln.startsWith('0:')) {
            try { acc += JSON.parse(ln.slice(2)); setRt(acc); } catch { /* skip */ }
          }
        }
      }
      setSt('done');
    } catch {
      setSt('done');
      setRt('翻译失败，请重试');
    }
  }, [btn]);

  const closePopup = useCallback(() => { setPopup(null); setRt(''); setSt('idle'); }, []);

  // ── dismiss on outside click ────────────────────────────────────

  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopup(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [popup, closePopup]);

  return (
    <>
      {/* DEBUG: always-visible translate button */}
      {mounted && (
        <>
          <div style={{ position: 'fixed', bottom: 4, right: 4, zIndex: 99999, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontFamily: 'monospace', opacity: 0.85 }}>
            译
          </div>
          <button
            onClick={() => {
              const sel = window.getSelection()?.toString()?.trim();
              if (!sel || sel.length < 2) { alert('请先选中文字'); return; }
              setBtn({ text: sel, x: window.innerWidth / 2, y: window.innerHeight / 2 });
              // use setTimeout to let setBtn propagate, then translate
              setTimeout(() => {
                const src = detectLanguage(sel);
                setPopup({ text: sel, src, x: window.innerWidth / 2, y: window.innerHeight / 2 - 100 });
                setRt('');
                setSt('loading');
                fetch('/api/sky/cloud-mind/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: sel, sourceLang: src === 'auto' ? '' : src, targetLang: TARGET, stream: true }),
                }).then(async (res) => {
                  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error || 'HTTP ' + res.status); }
                  const reader = res.body?.getReader();
                  if (!reader) throw new Error('No stream');
                  const dec = new TextDecoder(); let buf = '', acc = '';
                  setSt('streaming');
                  while (true) { const { done, value } = await reader.read(); if (done) break;
                    buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || '';
                    for (const ln of lines) { if (ln.startsWith('0:')) { try { acc += JSON.parse(ln.slice(2)); setRt(acc); } catch { /* skip */ } } }
                  }
                  setSt('done');
                }).catch((err) => { setSt('done'); setRt('错误: ' + (err instanceof Error ? err.message : String(err))); });
              }, 50);
            }}
            style={{ position: 'fixed', bottom: 40, right: 8, zIndex: 99999, background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(14,165,233,0.4)' }}
          >
            翻译选中文字
          </button>
        </>
      )}

      {/* translate result popover */}
      {popup && (
        <div
          className="fixed inset-0 z-[99998]"
          onClick={(e) => { if (e.target === e.currentTarget) closePopup(); }}
        >
          <div
            className="absolute w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-sky-200/60 dark:border-sky-700/30 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            style={{ left: Math.min(popup.x, window.innerWidth - 360), top: Math.min(popup.y, window.innerHeight - 200) }}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-sky-100 dark:border-sky-800/30 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/50 dark:to-blue-950/50">
              <span className="text-xs font-medium text-sky-700 dark:text-sky-300">翻译</span>
              <button onClick={closePopup} className="text-slate-400 hover:text-slate-600 text-sm leading-none">&times;</button>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-3 italic border-l-2 border-sky-200 pl-2">{popup.text}</p>
              <div className="h-px bg-sky-100 dark:bg-sky-800/30 mb-2" />
              {st === 'loading' && (
                <div className="flex items-center gap-1.5 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '120ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '240ms' }} />
                  <span className="text-xs text-slate-400 ml-2">正在翻译…</span>
                </div>
              )}
              {(st === 'streaming' || st === 'done') && (
                <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">
                  {rt || '（无结果）'}
                  {st === 'streaming' && <span className="inline-block w-1.5 h-4 bg-sky-500 animate-pulse ml-0.5 align-middle" />}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
