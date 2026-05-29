'use client';

import { useEffect } from 'react';

/**
 * Translation feature — vanilla DOM approach.
 * Creates a floating translate button and result popup
 * directly via document.createElement, avoiding all React
 * rendering / z-index / event-system issues.
 */
export function GlobalTranslate() {
  useEffect(() => {
    // ── language detection ──────────────────────────────────────
    function detectLang(text: string): string {
      let cjk = 0, hira = 0, kata = 0, hang = 0, lat = 0;
      for (const ch of text.slice(0, 500)) {
        const c = ch.charCodeAt(0);
        if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF)) cjk++;
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

    // ── create indicator ─────────────────────────────────────────
    const indicator = document.createElement('div');
    indicator.textContent = '译';
    Object.assign(indicator.style, {
      position: 'fixed', bottom: '4px', right: '4px', zIndex: '2147483640',
      background: '#ef4444', color: '#fff', padding: '2px 6px',
      borderRadius: '3px', fontSize: '10px', fontFamily: 'monospace', opacity: '0.85',
    });
    document.body.appendChild(indicator);

    // ── create button ───────────────────────────────────────────
    const btn = document.createElement('button');
    btn.textContent = '翻译选中文字';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '40px', right: '8px', zIndex: '2147483640',
      background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
      color: '#fff', padding: '8px 16px', borderRadius: '8px',
      fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(14,165,233,0.4)',
    });
    document.body.appendChild(btn);

    // ── result popup ────────────────────────────────────────────
    const popup = document.createElement('div');
    Object.assign(popup.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      zIndex: '2147483647', background: '#fff', color: '#1e293b',
      padding: '20px', borderRadius: '12px', minWidth: '320px', maxWidth: '90vw',
      boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      fontSize: '14px', lineHeight: '1.6', border: '1px solid #e2e8f0',
      display: 'none', fontFamily: 'system-ui, sans-serif',
    });
    document.body.appendChild(popup);

    const popupText = document.createElement('pre');
    Object.assign(popupText.style, { whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 'inherit' });
    popup.appendChild(popupText);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    Object.assign(closeBtn.style, {
      marginTop: '12px', background: '#e2e8f0', border: 'none',
      padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
    });
    closeBtn.onclick = () => { popup.style.display = 'none'; };
    popup.appendChild(closeBtn);

    // ── click handler ───────────────────────────────────────────
    btn.onclick = async () => {
      const sel = window.getSelection()?.toString()?.trim();
      if (!sel || sel.length < 2) { alert('请先选中文字'); return; }

      popup.style.display = 'block';
      popupText.textContent = '正在翻译…';

      try {
        const src = detectLang(sel);
        const res = await fetch('/api/sky/cloud-mind/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sel.slice(0, 500), sourceLang: src === 'auto' ? '' : src, targetLang: 'zh', stream: false }),
        });
        const raw = await res.text();
        try {
          const j = JSON.parse(raw);
          if (j?.success && j?.data?.translation) {
            popupText.textContent = j.data.translation;
          } else {
            popupText.textContent = '错误: ' + (j?.error || '未知');
            popupText.style.color = '#ef4444';
          }
        } catch {
          popupText.textContent = raw.slice(0, 1000);
          popupText.style.color = '#1e293b';
        }
      } catch (e) {
        popupText.textContent = '网络错误: ' + (e instanceof Error ? e.message : String(e));
        popupText.style.color = '#ef4444';
      }
    };

    // ── cleanup ─────────────────────────────────────────────────
    return () => {
      indicator.remove();
      btn.remove();
      popup.remove();
    };
  }, []);

  return null;
}
