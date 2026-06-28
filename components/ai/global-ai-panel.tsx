'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { TextSelectionAI } from './text-selection-ai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function GlobalAIPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAsk = useCallback(
    (text: string) => {
      setOpen(true);
      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setLoading(true);
      sendMessage([...messages, { role: 'user' as const, content: text }]);
    },
    [messages],
  );

  const sendMessage = async (msgs: ChatMessage[]) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/sky/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
          style: 'concise',
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '抱歉，AI 助手暂时无法响应。' },
        ]);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text_delta' && event.content) {
              reply += event.content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: reply };
                return copy;
              });
            }
          } catch {
            /* partial chunk */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => [...prev, { role: 'assistant', content: '请求失败，请重试。' }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    const next = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(next);
    setLoading(true);
    sendMessage(next);
  };

  return (
    <>
      <TextSelectionAI onAsk={handleAsk} />

      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#4A90D9] text-2xl text-white shadow-lg hover:bg-[#3A7BC8] transition-all hover:scale-105"
          title="AI 助手 (Ctrl+Shift+A)"
        >
          💡
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[400px] flex-col rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-4 py-3">
            <span className="font-semibold text-gray-800 dark:text-slate-100">AI 助手</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-slate-500">Ctrl+Shift+A</span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                <div className="mb-2 text-3xl">💡</div>
                <p>AI 助手已就绪</p>
                <p className="mt-1 text-xs">选中页面上任意文字，或直接输入问题</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-[#4A90D9] text-white'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100'
                  }`}
                >
                  {m.content || (loading && m.role === 'assistant' ? '...' : '')}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-2 text-sm text-gray-400 dark:text-slate-500">
                  思考中...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-slate-700 px-3 py-2">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="输入问题..."
                className="flex-1 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 outline-none focus:border-[#4A90D9] placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || loading}
                className="rounded-lg bg-[#4A90D9] px-4 py-2 text-sm text-white hover:bg-[#3A7BC8] disabled:opacity-50"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
