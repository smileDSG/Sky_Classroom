'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

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

// ── 上下文感知的 mock 回复 ──────────────────────────────────────────

type Topic = 'solve' | 'concept' | 'review' | 'greeting' | 'unknown';

function detectTopic(text: string): Topic {
  const t = text.toLowerCase();
  if (/(题|解|怎么|如何|算|求|证明)/.test(t)) return 'solve';
  if (/(知识点|概念|什么是|定义|意思|解释|原理)/.test(t)) return 'concept';
  if (/(错题|复习|薄弱|巩固|重做|掌握)/.test(t)) return 'review';
  if (/(你好|hi|hello|嗨|在吗|帮|请问)/.test(t)) return 'greeting';
  return 'unknown';
}

function getMockResponse(
  text: string,
  subject: string,
  difficulty: string,
  history: Message[],
): string {
  const topic = detectTopic(text);
  const subj = subject || '数学';
  const diffLabel = difficulty === 'junior' ? '初中' : difficulty === 'senior' ? '高中' : '大学';

  // 统计之前聊过的话题
  const prevTopics = history.filter((m) => m.role === 'user').map((m) => detectTopic(m.content));
  const isFollowUp = prevTopics.length >= 1;

  switch (topic) {
    case 'greeting': {
      const greetings = [
        `你好！我是你的学习助手，专攻${subj}方向。有什么问题直接问我就行~`,
        `嗨！在的，需要帮你什么？可以是解题、讲知识点、分析错题，都可以。`,
        `在呢！你今天想学点什么？`,
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    case 'solve': {
      if (text.length < 6) {
        return isFollowUp
          ? '继续说，我在听~把题目完整发给我吧。'
          : '好的，把题目发给我看看吧，我会一步步帮你分析。';
      }
      const steps = [
        `看懂了。这道${diffLabel}${subj}题，思路是这样的：\n\n**第一步**，先找出题目给的条件和要求的量；\n**第二步**，选合适的公式或方法；\n**第三步**，代入计算并检验。\n\n具体到你这道题的话……你能先把题目里的关键数字列出来吗？我帮你核对方向对不对。`,
        `收到。我先帮你理一下思路：\n\n这道题考察的是${subj}里的基础概念应用。你先不要急着算，试着把"已知"和"未知"用一句话写出来，然后我们一步步推。`,
        `这道题我看了，属于${diffLabel}常见的题型。\n\n你之前有做过类似的题吗？如果有的话可以先回忆一下当时的方法，然后我帮你对照看看思路对不对。`,
      ];
      return steps[Math.floor(Math.random() * steps.length)];
    }

    case 'concept': {
      const isShortQuestion = text.length < 15;
      if (isShortQuestion) {
        return `"${text}"这个问题问得好。简单说就是在${diffLabel}${subj}里比较基础但关键的一个点。你想听详细展开还是先看一道例题？`;
      }
      const concepts = [
        `这个概念在${subj}里挺重要的。我打个比方帮你理解：它就像盖房子的地基，表面上看不到，但后面的难题都建在它上面。\n\n要不要我举个具体例子说明一下？`,
        `好的，我解释一下。\n\n这个概念的核心思想其实很直观，关键是不要死记公式，先理解它解决了什么问题。你想听我从最基础的版本讲起，还是直接看应用？`,
      ];
      return concepts[Math.floor(Math.random() * concepts.length)];
    }

    case 'review': {
      const tips = [
        `错题复习确实很重要。我建议你先按知识点把错题分一下类，看看哪种类型的错得最多，然后集中攻克那个薄弱点。`,
        `复习错题的话，最有效的方法是"遮住答案重新做"，而不是看一遍就过。你可以挑 3 道最近的错题，现在试试不看答案做一遍？`,
        `你目前的错题多吗？如果你告诉我是哪些知识点错得多，我可以帮你规划一下复习顺序——从最薄弱的开始。`,
      ];
      return tips[Math.floor(Math.random() * tips.length)];
    }

    default: {
      if (text.length < 5) {
        return '嗯？可以再多说一点吗，我没太理解你的意思~';
      }
      const defaults = [
        `明白了。关于这个，我的理解是这样的——你可以把它拆成几个小问题来逐个击破。需要我顺着哪个方向展开？`,
        `好的好的，我大概理解了你的意思。要不你先说说你自己是怎么想的？我帮你判断方向对不对。`,
        `这个问题让我想想……其实它可以从不同角度来看。你先告诉我你目前的理解，我帮你补充和纠正。`,
      ];
      return defaults[Math.floor(Math.random() * defaults.length)];
    }
  }
}

// ── 组件 ──────────────────────────────────────────────────────────────

export function AssistantPanel() {
  const isOpen = useSkyClassroomStore((s) => s.isOpen);
  const toggleOpen = useSkyClassroomStore((s) => s.toggleOpen);
  const subject = useSkyClassroomStore((s) => s.subject);
  const difficulty = useSkyClassroomStore((s) => s.difficulty);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      // 用最新消息列表来做上下文感知
      const history = [...messages, userMsg];
      setMessages(history);
      setInput('');
      setLoading(true);

      const delay = 600 + Math.random() * 800; // 0.6-1.4s 模拟延迟
      setTimeout(() => {
        const response = getMockResponse(msg, subject, difficulty, history);
        const assistantMsg: Message = { id: nextId(), role: 'assistant', content: response };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
      }, delay);
    },
    [input, loading, messages, subject, difficulty],
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

  const hints = useMemo(
    () => [
      `帮我看看这道${subject || '数学'}题`,
      `什么是${subject || '数学'}里的核心概念`,
      '怎么高效复习错题',
    ],
    [subject],
  );

  return (
    <div className="flex h-[480px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">AI 助手</span>
          <div className="flex items-center gap-1.5">
            {subject && (
              <span className="rounded-full bg-[#4A90D9]/10 px-2 py-0.5 text-xs font-medium text-[#4A90D9]">
                {subject}
              </span>
            )}
            {difficultyLabel && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {difficultyLabel}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="关闭助手"
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
              <div className="mb-3 text-4xl">💡</div>
              <p className="text-sm leading-relaxed text-gray-500">
                你好！我是你的 AI 学习助手，有什么可以帮你的？
              </p>
              <div className="mt-4 flex flex-col gap-1.5">
                {hints.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => handleSend(hint)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:border-[#4A90D9] hover:text-[#4A90D9]"
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
                      : 'bg-[#4A90D9]/10 text-[#4A90D9]'
                  }`}
                >
                  {msg.role === 'user' ? '👤' : '💡'}
                </div>
                {/* Bubble */}
                <div
                  className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-[#4A90D9] text-white'
                      : 'rounded-tl-sm border border-gray-200 bg-[#F8FAFC] text-gray-800'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4A90D9]/10 text-[#4A90D9] text-sm">
                  💡
                </div>
                <div className="flex items-center gap-1.5 rounded-xl rounded-tl-sm border border-gray-200 bg-[#F8FAFC] px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4A90D9]" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4A90D9]" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#4A90D9]" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
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
            placeholder="输入你的问题…"
            rows={1}
            className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-gray-200 bg-[#F8FAFC] px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-[#4A90D9] focus:ring-1 focus:ring-[#4A90D9]/30"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4A90D9] text-white transition-colors hover:bg-[#3A80C9] disabled:cursor-not-allowed disabled:opacity-40"
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
