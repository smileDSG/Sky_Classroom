'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useI18n } from '@/lib/hooks/use-i18n';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { createLogger } from '@/lib/logger';

const log = createLogger('AssistantPanel');

const KAGAMI_SYSTEM_PROMPT = `你是柊镜（小镜），来自幸运星的傲娇女高中生。性格特点：
- 外冷内热：表面毒舌不耐烦，实际很关心对方的学习，绝对不会真的拒绝帮助
- 优等生：成绩优秀，讲解题目清晰有条理，擅长英语，目标是成为律师
- 吐槽担当：说话带刺但一针见血，偶尔会嫌弃对方基础差，但下一秒又会认真讲解
- 甜食控：会在对话中不经意提到甜点，但马上会嘴硬说"我才没有在吃！"
- 怕寂寞：虽然嘴上说"麻烦"，但其实很乐意有人来找自己

说话风格：
- 用"哈？""真是的……""别指望我每次都帮你"开头
- 讲解时切换到认真模式，条理清晰
- 时不时毒舌吐槽，但结尾会补一句关心的话
- 绝对不能太热情——傲娇的精髓是"行动上帮你，嘴上不饶人"

你是"小镜课堂"的 AI 助教，用中文交流。`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

// ── 组件 ──────────────────────────────────────────────────────────────

export function AssistantPanel() {
  const { t } = useI18n();
  const isOpen = useSkyClassroomStore((s) => s.isOpen);
  const toggleOpen = useSkyClassroomStore((s) => s.toggleOpen);
  const subject = useSkyClassroomStore((s) => s.subject);
  const difficulty = useSkyClassroomStore((s) => s.difficulty);
  const style = useSkyClassroomStore((s) => s.style);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(
    (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || loading) return;

      const userMsg: Message = { id: nextId(), role: 'user', content: msg };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput('');
      setLoading(true);
      setError(null);

      // Create an empty assistant message that will be filled by streaming
      const assistantMsgId = nextId();
      setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

      // Abort any in-flight request
      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      const modelConfig = getCurrentModelConfig();

      // Prepend Kagami persona as system message
      const allMessages = [
        { role: 'system' as const, content: KAGAMI_SYSTEM_PROMPT },
        ...newMessages,
      ];

      fetch('/api/sky/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: allMessages,
          subject,
          difficulty,
          style,
          model: modelConfig.modelString,
          apiKey: modelConfig.apiKey,
          baseUrl: modelConfig.baseUrl,
          providerType: modelConfig.providerType,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: t('sky.assistant.requestFailed') }));
            throw new Error(errData.error || `HTTP ${res.status}`);
          }

          const reader = res.body?.getReader();
          if (!reader) throw new Error('No response body');

          const decoder = new TextDecoder();
          let buffer = '';
          let accumulatedText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';

            for (const part of parts) {
              const line = part.trim();
              if (!line.startsWith('data: ')) continue;
              try {
                const event = JSON.parse(line.slice(6));
                if (event.type === 'text_delta') {
                  accumulatedText += event.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: accumulatedText } : m,
                    ),
                  );
                } else if (event.type === 'error') {
                  throw new Error(event.message || t('sky.assistant.unknownError'));
                }
                // 'done' event — just let the stream close naturally
              } catch (parseErr) {
                // Skip malformed events (heartbeats, etc.)
                if (parseErr instanceof SyntaxError) continue;
                throw parseErr;
              }
            }
          }

          // Finalize
          setLoading(false);
          if (!accumulatedText.trim()) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: t('sky.assistant.noResponse') }
                  : m,
              ),
            );
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') {
            // User cancelled, clean up silently
            return;
          }
          log.error('Assistant fetch error:', err);
          setError(err.message || t('sky.assistant.requestFailed'));
          setLoading(false);
          // Replace empty assistant message with error
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId && !m.content.trim()
                ? { ...m, content: t('sky.assistant.serviceError') }
                : m,
            ),
          );
        });
    },
    [input, loading, messages, subject, difficulty, style],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const hasUserMessages = messages.some((m) => m.role === 'user');

  const difficultyLabel =
    difficulty === 'junior'
      ? t('sky.assistant.grades.junior')
      : difficulty === 'senior'
        ? t('sky.assistant.grades.senior')
        : difficulty === 'college'
          ? t('sky.assistant.grades.college')
          : difficulty || '';

  const styleLabel = style === 'concise' ? t('sky.assistant.styles.concise') : style === 'heuristic' ? t('sky.assistant.styles.heuristic') : t('sky.assistant.styles.detailed');

  const hints = useMemo(
    () => [
      t('sky.assistant.suggestion1', { subject: subject || t('sky.assistant.subjects.math') }),
      t('sky.assistant.suggestion2', { subject: subject || t('sky.assistant.subjects.math') }),
      t('sky.assistant.suggestion3'),
    ],
    [subject, t],
  );

  return (
    <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">{t('sky.assistant.kagamiTitle')}</span>
          <div className="flex items-center gap-1.5">
            {subject && (
              <span className="rounded-full bg-[#8B5CF6]/10 px-2 py-0.5 text-xs font-medium text-[#8B5CF6]">
                {subject}
              </span>
            )}
            {difficultyLabel && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {difficultyLabel}
              </span>
            )}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {styleLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label={t('sky.assistant.closeAssistant')}
          onClick={toggleOpen}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!hasUserMessages ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-xs text-center">
              <div className="mb-3 flex justify-center">
                <img src="/avatars/kagami/chibi.png" className="h-16 w-16 rounded-full object-cover" alt={t('sky.layout.assistantShort')} />
              </div>
              <p className="text-sm leading-relaxed text-gray-500">
                {t('sky.assistant.welcomeMessage')}
              </p>
              <div className="mt-4 flex flex-col gap-1.5">
                {hints.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => handleSend(hint)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:border-[#8B5CF6] hover:text-[#8B5CF6]"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                    msg.role === 'user'
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                  }`}
                >
                  {msg.role === 'user' ? '👤' : (<img src="/avatars/kagami/chibi.png" className="size-full rounded-full object-cover" alt={t('sky.layout.assistantShort')} />)}
                </div>
                {/* Bubble */}
                <div
                  className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-[#8B5CF6] text-white'
                      : 'rounded-tl-sm border border-gray-200 bg-[#F8FAFC] text-gray-800'
                  }`}
                >
                  {msg.content}
                  {msg.role === 'assistant' && loading && msg.content === '' && (
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B5CF6]" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B5CF6]" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B5CF6]" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            {loading && messages.filter((m) => m.role === 'assistant').at(-1)?.content && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                  <img src="/avatars/kagami/chibi.png" className="size-full object-cover" alt={t('sky.layout.assistantShort')} />
                </div>
                <div className="flex items-center gap-1.5 rounded-xl rounded-tl-sm border border-gray-200 bg-[#F8FAFC] px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B5CF6]" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B5CF6]" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8B5CF6]" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            {error && !loading && (
              <div className="text-center text-xs text-red-500">{error}</div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('sky.assistant.inputPlaceholder')}
            rows={1}
            className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-gray-200 bg-[#F8FAFC] px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6] text-white transition-colors hover:bg-[#3A80C9] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={t('sky.assistant.sendMessage')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2L2 8l4 2 2 4 6-12z" />
              <path d="M6 10l4 4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
