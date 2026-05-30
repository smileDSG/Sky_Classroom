'use client';

import { useImperativeHandle, forwardRef, useRef, useCallback, useState, useMemo } from 'react';
import type { SessionType } from '@/lib/types/chat';
import type { LectureNoteEntry } from '@/lib/types/chat';
import type { DiscussionRequest } from '@/components/roundtable';
import type { Action, SpeechAction, DiscussionAction } from '@/lib/types/action';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useStageStore } from '@/lib/store';
import { PanelLeftClose, BookOpen, MessageSquare } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useChatSessions } from './use-chat-sessions';
import { SessionList } from './session-list';
import { LectureNotesView } from './lecture-notes-view';
import {
  MessageFilters,
  type MessageFilterState,
} from '@/components/classroom/message-filters';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';

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
  /** When provided and returns true, StreamBuffer holds on the current text item after reveal. */
  shouldHoldAfterReveal?: () => { holding: boolean; segmentDone: number } | boolean;
  currentSceneId?: string | null;
  /** Enable message type/agent filter bar above chat sessions. */
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

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;

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
    const { t } = useI18n();
    const scenes = useStageStore((s) => s.scenes);
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
    const isDraggingRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Derive lecture notes directly from scenes — updates reactively as scenes stream in
    // Preserves action order so spotlight/laser badges appear inline between speech texts
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
                (a) =>
                  a.type === 'speech' ||
                  a.type === 'spotlight' ||
                  a.type === 'laser' ||
                  a.type === 'play_video' ||
                  a.type === 'discussion',
              )
              .map((a) => {
                if (a.type === 'speech') {
                  return {
                    kind: 'speech' as const,
                    text: (a as SpeechAction).text,
                  };
                }
                return {
                  kind: 'action' as const,
                  type: a.type,
                  label: a.type === 'discussion' ? (a as DiscussionAction).topic : undefined,
                };
              }),
            completedAt: scene.updatedAt || scene.createdAt || 0,
          }))
          .sort((a, b) => a.sceneOrder - b.sceneOrder),
      [scenes],
    );

    // Filter out lecture sessions for the Chat tab
    const chatSessions = useMemo(() => sessions.filter((s) => s.type !== 'lecture'), [sessions]);

    // Build scene lookup map from ALL scenes for session-scene association
    const sceneTitleMap = useMemo(() => {
      const map = new Map<string, { title: string; order: number }>();
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        map.set(scene.id, { title: scene.title, order: scene.order });
      }
      return map;
    }, [scenes]);

    // Message filter state (local)
    const [messageFilters, setMessageFilters] = useState<MessageFilterState>({
      types: new Set(),
      agentIds: new Set(),
    });

    // Map session type to MessageFilter type key
    const sessionTypeToFilterKey: Record<string, 'discussion' | 'lecture' | 'qa' | 'system'> = {
      discussion: 'discussion',
      qa: 'qa',
      lecture: 'lecture',
      system: 'system',
    };

    // Apply message type filters to chat sessions
    const filteredChatSessions = useMemo(() => {
      if (!enableFilters || messageFilters.types.size === 0) return chatSessions;
      return chatSessions.filter((s) => messageFilters.types.has(sessionTypeToFilterKey[s.type] ?? 'system'));
    }, [chatSessions, enableFilters, messageFilters.types]);

    // Get available agents for filter badges
    const availableAgents = useMemo(() => {
      const registry = useAgentRegistry.getState();
      return Object.entries(registry.agents).map(([id, cfg]) => ({ id, name: cfg.name ?? id }));
    }, []);

    // Whether there's an active discussion/QA session (for amber dot on Chat tab)
    const hasActiveChatSession = useMemo(
      () => chatSessions.some((s) => s.status === 'active'),
      [chatSessions],
    );

    // Wrap endSession for QA/Discussion: also notify parent for engine cleanup
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

    // Drag-to-resize
    const handleDragStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (me: MouseEvent) => {
          const delta = me.clientX - startX;
          const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
          onWidthChange?.(newWidth);
        };

        const handleMouseUp = () => {
          isDraggingRef.current = false;
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
      [width, onWidthChange],
    );

    const displayWidth = collapsed ? 0 : width;

    return (
      <div
        style={{
          width: displayWidth,
          transition: isDragging ? 'none' : 'width 0.3s ease',
        }}
        className={cn(
          'bg-white dark:bg-slate-950 border-l border-sky-200/50 dark:border-slate-700',
          'flex flex-col shrink-0 z-20 relative overflow-hidden h-full',
          className,
        )}
      >
        {/* Drag handle */}
        {!collapsed && (
          <div
            onMouseDown={handleDragStart}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 group hover:bg-sky-400/50 dark:hover:bg-violet-500/50 active:bg-sky-500/70 dark:active:bg-violet-500/70 transition-colors"
          >
            <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full bg-sky-300 dark:bg-slate-700 group-hover:bg-sky-400 dark:group-hover:bg-violet-400 transition-colors" />
          </div>
        )}

        <div className={cn('flex flex-col w-full h-full overflow-hidden', collapsed && 'hidden')}>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'lecture' | 'chat')}
            className="flex flex-col h-full gap-0"
          >
            {/* Redesigned tab header row */}
            <div className="h-12 flex items-center gap-2 shrink-0 px-3 pt-2 pb-1">
              <TabsList variant="line" className="h-9 flex-1 w-0 bg-slate-100/60 dark:bg-slate-800/60 rounded-xl p-1">
                <TabsTrigger
                  value="lecture"
                  className="text-[13px] gap-1.5 flex-1 rounded-lg transition-all duration-200
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-400 data-[state=active]:to-indigo-400
                    data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-sky-300/30
                    data-[state=active]:dark:shadow-sky-500/20
                    text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                    border-0 after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-gradient-to-r after:from-sky-400 after:to-indigo-400
                    data-[state=active]:after:opacity-100 after:opacity-0"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {t('chat.tabs.lecture')}
                </TabsTrigger>
                <TabsTrigger
                  value="chat"
                  className="text-[13px] gap-1.5 flex-1 rounded-lg transition-all duration-200 relative
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-400 data-[state=active]:to-indigo-400
                    data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:shadow-sky-300/30
                    data-[state=active]:dark:shadow-sky-500/20
                    text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200
                    border-0 after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-gradient-to-r after:from-sky-400 after:to-indigo-400
                    data-[state=active]:after:opacity-100 after:opacity-0"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  {t('chat.tabs.chat')}
                </TabsTrigger>
              </TabsList>

              {onCollapseChange && (
                <button
                  onClick={() => onCollapseChange(true)}
                  aria-label={t('common.collapse')}
                  title={t('common.collapse')}
                  className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center
                    text-slate-400 dark:text-slate-500
                    hover:text-slate-600 dark:hover:text-slate-300
                    hover:bg-slate-100 dark:hover:bg-slate-800
                    active:scale-90 transition-all duration-200"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Notes Tab */}
            <TabsContent value="lecture" className="flex-1 overflow-hidden flex flex-col">
              <LectureNotesView notes={lectureNotes} currentSceneId={currentSceneId} />
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col">
              {enableFilters && (
                <MessageFilters
                  filters={messageFilters}
                  onChange={setMessageFilters}
                  availableAgents={availableAgents}
                />
              )}
              <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
                {filteredChatSessions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3 text-slate-600">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-400">
                      {t('chat.noConversations')}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('chat.startConversation')}
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
      </div>
    );
  },
);

ChatArea.displayName = 'ChatArea';
