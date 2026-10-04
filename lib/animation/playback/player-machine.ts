/** 播放状态机（纯函数，spec §5）。UI 层（useAnimationPlayer）负责副作用。 */

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'finished';

export type PlayerEvent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'seek'; index: number }
  | { type: 'speed'; value: number }
  /** 当前步旁白播放完毕 → 推进 */
  | { type: 'ended' };

export interface PlayerState {
  status: PlayerStatus;
  stepIndex: number;
  speed: number;
  totalSteps: number;
}

export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5] as const;

export function initialPlayerState(totalSteps: number): PlayerState {
  return { status: 'idle', stepIndex: 0, speed: 1, totalSteps };
}

function isLast(s: PlayerState): boolean {
  return s.stepIndex >= s.totalSteps - 1;
}

export function reducePlayer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'play':
      // finished 后重播从头开始
      if (state.status === 'finished') {
        return { ...state, status: 'playing', stepIndex: 0 };
      }
      return { ...state, status: 'playing' };
    case 'pause':
      return { ...state, status: 'paused' };
    case 'next': {
      if (isLast(state)) return { ...state, status: 'finished' };
      return { ...state, stepIndex: state.stepIndex + 1, status: 'paused' };
    }
    case 'prev':
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1), status: 'paused' };
    case 'seek':
      return {
        ...state,
        stepIndex: Math.max(0, Math.min(event.index, state.totalSteps - 1)),
        status: 'paused',
      };
    case 'speed':
      return { ...state, speed: event.value };
    case 'ended': {
      if (state.status !== 'playing') return state;
      if (isLast(state)) return { ...state, status: 'finished' };
      return { ...state, stepIndex: state.stepIndex + 1 };
    }
    default:
      return state;
  }
}
