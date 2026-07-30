'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { createLogger } from '@/lib/logger';
import { InlineMath } from '@/components/ui/inline-math';
import { useScrollIsolation } from '@/lib/hooks/use-scroll-isolation';
import {
  retrieveRelevantMemories,
  buildMemoryContext,
  injectMemoryIntoPrompt,
  saveExtractedMemories,
} from '@/lib/ai/memory-context';
import {
  extractMemoriesFromConversation,
  detectConversationTopic,
  generateConversationSummary,
} from '@/lib/ai/memory-extractor';
import {
  createConversation,
  appendMessage,
  appendMessages,
  updateSummary,
  listConversations,
  deleteConversation,
  getConversation,
  type AssistantConversationRecord,
} from '@/lib/storage/dao/assistant-conversation';
import type { AssistantMessage } from '@/lib/utils/database';
import { sanitizeAssistantMessages } from '@/lib/assistant/client-payload';

const log = createLogger('AssistantPanel');

const AGENT_ID = 'sky-assistant';

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

你是"小镜课堂"的 AI 助教，用中文交流。

数学格式要求：所有数学符号、公式、表达式必须使用 LaTeX 格式。行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹。例如：$x^2 + y^2 = 1$、$$\sum_{n=0}^{\infty} a_n x^n$$、分数用 \frac{}{}、根号用 \sqrt{}、极限用 \lim、积分用 \int、求和用 \sum。严禁用 ^ 代替上标，严禁用 _ 代替下标。`;

const NORMAL_SYSTEM_PROMPT = `你是一个专业、友善的 AI 学习助手。性格特点：
- 专业严谨：回答问题条理清晰，注重知识点的准确性
- 耐心温和：无论问题简单还是复杂，都认真对待，循循善诱
- 鼓励式教学：用积极正面的语言激励学生，肯定进步
- 实用导向：讲解后会用实例加深理解，帮助举一反三

说话风格：
- 开头用"你好！""没问题，让我来帮你""这道题我们可以这样思考"等友好开场
- 讲解时结构清晰、逻辑严密
- 适当肯定学生的努力
- 结尾鼓励学生继续练习

你是 AI 学习助教，用中文交流。注意：你不是"小镜"，不要以小镜自称，不要使用傲娇或角色扮演的语气。

数学格式要求：所有数学符号、公式、表达式必须使用 LaTeX 格式。行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹。例如：$x^2 + y^2 = 1$、$$\sum_{n=0}^{\infty} a_n x^n$$、分数用 \frac{}{}、根号用 \sqrt{}、极限用 \lim、积分用 \int、求和用 \sum。严禁用 ^ 代替上标，严禁用 _ 代替下标。`;

type KagamiMode = 'anime' | 'normal';

function loadMode(): KagamiMode {
  try {
    const saved = localStorage.getItem('assistant-panel-mode');
    if (saved === 'normal' || saved === 'anime') return saved;
  } catch { /* ignore */ }
  return 'anime';
}

const THEME_MAP: Record<string, string> = {
  sky: '#0ea5e9',
  violet: '#8B5CF6',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
};

function loadTheme(): string {
  try {
    const id = localStorage.getItem('assistant-theme') || 'sky';
    return THEME_MAP[id] || THEME_MAP.sky;
  } catch { return THEME_MAP.sky; }
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ── 组件 ──────────────────────────────────────────────────────────────

interface AssistantPanelProps {
  mode?: KagamiMode;
  onModeChange?: (mode: KagamiMode) => void;
  externalLoadConvId?: string | null;
  onConversationLoaded?: () => void;
  accentColor?: string;
}

export function AssistantPanel({
  mode: externalMode,
  onModeChange,
  externalLoadConvId,
  onConversationLoaded,
  accentColor: externalAccent,
}: AssistantPanelProps = {}) {
  const [accent, setAccent] = useState(externalAccent || THEME_MAP.sky);
  useEffect(() => {
    if (!externalAccent) setAccent(loadTheme());
  }, [externalAccent]);
  const isOpen = useSkyClassroomStore((s) => s.isOpen);
  const toggleOpen = useSkyClassroomStore((s) => s.toggleOpen);
  const subject = useSkyClassroomStore((s) => s.subject);
  const difficulty = useSkyClassroomStore((s) => s.difficulty);
  const style = useSkyClassroomStore((s) => s.style);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalMode, setInternalMode] = useState<KagamiMode>('anime');
  const mode = externalMode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<AssistantConversationRecord[]>([]);
  const [memoryContextStr, setMemoryContextStr] = useState<string>('');

  // Current conversation ID for persistence
  const currentConvIdRef = useRef<string | null>(null);
  const savedCountRef = useRef(0);

  // Hydrate mode from localStorage after mount (avoids SSR mismatch)
  useEffect(() => { if (!externalMode) setInternalMode(loadMode()); }, [externalMode]);

  // Reset chat when mode switches so the two personas don't share history
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      // Save current conversation before switching
      void saveCurrentConversation();
      setMessages([]);
      currentConvIdRef.current = null;
      savedCountRef.current = 0;
      prevModeRef.current = mode;
    }
  }, [mode]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useCallback(() => `msg-${crypto.randomUUID()}`, []);

  // ── Memory loading ──────────────────────────────────────────────

  /** Load memory context for the current conversation */
  const loadMemoryContext = useCallback(async (userMessage: string) => {
    try {
      const memories = await retrieveRelevantMemories(AGENT_ID, userMessage);
      const context = buildMemoryContext(memories);
      if (context) {
        const fullContext = `以下是该学生的历史学习档案，请在回答时参考这些信息，使回答更加个性化：\n${context}`;
        setMemoryContextStr(fullContext);
        log.info(`Loaded ${memories.length} memories for context`);
      } else {
        setMemoryContextStr('');
      }
    } catch (err) {
      log.warn('Failed to load memory context:', err);
      setMemoryContextStr('');
    }
  }, []);

  // ── Conversation persistence ────────────────────────────────────

  /** Save the current conversation to IndexedDB (delta: only new messages since last save) */
  const saveCurrentConversation = useCallback(async () => {
    if (messages.length === 0) return;

    const newMessages = messages.slice(savedCountRef.current);
    if (newMessages.length === 0 && currentConvIdRef.current) return;

    try {
      const now = Date.now();
      const convMessages: AssistantMessage[] = newMessages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: now,
      }));

      if (!currentConvIdRef.current) {
        const conv = await createConversation({
          mode,
          subject,
          difficulty,
          style,
          firstMessage: messages[0]?.content,
        });
        currentConvIdRef.current = conv.id;
        if (convMessages.length > 0) await appendMessages(conv.id, convMessages);
      } else if (convMessages.length > 0) {
        await appendMessages(currentConvIdRef.current, convMessages);
      }
      savedCountRef.current = messages.length;

      // Extract and save memories from this conversation
      const extracted = extractMemoriesFromConversation(
        messages.map((m) => ({ role: m.role, content: m.content })),
      );
      if (extracted.length > 0) {
        await saveExtractedMemories(AGENT_ID, extracted, currentConvIdRef.current ?? undefined);
        log.info(`Extracted ${extracted.length} memories from conversation`);
      }

      // Update conversation summary
      if (currentConvIdRef.current && messages.length >= 4) {
        const summary = generateConversationSummary(
          messages.map((m) => ({ role: m.role, content: m.content })),
        );
        await updateSummary(currentConvIdRef.current, summary);
      }
    } catch (err) {
      log.warn('Failed to save conversation:', err);
    }
  }, [messages, mode, subject, difficulty, style]);

  /** Load conversation history list */
  const loadConversationHistory = useCallback(async () => {
    try {
      const convs = await listConversations({ mode, limit: 20 });
      setConversations(convs);
    } catch (err) {
      log.warn('Failed to load conversation history:', err);
    }
  }, [mode]);

  /** Load a past conversation */
  const loadConversation = useCallback(async (convId: string) => {
    try {
      const conv = await getConversation(convId);
      if (!conv) return;

      const rawMessages = conv.messages
        .filter((m) => m.role !== 'system')
        .map((m, i) => ({
          id: m.id || `loaded-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      // Deduplicate by ID (handles previously corrupted data from duplicate saves)
      const seen = new Set<string>();
      const loadedMessages: Message[] = [];
      for (const m of rawMessages) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          loadedMessages.push(m);
        }
      }

      setMessages(loadedMessages);
      currentConvIdRef.current = conv.id;
      savedCountRef.current = loadedMessages.length;

      setShowHistory(false);
    } catch (err) {
      log.warn('Failed to load conversation:', err);
    }
  }, []);

  // Load conversation from external trigger (page-level history sidebar)
  useEffect(() => {
    if (externalLoadConvId) {
      void loadConversation(externalLoadConvId).then(() => {
        onConversationLoaded?.();
      });
    }
  }, [externalLoadConvId, loadConversation, onConversationLoaded]);

  /** Start a new conversation */
  const startNewConversation = useCallback(() => {
    void saveCurrentConversation();
    setMessages([]);
    currentConvIdRef.current = null;
    savedCountRef.current = 0;
    setMemoryContextStr('');
  }, [saveCurrentConversation]);

  /** Delete a conversation */
  const handleDeleteConversation = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(convId);
      if (currentConvIdRef.current === convId) {
        setMessages([]);
        currentConvIdRef.current = null;
      }
      await loadConversationHistory();
    } catch (err) {
      log.warn('Failed to delete conversation:', err);
    }
  }, [loadConversationHistory]);

  // Load history when panel opens
  useEffect(() => {
    if (showHistory) {
      void loadConversationHistory();
    }
  }, [showHistory, loadConversationHistory]);

  // ── Scroll ──────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    const el = messagesListRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useScrollIsolation(messagesListRef, true);

  // ── Send message ────────────────────────────────────────────────

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

      // Load memory context asynchronously, then send
      void (async () => {
        try {
          const res = await fetch('/api/sky/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortController.signal,
            body: JSON.stringify({
              messages: sanitizeAssistantMessages(newMessages),
              subject,
              difficulty,
              style,
              model: modelConfig.modelString,
              apiKey: modelConfig.apiKey,
              baseUrl: modelConfig.baseUrl,
              providerType: modelConfig.providerType,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: '请求失败' }));
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
                  throw new Error(event.message || '未知错误');
                }
              } catch (parseErr) {
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
                  ? { ...m, content: '抱歉，我没有生成回答，请稍后重试。' }
                  : m,
              ),
            );
          }

          // Save conversation and extract memories after response completes (delta only)
          const finalMessages = [...newMessages, { id: assistantMsgId, role: 'assistant' as const, content: accumulatedText }];
          try {
            const now = Date.now();
            const newOnly = finalMessages.slice(savedCountRef.current).map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: now,
            }));

            if (!currentConvIdRef.current) {
              const conv = await createConversation({
                mode,
                subject,
                difficulty,
                style,
                firstMessage: newMessages[0]?.content,
              });
              currentConvIdRef.current = conv.id;
            }

            if (newOnly.length > 0) await appendMessages(currentConvIdRef.current, newOnly);
            savedCountRef.current = finalMessages.length;

            // Extract and save memories
            const extracted = extractMemoriesFromConversation(
              finalMessages.map((m) => ({ role: m.role, content: m.content })),
            );
            if (extracted.length > 0) {
              await saveExtractedMemories(AGENT_ID, extracted, currentConvIdRef.current ?? undefined);
            }

            // Update summary
            if (finalMessages.length >= 4) {
              const summary = generateConversationSummary(
                finalMessages.map((m) => ({ role: m.role, content: m.content })),
              );
              await updateSummary(currentConvIdRef.current, summary);
            }
          } catch (saveErr) {
            log.warn('Failed to save conversation after response:', saveErr);
          }
        } catch (err) {
          if ((err as Error).name === 'AbortError') return;
          log.error('Assistant fetch error:', err);
          setError((err as Error).message || '请求失败，请重试');
          setLoading(false);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId && !m.content.trim()
                ? { ...m, content: '抱歉，请求出现错误，请稍后重试。' }
                : m,
            ),
          );
        }
      })();
    },
    [input, loading, messages, subject, difficulty, style, mode],
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
      ? '初中'
      : difficulty === 'senior'
        ? '高中'
        : difficulty === 'college'
          ? '大学'
          : difficulty || '';

  const styleLabel = style === 'concise' ? '简洁' : style === 'heuristic' ? '启发' : '详细';

  const hints = useMemo(
    () => [
      `帮我看看这道${subject || '数学'}题`,
      `什么是${subject || '数学'}里的核心概念`,
      '怎么高效复习错题',
    ],
    [subject],
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div id="assistant-panel" className="flex flex-col h-full overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl" style={{ '--accent': accent, '--accent-rgb': hexToRgb(accent) } as React.CSSProperties}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900 dark:text-slate-100" suppressHydrationWarning>{mode === 'anime' ? '小镜课堂' : 'AI 学习助手'}</span>
          <div className="flex items-center gap-1.5">
            {subject && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `rgb(var(--accent-rgb) / 0.1)`, color: `var(--accent)` }}>
                {subject}
              </span>
            )}
            {difficultyLabel && (
              <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-300">
                {difficultyLabel}
              </span>
            )}
            <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-300">
              {styleLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* New conversation button */}
          <button
            type="button"
            onClick={startNewConversation}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 dark:text-slate-500 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-slate-300"
            title="新对话"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
          {/* History toggle */}
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-slate-300"
            style={showHistory ? { backgroundColor: `rgb(var(--accent-rgb) / 0.1)`, color: `var(--accent)` } : undefined}
            title="对话历史"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4v4l3 2" />
            </svg>
          </button>
          {/* Mode toggle */}
          <button
            onClick={() => {
              const next = mode === 'anime' ? 'normal' : 'anime';
              setMode(next);
              try { localStorage.setItem('assistant-panel-mode', next); } catch { /* ignore */ }
            }}
            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
              mode === 'anime'
                ? 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
            title={mode === 'anime' ? '当前：二次元版' : '当前：常规版'}
          >
            {mode === 'anime' ? '🌸 二次元' : '📖 常规'}
          </button>
          <button
            type="button"
            aria-label="关闭助手"
            onClick={toggleOpen}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 dark:text-slate-500 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 dark:hover:text-slate-300"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>

      {/* History sidebar */}
      {showHistory && (
        <div className="shrink-0 border-b border-gray-100 dark:border-slate-700 max-h-48 overflow-y-auto bg-gray-50 dark:bg-slate-800/50">
          <div className="px-3 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400">对话历史</span>
              <span className="text-xs text-gray-400 dark:text-slate-500">{conversations.length} 条记录</span>
            </div>
            {conversations.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">暂无历史对话</p>
            ) : (
              <div className="flex flex-col gap-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => void loadConversation(conv.id)}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors hover:bg-white dark:hover:bg-slate-700 ${
                      currentConvIdRef.current === conv.id ? 'bg-white dark:bg-slate-700 ring-1' : ''
                    }`}
                    style={currentConvIdRef.current === conv.id ? { '--tw-ring-color': `rgb(var(--accent-rgb) / 0.3)` } as React.CSSProperties : undefined}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-slate-200 truncate">{conv.title}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">
                        {conv.messageCount} 条消息 · {new Date(conv.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => void handleDeleteConversation(conv.id, e)}
                      className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-gray-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 2l6 6M8 2l-6 6" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesListRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ overscrollBehavior: 'contain' }}>
        {!hasUserMessages ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-xs text-center">
              <div className="mb-3 flex justify-center">
                <img
                  src={mode === 'anime' ? '/avatars/kagami/chibi.png' : '/avatars/student-glasses-new.jpg'}
                  className="h-16 w-16 rounded-full object-cover"
                  alt="小镜"
                />
              </div>
              <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">
                {mode === 'anime' ? '哈？遇到不会的题目了？告诉我吧。' : '你好！有任何学习问题，尽管问我。'}
              </p>
              <div className="mt-4 flex flex-col gap-1.5">
                {hints.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => handleSend(hint)}
                    className="rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-left text-sm text-gray-500 dark:text-slate-400 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div
                key={`${msg.id}-${i}`}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                    msg.role === 'user'
                      ? 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300'
                      : 'text-[var(--accent)]'
                  }`}
                  style={msg.role !== 'user' ? { backgroundColor: `rgb(var(--accent-rgb) / 0.1)` } : undefined}
                >
                  {msg.role === 'user' ? '👤' : (<img src={mode === 'anime' ? '/avatars/kagami/chibi.png' : '/avatars/student-glasses-new.jpg'} className="size-full rounded-full object-cover" alt="小镜" />)}
                </div>
                {/* Bubble */}
                <div
                  className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm text-white'
                      : 'rounded-tl-sm border border-gray-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-gray-800 dark:text-slate-200'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: accent } : undefined}
                >
                  <InlineMath text={msg.content} />
                  {msg.role === 'assistant' && loading && msg.content === '' && (
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: accent, animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: accent, animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: accent, animationDelay: '300ms' }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
            {loading && messages.filter((m) => m.role === 'assistant').at(-1)?.content && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                  <img src={mode === 'anime' ? '/avatars/kagami/chibi.png' : '/avatars/student-glasses-new.jpg'} className="size-full object-cover" alt="小镜" />
                </div>
                <div className="flex items-center gap-1.5 rounded-xl rounded-tl-sm border border-gray-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: accent, animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: accent, animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: accent, animationDelay: '300ms' }} />
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
      <div className="shrink-0 border-t border-gray-100 dark:border-slate-700 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题…"
            rows={1}
            className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-gray-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-colors focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:brightness-110 active:scale-95"
            style={{ backgroundColor: accent }}
            aria-label="发送消息"
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
