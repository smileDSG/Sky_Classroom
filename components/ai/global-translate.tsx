'use client';

import { useEffect } from 'react';

export function GlobalTranslate() {
  useEffect(() => {
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

    async function doTranslate() {
      const sel = window.getSelection()?.toString()?.trim();
      if (!sel || sel.length < 2) {
        popup.style.display = 'block';
        popupText.textContent = '请先选中文字，再按 Ctrl+Shift+T';
        popupText.style.color = '#64748b';
        return;
      }

      popup.style.display = 'block';
      popupText.textContent = '正在翻译…';
      popupText.style.color = '#1e293b';

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
          popupText.textContent = j?.success && j?.data?.translation
            ? j.data.translation
            : '错误: ' + (j?.error || '翻译失败');
          if (!j?.success) popupText.style.color = '#ef4444';
          else popupText.style.color = '#1e293b';
        } catch {
          popupText.textContent = raw.slice(0, 1000);
          popupText.style.color = '#1e293b';
        }
      } catch (e) {
        popupText.textContent = '网络错误: ' + (e instanceof Error ? e.message : String(e));
        popupText.style.color = '#ef4444';
      }
    }

    // ── popup element ─────────────────────────────────────────────
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
    Object.assign(popupText.style, { whiteSpace: 'pre-wrap', margin: '0 0 12px 0', fontFamily: 'inherit', fontSize: 'inherit' });
    popup.appendChild(popupText);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭 (或按 Esc)';
    Object.assign(closeBtn.style, {
      background: '#e2e8f0', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
    });
    closeBtn.addEventListener('click', () => { popup.style.display = 'none'; });
    popup.appendChild(closeBtn);

    // ── keyboard shortcut Ctrl+Shift+T ─────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        doTranslate();
      }
      if (e.key === 'Escape') popup.style.display = 'none';
    };
    document.addEventListener('keydown', onKeyDown);

    // ── indicator ──────────────────────────────────────────────────
    const indicator = document.createElement('div');
    indicator.textContent = 'Ctrl+Shift+T 翻译';
    Object.assign(indicator.style, {
      position: 'fixed', bottom: '4px', right: '4px', zIndex: '2147483640',
      background: '#0ea5e9', color: '#fff', padding: '3px 8px',
      borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', opacity: '0.85',
      cursor: 'default',
    });
    document.body.appendChild(indicator);

    // ── cleanup ────────────────────────────────────────────────────
    return () => {
      popup.remove();
      indicator.remove();
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
