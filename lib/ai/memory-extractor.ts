/**
 * GAM-style Memory Extractor
 *
 * Extracts structured memories from conversations using heuristic rules.
 * Supports extracting: core facts, preferences, learning progress, questions, decisions.
 *
 * Future: Can be upgraded to use LLM-based extraction for higher quality.
 */

import { createLogger } from '@/lib/logger';
import type { MemoryType } from '@/lib/storage/dao/agent-memory';

const log = createLogger('MemoryExtractor');

// ── Types ─────────────────────────────────────────────────────────

export interface ExtractedMemory {
  type: MemoryType;
  category: string;
  content: string;
  importance: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ── Pattern-based extraction rules ────────────────────────────────

/** Patterns that indicate a user preference */
const PREFERENCE_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /我喜欢|我偏好|我更(?:喜欢|倾向)|我习惯/i, category: '学习偏好' },
  { pattern: /我不喜欢|我不太|我不太会|我不擅长/i, category: '学习偏好' },
  { pattern: /(?:用|用不)惯|太(?:难|简单|快|慢|长|短)|能不能(?:再|更)/i, category: '学习偏好' },
  { pattern: /希望|想要|能不能|可以不可以/i, category: '学习偏好' },
];

/** Patterns that indicate learning progress */
const PROGRESS_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /我(?:终于|已经|现在)(?:懂|理解|掌握|学会|会了)/i, category: '学习进度' },
  { pattern: /我(?:还是|还)不(?:太|太会|懂|理解|会)/i, category: '学习进度' },
  { pattern: /我(?:搞|弄|想)明白|豁然开朗|原来如此/i, category: '学习进度' },
  { pattern: /还是(?:不太|没|不)(?:懂|理解|会)/i, category: '学习进度' },
];

/** Patterns that indicate a factual statement about the user */
const FACT_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /我是(?:初|高|大)(?:中|学|生)/i, category: '个人信息' },
  { pattern: /我(?:在|正|准备)(?:学|复习|备考|准备)/i, category: '学习状态' },
  { pattern: /我(?:的|有)(?:考试|测验|作业|考试)/i, category: '学习状态' },
  { pattern: /下次(?:考试|测验|作业)/i, category: '学习状态' },
  {
    pattern: /我(?:的)?(?:数学|语文|英语|物理|化学|生物|历史|地理|政治)(?:成绩|分数|水平)/i,
    category: '学科水平',
  },
];

/** Patterns that indicate a decision */
const DECISION_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /我(?:决定|打算|准备|计划)/i, category: '学习计划' },
  { pattern: /那(?:就|我)(?:先|开始|继续)/i, category: '学习计划' },
];

// ── Core extraction logic ─────────────────────────────────────────

/** Extract memories from a conversation using pattern matching */
export function extractMemoriesFromConversation(
  messages: ConversationMessage[],
): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== 'user') continue;

    // Extract preferences
    for (const { pattern, category } of PREFERENCE_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match) {
        const content = extractSentence(msg.content, match.index!);
        const key = `preference:${content}`;
        if (!seen.has(key)) {
          seen.add(key);
          memories.push({
            type: 'preference',
            category,
            content,
            importance: 0.7,
          });
        }
      }
    }

    // Extract progress
    for (const { pattern, category } of PROGRESS_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match) {
        const content = extractSentence(msg.content, match.index!);
        const key = `progress:${content}`;
        if (!seen.has(key)) {
          seen.add(key);
          memories.push({
            type: 'progress',
            category,
            content,
            importance: 0.8,
          });
        }
      }
    }

    // Extract facts
    for (const { pattern, category } of FACT_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match) {
        const content = extractSentence(msg.content, match.index!);
        const key = `fact:${content}`;
        if (!seen.has(key)) {
          seen.add(key);
          memories.push({
            type: 'fact',
            category,
            content,
            importance: 0.6,
          });
        }
      }
    }

    // Extract decisions
    for (const { pattern, category } of DECISION_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match) {
        const content = extractSentence(msg.content, match.index!);
        const key = `decision:${content}`;
        if (!seen.has(key)) {
          seen.add(key);
          memories.push({
            type: 'decision',
            category,
            content,
            importance: 0.75,
          });
        }
      }
    }

    // Extract questions as potential recurring topics
    const questionMatch = msg.content.match(/^(.{2,40}[？?])/);
    if (questionMatch) {
      const content = questionMatch[1];
      const key = `question:${content}`;
      if (!seen.has(key)) {
        seen.add(key);
        memories.push({
          type: 'question',
          category: '学习疑问',
          content,
          importance: 0.5,
        });
      }
    }
  }

  // Deduplicate similar memories
  return deduplicateMemories(memories);
}

/** Extract the sentence containing the match */
function extractSentence(text: string, matchIndex: number): string {
  // Find sentence boundaries (Chinese/English punctuation)
  const sentenceStart =
    text.slice(0, matchIndex).lastIndexOf('。') + 1 ||
    text.slice(0, matchIndex).lastIndexOf('！') + 1 ||
    text.slice(0, matchIndex).lastIndexOf('？') + 1 ||
    text.slice(0, matchIndex).lastIndexOf('\n') + 1 ||
    0;

  const remaining = text.slice(matchIndex);
  const sentenceEndMatch = remaining.match(/[。！？\n]/);
  const sentenceEnd = sentenceEndMatch
    ? matchIndex + (sentenceEndMatch.index ?? 0) + 1
    : text.length;

  return text.slice(Math.max(0, sentenceStart), Math.min(text.length, sentenceEnd)).trim();
}

/** Remove near-duplicate memories */
function deduplicateMemories(memories: ExtractedMemory[]): ExtractedMemory[] {
  const result: ExtractedMemory[] = [];
  for (const mem of memories) {
    const isDuplicate = result.some(
      (existing) =>
        existing.type === mem.type &&
        (existing.content.includes(mem.content) || mem.content.includes(existing.content)),
    );
    if (!isDuplicate) {
      result.push(mem);
    }
  }
  return result;
}

// ── Topic-based extraction ────────────────────────────────────────

/** Detect the main subject/topic of a conversation */
export function detectConversationTopic(messages: ConversationMessage[]): string {
  const subjectKeywords: Record<string, string[]> = {
    数学: [
      '函数',
      '方程',
      '几何',
      '概率',
      '微积分',
      '导数',
      '积分',
      '矩阵',
      '向量',
      '三角',
      '代数',
      '数学',
      '计算',
      '证明',
    ],
    物理: [
      '力学',
      '电磁',
      '光学',
      '热学',
      '量子',
      '牛顿',
      '电路',
      '物理',
      '速度',
      '加速度',
      '能量',
    ],
    化学: ['化学', '反应', '分子', '原子', '元素', '有机', '无机', '酸碱', '氧化'],
    英语: ['英语', '语法', '单词', '阅读', '写作', '听力', '口语', '翻译', 'English'],
    语文: ['语文', '作文', '阅读理解', '古文', '诗词', '文言文', '修辞'],
    生物: ['生物', '细胞', '基因', 'DNA', '进化', '生态', '遗传'],
    历史: ['历史', '朝代', '战争', '革命', '文明', '古代'],
    地理: ['地理', '气候', '地形', '经纬', '板块', '洋流'],
  };

  const allText = messages.map((m) => m.content).join(' ');
  let bestSubject = '综合';
  let bestScore = 0;

  for (const [subject, keywords] of Object.entries(subjectKeywords)) {
    const score = keywords.reduce((sum, kw) => sum + (allText.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestSubject = subject;
    }
  }

  return bestSubject;
}

/** Generate a brief summary of the conversation (heuristic) */
export function generateConversationSummary(messages: ConversationMessage[]): string {
  const userMsgs = messages.filter((m) => m.role === 'user');
  const assistantMsgs = messages.filter((m) => m.role === 'assistant');

  if (userMsgs.length === 0) return '空对话';

  const topic = detectConversationTopic(messages);
  const firstQuestion = userMsgs[0].content.slice(0, 60).replace(/\n/g, ' ');

  return `关于${topic}的对话，首个问题：${firstQuestion}…（共${userMsgs.length}个问题，${assistantMsgs.length}个回答）`;
}
