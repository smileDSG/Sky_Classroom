import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const speakMock = vi.fn(async () => {});
const cancelSpeechMock = vi.fn();
vi.mock('@/lib/animation/playback/speech', () => ({
  speak: (...args: unknown[]) => speakMock(...(args as [])),
  cancelSpeech: (...args: unknown[]) => cancelSpeechMock(...(args as [])),
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
    cancelSpeechMock.mockClear();
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

  it('卸载时调用 cancelSpeech 取消朗读', async () => {
    const { result, unmount } = renderHook(() => useAnimationPlayer(script));
    let resolveCurrent!: () => void;
    speakMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCurrent = resolve;
        }),
    );
    act(() => result.current.toggle());
    expect(result.current.status).toBe('playing');
    expect(cancelSpeechMock).not.toHaveBeenCalled();
    unmount();
    expect(cancelSpeechMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCurrent();
    });
    expect(result.current.stepIndex).toBe(0); // 卸载后不推进
  });

  it('pause 中断朗读；中断后的完成不推进，重新 play 重读当前步', async () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    let resolveCurrent!: () => void;
    speakMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCurrent = resolve;
        }),
    );
    act(() => result.current.toggle());
    expect(speakMock).toHaveBeenCalledTimes(1);
    act(() => result.current.toggle()); // 中途暂停
    expect(result.current.status).toBe('paused');
    await act(async () => {
      resolveCurrent(); // 被打断的朗读此时才结束
    });
    expect(result.current.stepIndex).toBe(0);
    act(() => result.current.toggle());
    expect(result.current.status).toBe('playing');
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(speakMock).toHaveBeenLastCalledWith('第一句', expect.anything());
  });

  it('playing 中 seek 到同一步为 no-op：不重读、状态不变', () => {
    const { result } = renderHook(() => useAnimationPlayer(script));
    speakMock.mockImplementation(() => new Promise<void>(() => {}));
    act(() => result.current.toggle());
    act(() => result.current.seek(0)); // 与当前 stepIndex 相同
    expect(result.current).toMatchObject({ status: 'playing', stepIndex: 0 });
    expect(speakMock).toHaveBeenCalledTimes(1);
  });

  it('挂载后替换为不同步数的脚本：reducer 边界冻结于挂载脚本，页面须以 key 重新挂载', () => {
    // 不变式（源自播放页 C1 缺陷）：useReducer 的 init 只在首次挂载执行，步数边界
    // 来自「挂载时传入的脚本」。之后即使脚本 prop 替换，hook 返回的 totalSteps 虽
    // 反映新脚本（UI 计数显示正确），但 next/seek/ended 全部按旧边界钳制——表现为
    // 多步播放失效（next 直接 finished、seek 被钳回 0）。
    // 因此使用本 hook 的页面必须在脚本就绪后才挂载，并以 key={script.id} 强制重挂载
    // （见 app/sky/animation/[scriptId]/page.tsx 的 PlayerView）。
    const oneStepScript: AnimationScript = { ...script, id: 'one-step', steps: [script.steps[0]] };
    const { result, rerender } = renderHook((s: AnimationScript) => useAnimationPlayer(s), {
      initialProps: oneStepScript,
    });
    rerender(script);
    expect(result.current.totalSteps).toBe(3); // 返回值已反映新脚本（掩盖问题的表象）
    act(() => result.current.next()); // reducer 仍按挂载时的 1 步钳制 → 直接 finished
    expect(result.current).toMatchObject({ status: 'finished', stepIndex: 0 });
    act(() => result.current.seek(2)); // 越界 seek 被钳回 0
    expect(result.current.stepIndex).toBe(0);
  });
});
