/**
 * 浏览器 TTS 适配器（spec §5：v1 用 SpeechSynthesis，接口留出后续接
 * 服务端 TTS 的空间）。speak 返回的 Promise 在朗读结束/失败时 resolve；
 * 无 TTS 环境回退为阅读时长定时器。
 */
import { estimateSpeechDurationMs } from './duration';

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
  const speed = opts.speed ?? 1;
  if (!isSpeechSynthesisAvailable()) {
    await delay(estimateSpeechDurationMs(text, speed), opts.signal);
    return;
  }
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length > text.length * 0.3;
    utterance.lang = cjk ? 'zh-CN' : 'en-US';
    utterance.rate = speed;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        opts.signal?.removeEventListener('abort', onAbort);
        resolve();
      }
    };
    const onAbort = () => {
      synth.cancel();
      finish();
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    // 某些浏览器 end 事件不触发：以估算时长 + 2s 兜底
    const fallback = setTimeout(finish, estimateSpeechDurationMs(text, speed) + 2000);
    utterance.onend = () => {
      clearTimeout(fallback);
      finish();
    };
    utterance.onerror = () => {
      clearTimeout(fallback);
      finish();
    };
    synth.speak(utterance);
  });
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
