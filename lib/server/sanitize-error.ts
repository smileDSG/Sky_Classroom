/**
 * 分级错误脱敏：区分「可展示给用户的操作性信息」与「内部诊断痕迹」。
 *
 * 规则：
 * - 空值 / 堆栈痕迹 / 文件路径+行列 / 疑似密钥 / 超长转储 -> 固定通用文案；
 * - 其余短路到 raw（多为可直接提示用户的操作性错误，如「额度用尽」「上游超时」）。
 *
 * 服务端日志请勿走本函数，否则丢失排障信息；本函数仅用于写入 API 响应的 message。
 */

const GENERIC_MESSAGE = '服务暂时不可用，请稍后重试';

const INTERNAL_MARKER =
  /(\\\\|\/)[^\\\\\/\s]{1,80}\.[a-zA-Z]{1,10}(:\d+)?|\bat\s+[A-Za-z]|^typeerror|^referenceerror|^rangeerror|^syntaxerror|^error:|@-?\d+|(api[_-]?key|secret|password|client[_-]?secret|token|authorization)[=:]|^\[object|:\s*\{(?:\s*"[^"]+":)/i;

function rawMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error != null && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    return typeof m === 'string' ? m : '';
  }
  return '';
}

export function safeErrorMessage(error: unknown, fallback = GENERIC_MESSAGE): string {
  const msg = rawMessage(error).trim();
  if (!msg) return fallback;
  if (msg.length > 300) return fallback;
  if (INTERNAL_MARKER.test(msg)) return fallback;
  return msg;
}