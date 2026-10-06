/**
 * 浏览器 TTS 适配器（spec §5：v1 用 SpeechSynthesis，接口留出后续接
 * 服务端 TTS 的空间）。speak 返回的 Promise 在朗读结束/失败时 resolve；
 * 无 TTS 环境回退为阅读时长定时器。
 */
import { estimateSpeechDurationMs, isCJKDominant } from './duration';

export interface SpeakOptions {
  speed?: number;
  signal?: AbortSignal;
}

export function isSpeechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function cancelSpeech(): void {
  if (isSpeechSynthesisAvailable()) window.speechSynthesis.cancel();
}

export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  // 已中止的 signal：立即返回，避免启动无法取消的朗读/定时器
  if (opts.signal?.aborted) return;
  const speed = opts.speed ?? 1;
  if (!isSpeechSynthesisAvailable()) {
    await delay(estimateSpeechDurationMs(text, speed), opts.signal);
    return;
  }
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isCJKDominant(text) ? 'zh-CN' : 'en-US';
    utterance.rate = speed;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      opts.signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const onAbort = () => {
      synth.cancel();
      finish();
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    // 某些浏览器 end 事件不触发：以估算时长 + 2s 兜底
    const fallback = setTimeout(finish, estimateSpeechDurationMs(text, speed) + 2000);
    utterance.onend = () => finish();
    utterance.onerror = () => finish();
    synth.speak(utterance);
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
