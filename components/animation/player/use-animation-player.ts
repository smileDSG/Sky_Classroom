'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  initialPlayerState,
  reducePlayer,
  SPEED_OPTIONS,
} from '@/lib/animation/playback/player-machine';
import { speak, cancelSpeech } from '@/lib/animation/playback/speech';
import type { AnimationScript } from '@/lib/animation/types';

export type UseAnimationPlayerReturn = ReturnType<typeof useAnimationPlayer>;

/**
 * 播放 hook（spec §5）：playing 状态下朗读当前步旁白，结束后由
 * reducePlayer({type:'ended'}) 推进。seek/next/prev 会中断当前朗读
 * （effect cleanup abort）。倍速变更会重读当前步（v1 接受的行为）。
 */
export function useAnimationPlayer(script: AnimationScript) {
  const [state, dispatch] = useReducer(reducePlayer, script.steps.length, initialPlayerState);
  const abortRef = useRef<AbortController | null>(null);

  const currentStep = script.steps[Math.min(state.stepIndex, script.steps.length - 1)];

  useEffect(() => {
    if (state.status !== 'playing') return;
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;
    (async () => {
      await speak(currentStep.narration, { speed: state.speed, signal: controller.signal });
      if (!cancelled) dispatch({ type: 'ended' });
    })();
    return () => {
      cancelled = true;
      controller.abort();
      if (abortRef.current === controller) abortRef.current = null;
    };
  }, [state.status, state.stepIndex, state.speed, currentStep.narration]);

  useEffect(() => () => cancelSpeech(), []);

  const toggle = useCallback(() => {
    dispatch({ type: state.status === 'playing' ? 'pause' : 'play' });
  }, [state.status]);

  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const prev = useCallback(() => dispatch({ type: 'prev' }), []);
  const seek = useCallback((index: number) => dispatch({ type: 'seek', index }), []);
  const setSpeed = useCallback((value: number) => dispatch({ type: 'speed', value }), []);

  return {
    status: state.status,
    stepIndex: state.stepIndex,
    speed: state.speed,
    totalSteps: script.steps.length,
    currentStep,
    speedOptions: SPEED_OPTIONS,
    toggle,
    next,
    prev,
    seek,
    setSpeed,
  };
}
