'use client';

import { useEffect, useState, useRef } from 'react';

function detectLang(text: string): string {
  let cjk = 0, hira = 0, kata = 0, hang = 0, lat = 0;
  for (const ch of text.slice(0, 1000)) {
    const c = ch.charCodeAt(0);
    if (c >= 0x4E00 && c <= 0x9FFF) cjk++;
    else if (c >= 0x3400 && c <= 0x4DBF) cjk++;
    else if (c >= 0x3040 && c <= 0x309F) hira++;
    else if (c >= 0x30A0 && c <= 0x30FF) kata++;
    else if (c >= 0xAC00 && c <= 0xD7AF) hang++;
    else if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) lat++;
  }
  if (hira > 0 || kata > 0) return 'ja';
  if (hang > cjk && hang > lat) return 'ko';
  if (cjk > 4) return 'zh';
  if (lat > 0) return 'en';
  return 'auto';
}

export function GlobalTranslate() {
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── native click handler ─────────────────────────────────────────

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const handler = () => {
      const sel = window.getSelection()?.toString()?.trim();
      if (!sel || sel.length < 2) { alert('请先选中文字'); return; }
      const src = detectLang(sel);
      setLoading(true);
      setResult('');
      setErr('');
      alert('开始翻译: ' + sel.slice(0, 30));

      fetch('/api/sky/cloud-mind/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sel.slice(0, 500), sourceLang: src === 'auto' ? '' : src, targetLang: 'zh', stream: false }),
      }).then(async (res) => {
        const raw = await res.text();
        alert('HTTP ' + res.status + ': ' + raw.slice(0, 300));
        try {
          const j = JSON.parse(raw);
          if (j?.success && j?.data?.translation) {
            setResult(j.data.translation);
          } else {
            setErr(j?.error || 'API 返回错误');
          }
        } catch {
          setResult(raw.slice(0, 500));
        }
      }).catch((e) => {
        alert('网络错误: ' + (e instanceof Error ? e.message : String(e)));
        setErr('网络错误: ' + (e instanceof Error ? e.message : String(e)));
      }).finally(() => setLoading(false));
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      <div style={{ position: 'fixed', bottom: 4, right: 4, zIndex: 99999, background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: 3, fontSize: 10, fontFamily: 'monospace', opacity: 0.85 }}>译</div>

      <button
        ref={btnRef}
        style={{ position: 'fixed', bottom: 40, right: 8, zIndex: 99999, background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(14,165,233,0.4)' }}
      >
        翻译选中文字
      </button>

      {/* result */}
      {(loading || result || err) && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 99998, background: '#fff', color: '#1e293b', padding: 20, borderRadius: 12, minWidth: 320, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', fontSize: 14, lineHeight: 1.6, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{loading ? '正在翻译…' : '翻译结果'}</div>
          {loading && <div>...</div>}
          {err && <div style={{ color: '#ef4444' }}>{err}</div>}
          {!loading && !err && <div style={{ whiteSpace: 'pre-wrap' }}>{result || '（空）'}</div>}
          <button onClick={() => { setLoading(false); setResult(''); setErr(''); }} style={{ marginTop: 12, background: '#e2e8f0', border: 'none', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>关闭</button>
        </div>
      )}
    </>
  );
}
