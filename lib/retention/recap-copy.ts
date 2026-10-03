/**
 * 回访态话术库（T06 / PRD §6）。
 *
 * 两件事：
 * 1. 存定稿话术模板（§6.1，一字不改；变量由 recap-line.ts 用真实数据填）
 * 2. 语气红线机器门禁（§6.3，R-A…R-H），CI 与单测共用同一份规则表
 *
 * 硬约束：本文件是**纯数据 + 纯函数**，零 IO、零 `new Date()`。
 */

import type { RecapCopyVariant, RecapState } from './types';

// ── 常量 ────────────────────────────────────────────────────────────

/** 话术里 『X』 的汉字上限；完整名留给记忆块（PRD §6.2）。 */
export const RECAP_POINT_MAX_HAN = 8;

/** R-H：单句汉字上限（超出即不合格）。 */
export const RECAP_MAX_HAN = 24;

/** 巩固阈值：掌握度 >= 此值时 S-1 换成陈述句，不再说"练到 80%"（PRD Q-2）。 */
export const RECONSOLIDATE_THRESHOLD = 80;

/** 话术模板里允许出现的占位变量，供填充函数与单测对账。 */
export const RECAP_TEMPLATE_VARS = ['point', 'mastery', 'gap', 'gapLabel', 'gapBreakLabel', 'date'] as const;

// ── 红线规则表（PRD §6.3，八条） ────────────────────────────────────

export interface RedlineRule {
  /** 规则号，如 'R-A' */
  rule: string;
  /** 人读的说明 */
  label: string;
  /** 禁用词；命中即判不合格 */
  words: string[];
  /** 禁用正则；用于纯词表盖不住的模式（如感叹号、`前\d+天`） */
  patterns?: RegExp[];
}

/**
 * 八条语气红线。
 * 顺序即 assertRedline 的输出顺序，单测据此断言"命中的是哪几条"。
 */
export const RECAP_FORBIDDEN_PATTERNS: RedlineRule[] = [
  {
    rule: 'R-A',
    label: '无催促',
    words: ['快', '赶紧', '抓紧', '马上', '现在就', '别再', '还剩', '只剩', '倒计时', '截止'],
  },
  {
    rule: 'R-B',
    label: '无负罪感',
    words: ['欠', '漏', '浪费', '白费', '放弃', '可惜', '你已经断了'],
    // 「你已经 9 天没学了」「你已经断了 3 天」这类中间隔了数字的变体。
    // 必须带间隔容差：写成 /你已经(没|断)/ 会漏掉"你已经 9 天没学了"这种。
    patterns: [/你已经.{0,12}(没|断)/],
  },
  {
    rule: 'R-C',
    label: '无时间压力',
    words: ['今日之内', '最后机会', '分钟倒计时'],
    patterns: [/前\d+天/g, /今天之内/g],
  },
  {
    rule: 'R-D',
    label: '无客人式招呼',
    words: ['欢迎回来', '您好', '您', '贵客'],
  },
  {
    rule: 'R-E',
    label: '无夸赞/打气',
    words: ['真棒', '厉害', '加油', '很棒', '太强', '继续冲'],
    patterns: [/[!！]/g],
  },
  {
    rule: 'R-F',
    label: '无"我盯着你"',
    words: ['我发现你', '你总是', '系统检测到', '你上次一定', '猜你'],
  },
  {
    rule: 'R-G',
    label: '无奖励机制话术',
    words: ['解锁', '获得', '奖励', '徽章', '排行', 'PK'],
  },
  {
    rule: 'R-H',
    label: `长度 ≤ ${RECAP_MAX_HAN} 个汉字`,
    // 长度单独在 assertRedline 里判（依赖 countHan），不进词表。
    words: [],
  },
];

// ── 定稿话术表（PRD §6.1，选定句一字不改） ──────────────────────────

export interface RecapCopyEntry {
  /** 默认模板；变量用 {point}/{mastery}/{gap}/{gapLabel}/{gapBreakLabel}/{date} 占位 */
  template: string;
  /** 掌握度已达 RECONSOLIDATE_THRESHOLD 时的替换模板；未达阈值不使用 */
  masteredTemplate?: string;
}

export type RecapCopyKey = Extract<RecapState, 'S-1' | 'S-2' | 'S-3' | 'S-4'>;

/** 四档 × variant 的选定句。 */
export const RECAP_COPY_TABLE: Record<RecapCopyKey, Record<RecapCopyVariant, RecapCopyEntry>> = {
  // A1：主语是用户昨天真实做过的事；目标量化（80%）且够得着，不用感叹、不夸人
  'S-1': {
    B1: {
      template: '昨天你补上了『{point}』，今天把它练到 80% 就行。',
      // 已达巩固阈值：不再追着要"练到 80%"，改陈述事实（PRD §6.2）
      masteredTemplate: '『{point}』你已经练到 {mastery}%，今天顺手巩固一下。',
    },
    // 灰度位与 B1 同句（PRD 只在 S-2 留了 B1/B2 对照组），阈值分支也同
    B2: {
      template: '昨天你补上了『{point}』，今天把它练到 80% 就行。',
      masteredTemplate: '『{point}』你已经练到 {mastery}%，今天顺手巩固一下。',
    },
  },
  // B1 主选 / B2 备选（PRD §6.1 标 ⚪）
  'S-2': {
    B1: { template: '{gapLabel}今天不用补，做 1 件小事就能接上。' },
    B2: { template: '{gapBreakLabel}今天做 1 件事就能接上。' },
  },
  // C1：唯一动作 1 道，把"连续"定义成从今天开始，零承诺零压力
  'S-3': {
    B1: { template: '今天先做一道题，连续学习就从这开始。' },
    B2: { template: '今天先做一道题，连续学习就从这开始。' },
  },
  // D1：只陈述位置（不是欠账），把决定权交给用户，不做祈使句
  'S-4': {
    B1: { template: '上次学到『{point}』，就到这儿。今天想接着来，点一下就行。' },
    B2: { template: '上次学到『{point}』，就到这儿。今天想接着来，点一下就行。' },
  },
};

/** S-3 通用句：至少 H 清空、字段缺失、记忆开关关闭时一律退回这一句。 */
export const RECAP_GENERIC_LINE = '今天先做一道题，连续学习就从这开始。';

/**
 * S-4 无薄弱点时的退化句（PRD §5：无记录 → 只说日期，**不外推知识点**）。
 * 与 D1 同一句式，只把 『X』 换成真实 lastActiveDate。
 */
export const RECAP_S4_DATE_LINE = '上次学到 {date}，就到这儿。今天想接着来，点一下就行。';

// ── 汉字计数与截断（R-H / 『X』截断） ────────────────────────────────

/** 只数汉字（CJK 基本区）。数字、字母、标点均不计。 */
export function countHan(text: string): number {
  if (typeof text !== 'string' || text.length === 0) return 0;
  const matched = text.match(/[\u4e00-\u9fa5]/g);
  return matched ? matched.length : 0;
}

/**
 * 按**汉字数**截断（不是字符数）：超长追加 '…'。
 * 用于话术里的 『X』（界面不超过 8 字，完整名留给记忆块）。
 *
 * @param text 原文
 * @param maxHan 汉字上限
 */
export function clampToHan(text: string, maxHan: number): string {
  if (typeof text !== 'string' || text.length === 0) return '';
  if (maxHan <= 0) return '';
  const chars = Array.from(text);
  if (countHan(text) <= maxHan) return text;
  let out = '';
  let used = 0;
  for (const ch of chars) {
    if (/[\u4e00-\u9fa5]/.test(ch)) {
      if (used >= maxHan) break;
      used += 1;
    }
    out += ch;
  }
  return `${out}…`;
}

// ── 红线门禁 ────────────────────────────────────────────────────────

/**
 * 抹掉变量占位后的骨架，供 R-H 计数。
 *
 * PRD §6.3 R-H 原话：「单句 ≤ 24 个汉字（**不含变量占位**）」。
 * 变量内容另由 RECAP_POINT_MAX_HAN=8 单独兜底——否则"上次学到『二次函数对称轴与顶点式的辨析』"
 * 会因为知识点名长就被判不合格，而这话术本身并没有超长。
 */
function stripVariables(text: string): string {
  return text.replace(/『[^』]*』/g, '').replace(/\{[^{}]*\}/g, '');
}

/**
 * 扫描一句文案，返回命中的规则号数组（空数组 = 干净）。
 * 长度规则 R-H 用 countHan 判，不依赖词表。
 *
 * @param text 待校验文案（渲染后的完整句子）
 */
export function assertRedline(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const hit: string[] = [];
  for (const rule of RECAP_FORBIDDEN_PATTERNS) {
    const wordsHit = rule.words.some((w) => text.includes(w));
    const patternHit = (rule.patterns ?? []).some((re) => re.test(text));
    if (wordsHit || patternHit) hit.push(rule.rule);
  }
  if (countHan(stripVariables(text)) > RECAP_MAX_HAN) hit.push('R-H');
  return hit;
}

/** 一句文案是否干净（assertRedline 的布尔糖）。 */
export function isRedlineFree(text: string): boolean {
  return assertRedline(text).length === 0;
}

/** 取某档 × 某 variant 的模板（含掌握度已达阈值时的替换模板）。 */
export function getCopyEntry(state: RecapCopyKey, variant: RecapCopyVariant): RecapCopyEntry {
  const table = RECAP_COPY_TABLE[state];
  const entry = table ? table[variant] : undefined;
  // variant 传错（将来加了 B3）时退到 B1，而不是让首屏没话。
  return entry && entry.template ? entry : table.B1;
}
