'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStageStore } from '@/lib/store';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import { useCanvasStore } from '@/lib/store/canvas';
import { useSettingsStore } from '@/lib/store/settings';
import { useI18n } from '@/lib/hooks/use-i18n';
import { SceneSidebar } from './stage/scene-sidebar';
import { Header } from './header';
import { CanvasArea } from '@/components/canvas/canvas-area';
import { Roundtable } from '@/components/roundtable';
import { PlaybackEngine, computePlaybackView, getSpeechTextForView } from '@/lib/playback';
import type { EngineMode, TriggerEvent, Effect } from '@/lib/playback';
import { ActionEngine } from '@/lib/action/engine';
import { createAudioPlayer } from '@/lib/utils/audio-player';
import { useDiscussionTTS } from '@/lib/hooks/use-discussion-tts';
import { useWidgetIframeStore } from '@/lib/store/widget-iframe';
import type { AudioIndicatorState } from '@/components/roundtable/audio-indicator';
import type { Action, DiscussionAction, SpeechAction } from '@/lib/types/action';
import { cn } from '@/lib/utils';
import { BottomToolbar } from '@/components/ui/bottom-toolbar';
import { useUserProfileStore } from '@/lib/store/user-profile';
// Playback state persistence removed — refresh always starts from the beginning
import { ChatArea, type ChatAreaRef } from '@/components/chat/chat-area';
import { agentsToParticipants, useAgentRegistry } from '@/lib/orchestration/registry/store';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, LayoutList, MessageSquare } from 'lucide-react';
import { PptViewer } from '@/components/classroom/ppt-viewer';
import { VisuallyHidden } from 'radix-ui';

/**
 * Stage Component
 *
 * The main container for the classroom/course.
 * Combines sidebar (scene navigation) and content area (scene viewer).
 * Supports two modes: autonomous and playback.
 */
export function Stage({
  onRetryOutline,
}: {
  onRetryOutline?: (outlineId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  // 获取用户头像（与主页一致）
  const userAvatar = useUserProfileStore((s) => s.avatar);
  const {
    mode,
    getCurrentScene,
    scenes,
    currentSceneId,
    setCurrentSceneId,
    generatingOutlines,
    outlines,
  } = useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();

  const currentScene = getCurrentScene();

  // PPT slide panel state
  const [pptPanelOpen, setPptPanelOpen] = useState(false);
  const [pptFullscreen, setPptFullscreen] = useState(false);

  // Layout state from settings store (persisted via localStorage)
  const timelineCollapsed = useSettingsStore((s) => s.timelineCollapsed);
  const setTimelineCollapsed = useSettingsStore((s) => s.setTimelineCollapsed);
  const chatAreaWidth = useSettingsStore((s) => s.chatAreaWidth);
  const setChatAreaWidth = useSettingsStore((s) => s.setChatAreaWidth);
  const chatAreaCollapsed = useSettingsStore((s) => s.chatAreaCollapsed);
  const setChatAreaCollapsed = useSettingsStore((s) => s.setChatAreaCollapsed);
  const setTTSMuted = useSettingsStore((s) => s.setTTSMuted);
  const setTTSVolume = useSettingsStore((s) => s.setTTSVolume);

  // PlaybackEngine state
  const [engineMode, setEngineMode] = useState<EngineMode>('idle');
  const [playbackCompleted, setPlaybackCompleted] = useState(false); // Distinguishes "never played" idle from "finished" idle
  const [lectureSpeech, setLectureSpeech] = useState<string | null>(null); // From PlaybackEngine (lecture)
  const [liveSpeech, setLiveSpeech] = useState<string | null>(null); // From buffer (discussion/QA)
  const [speechProgress, setSpeechProgress] = useState<number | null>(null); // StreamBuffer reveal progress (0–1)
  const [discussionTrigger, setDiscussionTrigger] = useState<TriggerEvent | null>(null);

  // Speaking agent tracking (Issue 2)
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);

  // Thinking state (Issue 5)
  const [thinkingState, setThinkingState] = useState<{
    stage: string;
    agentId?: string;
  } | null>(null);

  // Cue user state (Issue 7)
  const [isCueUser, setIsCueUser] = useState(false);

  // End flash state (Issue 3)
  const [showEndFlash, setShowEndFlash] = useState(false);
  const [endFlashSessionType, setEndFlashSessionType] = useState<'qa' | 'discussion'>('discussion');

  // Streaming state for stop button (Issue 1)
  const [chatIsStreaming, setChatIsStreaming] = useState(false);
  const [chatSessionType, setChatSessionType] = useState<string | null>(null);

  // Topic pending state: session is soft-paused, bubble stays visible, waiting for user input
  const [isTopicPending, setIsTopicPending] = useState(false);

  // Active bubble ID for playback highlight in chat area (Issue 8)
  const [activeBubbleId, setActiveBubbleId] = useState<string | null>(null);

  // Scene switch confirmation dialog state
  const [pendingSceneId, setPendingSceneId] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPresentationInteractionActive, setIsPresentationInteractionActive] = useState(false);

  // Floating Ask Dialog state
  const [isAskDialogOpen, setIsAskDialogOpen] = useState(false);
  const [askInputValue, setAskInputValue] = useState('');
  const askInputRef = useRef<HTMLTextAreaElement>(null);

  // Whiteboard state (from canvas store so AI tools can open it)
  const whiteboardOpen = useCanvasStore.use.whiteboardOpen();
  const setWhiteboardOpen = useCanvasStore.use.setWhiteboardOpen();

  // Selected agents from settings store (Zustand)
  const selectedAgentIds = useSettingsStore((s) => s.selectedAgentIds);
  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);

  // Generate participants from selected agents
  const participants = useMemo(
    () => agentsToParticipants(selectedAgentIds, t),
    [selectedAgentIds, t],
  );

  // Resolved AgentConfig array for hooks that need full agent objects
  // Subscribe to the agents record so voiceConfig changes trigger re-resolution
  const agentsRecord = useAgentRegistry((s) => s.agents);
  const selectedAgents = useMemo(
    () => selectedAgentIds.map((id) => agentsRecord[id]).filter((a): a is AgentConfig => a != null),
    [agentsRecord, selectedAgentIds],
  );

  // Discussion TTS: audio indicator state
  const [audioIndicatorState, setAudioIndicatorState] = useState<AudioIndicatorState>('idle');
  const [audioAgentId, setAudioAgentId] = useState<string | null>(null);
  const [audioSpeech, setAudioSpeech] = useState<string | null>(null);

  const discussionTTS = useDiscussionTTS({
    enabled: ttsEnabled && !ttsMuted,
    agents: selectedAgents,
    onAudioStateChange: (agentId, state, text) => {
      setAudioAgentId(agentId);
      setAudioIndicatorState(state);
      if (state === 'playing' && text) {
        setAudioSpeech(text);
        setSpeakingAgentId(agentId);
      } else if (state === 'idle') {
        setAudioSpeech(null);
      }
    },
  });

  // Pick a student agent for discussion trigger (prioritize student > non-teacher > fallback)
  const pickStudentAgent = useCallback((): string => {
    const registry = useAgentRegistry.getState();
    const agents = selectedAgentIds
      .map((id) => registry.getAgent(id))
      .filter((a): a is AgentConfig => a != null);
    const students = agents.filter((a) => a.role === 'student');
    if (students.length > 0) {
      return students[Math.floor(Math.random() * students.length)].id;
    }
    const nonTeachers = agents.filter((a) => a.role !== 'teacher');
    if (nonTeachers.length > 0) {
      return nonTeachers[Math.floor(Math.random() * nonTeachers.length)].id;
    }
    return agents[0]?.id || 'default-1';
  }, [selectedAgentIds]);

  const engineRef = useRef<PlaybackEngine | null>(null);
  const audioPlayerRef = useRef(createAudioPlayer());
  const chatAreaRef = useRef<ChatAreaRef>(null);
  const lectureSessionIdRef = useRef<string | null>(null);
  const lectureActionCounterRef = useRef(0);
  const discussionAbortRef = useRef<AbortController | null>(null);
  const presentationIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Guard to prevent double flash when manual stop triggers onDiscussionEnd
  const manualStopRef = useRef(false);
  const liveCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic counter incremented on each scene switch — used to discard stale SSE callbacks
  const sceneEpochRef = useRef(0);
  // When true, the next engine init will auto-start playback (for auto-play scene advance)
  const autoStartRef = useRef(false);
  // Discussion buffer-level pause state (distinct from soft-pause which aborts SSE)
  const [isDiscussionPaused, setIsDiscussionPaused] = useState(false);

  /**
   * Resume a soft-paused topic: re-call /chat with existing session messages.
   * The director picks the next agent to continue.
   */
  const doResumeTopic = useCallback(async () => {
    // Clear old bubble immediately — no lingering on interrupted text
    setIsTopicPending(false);
    setLiveSpeech(null);
    setSpeakingAgentId(null);
    setThinkingState({ stage: 'director' });
    setChatIsStreaming(true);
    // Transition engine back to live — onInputActivate paused it when soft-pausing,
    // so we must explicitly resume to keep engine mode in sync with the chat loop.
    engineRef.current?.resume();
    // Fire new chat round — SSE events will drive thinking → agent_start → speech
    await chatAreaRef.current?.resumeActiveSession();
  }, []);

  /** Reset all live/discussion state (shared by doSessionCleanup & onDiscussionEnd) */
  const resetLiveState = useCallback(() => {
    if (liveCleanupTimerRef.current) {
      clearTimeout(liveCleanupTimerRef.current);
      liveCleanupTimerRef.current = null;
    }
    setLiveSpeech(null);
    setAudioSpeech(null);
    setSpeakingAgentId(null);
    setSpeechProgress(null);
    setThinkingState(null);
    setIsCueUser(false);
    setIsTopicPending(false);
    setChatIsStreaming(false);
    setChatSessionType(null);
    setIsDiscussionPaused(false);
  }, []);

  /** Full scene reset (scene switch) — resetLiveState + lecture/visual state */
  const resetSceneState = useCallback(() => {
    resetLiveState();
    setPlaybackCompleted(false);
    setLectureSpeech(null);
    setSpeechProgress(null);
    setShowEndFlash(false);
    setActiveBubbleId(null);
    setDiscussionTrigger(null);
  }, [resetLiveState]);

  /** Request failure should exit live discussion UI without hard-closing the session. */
  const handleLiveSessionError = useCallback(() => {
    engineRef.current?.handleDiscussionError();
    resetLiveState();
    setActiveBubbleId(null);
  }, [resetLiveState]);

  /**
   * Unified session cleanup — called by both roundtable stop button and chat area end button.
   * Handles: engine transition, flash, roundtable state clearing.
   */
  const doSessionCleanup = useCallback((options?: { preserveQaBubble?: boolean }) => {
    const activeType = chatSessionType;

    // Engine cleanup — guard to avoid double flash from onDiscussionEnd
    manualStopRef.current = true;
    engineRef.current?.handleEndDiscussion();
    manualStopRef.current = false;

    // Show end flash with correct session type
    if (activeType === 'qa' || activeType === 'discussion') {
      setEndFlashSessionType(activeType);
      setShowEndFlash(true);
      setTimeout(() => setShowEndFlash(false), 1800);
    }

    if (activeType === 'qa' && options?.preserveQaBubble) {
      setChatIsStreaming(false);
      setChatSessionType(null);
      setThinkingState(null);
      setIsCueUser(false);
      setIsTopicPending(false);
      setIsDiscussionPaused(false);
      setSpeechProgress(null);
      liveCleanupTimerRef.current = setTimeout(() => {
        liveCleanupTimerRef.current = null;
        setLiveSpeech(null);
        setAudioSpeech(null);
        setSpeakingAgentId(null);
      }, 6000);
      return;
    }

    // Stop any in-flight discussion TTS audio
    discussionTTS.cleanup();

    resetLiveState();
  }, [chatSessionType, resetLiveState, discussionTTS]);

  // Shared stop-discussion handler (used by both Roundtable and Canvas toolbar)
  const handleStopDiscussion = useCallback(async () => {
    await chatAreaRef.current?.endActiveSession();
    doSessionCleanup();
  }, [doSessionCleanup]);

  // Handle opening ask dialog
  const handleOpenAskDialog = useCallback(() => {
    setIsAskDialogOpen(true);
    setAskInputValue('');
    // Focus input after animation
    setTimeout(() => {
      askInputRef.current?.focus();
    }, 100);
  }, []);

  // Handle sending question from floating dialog
  const handleSendQuestion = useCallback(async () => {
    if (!askInputValue.trim()) return;

    const message = askInputValue.trim();
    setIsAskDialogOpen(false);
    setAskInputValue('');

    // Send message via ChatArea
    await chatAreaRef.current?.sendMessage(message);

    // Switch to chat tab and expand
    chatAreaRef.current?.switchToTab('chat');
    setChatAreaCollapsed(false);

    // Set streaming state
    setChatIsStreaming(true);
    setChatSessionType('qa');
    setThinkingState({ stage: 'director' });
  }, [askInputValue, setChatAreaCollapsed]);

  // Handle key down in ask dialog
  const handleAskInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSendQuestion();
      }
      if (e.key === 'Escape') {
        setIsAskDialogOpen(false);
        setAskInputValue('');
      }
    },
    [handleSendQuestion],
  );

  const clearPresentationIdleTimer = useCallback(() => {
    if (presentationIdleTimerRef.current) {
      clearTimeout(presentationIdleTimerRef.current);
      presentationIdleTimerRef.current = null;
    }
  }, []);

  const resetPresentationIdleTimer = useCallback(() => {
    setControlsVisible(true);
    clearPresentationIdleTimer();
    if (isPresenting && !isPresentationInteractionActive) {
      presentationIdleTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [clearPresentationIdleTimer, isPresenting, isPresentationInteractionActive]);

  const togglePresentation = useCallback(async () => {
    const stageElement = stageRef.current;
    if (!stageElement) return;

    try {
      if (document.fullscreenElement === stageElement) {
        // Unlock Escape key before exiting fullscreen
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).keyboard?.unlock?.();
        await document.exitFullscreen();
        return;
      }

      setControlsVisible(true);
      await stageElement.requestFullscreen();
      // Lock Escape key so it doesn't auto-exit fullscreen (#255)
      // Escape is handled manually in our keydown handler instead
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).keyboard?.lock?.(['Escape']).catch(() => {});
      setTimelineCollapsed(true);
      setChatAreaCollapsed(true);
    } catch {
      // Firefox may deny fullscreen from certain keyboard events (e.g. F11)
      console.warn('[Presentation] Fullscreen request denied — browser policy');
    }
  }, [setChatAreaCollapsed, setTimelineCollapsed]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === stageRef.current;
      setIsPresenting(active);

      if (!active) {
        // Ensure keyboard unlock on any fullscreen exit
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).keyboard?.unlock?.();
        setControlsVisible(true);
        clearPresentationIdleTimer();
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [clearPresentationIdleTimer]);

  useEffect(() => {
    if (!isPresenting) {
      setControlsVisible(true);
      clearPresentationIdleTimer();
      return;
    }

    const handleActivity = () => {
      resetPresentationIdleTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    if (isPresentationInteractionActive) {
      setControlsVisible(true);
      clearPresentationIdleTimer();
    } else {
      resetPresentationIdleTimer();
    }

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearPresentationIdleTimer();
    };
  }, [
    clearPresentationIdleTimer,
    isPresenting,
    isPresentationInteractionActive,
    resetPresentationIdleTimer,
  ]);

  // Initialize playback engine when scene changes
  useEffect(() => {
    // Bump epoch so any stale SSE callbacks from the previous scene are discarded
    sceneEpochRef.current++;

    // End any active QA/discussion session — this synchronously aborts the SSE
    // stream inside use-chat-sessions (abortControllerRef.abort()), preventing
    // stale onLiveSpeech callbacks from leaking into the new scene.
    chatAreaRef.current?.endActiveSession();

    // Also abort the engine-level discussion controller
    if (discussionAbortRef.current) {
      discussionAbortRef.current.abort();
      discussionAbortRef.current = null;
    }

    // Stop any in-flight discussion TTS audio on scene switch
    discussionTTS.cleanup();

    // Reset all roundtable/live state so scenes are fully isolated
    resetSceneState();

    if (!currentScene || !currentScene.actions || currentScene.actions.length === 0) {
      engineRef.current = null;
      setEngineMode('idle');

      return;
    }

    // Stop previous engine
    if (engineRef.current) {
      engineRef.current.stop();
    }

    // Get widget iframe messaging callback for interactive scenes (keyed by sceneId)
    const widgetSendMessage = useWidgetIframeStore.getState().getSendMessage(currentScene.id);

    // Create ActionEngine for playback (with audioPlayer for TTS and widget messaging)
    const actionEngine = new ActionEngine(useStageStore, audioPlayerRef.current, widgetSendMessage);

    // Create new PlaybackEngine
    const engine = new PlaybackEngine([currentScene], actionEngine, audioPlayerRef.current, {
      onModeChange: (mode) => {
        setEngineMode(mode);
      },
      onSceneChange: (_sceneId) => {
        // Scene change handled by engine
      },
      onSpeechStart: (text) => {
        setLectureSpeech(text);
        // Add to lecture session with incrementing index for dedup
        // Chat area pacing is handled by the StreamBuffer (onTextReveal)
        if (lectureSessionIdRef.current) {
          const idx = lectureActionCounterRef.current++;
          const speechId = `speech-${Date.now()}`;
          chatAreaRef.current?.addLectureMessage(
            lectureSessionIdRef.current,
            { id: speechId, type: 'speech', text } as Action,
            idx,
          );
          // Track active bubble for highlight (Issue 8)
          const msgId = chatAreaRef.current?.getLectureMessageId(lectureSessionIdRef.current!);
          if (msgId) setActiveBubbleId(msgId);
        }
      },
      onSpeechEnd: () => {
        setLectureSpeech(null);
        setActiveBubbleId(null);
      },
      onEffectFire: (effect: Effect) => {
        // Add to lecture session with incrementing index
        if (
          lectureSessionIdRef.current &&
          (effect.kind === 'spotlight' || effect.kind === 'laser')
        ) {
          const idx = lectureActionCounterRef.current++;
          chatAreaRef.current?.addLectureMessage(
            lectureSessionIdRef.current,
            {
              id: `${effect.kind}-${Date.now()}`,
              type: effect.kind,
              elementId: effect.targetId,
            } as Action,
            idx,
          );
        }
      },
      onProactiveShow: (trigger) => {
        if (!trigger.agentId) {
          // Mutate in-place so engine.currentTrigger also gets the agentId
          // (confirmDiscussion reads agentId from the same object reference)
          trigger.agentId = pickStudentAgent();
        }
        setDiscussionTrigger(trigger);
      },
      onProactiveHide: () => {
        setDiscussionTrigger(null);
      },
      onDiscussionConfirmed: (topic, prompt, agentId) => {
        // Start SSE discussion via ChatArea
        handleDiscussionSSE(topic, prompt, agentId);
      },
      onDiscussionEnd: () => {
        // Abort any active SSE
        if (discussionAbortRef.current) {
          discussionAbortRef.current.abort();
          discussionAbortRef.current = null;
        }
        setDiscussionTrigger(null);
        // Stop any in-flight discussion TTS audio
        discussionTTS.cleanup();
        // Clear roundtable state (idempotent — may already be cleared by doSessionCleanup)
        resetLiveState();
        // Only show flash for engine-initiated ends (not manual stop — that's handled by doSessionCleanup)
        if (!manualStopRef.current) {
          setEndFlashSessionType('discussion');
          setShowEndFlash(true);
          setTimeout(() => setShowEndFlash(false), 1800);
        }
        // If all actions are exhausted (discussion was the last action), mark
        // playback as completed so the bubble shows reset instead of play.
        if (engineRef.current?.isExhausted()) {
          setPlaybackCompleted(true);
        }
      },
      onUserInterrupt: (text) => {
        // User interrupted → start a discussion via chat
        chatAreaRef.current?.sendMessage(text);
      },
      isAgentSelected: (agentId) => {
        const ids = useSettingsStore.getState().selectedAgentIds;
        return ids.includes(agentId);
      },
      getPlaybackSpeed: () => useSettingsStore.getState().playbackSpeed || 1,
      onComplete: () => {
        // lectureSpeech intentionally NOT cleared — last sentence stays visible
        // until scene transition (auto-play) or user restarts. Scene change
        // effect handles the reset.
        setPlaybackCompleted(true);

        // End lecture session on playback complete
        if (lectureSessionIdRef.current) {
          chatAreaRef.current?.endSession(lectureSessionIdRef.current);
          lectureSessionIdRef.current = null;
        }
        // Auto-play: advance to next scene after a short pause
        const { autoPlayLecture } = useSettingsStore.getState();
        if (autoPlayLecture) {
          setTimeout(() => {
            const stageState = useStageStore.getState();
            if (!useSettingsStore.getState().autoPlayLecture) return;
            const allScenes = stageState.scenes;
            const curId = stageState.currentSceneId;
            const idx = allScenes.findIndex((s) => s.id === curId);
            if (idx >= 0 && idx < allScenes.length - 1) {
              const currentScene = allScenes[idx];
              if (
                currentScene.type === 'quiz' ||
                currentScene.type === 'interactive' ||
                currentScene.type === 'pbl'
              ) {
                return;
              }
              autoStartRef.current = true;
              stageState.setCurrentSceneId(allScenes[idx + 1].id);
            } else if (idx === allScenes.length - 1 && stageState.generatingOutlines.length > 0) {
              // Last scene exhausted but next is still generating — go to pending page
              const currentScene = allScenes[idx];
              if (
                currentScene.type === 'quiz' ||
                currentScene.type === 'interactive' ||
                currentScene.type === 'pbl'
              ) {
                return;
              }
              autoStartRef.current = true;
              stageState.setCurrentSceneId(PENDING_SCENE_ID);
            }
          }, 1500);
        }
      },
    });

    engineRef.current = engine;

    // Auto-start if triggered by auto-play scene advance
    if (autoStartRef.current) {
      autoStartRef.current = false;
      (async () => {
        if (currentScene && chatAreaRef.current) {
          const sessionId = await chatAreaRef.current.startLecture(currentScene.id);
          lectureSessionIdRef.current = sessionId;
          lectureActionCounterRef.current = 0;
        }
        engine.start();
      })();
    } else {
      // Load saved playback state and restore position (but never auto-play).
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only re-run when scene changes, functions are stable refs
  }, [currentScene]);

  // Cleanup on unmount
  useEffect(() => {
    const audioPlayer = audioPlayerRef.current;
    const chatArea = chatAreaRef.current;
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
      }
      audioPlayer.destroy();
      if (discussionAbortRef.current) {
        discussionAbortRef.current.abort();
      }
      discussionTTS.cleanup();
      chatArea?.endActiveSession();
      clearPresentationIdleTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup, clearPresentationIdleTimer is stable
  }, []);

  // Sync mute state from settings store to audioPlayer
  useEffect(() => {
    audioPlayerRef.current.setMuted(ttsMuted);
  }, [ttsMuted]);

  // Sync volume from settings store to audioPlayer
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  useEffect(() => {
    if (!ttsMuted) {
      audioPlayerRef.current.setVolume(ttsVolume);
    }
  }, [ttsVolume, ttsMuted]);

  // Sync playback speed to audio player (for live-updating current audio)
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  useEffect(() => {
    audioPlayerRef.current.setPlaybackRate(playbackSpeed);
  }, [playbackSpeed]);

  /**
   * Handle discussion SSE — POST /api/chat and push events to engine
   */
  const handleDiscussionSSE = useCallback(
    async (topic: string, prompt?: string, agentId?: string) => {
      // Start discussion display in ChatArea (lecture speech is preserved independently)
      chatAreaRef.current?.startDiscussion({
        topic,
        prompt,
        agentId: agentId || 'default-1',
      });
      // Auto-switch to chat tab when discussion starts
      chatAreaRef.current?.switchToTab('chat');
      // Immediately mark streaming for synchronized stop button
      setChatIsStreaming(true);
      setChatSessionType('discussion');
      // Optimistic thinking: show thinking dots immediately (same as onMessageSend)
      setThinkingState({ stage: 'director' });
    },
    [],
  );

  // First speech text for idle display (extracted here for playbackView)
  const firstSpeechText = useMemo(
    () => currentScene?.actions?.find((a): a is SpeechAction => a.type === 'speech')?.text ?? null,
    [currentScene],
  );

  // Whether the speaking agent is a student (for bubble role derivation)
  const speakingStudentFlag = useMemo(() => {
    if (!speakingAgentId) return false;
    const agent = useAgentRegistry.getState().getAgent(speakingAgentId);
    return agent?.role !== 'teacher';
  }, [speakingAgentId]);

  const speechTextForView = getSpeechTextForView({
    ttsEnabled,
    ttsMuted,
    audioIndicatorState,
    audioSpeech,
    liveSpeech,
  });

  // Centralised derived playback view
  const playbackView = useMemo(
    () =>
      computePlaybackView({
        engineMode,
        lectureSpeech,
        liveSpeech: speechTextForView,
        speakingAgentId,
        thinkingState,
        isCueUser,
        isTopicPending,
        chatIsStreaming,
        discussionTrigger,
        playbackCompleted,
        idleText: firstSpeechText,
        speakingStudent: speakingStudentFlag,
        sessionType: chatSessionType,
      }),
    [
      engineMode,
      lectureSpeech,
      speechTextForView,
      speakingAgentId,
      thinkingState,
      isCueUser,
      isTopicPending,
      chatIsStreaming,
      discussionTrigger,
      playbackCompleted,
      firstSpeechText,
      speakingStudentFlag,
      chatSessionType,
    ],
  );
  const activeSpeechTextForView = playbackView.isInLiveFlow ? speechTextForView : lectureSpeech;

  const isTopicActive = playbackView.isTopicActive;

  /**
   * Gated scene switch — if a topic is active, show AlertDialog before switching.
   * Returns true if the switch was immediate, false if gated (dialog shown).
   */
  const gatedSceneSwitch = useCallback(
    (targetSceneId: string): boolean => {
      if (targetSceneId === currentSceneId) return false;
      if (isTopicActive) {
        setPendingSceneId(targetSceneId);
        return false;
      }
      setCurrentSceneId(targetSceneId);
      return true;
    },
    [currentSceneId, isTopicActive, setCurrentSceneId],
  );

  /** User confirmed scene switch via AlertDialog */
  const confirmSceneSwitch = useCallback(() => {
    if (!pendingSceneId) return;
    chatAreaRef.current?.endActiveSession();
    doSessionCleanup();
    setCurrentSceneId(pendingSceneId);
    setPendingSceneId(null);
  }, [pendingSceneId, setCurrentSceneId, doSessionCleanup]);

  /** User cancelled scene switch via AlertDialog */
  const cancelSceneSwitch = useCallback(() => {
    setPendingSceneId(null);
  }, []);

  // play/pause toggle
  const handlePlayPause = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    const mode = engine.getMode();
    if (mode === 'playing' || mode === 'live') {
      engine.pause();
      // Pause lecture buffer so text stops immediately
      if (lectureSessionIdRef.current) {
        chatAreaRef.current?.pauseBuffer(lectureSessionIdRef.current);
      }
    } else if (mode === 'paused') {
      engine.resume();
      // Resume lecture buffer
      if (lectureSessionIdRef.current) {
        chatAreaRef.current?.resumeBuffer(lectureSessionIdRef.current);
      }
    } else {
      const wasCompleted = playbackCompleted;
      setPlaybackCompleted(false);
      // Starting playback - create/reuse lecture session
      if (currentScene && chatAreaRef.current) {
        const sessionId = await chatAreaRef.current.startLecture(currentScene.id);
        lectureSessionIdRef.current = sessionId;
      }
      if (wasCompleted) {
        // Restart from beginning (user clicked restart after completion)
        lectureActionCounterRef.current = 0;
        engine.start();
      } else {
        // Continue from current position (e.g. after discussion end)
        engine.continuePlayback();
      }
    }
  }, [playbackCompleted, currentScene]);

  // get scene information
  const isPendingScene = currentSceneId === PENDING_SCENE_ID;
  const hasNextPending = generatingOutlines.length > 0;
  // True when every outline has materialized into a scene and nothing is
  // currently generating — signals the classroom has finished and the user
  // can see a completion page. Comparing scenes.length === outlines.length
  // (rather than just `scenes.length > 0`) means a partial generation with
  // some failed outlines does not falsely trigger completion.
  const isCourseComplete =
    outlines.length > 0 && scenes.length === outlines.length && generatingOutlines.length === 0;
  const canAdvanceToPendingSlot = hasNextPending || isCourseComplete;

  // previous scene (gated)
  const handlePreviousScene = useCallback(() => {
    if (isPendingScene) {
      // From pending page → go to last real scene
      if (scenes.length > 0) {
        gatedSceneSwitch(scenes[scenes.length - 1].id);
      }
      return;
    }
    const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
    if (currentIndex > 0) {
      gatedSceneSwitch(scenes[currentIndex - 1].id);
    }
  }, [currentSceneId, gatedSceneSwitch, isPendingScene, scenes]);

  // next scene (gated)
  const handleNextScene = useCallback(() => {
    if (isPendingScene) return; // Already on pending, nowhere to go
    const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
    if (currentIndex < scenes.length - 1) {
      gatedSceneSwitch(scenes[currentIndex + 1].id);
    } else if (canAdvanceToPendingSlot) {
      // On last real scene → advance to pending slot (generating or completion page)
      setCurrentSceneId(PENDING_SCENE_ID);
    }
  }, [
    currentSceneId,
    gatedSceneSwitch,
    canAdvanceToPendingSlot,
    isPendingScene,
    scenes,
    setCurrentSceneId,
  ]);

  const currentSceneIndex = isPendingScene
    ? scenes.length
    : scenes.findIndex((s) => s.id === currentSceneId);
  const totalScenesCount = scenes.length + (canAdvanceToPendingSlot ? 1 : 0);

  // get action information
  const totalActions = currentScene?.actions?.length || 0;

  // whiteboard toggle
  const handleWhiteboardToggle = () => {
    setWhiteboardOpen(!whiteboardOpen);
  };

  const isPresentationShortcutTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;

    if (target.isContentEditable || target.closest('[contenteditable="true"]')) {
      return true;
    }

    return (
      target.closest(
        ['input', 'textarea', 'select', '[role="slider"]', 'input[type="range"]'].join(', '),
      ) !== null
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      // Let modifier-key combos (Ctrl+C, Ctrl+S, etc.) pass through to the browser
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        isPresentationShortcutTarget(event.target) ||
        isPresentationShortcutTarget(document.activeElement)
      ) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          if (!isPresenting) return;
          event.preventDefault();
          handlePreviousScene();
          resetPresentationIdleTimer();
          break;
        case 'ArrowRight':
          if (!isPresenting) return;
          event.preventDefault();
          handleNextScene();
          resetPresentationIdleTimer();
          break;
        case ' ':
        case 'Spacebar':
          // During active QA/discussion, Roundtable owns Space for
          // buffer-level pause/resume — don't also fire engine play/pause.
          if (chatSessionType === 'qa' || chatSessionType === 'discussion') break;
          event.preventDefault();
          handlePlayPause();
          break;
        case 'Escape':
          // With keyboard.lock(), Escape no longer auto-exits fullscreen.
          // If panels are open, roundtable handles Escape (close panels).
          // If no panels are open, manually exit fullscreen.
          if (isPresenting && !isPresentationInteractionActive) {
            event.preventDefault();
            togglePresentation();
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          setTTSVolume(ttsVolume + 0.1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setTTSVolume(ttsVolume - 0.1);
          break;
        case 'm':
        case 'M':
          event.preventDefault();
          setTTSMuted(!ttsMuted);
          break;
        case 's':
        case 'S':
          event.preventDefault();
          setTimelineCollapsed(!timelineCollapsed);
          break;
        case 'c':
        case 'C':
          event.preventDefault();
          setChatAreaCollapsed(!chatAreaCollapsed);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    chatSessionType,
    chatAreaCollapsed,
    handleNextScene,
    handlePlayPause,
    handlePreviousScene,
    isPresenting,
    isPresentationInteractionActive,
    isPresentationShortcutTarget,
    resetPresentationIdleTimer,
    setChatAreaCollapsed,
    setTimelineCollapsed,
    setTTSMuted,
    setTTSVolume,
    timelineCollapsed,
    togglePresentation,
    ttsMuted,
    ttsVolume,
  ]);

  // Intercept F11 to use our presentation fullscreen instead of browser fullscreen
  // This way ESC can exit fullscreen (browser F11 fullscreen requires F11 to exit)
  useEffect(() => {
    const onF11 = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault();
        togglePresentation();
      }
    };

    window.addEventListener('keydown', onF11);
    return () => window.removeEventListener('keydown', onF11);
  }, [togglePresentation]);

  // Map engine mode to the CanvasArea's expected engine state
  const canvasEngineState = (() => {
    switch (engineMode) {
      case 'playing':
      case 'live':
        return 'playing';
      case 'paused':
        return 'paused';
      default:
        return 'idle';
    }
  })();

  // Build discussion request for Roundtable ProactiveCard from trigger
  const discussionRequest: DiscussionAction | null = discussionTrigger
    ? {
        type: 'discussion',
        id: discussionTrigger.id,
        topic: discussionTrigger.question,
        prompt: discussionTrigger.prompt,
        agentId: discussionTrigger.agentId || 'default-1',
      }
    : null;

  // Show stop button for live sessions
  const showStopButton =
    engineMode === 'live' ||
    (chatIsStreaming && (chatSessionType === 'qa' || chatSessionType === 'discussion'));

  return (
    <div
      ref={stageRef}
      className={cn(
        'flex-1 flex flex-col overflow-hidden bg-[#e6f6ff] text-slate-900 dark:bg-slate-950 dark:text-slate-100',
        isPresenting && !controlsVisible && 'cursor-none',
      )}
    >
      {/* Main Content Area — sky presentation stage */}
      <div className="relative flex min-w-0 flex-1 overflow-hidden bg-[linear-gradient(180deg,#dff4ff_0%,#f7fcff_46%,#eef8ff_100%)] p-3 dark:bg-[linear-gradient(180deg,#07111f_0%,#020617_100%)] md:p-4">
        <div className="pointer-events-none absolute inset-x-0 top-14 h-px bg-white/75 dark:bg-slate-800/70" />
        <div className="pointer-events-none absolute inset-x-16 top-28 h-px bg-sky-100/90 dark:bg-slate-800/60" />
        <div className="pointer-events-none absolute inset-x-8 bottom-24 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.34)_62%,rgba(255,255,255,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.42)_62%,rgba(15,23,42,0)_100%)]" />
        {/* Left: Roundtable Character Strip — extends full height */}
        {mode === 'playback' && (
          <div className="absolute bottom-4 left-4 top-[76px] z-30 flex w-16 shrink-0 flex-col overflow-visible">
            <Roundtable
              compactDock
              mode={mode}
              initialParticipants={participants}
              playbackView={playbackView}
              currentSpeech={activeSpeechTextForView}
              lectureSpeech={lectureSpeech}
              idleText={firstSpeechText}
              playbackCompleted={playbackCompleted}
              discussionRequest={discussionRequest}
              engineMode={engineMode}
              isStreaming={chatIsStreaming}
              speakingAgentId={speakingAgentId}
              audioIndicatorState={audioIndicatorState}
              audioAgentId={audioAgentId}
              speechProgress={speechProgress}
              showEndFlash={showEndFlash}
              endFlashSessionType={endFlashSessionType}
              thinkingState={thinkingState}
              isCueUser={isCueUser}
              isTopicPending={isTopicPending}
              onMessageSend={async (msg) => {
                setIsDiscussionPaused(false);
                chatAreaRef.current?.resumeActiveLiveBuffer();
                discussionTTS.cleanup();
                if (isTopicPending) {
                  setIsTopicPending(false);
                  setLiveSpeech(null);
                  setSpeakingAgentId(null);
                }
                if (
                  engineRef.current &&
                  (engineMode === 'playing' || engineMode === 'live' || engineMode === 'paused')
                ) {
                  engineRef.current.handleUserInterrupt(msg);
                } else {
                  chatAreaRef.current?.sendMessage(msg);
                }
                chatAreaRef.current?.switchToTab('chat');
                setIsCueUser(false);
                setChatIsStreaming(true);
                setChatSessionType(chatSessionType || 'qa');
                setThinkingState({ stage: 'director' });
              }}
              onDiscussionStart={() => {
                engineRef.current?.confirmDiscussion();
              }}
              onDiscussionSkip={() => {
                engineRef.current?.skipDiscussion();
              }}
              onStopDiscussion={handleStopDiscussion}
              onInputActivate={() => {
                if (chatSessionType === 'qa' || chatSessionType === 'discussion') {
                  const paused = chatAreaRef.current?.pauseActiveLiveBuffer();
                  if (paused) {
                    discussionTTS.pause();
                    setIsDiscussionPaused(true);
                  }
                }
                if (engineRef.current && (engineMode === 'playing' || engineMode === 'live')) {
                  engineRef.current.pause();
                }
              }}
              onResumeTopic={doResumeTopic}
              onPlayPause={handlePlayPause}
              isDiscussionPaused={isDiscussionPaused}
              onDiscussionPause={() => {
                const paused = chatAreaRef.current?.pauseActiveLiveBuffer();
                if (paused) {
                  discussionTTS.pause();
                  setIsDiscussionPaused(true);
                }
              }}
              onDiscussionResume={() => {
                chatAreaRef.current?.resumeActiveLiveBuffer();
                discussionTTS.resume();
                setIsDiscussionPaused(false);
              }}
              totalActions={totalActions}
              currentActionIndex={0}
              currentSceneIndex={currentSceneIndex}
              scenesCount={totalScenesCount}
              whiteboardOpen={whiteboardOpen}
              sidebarCollapsed={timelineCollapsed}
              chatCollapsed={chatAreaCollapsed}
              onToggleSidebar={() => setTimelineCollapsed(!timelineCollapsed)}
              onToggleChat={() => setChatAreaCollapsed(!chatAreaCollapsed)}
              onPrevSlide={handlePreviousScene}
              onNextSlide={handleNextScene}
              onWhiteboardClose={handleWhiteboardToggle}
              isPresenting={isPresenting}
              onTogglePresentation={togglePresentation}
              onPresentationInteractionChange={setIsPresentationInteractionActive}
              fullscreenContainerRef={stageRef}
              onAskTeacher={handleOpenAskDialog}
              isAskDialogOpen={isAskDialogOpen}
            />
          </div>
        )}

        {!isPresenting && timelineCollapsed && (
          <button
            type="button"
            onClick={() => setTimelineCollapsed(false)}
            className="absolute left-4 top-4 z-40 flex h-11 items-center gap-2 rounded-full border border-white/75 bg-white/72 px-3 text-xs font-semibold text-sky-900 shadow-[0_12px_34px_rgba(14,116,144,0.12)] backdrop-blur-xl transition hover:bg-white dark:border-slate-800 dark:bg-slate-950/80 dark:text-sky-200"
            aria-label="Open slide map"
            title="Open slide map"
          >
            <LayoutList className="h-4 w-4" />
            <span className="tabular-nums">
              {currentSceneIndex >= 0 ? currentSceneIndex + 1 : '-'} / {totalScenesCount}
            </span>
          </button>
        )}

        {!isPresenting && chatAreaCollapsed && (
          <button
            type="button"
            onClick={() => setChatAreaCollapsed(false)}
            className="absolute right-4 top-[76px] z-40 flex h-11 items-center gap-2 rounded-full border border-white/75 bg-white/72 px-3 text-xs font-semibold text-sky-900 shadow-[0_12px_34px_rgba(14,116,144,0.12)] backdrop-blur-xl transition hover:bg-white dark:border-slate-800 dark:bg-slate-950/80 dark:text-sky-200"
            aria-label="Open learning assistant"
            title="Open learning assistant"
          >
            <MessageSquare className="h-4 w-4" />
            <span>助手</span>
          </button>
        )}

        {!isPresenting && (
          <SceneSidebar
            collapsed={timelineCollapsed}
            onCollapseChange={setTimelineCollapsed}
            onSceneSelect={gatedSceneSwitch}
            onRetryOutline={onRetryOutline}
            isCourseComplete={isCourseComplete}
          />
        )}

        {/* Center: Canvas Area — presentation stage */}
        <div
          className={cn(
            'relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/48 shadow-[0_24px_76px_rgba(14,116,144,0.11)] backdrop-blur-xl transition-[margin] duration-300 dark:border-slate-800 dark:bg-slate-950/82 dark:shadow-none',
            !isPresenting && mode === 'playback' && 'ml-20',
            !isPresenting && !chatAreaCollapsed && 'xl:mr-[412px]',
          )}
        >
          {/* Header */}
          {!isPresenting && (
            <Header
              currentSceneTitle={
                currentScene?.title || (isCourseComplete && isPendingScene ? 'Complete' : '')
              }
              timelineCollapsed={timelineCollapsed}
              onTimelineCollapseChange={setTimelineCollapsed}
              onSceneSelect={gatedSceneSwitch}
              onRetryOutline={onRetryOutline}
              isCourseComplete={isCourseComplete}
            />
          )}

          {/* Canvas Area — Golden ratio centered */}
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <CanvasArea
              currentScene={currentScene}
              currentSceneIndex={currentSceneIndex}
              scenesCount={totalScenesCount}
              mode={mode}
              engineState={canvasEngineState}
              isLiveSession={
                chatIsStreaming || isTopicPending || engineMode === 'live' || !!chatSessionType
              }
              whiteboardOpen={whiteboardOpen}
              sidebarCollapsed={timelineCollapsed}
              chatCollapsed={chatAreaCollapsed}
              onToggleSidebar={() => setTimelineCollapsed(!timelineCollapsed)}
              onToggleChat={() => setChatAreaCollapsed(!chatAreaCollapsed)}
              onPrevSlide={handlePreviousScene}
              onNextSlide={handleNextScene}
              onPlayPause={handlePlayPause}
              onWhiteboardClose={handleWhiteboardToggle}
              isPresenting={isPresenting}
              onTogglePresentation={togglePresentation}
              showStopDiscussion={
                engineMode === 'live' ||
                (chatIsStreaming && (chatSessionType === 'qa' || chatSessionType === 'discussion'))
              }
              onStopDiscussion={handleStopDiscussion}
              hideToolbar={mode === 'playback'}
              isPendingScene={isPendingScene}
              isCourseComplete={isCourseComplete}
              isGenerationFailed={
                isPendingScene && failedOutlines.some((f) => f.id === generatingOutlines[0]?.id)
              }
              onRetryGeneration={
                onRetryOutline && generatingOutlines[0]
                  ? () => onRetryOutline(generatingOutlines[0].id)
                  : undefined
              }
            />
          </div>

          {/* Bottom: Playback Controls */}
          {mode === 'playback' && !isPresenting && (
            <BottomToolbar
              className="absolute bottom-3 left-0 right-0 z-40"
              currentSceneIndex={currentSceneIndex}
              scenesCount={totalScenesCount}
              engineState={canvasEngineState}
              isLiveSession={chatIsStreaming || isTopicPending || engineMode === 'live'}
              whiteboardOpen={whiteboardOpen}
              sidebarCollapsed={timelineCollapsed}
              chatCollapsed={chatAreaCollapsed}
              onToggleSidebar={() => setTimelineCollapsed(!timelineCollapsed)}
              onToggleChat={() => setChatAreaCollapsed(!chatAreaCollapsed)}
              onPrevSlide={handlePreviousScene}
              onNextSlide={handleNextScene}
              onPlayPause={handlePlayPause}
              onWhiteboardClose={handleWhiteboardToggle}
              isPresenting={isPresenting}
              onTogglePresentation={togglePresentation}
              showStopDiscussion={showStopButton}
              onStopDiscussion={handleStopDiscussion}
              onAskTeacher={handleOpenAskDialog}
              ttsEnabled={ttsEnabled}
              ttsMuted={ttsMuted}
              ttsVolume={ttsVolume}
              onToggleMute={() => setTTSMuted(!ttsMuted)}
              onVolumeChange={setTTSVolume}
              playbackSpeed={playbackSpeed}
              onCycleSpeed={() => {
                const speeds: Array<1 | 1.25 | 1.5 | 2> = [1, 1.25, 1.5, 2];
                const current = (playbackSpeed || 1) as 1 | 1.25 | 1.5 | 2;
                const currentIndex = speeds.indexOf(current);
                const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
                useSettingsStore.getState().setPlaybackSpeed(nextSpeed);
              }}
              autoPlayLecture={useSettingsStore.getState().autoPlayLecture}
              onToggleAutoPlay={() =>
                useSettingsStore
                  .getState()
                  .setAutoPlayLecture(!useSettingsStore.getState().autoPlayLecture)
              }
            />
          )}
        </div>

        {/* Right Panel — floating notes and dialogue */}
        <ChatArea
          ref={chatAreaRef}
          width={Math.min(Math.max(chatAreaWidth, 340), 380)}
          onWidthChange={setChatAreaWidth}
          collapsed={chatAreaCollapsed}
          onCollapseChange={setChatAreaCollapsed}
          className={cn(
            'absolute bottom-4 right-4 top-4 z-50 shadow-[0_20px_58px_rgba(14,116,144,0.16)]',
            chatAreaCollapsed &&
              'pointer-events-none border-transparent bg-transparent shadow-none',
          )}
          activeBubbleId={activeBubbleId}
          onActiveBubble={(id) => setActiveBubbleId(id)}
          currentSceneId={currentSceneId}
          onLiveSpeech={(text, agentId) => {
            const epoch = sceneEpochRef.current;
            queueMicrotask(() => {
              if (sceneEpochRef.current !== epoch) return;
              setLiveSpeech(text);
              if (agentId !== undefined) {
                setSpeakingAgentId(agentId);
              }
              if (text !== null || agentId) {
                setChatIsStreaming(true);
                setChatSessionType(chatAreaRef.current?.getActiveSessionType?.() ?? null);
                setIsTopicPending(false);
              } else if (text === null && agentId === null) {
                setChatIsStreaming(false);
              }
            });
          }}
          onSpeechProgress={(ratio) => {
            const epoch = sceneEpochRef.current;
            queueMicrotask(() => {
              if (sceneEpochRef.current !== epoch) return;
              setSpeechProgress(ratio);
            });
          }}
          onThinking={(state) => {
            const epoch = sceneEpochRef.current;
            queueMicrotask(() => {
              if (sceneEpochRef.current !== epoch) return;
              setThinkingState(state);
            });
          }}
          onCueUser={(_fromAgentId, _prompt) => {
            setIsCueUser(true);
          }}
          onLiveSessionError={handleLiveSessionError}
          onStopSession={() => doSessionCleanup({ preserveQaBubble: true })}
          onSegmentSealed={discussionTTS.handleSegmentSealed}
          shouldHoldAfterReveal={discussionTTS.shouldHold}
          enableFilters
        />
      </div>

      {/* PPT Slide Panel — right side overlay */}
      <PptViewer
        scenes={scenes}
        currentSlideIndex={scenes.findIndex((s) => s.id === currentSceneId && s.type === 'slide')}
        onSlideChange={(index) => {
          const slideScenes = scenes.filter((s) => s.type === 'slide');
          if (index >= 0 && index < slideScenes.length) {
            setCurrentSceneId(slideScenes[index].id);
          }
        }}
        visible={pptPanelOpen}
        onClose={() => {
          setPptPanelOpen(false);
          setPptFullscreen(false);
        }}
        onToggleFullscreen={() => setPptFullscreen((v) => !v)}
        isFullscreen={pptFullscreen}
      />

      {/* Floating Ask Dialog - Redesigned as Conversation Input */}
      <AnimatePresence>
        {isAskDialogOpen && (
          <>
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm"
              onClick={() => {
                setIsAskDialogOpen(false);
                setAskInputValue('');
              }}
            />

            {/* Conversation Dialog - Bottom Sheet Style */}
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.21, 1, 0.36, 1] }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[101] w-full max-w-2xl px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-sky-200/50 dark:border-sky-500/30 overflow-hidden">
                {/* Top Handle Bar */}
                <div className="flex items-center justify-center pt-3 pb-1">
                  <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                </div>

                {/* Header with User Avatar and Context */}
                <div className="flex items-center gap-3 px-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    {/* 用户头像 - 与主页样式一致 */}
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-10 h-10 rounded-xl overflow-hidden ring-2 ring-sky-400/50"
                    >
                      <img src={userAvatar} alt={'你'} className="w-full h-full object-cover" />
                    </motion.div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {'向老师提问'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {'正在向老师提问...'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsAskDialogOpen(false);
                      setAskInputValue('');
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Input Area - Chat Style */}
                <div className="p-4">
                  <div className="relative">
                    <textarea
                      ref={askInputRef}
                      value={askInputValue}
                      onChange={(e) => setAskInputValue(e.target.value)}
                      onKeyDown={handleAskInputKeyDown}
                      placeholder={'输入你的消息...'}
                      rows={1}
                      className="w-full resize-none bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 pl-4 pr-12 py-3.5 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 transition-all"
                      style={
                        { fieldSizing: 'content', minHeight: '52px', maxHeight: '120px' } as Record<
                          string,
                          string
                        >
                      }
                    />

                    {/* Send Button - Inside Input */}
                    <button
                      onClick={handleSendQuestion}
                      disabled={!askInputValue.trim()}
                      className={cn(
                        'absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                        askInputValue.trim()
                          ? 'bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/30 active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed',
                      )}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Quick Actions Bar */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {/* Voice Input */}
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                          />
                        </svg>
                        {'语音输入'}
                      </button>
                    </div>

                    {/* Hint Text */}
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Enter {'发送'} · Esc {'取消'}
                    </p>
                  </div>
                </div>

                {/* Quick Suggestions - Optional */}
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <span className="text-xs text-slate-400 whitespace-nowrap">{'快速提问'}:</span>
                    {[
                      '这个知识点能再解释一下吗？',
                      '可以举个例子吗？',
                      '我没听明白',
                      '这和之前学的有什么联系？',
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setAskInputValue(q);
                          askInputRef.current?.focus();
                        }}
                        className="px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 text-xs text-sky-600 dark:text-sky-400 whitespace-nowrap hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Scene switch confirmation dialog */}
      <AlertDialog
        open={!!pendingSceneId}
        onOpenChange={(open) => {
          if (!open) cancelSceneSwitch();
        }}
      >
        <AlertDialogContent
          container={isPresenting ? stageRef.current : undefined}
          className="max-w-sm rounded-2xl p-0 overflow-hidden border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.5)]"
        >
          <VisuallyHidden.Root>
            <AlertDialogTitle>{'切换页面'}</AlertDialogTitle>
          </VisuallyHidden.Root>
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400" />

          <div className="px-6 pt-5 pb-2 flex flex-col items-center text-center">
            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 ring-1 ring-amber-500/30">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            {/* Title */}
            <h3 className="text-base font-bold text-slate-100 mb-1.5">{'切换页面'}</h3>
            {/* Description */}
            <p className="text-sm text-slate-400 leading-relaxed">
              {'当前话题正在进行中，切换页面将结束当前话题。确定要切换吗？'}
            </p>
          </div>

          <AlertDialogFooter className="px-6 pb-5 pt-3 flex-row gap-3 border-t border-white/5">
            <AlertDialogCancel
              onClick={cancelSceneSwitch}
              className="flex-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10"
            >
              {'取消'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSceneSwitch}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg shadow-amber-500/20"
            >
              {'确定'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
