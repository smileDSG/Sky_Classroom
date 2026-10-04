import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSpeechSynthesisAvailable, speak } from '@/lib/animation/playback/speech';

/** jsdom 不实现 Web Speech API：用最小 stub 模拟 SpeechSynthesis 与 Utterance。 */
class FakeUtterance {
  lang = '';
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function stubSpeechSynthesis() {
  const synth = { speak: vi.fn(), cancel: vi.fn() };
  let utterance: FakeUtterance | undefined;
  synth.speak.mockImplementation((u: FakeUtterance) => {
    utterance = u;
  });
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return { synth, current: () => utterance };
}

describe('speak (browser TTS adapter)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('无 speechSynthesis 时按估算时长 resolve', async () => {
    // 前置条件：jsdom 默认无 speechSynthesis
    expect(isSpeechSynthesisAvailable()).toBe(false);
    vi.useFakeTimers();
    let resolved = false;
    const p = speak('一二三四五').then(() => {
      resolved = true;
    });
    // 估算 5 * 150 = 750ms：未到点不 resolve
    await vi.advanceTimersByTimeAsync(749);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(resolved).toBe(true);
  });

  it('delay 路径中途 abort 提前 resolve 并清理定时器', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let resolved = false;
    const p = speak('一二三四五', { signal: controller.signal }).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);
    controller.abort();
    await p;
    expect(resolved).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('预中止的 signal 立即 resolve，不启动定时器', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();
    let resolved = false;
    const p = speak('一二三四五', { signal: controller.signal }).then(() => {
      resolved = true;
    });
    // 不推进任何定时器，仅冲刷微任务即应 resolve
    await Promise.resolve();
    await p;
    expect(resolved).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('TTS 路径：onend resolve 并清除兜底定时器', async () => {
    vi.useFakeTimers();
    const { synth, current } = stubSpeechSynthesis();
    const p = speak('hello world');
    expect(synth.speak).toHaveBeenCalledOnce();
    const utterance = current();
    expect(utterance).toBeDefined();
    expect(utterance!.lang).toBe('en-US');
    expect(utterance!.rate).toBe(1);
    expect(vi.getTimerCount()).toBe(1); // 兜底定时器挂起
    utterance!.onend!();
    await p;
    expect(vi.getTimerCount()).toBe(0); // onend 清除了兜底定时器
  });

  it('TTS 路径：abort 与 onend 竞态仅结算一次', async () => {
    vi.useFakeTimers();
    const { synth, current } = stubSpeechSynthesis();
    const controller = new AbortController();
    let resolvedCount = 0;
    const p = speak('hello', { signal: controller.signal });
    void p.then(() => {
      resolvedCount++;
    });
    controller.abort(); // 同步触发 onAbort → synth.cancel + finish
    expect(synth.cancel).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0); // abort 本身即清除兜底定时器（finish 内统一清理）
    current()!.onend!(); // 竞态：abort 之后的 onend 必须为 no-op
    await p;
    expect(resolvedCount).toBe(1);
    expect(vi.getTimerCount()).toBe(0); // abort 已清除兜底定时器
  });
});
