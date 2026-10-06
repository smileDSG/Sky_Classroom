import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const speakMock = vi.fn(async () => {});
vi.mock('@/lib/animation/playback/speech', () => ({
  speak: (...args: unknown[]) => speakMock(...(args as [])),
  cancelSpeech: vi.fn(),
  isSpeechSynthesisAvailable: vi.fn(() => false),
}));

import { useAnimationPlayer } from '@/components/animation/player/use-animation-player';
import type { AnimationScript } from '@/lib/animation/types';

const script: AnimationScript = {
  id: 's',
  title: 't',
  topic: 'tp',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [],
  steps: [
    { id: 's1', title: '一', narration: '第一句', actorStates: [{ actorId: 'x', x: 1, y: 1 }] },
    { id: 's2', title: '二', narration: '第二句', actorStates: [{ actorId: 'x', x: 2, y: 2 }] },
    { id: 's3', title: '三', narration: '第三句', actorStates: [{ actorId: 'x', x: 3, y: 3 }] },
  ],
};

describe('useAnimationPlayer', () => {
  beforeEach(() => {
    speakMock.mockReset().mockImplementation(async () => {});
  });

  it('初始 idle，play 后 playing 且朗读第一步', async () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    expect(result.current.status).toBe('idle');
    act(() => result.current.toggle());
    expect(result.current.status).toBe('playing');
    await act(async () => {});
    expect(speakMock).toHaveBeenCalledWith('第一句', expect.anything());
  });

  it('朗读结束后自动推进；最后一步结束后 finished', async () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    // speak 立即 resolve 时单次 act 会级联推进多步，这里手动控制每步的完成时机
    let resolveCurrent!: () => void;
    speakMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCurrent = resolve;
        }),
    );
    act(() => result.current.toggle());
    await act(async () => {
      resolveCurrent();
    }); // step1 speak 完成 → 推进
    expect(result.current.stepIndex).toBe(1);
    await act(async () => {
      resolveCurrent();
    });
    await act(async () => {
      resolveCurrent();
    });
    expect(result.current.status).toBe('finished');
  });

  it('seek 回溯并暂停；再次 play 重新朗读当前步', async () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    act(() => result.current.toggle());
    await act(async () => {});
    act(() => result.current.seek(0));
    expect(result.current).toMatchObject({ status: 'paused', stepIndex: 0 });
    speakMock.mockClear();
    act(() => result.current.toggle());
    await act(async () => {});
    expect(speakMock).toHaveBeenCalledWith('第一句', expect.anything());
  });

  it('setSpeed 调整倍速', () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    act(() => result.current.setSpeed(1.5));
    expect(result.current.speed).toBe(1.5);
  });
});
