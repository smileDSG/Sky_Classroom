/**
 * Study Group Panel — AI 学习小组讨论面板
 *
 * Fetches study group config from a completed teaching job and runs
 * a multi-agent discussion via the stateless /api/chat endpoint.
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Loader2, Send, X, MessageCircle, Play, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';
import { toast } from 'sonner';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { StatelessEvent, DirectorState } from '@/lib/types/chat';
import {
  createStudyGroupMemory,
  extractMemoryFromMessages,
  mergeMemory,
  formatMemoryForPrompt,
} from '@/lib/teaching/study-group-memory';

interface StudyGroupMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  agentColor: string;
  content: string;
  role: 'agent' | 'user';
}

interface StudyGroupSetup {
  sessionId: string;
  context: {
    topic: string;
    summary: string;
    focusPoints: string[];
    sectionTitles: string[];
  };
  agents: AgentConfig[];
  discussionTopic: string;
  discussionPrompt: string;
}

interface StudyGroupPanelProps {
  jobId: string;
}

const MAX_DISCUSSION_TURNS = 6;

export function StudyGroupPanel({ jobId }: StudyGroupPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<StudyGroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [setup, setSetup] = useState<StudyGroupSetup | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [started, setStarted] = useState(false);

  const directorStateRef = useRef<DirectorState | undefined>(undefined);
  const turnCountRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentMessageRef = useRef<StudyGroupMessage | null>(null);
  const memoryRef = useRef(createStudyGroupMemory());

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch study group setup
  const fetchSetup = useCallback(async () => {
    const res = await fetch(`/api/sky/teaching/${jobId}/study-group`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || '获取学习小组配置失败');
    }
    setSetup(data.data);
    setAgents(data.data.agents);
  }, [jobId]);

  // Parse SSE stream and accumulate events
  const parseSSE = async (
    response: Response,
    onEvent: (event: StatelessEvent) => void,
  ): Promise<{ directorState?: DirectorState; totalAgents: number; cueUser?: boolean }> => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let directorState: DirectorState | undefined = undefined;
    let totalAgents = 0;
    let cueUser = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data) as StatelessEvent;
            onEvent(event);

            if (event.type === 'agent_start') {
              totalAgents++;
            }
            if (event.type === 'done' && event.data.directorState) {
              directorState = event.data.directorState;
            }
            if (event.type === 'cue_user') {
              cueUser = true;
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    }

    return { directorState, totalAgents, cueUser };
  };

  // Run one discussion turn
  const runTurn = useCallback(
    async (userContent?: string): Promise<boolean> => {
      if (!setup || abortRef.current?.signal.aborted) return false;

      const mc = getCurrentModelConfig();
      const agentIds = setup.agents.map((a) => a.id);

      // Build messages
      const uiMessages = messages.map((m) => ({
        id: m.id,
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        parts: [{ type: 'text' as const, text: m.content }],
        metadata: {
          agentId: m.agentId,
          senderName: m.agentName,
          originalRole: m.role === 'user' ? ('user' as const) : ('agent' as const),
        },
      }));

      if (userContent) {
        uiMessages.push({
          id: `user-${Date.now()}`,
          role: 'user',
          parts: [{ type: 'text', text: userContent }],
          metadata: { agentId: 'user', senderName: '你', originalRole: 'user' },
        });
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: uiMessages,
          storeState: {
            stage: null,
            scenes: [],
            currentSceneId: null,
            mode: 'autonomous',
            whiteboardOpen: false,
          },
          config: {
            agentIds,
            sessionType: 'discussion',
            discussionTopic: setup.discussionTopic,
            discussionPrompt:
              setup.discussionPrompt + formatMemoryForPrompt(memoryRef.current),
            agentConfigs: setup.agents.map(({ createdAt: _c, updatedAt: _u, isDefault: _d, ...rest }) => rest),
            triggerAgentId: userContent ? undefined : agentIds[0],
          },
          directorState: directorStateRef.current,
          apiKey: mc.apiKey,
          baseUrl: mc.baseUrl,
          model: mc.modelString,
          providerType: mc.providerType,
          thinkingConfig: mc.thinkingConfig,
        }),
        signal: abortRef.current!.signal,
      });

      if (res.status === 401) {
        toast.error('API Key 无效或已过期');
        return false;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast.error(`讨论请求失败: ${text.slice(0, 100)}`);
        return false;
      }

      let currentAgentId: string | null = null;
      let currentAgentName = '';
      let currentAgentColor = '';
      let currentAgentAvatar = '';
      let currentContent = '';
      const turnMessages: StudyGroupMessage[] = [];

      const { directorState, totalAgents, cueUser } = await parseSSE(res, (event) => {
        switch (event.type) {
          case 'agent_start': {
            currentAgentId = event.data.agentId;
            currentAgentName = event.data.agentName;
            currentAgentColor = event.data.agentColor || '#888';
            currentAgentAvatar = event.data.agentAvatar || '';
            currentContent = '';

            const msg: StudyGroupMessage = {
              id: event.data.messageId,
              agentId: currentAgentId,
              agentName: currentAgentName,
              agentAvatar: currentAgentAvatar,
              agentColor: currentAgentColor,
              content: '',
              role: 'agent',
            };
            currentMessageRef.current = msg;
            turnMessages.push(msg);
            setMessages((prev) => [...prev, msg]);
            break;
          }
          case 'text_delta': {
            if (!currentMessageRef.current) return;
            currentContent += event.data.content;
            currentMessageRef.current.content = currentContent;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.id === currentMessageRef.current!.id) {
                return [...prev.slice(0, -1), { ...last, content: currentContent }];
              }
              return prev;
            });
            break;
          }
          case 'agent_end': {
            currentMessageRef.current = null;
            break;
          }
          case 'thinking': {
            // Ignore thinking events in UI
            break;
          }
        }
      });

      if (directorState) {
        directorStateRef.current = directorState;
        turnCountRef.current = directorState.turnCount;
      }

      // Extract memory from this turn's agent messages
      if (turnMessages.length > 0) {
        const newMemory = extractMemoryFromMessages(turnMessages);
        memoryRef.current = mergeMemory(memoryRef.current, newMemory);
      }

      // Continue if we got agent content and haven't reached max turns
      const shouldContinue =
        totalAgents > 0 && !cueUser && turnCountRef.current < MAX_DISCUSSION_TURNS;
      return shouldContinue;
    },
    [setup, messages],
  );

  // Run discussion loop
  const runDiscussionLoop = useCallback(
    async (userContent?: string) => {
      if (isStreaming) return;
      setIsStreaming(true);

      try {
        let shouldContinue = await runTurn(userContent);
        while (shouldContinue && !abortRef.current?.signal.aborted) {
          shouldContinue = await runTurn();
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Intentional abort
        } else {
          toast.error('讨论出错，请重试');
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, runTurn],
  );

  // Start discussion
  const handleStart = useCallback(async () => {
    if (!setup) {
      setIsLoading(true);
      try {
        await fetchSetup();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '初始化失败';
        toast.error(msg);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    // Reset state
    setMessages([]);
    directorStateRef.current = undefined;
    turnCountRef.current = 0;
    memoryRef.current = createStudyGroupMemory();
    abortRef.current = new AbortController();
    setStarted(true);

    // Start the loop
    runDiscussionLoop();
  }, [setup, fetchSetup, runDiscussionLoop]);

  // Send user message
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    // Add user message
    const userMsg: StudyGroupMessage = {
      id: `user-${Date.now()}`,
      agentId: 'user',
      agentName: '你',
      agentColor: '#10b981',
      content: trimmed,
      role: 'user',
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Continue discussion with user input
    abortRef.current = new AbortController();
    runDiscussionLoop(trimmed);
  }, [input, isStreaming, runDiscussionLoop]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Interrupt
  const handleInterrupt = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!isOpen) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-lg shadow-indigo-500/25"
          size="icon"
        >
          <Users className="h-6 w-6 text-white" />
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 right-6 w-[420px] h-[560px] z-50 shadow-2xl"
    >
      <Card className="h-full flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-indigo-200/50 dark:border-indigo-800/30">
        {/* Header */}
        <CardHeader className="pb-3 pt-4 px-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              AI 学习小组
            </CardTitle>
            <div className="flex items-center gap-1">
              {isStreaming && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleInterrupt}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {setup && (
            <p className="text-xs text-muted-foreground mt-1 truncate">讨论主题：{setup.discussionTopic}</p>
          )}
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          {!started ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Users className="h-8 w-8 text-indigo-500" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">AI 学习小组</p>
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  邀请 3 位 AI 同学围绕刚才的授课内容展开讨论，你可以随时加入。
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleStart}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1" />
                )}
                开始讨论
              </Button>
            </div>
          ) : messages.length === 0 && isStreaming ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在组织讨论...
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id + idx} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                  style={{ backgroundColor: msg.agentColor }}
                >
                  {msg.agentAvatar ? (
                    <img src={msg.agentAvatar} alt={msg.agentName} className="w-full h-full object-cover" />
                  ) : (
                    msg.agentName[0]
                  )}
                </div>
                <div className={cn('max-w-[80%] space-y-1', msg.role === 'user' && 'items-end')}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium" style={{ color: msg.agentColor }}>
                      {msg.agentName}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'text-sm px-3 py-2 rounded-xl leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-slate-800 rounded-tl-sm',
                    )}
                  >
                    <MathRenderer content={msg.content} />
                  </div>
                </div>
              </div>
            ))
          )}
          {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'agent' && (
            <div className="flex gap-2">
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center animate-pulse"
                style={{ backgroundColor: messages[messages.length - 1].agentColor }}
              >
                <Loader2 className="h-3 w-3 text-white animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Input */}
        {started && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? 'AI 同学正在发言...' : '加入讨论...'}
                disabled={isStreaming}
                className="flex-1 h-9 text-sm"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 bg-indigo-600 hover:bg-indigo-700"
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
