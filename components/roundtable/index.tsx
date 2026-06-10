'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Pause,
  Play,
  Loader2,
  Volume2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AudioIndicatorState } from './audio-indicator';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { toast } from 'sonner';
import { useSettingsStore } from '@/lib/store/settings';
import { useUserProfileStore } from '@/lib/store/user-profile';
import { ProactiveCard } from '@/components/chat/proactive-card';
import { PresentationSpeechOverlay } from '@/components/roundtable/presentation-speech-overlay';
import { AvatarDisplay } from '@/components/ui/avatar-display';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { DEFAULT_TEACHER_AVATAR, DEFAULT_USER_AVATAR } from '@/components/roundtable/constants';
import type { DiscussionAction } from '@/lib/types/action';
import type { EngineMode, PlaybackView } from '@/lib/playback';
import type { Participant } from '@/lib/types/roundtable';
import { CharacterStrip } from '@/components/ui/character-avatar';
import { SpeechBubble } from '@/components/ui/glass-dialog';
import { BottomToolbar } from '@/components/ui/bottom-toolbar';
import { AvatarSpeechPopup } from '@/components/ui/avatar-speech-popup';

export interface DiscussionRequest {
  topic: string;
  prompt?: string;
  agentId?: string;
  sceneId?: string;
}

interface RoundtableProps {
  readonly mode?: 'playback' | 'autonomous';
  readonly initialParticipants?: Participant[];
  readonly playbackView?: PlaybackView;
  readonly currentSpeech?: string | null;
  readonly lectureSpeech?: string | null;
  readonly idleText?: string | null;
  readonly playbackCompleted?: boolean;
  readonly discussionRequest?: DiscussionAction | null;
  readonly engineMode?: EngineMode;
  readonly isStreaming?: boolean;
  readonly sessionType?: 'qa' | 'discussion';
  readonly speakingAgentId?: string | null;
  readonly audioIndicatorState?: AudioIndicatorState;
  readonly audioAgentId?: string | null;
  readonly speechProgress?: number | null;
  readonly showEndFlash?: boolean;
  readonly endFlashSessionType?: 'qa' | 'discussion';
  readonly thinkingState?: { stage: string; agentId?: string } | null;
  readonly isCueUser?: boolean;
  readonly isTopicPending?: boolean;
  readonly onMessageSend?: (message: string) => void;
  readonly onDiscussionStart?: (request: DiscussionAction) => void;
  readonly onDiscussionSkip?: () => void;
  readonly onStopDiscussion?: () => void;
  readonly onInputActivate?: () => void;
  readonly onResumeTopic?: () => void;
  readonly onPlayPause?: () => void;
  readonly isDiscussionPaused?: boolean;
  readonly onDiscussionPause?: () => void;
  readonly onDiscussionResume?: () => void;
  readonly totalActions?: number;
  readonly currentActionIndex?: number;
  readonly currentSceneIndex?: number;
  readonly scenesCount?: number;
  readonly whiteboardOpen?: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly chatCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
  readonly onToggleChat?: () => void;
  readonly onPrevSlide?: () => void;
  readonly onNextSlide?: () => void;
  readonly onWhiteboardClose?: () => void;
  readonly isPresenting?: boolean;
  readonly controlsVisible?: boolean;
  readonly onTogglePresentation?: () => void;
  readonly onPresentationInteractionChange?: (active: boolean) => void;
  readonly fullscreenContainerRef?: React.RefObject<HTMLDivElement | null>;
  readonly onAskTeacher?: () => void;
  readonly isAskDialogOpen?: boolean;
}

export function Roundtable({
  mode: _mode = 'autonomous',
  initialParticipants = [],
  playbackView,
  currentSpeech,
  lectureSpeech,
  idleText,
  playbackCompleted,
  discussionRequest,
  engineMode = 'idle',
  isStreaming,
  sessionType,
  speakingAgentId,
  audioIndicatorState,
  audioAgentId,
  speechProgress: _speechProgress,
  showEndFlash,
  endFlashSessionType = 'discussion',
  thinkingState,
  isCueUser,
  isTopicPending,
  onMessageSend,
  onDiscussionStart,
  onDiscussionSkip,
  onStopDiscussion,
  onInputActivate,
  onResumeTopic,
  onPlayPause,
  isDiscussionPaused,
  onDiscussionPause,
  onDiscussionResume,
  currentSceneIndex = 0,
  scenesCount = 1,
  whiteboardOpen = false,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onPrevSlide,
  onNextSlide,
  onWhiteboardClose,
  isPresenting,
  controlsVisible,
  onTogglePresentation,
  onPresentationInteractionChange,
  fullscreenContainerRef,
  onAskTeacher,
  isAskDialogOpen,
}: RoundtableProps) {
  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const setTTSMuted = useSettingsStore((s) => s.setTTSMuted);
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const asrEnabled = useSettingsStore((state) => state.asrEnabled);
  const chatAreaWidth = useSettingsStore((s) => s.chatAreaWidth);
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  const setTTSVolume = useSettingsStore((s) => s.setTTSVolume);

  // 获取用户实际头像（与主页一致）
  const userProfileAvatar = useUserProfileStore((s) => s.avatar);

  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const avatarRefMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const agentScrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const teacherAvatarRef = useRef<HTMLDivElement>(null);
  const studentAvatarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const userMessageClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dismissedSpeaker, setDismissedSpeaker] = useState<string | null>(null);
  const [endFlashVisible, setEndFlashVisible] = useState(false);
  const [isSendCooldown, setIsSendCooldown] = useState(false);
  const isSendCooldownRef = useRef(false);

  const teacherParticipant = initialParticipants.find((p) => p.role === 'teacher');
  const studentParticipants = initialParticipants.filter(
    (p) => p.role !== 'teacher' && p.role !== 'user'
  );
  const userParticipant = initialParticipants.find((p) => p.role === 'user');

  const discussionAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!discussionRequest) {
      discussionAnchorRef.current = null;
      return;
    }
    if (discussionRequest.agentId === teacherParticipant?.id) {
      discussionAnchorRef.current = teacherAvatarRef.current;
    } else {
      discussionAnchorRef.current =
        studentAvatarRefs.current.get(discussionRequest.agentId || '') || null;
    }
  }, [discussionRequest, teacherParticipant?.id]);

  const isInLiveFlow =
    playbackView?.isInLiveFlow ??
    !!(speakingAgentId || thinkingState || isStreaming || sessionType);

  const sourceText = userMessage
    ? userMessage
    : (playbackView?.sourceText ??
      (currentSpeech
        ? currentSpeech
        : isInLiveFlow
          ? ''
          : lectureSpeech || (playbackCompleted ? '' : idleText) || ''));
  const hasAgentFeedback = Boolean(playbackView?.sourceText || thinkingState);
  const prevHasAgentFeedbackRef = useRef(hasAgentFeedback);

  const clearUserMessageClearTimer = useCallback(() => {
    if (userMessageClearTimerRef.current) {
      clearTimeout(userMessageClearTimerRef.current);
      userMessageClearTimerRef.current = null;
    }
  }, []);

  const scheduleUserMessageClear = useCallback(() => {
    clearUserMessageClearTimer();
    userMessageClearTimerRef.current = setTimeout(() => {
      setUserMessage(null);
      userMessageClearTimerRef.current = null;
    }, 3000);
  }, [clearUserMessageClearTimer]);

  const showLocalUserMessage = useCallback(
    (text: string) => {
      setUserMessage(text);
      prevHasAgentFeedbackRef.current = true;
      scheduleUserMessageClear();
    },
    [scheduleUserMessageClear]
  );

  useEffect(() => {
    if (isInLiveFlow && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [sourceText, isInLiveFlow]);

  useEffect(() => {
    const feedbackStarted = hasAgentFeedback && !prevHasAgentFeedbackRef.current;
    if (userMessage && feedbackStarted) {
      clearUserMessageClearTimer();
      setUserMessage(null);
    }
    prevHasAgentFeedbackRef.current = hasAgentFeedback;
  }, [clearUserMessageClearTimer, hasAgentFeedback, userMessage]);

  useEffect(() => () => clearUserMessageClearTimer(), [clearUserMessageClearTimer]);

  useEffect(() => {
    if (showEndFlash) {
      setEndFlashVisible(true);
      const timer = setTimeout(() => setEndFlashVisible(false), 1800);
      return () => clearTimeout(timer);
    } else {
      setEndFlashVisible(false);
    }
  }, [showEndFlash]);

  useEffect(() => {
    if (isSendCooldown && speakingAgentId) {
      setIsSendCooldown(false);
      isSendCooldownRef.current = false;
    }
  }, [isSendCooldown, speakingAgentId]);

  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && isSendCooldown) {
      setIsSendCooldown(false);
      isSendCooldownRef.current = false;
    }
    prevStreamingRef.current = !!isStreaming;
  }, [isStreaming, isSendCooldown]);

  const teacherAvatar = teacherParticipant?.avatar || DEFAULT_TEACHER_AVATAR;
  const teacherName = teacherParticipant?.name || '教师';
  const userAvatar = userParticipant?.avatar || DEFAULT_USER_AVATAR;

  const { isRecording, isProcessing, startRecording, stopRecording, cancelRecording } =
    useAudioRecorder({
      onTranscription: (text) => {
        if (!text.trim()) {
          toast.info('未检测到语音，请重试');
          setIsVoiceOpen(false);
          return;
        }
        if (isSendCooldownRef.current) {
          setIsVoiceOpen(false);
          return;
        }
        showLocalUserMessage(text);
        onMessageSend?.(text);
        setIsSendCooldown(true);
        isSendCooldownRef.current = true;
        setIsVoiceOpen(false);
      },
      onError: (error) => {
        toast.error(error);
        setIsVoiceOpen(false);
      },
    });

  const handleSendMessage = () => {
    if (!inputValue.trim() || isSendCooldown) return;

    showLocalUserMessage(inputValue);
    onMessageSend?.(inputValue);
    setDismissedSpeaker(popupSpeakingAgentId ?? null);
    setIsSendCooldown(true);
    isSendCooldownRef.current = true;
    setInputValue('');
    setIsInputOpen(false);
  };

  const handleToggleInput = () => {
    if (isSendCooldown) return;
    if (!isInputOpen) {
      onInputActivate?.();
      setDismissedSpeaker(popupSpeakingAgentId ?? null);
    }
    setIsInputOpen(!isInputOpen);
    if (isVoiceOpen || isProcessing) {
      cancelRecording();
      setIsVoiceOpen(false);
    }
  };

  const handleToggleVoice = () => {
    if (isVoiceOpen) {
      if (isRecording) {
        stopRecording();
      }
      setIsVoiceOpen(false);
    } else {
      if (isSendCooldown || isProcessing) return;
      onInputActivate?.();
      setDismissedSpeaker(popupSpeakingAgentId ?? null);
      setIsVoiceOpen(true);
      setIsInputOpen(false);
      startRecording();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isInputOpen || isVoiceOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsInputOpen(false);
          setIsVoiceOpen(false);
          if (isRecording || isProcessing) cancelRecording();
        }
        return;
      }

      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          if (!isInLiveFlow) return;
          e.preventDefault();
          if (isDiscussionPaused) {
            onDiscussionResume?.();
          } else if (!thinkingState && currentSpeech) {
            onDiscussionPause?.();
          }
          break;
        case 't':
        case 'T':
          e.preventDefault();
          handleToggleInput();
          break;
        case 'v':
        case 'V':
          e.preventDefault();
          if (asrEnabled) handleToggleVoice();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isInLiveFlow,
    isDiscussionPaused,
    thinkingState,
    currentSpeech,
    onDiscussionPause,
    onDiscussionResume,
    asrEnabled,
    isInputOpen,
    isVoiceOpen,
    isRecording,
    isProcessing,
  ]);

  const isPresentationInteractionActive = isInputOpen || isVoiceOpen || isRecording || isProcessing;

  useEffect(() => {
    onPresentationInteractionChange?.(isPresentationInteractionActive);
    return () => {
      if (isPresentationInteractionActive) {
        onPresentationInteractionChange?.(false);
      }
    };
  }, [isPresentationInteractionActive, onPresentationInteractionChange]);

  const speakingStudent = speakingAgentId
    ? studentParticipants.find((s) => s.id === speakingAgentId)
    : null;

  const isBubbleLoading = !!(speakingAgentId && !currentSpeech && !userMessage);
  const isAgentLoading = !!(speakingStudent && !currentSpeech && !userMessage);

  const activeRole: 'teacher' | 'user' | 'agent' | null = userMessage
    ? 'user'
    : (playbackView?.activeRole ??
      (currentSpeech && speakingStudent
        ? 'agent'
        : currentSpeech
          ? 'teacher'
          : isAgentLoading
            ? 'agent'
            : isBubbleLoading
              ? 'teacher'
              : isCueUser
                ? null
                : lectureSpeech
                  ? 'teacher'
                  : null));

  const bubbleRole: 'teacher' | 'user' | 'agent' | null = userMessage
    ? 'user'
    : (playbackView?.bubbleRole ??
      (currentSpeech && speakingStudent
        ? 'agent'
        : currentSpeech
          ? 'teacher'
          : isAgentLoading
            ? 'agent'
            : isBubbleLoading
              ? 'teacher'
              : isInLiveFlow
                ? null
                : isCueUser
                  ? null
                  : lectureSpeech || idleText
                    ? 'teacher'
                    : null));

  const bubbleName =
    bubbleRole === 'agent'
      ? speakingStudent?.name || '学生'
      : bubbleRole === 'teacher'
        ? teacherName
        : bubbleRole === 'user'
          ? '你'
          : '';

  const bubbleAvatar =
    bubbleRole === 'user'
      ? userAvatar
      : bubbleRole === 'agent'
        ? speakingStudent?.avatar || userAvatar
        : teacherAvatar;

  const bubbleKey =
    bubbleRole === 'user'
      ? 'user'
      : bubbleRole === 'agent'
        ? `agent-${speakingAgentId}`
        : bubbleRole === 'teacher'
          ? 'teacher'
          : 'idle';

  const enrichedPlaybackView: PlaybackView = playbackView
    ? { ...playbackView, bubbleRole, sourceText, activeRole: activeRole ?? playbackView.activeRole }
    : {
        phase: 'idle' as const,
        sourceText,
        bubbleRole,
        activeRole,
        buttonState: 'none' as const,
        isInLiveFlow: false,
        isTopicActive: false,
      };

  const showStopButton =
    engineMode === 'live' || sessionType === 'qa' || sessionType === 'discussion';

  const agentRegistry = useAgentRegistry.getState();
  const getAgentConfig = (id: string) => agentRegistry.getAgent(id);

  const presentationDiscussionParticipant = discussionRequest
    ? discussionRequest.agentId === teacherParticipant?.id
      ? teacherParticipant || null
      : studentParticipants.find((student) => student.id === discussionRequest.agentId) || null
    : null;
  const presentationDiscussionAgentConfig = discussionRequest
    ? getAgentConfig(discussionRequest.agentId || '')
    : null;

  const handlePresentationBubbleClick = useCallback(() => {
    if (isTopicPending) {
      onResumeTopic?.();
      return;
    }
    if (isInLiveFlow) {
      if (isDiscussionPaused) {
        onDiscussionResume?.();
      } else if (!thinkingState && currentSpeech) {
        onDiscussionPause?.();
      }
      return;
    }
    onPlayPause?.();
  }, [
    isTopicPending,
    isInLiveFlow,
    isDiscussionPaused,
    thinkingState,
    currentSpeech,
    onResumeTopic,
    onDiscussionResume,
    onDiscussionPause,
    onPlayPause,
  ]);

  const showPresentationDock =
    !!controlsVisible ||
    !!discussionRequest ||
    isCueUser ||
    isInputOpen ||
    isVoiceOpen ||
    isRecording ||
    isProcessing;

  // Derive effective speaking agent for the popup — user messages come from local
  // state, not from the engine, so map them to the user participant explicitly.
  // Map speech to the correct participant for the popup.
  // speakingAgentId from the engine covers live chat; bubbleRole covers
  // lecture/idle playback where the engine doesn't emit an agentId.
  const popupSpeakingAgentId = (() => {
    if (userMessage) return userParticipant?.id ?? null;
    if (speakingAgentId) return speakingAgentId;
    // Any agent speaking — teacher, student, or thinking agent
    if (sourceText && bubbleRole === 'teacher') return teacherParticipant?.id ?? null;
    if (sourceText && bubbleRole === 'agent' && speakingStudent) return speakingStudent.id;
    // Fallback: if an agent is thinking, treat them as speaker
    if (sourceText && thinkingState?.agentId) return thinkingState.agentId;
    return null;
  })();

  // Reset dismissed state when speaker or text changes (new speech = show popup again)
  useEffect(() => {
    setDismissedSpeaker(null);
  }, [popupSpeakingAgentId, sourceText]);

  // Prepare participants for CharacterStrip
  const stripParticipants = initialParticipants.map((p) => ({
    id: p.id,
    avatar: p.avatar,
    name: p.name,
    role: p.role as 'teacher' | 'student' | 'user',
    color: getAgentConfig(p.id)?.color,
    description: getAgentConfig(p.id)?.persona,
  }));

  // Progress calculation
  const progress = ((currentSceneIndex + 1) / scenesCount) * 100;

  if (isPresenting) {
    return (
      <div className="h-0 w-full relative z-10 overflow-visible">
        {/* Fullscreen mode: avatar sidebar hidden, subtitles shown (closable) */}

        <AvatarSpeechPopup
          speakingAgentId={popupSpeakingAgentId}
          sourceText={sourceText}
          participants={stripParticipants}
          dismissed={dismissedSpeaker === popupSpeakingAgentId || isInputOpen || isVoiceOpen || isAskDialogOpen}
          onDismiss={() => setDismissedSpeaker(popupSpeakingAgentId ?? null)}
          container={fullscreenContainerRef?.current}
        />

        {(isInputOpen || isVoiceOpen) && (
          <div
            className="fixed top-0 left-0 right-0 bottom-14 z-[45] pointer-events-auto"
            onClick={() => {
              setIsInputOpen(false);
              setIsVoiceOpen(false);
              cancelRecording();
            }}
          />
        )}

        <AnimatePresence>
          {endFlashVisible && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [10, 0, 0, 6],
                scale: [0.9, 1, 1, 0.95],
              }}
              transition={{
                duration: 1.8,
                times: [0, 0.15, 0.7, 1],
                ease: 'easeOut',
              }}
              className="fixed bottom-20 -translate-x-1/2 z-[50] bg-slate-800/90 backdrop-blur-md text-slate-200 px-3.5 py-1.5 rounded-full text-xs font-medium pointer-events-none"
              style={{
                left: `calc((100vw - ${chatCollapsed === false ? (chatAreaWidth ?? 320) : 0}px) / 2)`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block mr-1.5" />
              {endFlashSessionType === 'discussion'
                ? '讨论已结束'
                : '问答已结束'}
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="fixed bottom-14 left-0 z-[50] flex flex-col items-center justify-center gap-3 pointer-events-none transition-[right] duration-300"
          style={{ right: chatCollapsed === false ? (chatAreaWidth ?? 320) : 0 }}
        >
          <AnimatePresence>
            {isInputOpen && (
              <motion.div
                key="presentation-input-stage"
                initial={{ opacity: 0, scale: 0.95, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.95, y: 15, filter: 'blur(4px)' }}
                className="w-[min(480px,calc(100vw-3rem))] pointer-events-auto"
              >
                <div className="flex items-center gap-3 bg-slate-900/80 dark:bg-black/70 backdrop-blur-xl rounded-full px-4 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10">
                  <div className="flex-1 min-w-0 flex items-center">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={'输入你的消息...'}
                      autoFocus
                      rows={1}
                      className="w-full resize-none bg-transparent border-none focus:ring-0 focus:outline-none outline-none shadow-none ring-0 text-slate-200 text-sm placeholder:text-slate-500 py-0 leading-[40px] max-h-[80px]"
                      style={{ fieldSizing: 'content' } as Record<string, string>}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={isSendCooldown}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0',
                      isSendCooldown
                        ? 'bg-slate-600/50 cursor-not-allowed'
                        : 'bg-violet-600 hover:bg-violet-500 shadow-[0_4px_16px_rgba(139,92,246,0.3)]'
                    )}
                  >
                    {isSendCooldown ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isVoiceOpen && (
              <motion.div
                key="presentation-voice-stage"
                initial={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, y: 20, filter: 'blur(4px)' }}
                className="pointer-events-auto"
              >
                <div className="flex items-center gap-4 bg-slate-900/80 dark:bg-black/70 backdrop-blur-xl rounded-full px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10">
                  <div className="flex items-center gap-0.5 h-8">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [8, 24 + Math.random() * 16, 8] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.5 + i * 0.1,
                          ease: 'easeInOut',
                        }}
                        className="w-1 rounded-full bg-gradient-to-t from-violet-400 to-fuchsia-400"
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold tracking-wider text-violet-400 uppercase">
                    {isProcessing ? '处理中...' : '录音中...'}
                  </span>
                  <button
                    type="button"
                    aria-label={
                      isRecording ? '停止录音' : '开始录音'
                    }
                    className="relative group cursor-pointer bg-transparent border-none p-0"
                    onClick={handleToggleVoice}
                  >
                    <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-700 shadow-[0_4px_20px_rgba(139,92,246,0.3)] flex items-center justify-center group-hover:scale-105 transition-transform duration-300 border border-white/20">
                      <Mic className="w-5 h-5 text-white" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500 opacity-40 animate-[ping_2s_ease-in-out_infinite]" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isCueUser && !bubbleRole && !thinkingState && !isInputOpen && !isVoiceOpen && (
              <motion.div
                key="presentation-cue-user"
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ duration: 0.22, ease: [0.21, 1, 0.36, 1] }}
                className="pointer-events-auto"
              >
                <button
                  onClick={() => (asrEnabled ? handleToggleVoice() : handleToggleInput())}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/80 backdrop-blur-xl border border-amber-500/50 shadow-[0_0_16px_rgba(245,158,11,0.2),0_8px_32px_rgba(0,0,0,0.3)] text-amber-400 text-sm font-semibold tracking-wide hover:bg-slate-800/80 hover:border-amber-400/70 hover:shadow-[0_0_24px_rgba(245,158,11,0.25)] transition-all active:scale-95 animate-pulse"
                >
                  {asrEnabled ? <Mic className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                  {'轮到你发言了'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
          </AnimatePresence>
        </div>

        <div
          className="fixed bottom-5 z-[48] flex flex-col items-end gap-3 pointer-events-none transition-[right] duration-300"
          style={{ right: chatCollapsed ? 20 : 20 + (chatAreaWidth ?? 320) }}
        >
          <PresentationSpeechOverlay
            playbackView={enrichedPlaybackView}
            participants={initialParticipants}
            speakingAgentId={speakingAgentId ?? null}
            isTopicPending={!!isTopicPending}
            userAvatar={userAvatar}
            side="right"
            onBubbleClick={handlePresentationBubbleClick}
            audioIndicatorState={audioIndicatorState ?? 'idle'}
            buttonState={enrichedPlaybackView?.buttonState}
            isPaused={isDiscussionPaused || engineMode === 'paused'}
          />

          <AnimatePresence>
            {showPresentationDock && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="pointer-events-auto"
              >
                <div className="flex items-center gap-2.5 rounded-full bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] px-2.5 py-2">
                  <AnimatePresence>
                    {((activeRole === 'agent' && speakingStudent) || presentationDiscussionParticipant) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, width: 0 }}
                        animate={{ opacity: 1, scale: 1, width: 'auto' }}
                        exit={{ opacity: 0, scale: 0.8, width: 0 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="shrink-0 overflow-hidden"
                      >
                        <div className="relative w-10 h-10 rounded-full flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-2 border-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.3)] transition-all duration-300" />
                          <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden relative z-10 text-lg">
                            <AvatarDisplay
                              src={(speakingStudent || presentationDiscussionParticipant)?.avatar || '/avatars/user.png'}
                              alt={(speakingStudent || presentationDiscussionParticipant)?.name || ''}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isSendCooldown ? (
                    <div className="flex items-center justify-center w-8 h-8">
                      <div className="flex items-center gap-[3px]">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -3, 0], opacity: [0.35, 0.9, 0.35] }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.9,
                              delay: i * 0.12,
                              ease: 'easeInOut',
                            }}
                            className="w-[3px] h-[3px] rounded-full bg-violet-400"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Ask Teacher Button - Most prominent */}
                      <button
                        aria-label={'向老师提问'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDismissedSpeaker(popupSpeakingAgentId ?? null);
                          if (onAskTeacher) {
                            onAskTeacher();
                          } else {
                            handleToggleInput();
                          }
                        }}
                        className={cn(
                          'h-8 px-3 rounded-full flex items-center gap-1.5 transition-all active:scale-95',
                          isInputOpen
                            ? 'bg-sky-500 text-white'
                            : 'bg-gradient-to-r from-sky-500 to-blue-500 text-white hover:from-sky-400 hover:to-blue-400 shadow-[0_4px_16px_rgba(14,165,233,0.4)]'
                        )}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs font-medium">{'提问'}</span>
                      </button>

                      <div className="w-px h-4 bg-white/20" />

                      <button
                        aria-label={asrEnabled ? '语音输入' : '语音输入已禁用'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (asrEnabled) handleToggleVoice();
                        }}
                        disabled={!asrEnabled}
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95',
                          !asrEnabled
                            ? 'text-slate-500 cursor-not-allowed'
                            : isVoiceOpen
                              ? 'bg-violet-600 text-white'
                              : 'text-slate-300 hover:text-white hover:bg-white/10'
                        )}
                      >
                        {asrEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    aria-label={'你'}
                    className="relative group cursor-pointer shrink-0 bg-transparent border-none p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleInput();
                    }}
                  >
                    {/* 用户头像 - 与主页 FloatingUserCard 样式一致 */}
                    <motion.div
                      className="relative"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl overflow-hidden transition-all duration-300',
                          isCueUser
                            ? 'ring-2 ring-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                            : activeRole === 'user' || isInputOpen
                              ? 'ring-2 ring-sky-400'
                              : 'ring-2 ring-slate-400/50 group-hover:ring-sky-400/70'
                        )}
                      >
                        <img
                          src={userProfileAvatar || userAvatar}
                          alt={'你'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </motion.div>
                  </button>
                </div>

                <AnimatePresence>
                  {discussionRequest && (
                    <ProactiveCard
                      action={discussionRequest}
                      mode={engineMode === 'paused' ? 'paused' : 'playback'}
                      anchorRef={discussionAnchorRef}
                      portalContainer={fullscreenContainerRef?.current}
                      align="left"
                      agentName={presentationDiscussionParticipant?.name || presentationDiscussionAgentConfig?.name}
                      agentAvatar={presentationDiscussionParticipant?.avatar || presentationDiscussionAgentConfig?.avatar}
                      agentColor={presentationDiscussionAgentConfig?.color}
                      onSkip={() => onDiscussionSkip?.()}
                      onListen={() => onDiscussionStart?.(discussionRequest)}
                      onTogglePause={() => onPlayPause?.()}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Normal mode - New immersive layout
  return (
    <div className="h-full w-full flex flex-row relative z-10">
      {/* Left: Character Strip with Speech Popup — centered vertically */}
      <div className="w-14 shrink-0 flex flex-col items-center bg-sky-50/60 dark:bg-slate-900/40 backdrop-blur-sm border-r border-sky-200/50 dark:border-white/5 overflow-hidden relative">
        <AvatarSpeechPopup
          speakingAgentId={popupSpeakingAgentId}
          sourceText={sourceText}
          participants={stripParticipants}
          dismissed={dismissedSpeaker === popupSpeakingAgentId || isInputOpen || isVoiceOpen || isAskDialogOpen}
          onDismiss={() => setDismissedSpeaker(popupSpeakingAgentId ?? null)}
          container={fullscreenContainerRef?.current}
        />

        {/* Spacer to push avatars down from top */}
        <div className="flex-1" />

        <CharacterStrip
          participants={stripParticipants}
          speakingId={speakingAgentId}
          thinkingId={thinkingState?.agentId}
          userAvatar={userAvatar}
          isCueUser={isCueUser}
          avatarRefMap={avatarRefMapRef}
          onParticipantClick={(id) => {
            // If subtitle was manually closed → reopen it
            // (hover already shows agent intro via HoverCard — no need to duplicate)
            if (dismissedSpeaker) {
              setDismissedSpeaker(null);
            }
          }}
        />

        {/* Bottom spacer — twice as much to bias toward upper-center */}
        <div className="flex-[2]" />
      </div>

      {/* Center: Main interaction area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Speech bubble area */}
        <div className="flex-1 flex items-center justify-center px-6 py-4">
          <div className="w-full max-w-2xl">
            <AnimatePresence mode="wait">
              {bubbleRole && (
                <motion.div
                  key={bubbleKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{
                    opacity: isInputOpen || isVoiceOpen || isAskDialogOpen ? 0.4 : 1,
                    y: 0,
                    filter: isInputOpen || isVoiceOpen || isAskDialogOpen ? 'blur(1px) grayscale(0.2)' : 'none',
                  }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease: [0.21, 1, 0.36, 1] }}
                  className="w-full"
                >
                  <SpeechBubble
                    text={sourceText}
                    speaker={
                      bubbleRole
                        ? {
                            name: bubbleName,
                            avatar: bubbleAvatar,
                            role: bubbleRole === 'agent' ? 'student' : bubbleRole,
                          }
                        : undefined
                    }
                    isVisible={!!bubbleRole}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state / Cue user / Thinking */}
            {!bubbleRole && (
              <div className="flex items-center justify-center h-32">
                <AnimatePresence>

                  {isCueUser && (
                    <motion.div
                      key="cue-user"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <motion.button
                        onClick={() => (asrEnabled ? handleToggleVoice() : handleToggleInput())}
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="relative w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30"
                      >
                        {asrEnabled ? <Mic className="w-6 h-6 text-white" /> : <MessageSquare className="w-6 h-6 text-white" />}
                        <motion.div
                          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 rounded-full border-2 border-amber-400"
                        />
                      </motion.button>
                      <span className="text-sm text-amber-400 font-medium">{'轮到你发言了'}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="px-6 pb-4">
          <AnimatePresence>
            {isInputOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="relative"
              >
                <div className="flex items-end gap-2 bg-white/80 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl border border-sky-200/50 dark:border-white/10 p-3 shadow-lg">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={'输入你的消息...'}
                    autoFocus
                    rows={1}
                    className="flex-1 resize-none bg-transparent border-none focus:ring-0 focus:outline-none text-slate-700 dark:text-slate-200 text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[40px] max-h-[120px] py-2"
                    style={{ fieldSizing: 'content' } as Record<string, string>}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSendCooldown}
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0',
                      isSendCooldown
                        ? 'bg-sky-300/50 dark:bg-slate-600/50 cursor-not-allowed'
                        : 'bg-sky-500 hover:bg-sky-600 dark:bg-violet-600 dark:hover:bg-violet-500'
                    )}
                  >
                    {isSendCooldown ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {isVoiceOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center justify-center gap-4 py-4"
              >
                <div className="flex items-center gap-0.5 h-10">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [8, 28 + Math.random() * 16, 8] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.4 + i * 0.05,
                        ease: 'easeInOut',
                      }}
                      className="w-1.5 rounded-full bg-gradient-to-t from-sky-400 to-blue-400 dark:from-violet-400 dark:to-fuchsia-400"
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-sky-500 dark:text-violet-400">{isProcessing ? '处理中...' : '录音中...'}</span>
                <button
                  onClick={handleToggleVoice}
                  className="w-12 h-12 rounded-full bg-sky-500 hover:bg-sky-600 dark:bg-violet-600 dark:hover:bg-violet-500 flex items-center justify-center transition-all shadow-lg shadow-sky-500/30 dark:shadow-violet-600/30"
                >
                  <Mic className="w-5 h-5 text-white" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Toolbar */}
        <BottomToolbar
          currentSceneIndex={currentSceneIndex}
          scenesCount={scenesCount}
          engineState={engineMode === 'playing' || engineMode === 'live' ? 'playing' : engineMode === 'paused' ? 'paused' : 'idle'}
          isLiveSession={isStreaming || isTopicPending || engineMode === 'live'}
          whiteboardOpen={whiteboardOpen}
          sidebarCollapsed={sidebarCollapsed}
          chatCollapsed={chatCollapsed}
          onToggleSidebar={onToggleSidebar}
          onToggleChat={onToggleChat}
          onPrevSlide={onPrevSlide ?? (() => {})}
          onNextSlide={onNextSlide ?? (() => {})}
          onPlayPause={onPlayPause ?? (() => {})}
          onWhiteboardClose={onWhiteboardClose ?? (() => {})}
          showStopDiscussion={showStopButton}
          onStopDiscussion={onStopDiscussion}
          isPresenting={isPresenting}
          onTogglePresentation={onTogglePresentation}
          onAskTeacher={() => {
            setDismissedSpeaker(popupSpeakingAgentId ?? null);
            if (onAskTeacher) onAskTeacher();
            else handleToggleInput();
          }}
          ttsEnabled={ttsEnabled}
          ttsMuted={ttsMuted}
          ttsVolume={ttsVolume}
          onToggleMute={() => setTTSMuted(!ttsMuted)}
          onVolumeChange={setTTSVolume}
          playbackSpeed={useSettingsStore.getState().playbackSpeed}
          onCycleSpeed={() => {
            const speeds: Array<1 | 1.25 | 1.5 | 2> = [1, 1.25, 1.5, 2];
            const current = (useSettingsStore.getState().playbackSpeed || 1) as 1 | 1.25 | 1.5 | 2;
            const currentIndex = speeds.indexOf(current);
            const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
            useSettingsStore.getState().setPlaybackSpeed(nextSpeed);
          }}
          autoPlayLecture={useSettingsStore.getState().autoPlayLecture}
          onToggleAutoPlay={() => useSettingsStore.getState().setAutoPlayLecture(!useSettingsStore.getState().autoPlayLecture)}
        />
      </div>
    </div>
  );
}

export default Roundtable;
