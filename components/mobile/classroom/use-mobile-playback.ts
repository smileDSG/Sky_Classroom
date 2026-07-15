'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PlaybackEngine } from '@/lib/playback';
import { ActionEngine } from '@/lib/action/engine';
import { createAudioPlayer } from '@/lib/utils/audio-player';
import { useStageStore } from '@/lib/store';
import { useSettingsStore } from '@/lib/store/settings';
import type { EngineMode } from '@/lib/playback/types';
import type { Scene } from '@/lib/types/stage';

interface TranscriptItem {
  id: string;
  text: string;
  role?: string;
  timestamp: number;
}

interface UseMobilePlaybackReturn {
  mode: EngineMode;
  currentSpeech: string | null;
  transcript: TranscriptItem[];
  isMuted: boolean;
  toggleMute: () => void;
  playPause: () => void;
  stop: () => void;
}

export function useMobilePlayback(scene: Scene | null): UseMobilePlaybackReturn {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const audioPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const actionEngineRef = useRef<ActionEngine | null>(null);

  const [mode, setMode] = useState<EngineMode>('idle');
  const [currentSpeech, setCurrentSpeech] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);

  const ttsMuted = useSettingsStore((s) => s.ttsMuted);
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const setTTSMuted = useSettingsStore((s) => s.setTTSMuted);

  // Ensure audio player volume/speed stay in sync with settings
  useEffect(() => {
    const player = audioPlayerRef.current;
    if (!player) return;
    player.setVolume(ttsMuted ? 0 : ttsVolume);
    player.setPlaybackRate(playbackSpeed);
  }, [ttsMuted, ttsVolume, playbackSpeed]);

  const buildEngine = useCallback(() => {
    if (!scene) return;

    // Cleanup previous engine
    engineRef.current?.stop();
    audioPlayerRef.current?.destroy();
    actionEngineRef.current?.clearEffects();

    const audioPlayer = createAudioPlayer();
    const actionEngine = new ActionEngine(useStageStore, audioPlayer);
    audioPlayer.setVolume(ttsMuted ? 0 : ttsVolume);
    audioPlayer.setPlaybackRate(playbackSpeed);

    actionEngineRef.current = actionEngine;
    audioPlayerRef.current = audioPlayer;

    const engine = new PlaybackEngine(
      [scene],
      actionEngine,
      audioPlayer,
      {
        onModeChange: (next) => setMode(next),
        onSpeechStart: (text) => {
          setCurrentSpeech(text);
          setTranscript((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, text, timestamp: Date.now() },
          ]);
        },
        onSpeechEnd: () => setCurrentSpeech(null),
        onTopicAppend: (role, text) => {
          setTranscript((prev) => [
            ...prev,
            { id: `${Date.now()}-${Math.random()}`, text, role, timestamp: Date.now() },
          ]);
        },
        onComplete: () => setCurrentSpeech(null),
      },
    );

    engineRef.current = engine;
    setMode('idle');
    setCurrentSpeech(null);
  }, [scene, ttsMuted, ttsVolume, playbackSpeed]);

  // Rebuild engine when scene changes
  useEffect(() => {
    setTranscript([]);
    buildEngine();
    return () => {
      engineRef.current?.stop();
      audioPlayerRef.current?.destroy();
      actionEngineRef.current?.clearEffects();
    };
  }, [buildEngine]);

  const playPause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const currentMode = engine.getMode();
    if (currentMode === 'idle') {
      engine.start();
    } else if (currentMode === 'playing') {
      engine.pause();
    } else if (currentMode === 'paused') {
      engine.resume();
    }
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const toggleMute = useCallback(() => {
    setTTSMuted(!ttsMuted);
  }, [ttsMuted, setTTSMuted]);

  return {
    mode,
    currentSpeech,
    transcript,
    isMuted: ttsMuted,
    toggleMute,
    playPause,
    stop,
  };
}
