'use client';

import { useEffect, useState, useCallback } from 'react';

// ── inline language detection (avoids Turbopack HMR import issues) ─

function detectLang(text: string): string {
  let cjk = 0, hira = 0, kata = 0, hang = 0, lat = 0;
  for (const ch of text.slice(0, 1000)) {
    const c = ch.charCodeAt(0);
    if (c >= 0x4E00 && c <= 0x9FFF) cjk++;        // CJK Unified
    else if (c >= 0x3400 && c <= 0x4DBF) cjk++;   // CJK Ext-A
    else if (c >= 0x3040 && c <= 0x309F) hira++;  // Hiragana
    else if (c >= 0x30A0 && c <= 0x30FF) kata++;  // Katakana
    else if (c >= 0xAC00 && c <= 0xD7AF) hang++;  // Hangul
    else if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) lat++; // A-Z a-z
  }
  if (hira > 0 || kata > 0) return 'ja';
  if (hang > cjk && hang > lat) return 'ko';
  if (cjk > 4) return 'zh';
  if (lat > 0) return 'en';
  return 'auto';
}

// ── component ──────────────────────────────────────────────────────

export function GlobalTranslate() {
  const [mounted, setMounted] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [result, setResult] = useState('');
  const [popup, setPopup] = useState<{ text: string; src: string; x: number; y: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const doTranslate = useCallback(() => {
    const sel = window.getSelection()?.toString()?.trim();
    if (!sel || sel.length < 2) { alert('请先选中要翻译的文字'); return; }
    const src = detectLang(sel);
    setPopup({ text: sel.slice(0, 500), src, x: window.innerWidth / 2, y: window.innerHeight / 2 - 100 });
    setTranslating(true);
    setResult('');
    setError('');

    alert('1: 开始请求翻译: ' + sel.slice(0, 30));
    fetch('/api/sky/cloud-mind/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sel.slice(0, 500), sourceLang: src === 'auto' ? '' : src, targetLang: 'zh', stream: false }),
    }).then(async (res) => {
      const text = await res.text();
      alert('2: HTTP ' + res.status + '\n' + text.slice(0, 500));
      try {
        const j = JSON.parse(text);
        if (j?.success && j?.data?.translation) {
          setResult(j.data.translation);
        } else {
          setError(j?.error || '翻译失败');
        }
      } catch {
        setResult(text.slice(0, 500));
      }
    }).catch((err) => {
      alert('3: 错误\n' + (err instanceof Error ? err.message : String(err)));
      setError(err instanceof Error ? err.message : String(err));
    }).finally(() => setTranslating(false));
  }, []);

  const closePopup = useCallback(() => { setPopup(null); setResult(''); setError(''); }, []);

  useEffect(() => {
    if (!popup) return;
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopup(); };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [popup, closePopup]);

  if (!mounted) return null;

  return (
    <>
      {/* indicator */}
      <div style={{ position: 'fixed', bottom: 4, right: 4, zIndex: 99999, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontFamily: 'monospace', opacity: 0.85 }}>译</div>

      {/* always-visible button */}
      <button
        onClick={doTranslate}
        style={{ position: 'fixed', bottom: 40, right: 8, zIndex: 99999, background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(14,165,233,0.4)' }}
      >
        翻译选中文字
      </button>

      {/* result popover */}
      {popup && (
        <div className="fixed inset-0 z-[99998]" onClick={(e) => { if (e.target === e.currentTarget) closePopup(); }}>
          <div className="absolute w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-sky-200/60 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden" style={{ left: Math.min(popup.x, window.innerWidth - 360), top: Math.min(popup.y, window.innerHeight - 200) }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-sky-100 dark:border-slate-700 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/50 dark:to-blue-950/50">
              <span className="text-xs font-medium text-sky-700 dark:text-sky-300">翻译 {popup.src}→zh</span>
              <button onClick={closePopup} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-3 italic border-l-2 border-sky-200 pl-2">{popup.text}</p>
              <div className="h-px bg-sky-100 dark:bg-slate-700 mb-2" />
              {translating && <div className="flex items-center gap-1.5 py-2"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '120ms' }} /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '240ms' }} /><span className="text-xs text-slate-400 ml-2">正在翻译…</span></div>}
              {!translating && error && <p className="text-sm text-red-500">{error}</p>}
              {!translating && !error && <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap">{result || '（翻译完成，但未返回结果）'}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
