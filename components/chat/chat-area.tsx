'use client';

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { BookOpen, MessageSquare, PanelRightClose } from 'lucide-react';
import type { DiscussionRequest } from '@/components/roundtable';
import { MessageFilters, type MessageFilterState } from '@/components/classroom/message-filters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { useStageStore } from '@/lib/store';
import type { Action, DiscussionAction, SpeechAction } from '@/lib/types/action';
import type { LectureNoteEntry, SessionType } from '@/lib/types/chat';
import { cn } from '@/lib/utils';
import { LectureNotesView } from './lecture-notes-view';
import { SessionList } from './session-list';
import { useChatSessions } from './use-chat-sessions';

interface ChatAreaProps {
  className?: string;
  width?: number;
  onWidthChange?: (width: number) => void;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  activeBubbleId?: string | null;
  onActiveBubble?: (messageId: string | null) => void;
  onLiveSpeech?: (text: string | null, agentId?: string | null) => void;
  onSpeechProgress?: (ratio: number | null) => void;
  onThinking?: (state: { stage: string; agentId?: string } | null) => void;
  onCueUser?: (fromAgentId?: string, prompt?: string) => void;
  onLiveSessionError?: () => void;
  onStopSession?: () => void;
  onSegmentSealed?: (
    messageId: string,
    partId: string,
    fullText: string,
    agentId: string | null,
  ) => void;
  shouldHoldAfterReveal?: () => { holding: boolean; segmentDone: number } | boolean;
  currentSceneId?: string | null;
  enableFilters?: boolean;
}

export interface ChatAreaRef {
  createSession: (type: SessionType, title: string) => Promise<string>;
  endSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => void;
  endActiveSession: () => Promise<void>;
  softPauseActiveSession: () => Promise<void>;
  resumeActiveSession: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  startDiscussion: (request: DiscussionRequest) => Promise<void>;
  startLecture: (sceneId: string) => Promise<string>;
  addLectureMessage: (sessionId: string, action: Action, actionIndex: number) => void;
  getIsStreaming: () => boolean;
  getActiveSessionType: () => string | null;
  getLectureMessageId: (sessionId: string) => string | null;
  pauseBuffer: (sessionId: string) => void;
  resumeBuffer: (sessionId: string) => void;
  pauseActiveLiveBuffer: () => boolean;
  resumeActiveLiveBuffer: () => void;
  switchToTab: (tab: 'lecture' | 'chat') => void;
}

const DEFAULT_WIDTH = 360;
const MIN_WIDTH = 320;
const MAX_WIDTH = 420;
const SESSION_TYPE_TO_FILTER_KEY: Record<string, 'discussion' | 'lecture' | 'qa' | 'system'> = {
  discussion: 'discussion',
  qa: 'qa',
  lecture: 'lecture',
  system: 'system',
};

export const ChatArea = forwardRef<ChatAreaRef, ChatAreaProps>(
  (
    {
      className,
      width = DEFAULT_WIDTH,
      onWidthChange,
      collapsed = false,
      onCollapseChange,
      activeBubbleId,
      onActiveBubble,
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onLiveSessionError,
      onStopSession,
      onSegmentSealed,
      shouldHoldAfterReveal,
      currentSceneId,
      enableFilters = false,
    },
    ref,
  ) => {
    const scenes = useStageStore((state) => state.scenes);
    const {
      sessions,
      activeSessionType,
      expandedSessionIds,
      isStreaming,
      createSession,
      endSession,
      endActiveSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      toggleSessionExpand,
      getLectureMessageId,
      deleteSession,
      pauseBuffer,
      resumeBuffer,
      pauseActiveLiveBuffer,
      resumeActiveLiveBuffer,
    } = useChatSessions({
      onLiveSpeech,
      onSpeechProgress,
      onThinking,
      onCueUser,
      onActiveBubble,
      onLiveSessionError,
      onStopSession,
      onSegmentSealed,
      shouldHoldAfterReveal,
    });

    const [activeTab, setActiveTab] = useState<'lecture' | 'chat'>('lecture');
    const [isDragging, setIsDragging] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const lectureNotes: LectureNoteEntry[] = useMemo(
      () =>
        scenes
          .filter((scene) => scene.actions && scene.actions.length > 0)
          .map((scene) => ({
            sceneId: scene.id,
            sceneTitle: scene.title,
            sceneOrder: scene.order,
            items: scene
              .actions!.filter(
                (action) =>
                  action.type === 'speech' ||
                  action.type === 'spotlight' ||
                  action.type === 'laser' ||
                  action.type === 'play_video' ||
                  action.type === 'discussion',
              )
              .map((action) => {
                if (action.type === 'speech') {
                  return {
                    kind: 'speech' as const,
                    text: (action as SpeechAction).text,
                  };
                }
                return {
                  kind: 'action' as const,
                  type: action.type,
                  label:
                    action.type === 'discussion' ? (action as DiscussionAction).topic : undefined,
                };
              }),
            completedAt: scene.updatedAt || scene.createdAt || 0,
          }))
          .sort((a, b) => a.sceneOrder - b.sceneOrder),
      [scenes],
    );

    const chatSessions = useMemo(() => sessions.filter((s) => s.type !== 'lecture'), [sessions]);

    const sceneTitleMap = useMemo(() => {
      const map = new Map<string, { title: string; order: number }>();
      scenes.forEach((scene) => map.set(scene.id, { title: scene.title, order: scene.order }));
      return map;
    }, [scenes]);

    const [messageFilters, setMessageFilters] = useState<MessageFilterState>({
      types: new Set(),
      agentIds: new Set(),
    });

    const filteredChatSessions = useMemo(() => {
      if (!enableFilters || messageFilters.types.size === 0) return chatSessions;
      return chatSessions.filter((session) =>
        messageFilters.types.has(SESSION_TYPE_TO_FILTER_KEY[session.type] ?? 'system'),
      );
    }, [chatSessions, enableFilters, messageFilters.types]);

    const availableAgents = useMemo(() => {
      const registry = useAgentRegistry.getState();
      return Object.entries(registry.agents).map(([id, cfg]) => ({ id, name: cfg.name ?? id }));
    }, []);

    const hasActiveChatSession = useMemo(
      () => chatSessions.some((session) => session.status === 'active'),
      [chatSessions],
    );

    const handleEndSession = useCallback(
      async (sessionId: string) => {
        await endSession(sessionId);
        onStopSession?.();
      },
      [endSession, onStopSession],
    );

    const handleDeleteSession = useCallback(
      (sessionId: string) => {
        deleteSession(sessionId);
        onStopSession?.();
      },
      [deleteSession, onStopSession],
    );

    const switchToTab = useCallback((tab: 'lecture' | 'chat') => {
      setActiveTab(tab);
    }, []);

    useImperativeHandle(ref, () => ({
      createSession,
      endSession,
      deleteSession,
      endActiveSession,
      softPauseActiveSession,
      resumeActiveSession,
      sendMessage,
      startDiscussion,
      startLecture,
      addLectureMessage,
      getIsStreaming: () => isStreaming,
      getActiveSessionType: () => activeSessionType,
      getLectureMessageId,
      pauseBuffer,
      resumeBuffer,
      pauseActiveLiveBuffer,
      resumeActiveLiveBuffer,
      switchToTab,
    }));

    const handleDragStart = useCallback(
      (event: React.MouseEvent) => {
        event.preventDefault();
        setIsDragging(true);
        const startX = event.clientX;
        const startWidth = width;

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const delta = startX - moveEvent.clientX;
          onWidthChange?.(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
        };

        const handleMouseUp = () => {
          setIsDragging(false);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        };

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      },
      [onWidthChange, width],
    );

    const displayWidth = collapsed ? 0 : width;

    return (
      <aside
        style={{ width: displayWidth, transition: isDragging ? 'none' : 'width 220ms ease' }}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col overflow-visible rounded-[26px] border border-white/80 bg-white/78 shadow-sm backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/86',
          className,
        )}
      >
        {!collapsed && (
          <div
            onMouseDown={handleDragStart}
            className="group absolute bottom-0 left-0 top-0 z-50 w-1.5 cursor-col-resize transition-colors hover:bg-sky-200/60 dark:hover:bg-slate-700/60"
          >
            <div className="absolute left-0.5 top-1/2 h-10 w-0.5 -translate-y-1/2 rounded-full bg-sky-200 transition-colors group-hover:bg-sky-500 dark:bg-slate-700" />
          </div>
        )}

        <div className={cn('flex h-full w-full flex-col overflow-hidden', collapsed && 'hidden')}>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'lecture' | 'chat')}
            className="flex h-full flex-col gap-0"
          >
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sky-100/80 px-3.5 dark:border-slate-800">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-sky-700/60">
                  Learning Assistant
                </div>
                <div className="mt-0.5 truncate text-base font-black text-slate-900 dark:text-slate-100">
                  学习助手
                </div>
              </div>
              <TabsList
                variant="line"
                className="h-8 w-auto shrink-0 rounded-full border border-sky-100 bg-white/72 p-1 dark:border-slate-800 dark:bg-slate-900"
              >
                <TabsTrigger
                  value="lecture"
                  className="h-7 gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-[13px] font-semibold text-sky-800/70 transition-colors data-[state=active]:bg-transparent data-[state=active]:font-black data-[state=active]:text-sky-950 dark:text-slate-400 dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-sky-100"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Script
                </TabsTrigger>
                <TabsTrigger
                  value="chat"
                  className="relative h-7 gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-[13px] font-semibold text-sky-800/70 transition-colors data-[state=active]:bg-transparent data-[state=active]:font-black data-[state=active]:text-sky-950 dark:text-slate-400 dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-sky-100"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Q&A
                  {hasActiveChatSession && activeTab === 'lecture' && (
                    <span className="absolute right-3 top-3 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {onCollapseChange && (
                <button
                  type="button"
                  onClick={() => onCollapseChange(true)}
                  aria-label="Close notes"
                  title="Close notes"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sky-800/65 transition-all duration-200 hover:bg-white/85 hover:text-sky-950 active:scale-90 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              )}
            </div>

            <TabsContent value="lecture" className="flex flex-1 flex-col overflow-hidden">
              <LectureNotesView notes={lectureNotes} currentSceneId={currentSceneId} />
            </TabsContent>

            <TabsContent value="chat" className="flex flex-1 flex-col overflow-hidden">
              {enableFilters && (
                <MessageFilters
                  filters={messageFilters}
                  onChange={setMessageFilters}
                  availableAgents={availableAgents}
                />
              )}
              <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
                {filteredChatSessions.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center opacity-60">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-500 dark:bg-slate-800 dark:text-slate-600">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <p className="text-base font-medium text-slate-500 dark:text-slate-400">
                      No questions yet
                    </p>
                    <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
                      Questions and discussion will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    <SessionList
                      sessions={filteredChatSessions}
                      expandedSessionIds={expandedSessionIds}
                      isStreaming={isStreaming}
                      activeBubbleId={activeBubbleId}
                      sceneTitleMap={sceneTitleMap}
                      onToggleExpand={toggleSessionExpand}
                      onEndSession={handleEndSession}
                      onDeleteSession={handleDeleteSession}
                    />
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </aside>
    );
  },
);

ChatArea.displayName = 'ChatArea';
