/**
 * 受挫信号检测（T04 / FR-04）。
 *
 * 纯函数：课堂运行时在检测到"作答错误 / 停留超时 / 用户语气受挫"时调用，
 * 输出 FrustrationSignal 供 teacher 系统注入共情兜底、并写入 emotion 记忆。
 * 不依赖任何外部状态，便于单测与复用。
 */

export type FrustrationTrigger =
  | { kind: 'wrong-answer'; knowledgePoint?: string }
  | { kind: 'dwelling-timeout'; dwellMs: number; thresholdMs: number; knowledgePoint?: string }
  | { kind: 'user-tone'; negative: boolean; knowledgePoint?: string };

export type FrustrationLevel = 'none' | 'low' | 'high';

export interface FrustrationSignal {
  level: FrustrationLevel;
  /** 关联知识点（若有） */
  knowledgePoint?: string;
  /** 人类可读的触发原因（用于调试 & 兜底语料选择，不含判定词） */
  reason: string;
}

/**
 * 检测受挫信号。
 * - 作答错误：low（单次错题不必然受挫，但值得温柔接住）
 * - 停留超时：high（明显卡壳）
 * - 用户语气负面：high
 */
export function detectFrustration(trigger: FrustrationTrigger): FrustrationSignal {
  switch (trigger.kind) {
    case 'wrong-answer':
      return {
        level: 'low',
        knowledgePoint: trigger.knowledgePoint,
        reason: '作答与预期不符',
      };
    case 'dwelling-timeout':
      return {
        level: trigger.dwellMs >= trigger.thresholdMs ? 'high' : 'low',
        knowledgePoint: trigger.knowledgePoint,
        reason:
          trigger.dwellMs >= trigger.thresholdMs
            ? '单页停留明显超时'
            : '单页停留偏长',
      };
    case 'user-tone':
      return {
        level: trigger.negative ? 'high' : 'none',
        knowledgePoint: trigger.knowledgePoint,
        reason: trigger.negative ? '用户语气显受挫' : '语气平和',
      };
    default:
      return { level: 'none', reason: '无受挫信号' };
  }
}
