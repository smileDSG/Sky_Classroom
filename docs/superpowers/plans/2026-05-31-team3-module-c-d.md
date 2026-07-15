# 队员3 模块 C + D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-agent solve chain (analyze → solve → verify → correct → knowledge → similar) and an adaptive teaching system (profile → plan → content → quiz) for Sky Classroom.

**Architecture:** Module C replaces the existing LangGraph solve-graph with an AsyncGenerator-based chain that yields SSE events. Module D builds a student profile from mistakes/knowledge-graph, then uses LLM to generate adaptive lesson content with inline quizzes. Both modules use the existing `callLLM`/`streamLLM` layer.

**Tech Stack:** Next.js 15, TypeScript, AI SDK (`ai` package), MySQL (question_bank), IndexedDB (mistakes, client-side), shadcn/ui, SSE streaming.

**Design Spec:** `docs/superpowers/specs/2026-05-31-team3-module-c-d-design.md`

---

## File Structure

### Module C — Solve Multi-Agent Chain

| File | Responsibility |
|------|---------------|
| `lib/solve/agents/analyze-types.ts` | `AnalysisResult` type |
| `lib/solve/agents/analyze-prompts.ts` | Prompt template for problem analysis |
| `lib/solve/agents/analyze-agent.ts` | Analyze Agent — classify subject/difficulty/type |
| `lib/solve/agents/verify-types.ts` | `VerifyResult` type |
| `lib/solve/agents/verify-prompts.ts` | Prompt template for answer verification |
| `lib/solve/agents/answer-matcher.ts` | Answer format normalization + comparison |
| `lib/solve/agents/verify-agent.ts` | Verify Agent — independent re-solve + compare |
| `lib/solve/agents/correct-prompts.ts` | Prompt template for answer correction |
| `lib/solve/agents/correct-agent.ts` | Correct Agent — re-solve with suggested answer |
| `lib/solve/solve-chain-types.ts` | `SolveChainEvent`, `SolveChainInput`, `SolveChainMetadata` |
| `lib/solve/solve-chain.ts` | Chain orchestrator — yields events from each agent |
| `app/api/sky/solve/explain-stream/route.ts` | **Modify** — replace internals with `solveChain()` |
| `components/sky/solve/analysis-card.tsx` | Analysis result display card |
| `components/sky/solve/verification-badge.tsx` | Verification status badge |
| `components/sky/solve/chain-progress.tsx` | Agent chain progress bar |
| `components/sky/solve/solution-panel.tsx` | **Modify** — handle new event types |
| `tests/solve/agents/analyze-agent.test.ts` | Analyze agent tests |
| `tests/solve/agents/verify-agent.test.ts` | Verify agent tests |
| `tests/solve/agents/correct-agent.test.ts` | Correct agent tests |
| `tests/solve/agents/answer-matcher.test.ts` | Answer matcher tests |
| `tests/solve/solve-chain.test.ts` | Full chain integration tests |

### Module D — Adaptive Teaching System

| File | Responsibility |
|------|---------------|
| `lib/student/profile-types.ts` | `StudentProfile`, `ErrorPattern` types |
| `lib/student/profile-builder.ts` | Profile aggregation from mistakes + knowledge graph |
| `lib/teaching/lesson-types.ts` | `LessonPlan`, `LessonSection`, `TeachingEvent` types |
| `lib/teaching/lesson-planner.ts` | Lesson planning agent |
| `lib/teaching/content-generator.ts` | Streaming content generation |
| `lib/teaching/quiz-injector.ts` | Quiz generation + injection |
| `app/api/sky/student/profile/route.ts` | GET/POST student profile API |
| `app/api/sky/teaching/generate-stream/route.ts` | POST SSE teaching stream API |
| `components/sky/teaching/inline-quiz.tsx` | Inline quiz component |
| `tests/teaching/profile-builder.test.ts` | Profile builder tests |
| `tests/teaching/lesson-planner.test.ts` | Lesson planner tests |
| `tests/teaching/content-generator.test.ts` | Content generator tests |
| `tests/teaching/quiz-injector.test.ts` | Quiz injector tests |

---

## Task 1: Analysis Types + Prompts

**Files:**
- Create: `lib/solve/agents/analyze-types.ts`
- Create: `lib/solve/agents/analyze-prompts.ts`

- [ ] **Step 1: Create `analyze-types.ts`**

```typescript
// lib/solve/agents/analyze-types.ts

export interface AnalysisResult {
  subject: string;
  knowledgePoints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'choice' | 'fill' | 'solve' | 'judge';
  confidence: number;
}

export const DEFAULT_ANALYSIS: AnalysisResult = {
  subject: 'unknown',
  knowledgePoints: [],
  difficulty: 'medium',
  questionType: 'solve',
  confidence: 0,
};
```

- [ ] **Step 2: Create `analyze-prompts.ts`**

```typescript
// lib/solve/agents/analyze-prompts.ts

export const ANALYZE_SYSTEM_PROMPT = `你是题目分析专家。分析给定的题目，识别以下信息：

1. **学科**：数学/物理/化学/生物/语文/英语/历史/地理/政治/其他
2. **知识点**：2-4 个相关知识点名称
3. **难度**：easy（基础）/ medium（中等）/ hard（困难）
4. **题型**：choice（选择题）/ fill（填空题）/ solve（解答题）/ judge（判断题）
5. **confidence**：你对分析结果的置信度 0-1

输出纯 JSON，不要输出其他内容：
{"subject":"数学","knowledgePoints":["二次函数","顶点坐标","配方法"],"difficulty":"medium","questionType":"solve","confidence":0.9}`;

export function buildAnalyzePrompt(problemText: string): string {
  return `请分析以下题目：\n\n${problemText}`;
}
```

- [ ] **Step 3: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/solve/agents/analyze-types.ts lib/solve/agents/analyze-prompts.ts
git commit -m "feat(solve): add analysis types and prompts for C-001"
```

---

## Task 2: Analyze Agent + Tests

**Files:**
- Create: `lib/solve/agents/analyze-agent.ts`
- Create: `tests/solve/agents/analyze-agent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/solve/agents/analyze-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { analyzeProblem } from '@/lib/solve/agents/analyze-agent';
import { DEFAULT_ANALYSIS } from '@/lib/solve/agents/analyze-types';

// Mock the LLM layer
vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

describe('analyzeProblem', () => {
  it('returns parsed analysis for valid LLM response', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        subject: '数学',
        knowledgePoints: ['二次函数', '顶点坐标'],
        difficulty: 'medium',
        questionType: 'solve',
        confidence: 0.9,
      }),
    } as any);

    const result = await analyzeProblem('已知二次函数y=x²-2x+3，求顶点坐标');
    expect(result.subject).toBe('数学');
    expect(result.knowledgePoints).toContain('二次函数');
    expect(result.difficulty).toBe('medium');
    expect(result.questionType).toBe('solve');
    expect(result.confidence).toBe(0.9);
  });

  it('returns DEFAULT_ANALYSIS on LLM failure', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('timeout'));

    const result = await analyzeProblem('some problem');
    expect(result).toEqual(DEFAULT_ANALYSIS);
  });

  it('returns DEFAULT_ANALYSIS on invalid JSON', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({ text: 'not json' } as any);

    const { parseJsonResponse } = await import('@/lib/generation/json-repair');
    vi.mocked(parseJsonResponse).mockReturnValueOnce(null);

    const result = await analyzeProblem('some problem');
    expect(result).toEqual(DEFAULT_ANALYSIS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/agents/analyze-agent.test.ts`
Expected: FAIL — module `analyze-agent` not found

- [ ] **Step 3: Write implementation**

```typescript
// lib/solve/agents/analyze-agent.ts
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel } from '../solver-constants';
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzePrompt } from './analyze-prompts';
import { DEFAULT_ANALYSIS, type AnalysisResult } from './analyze-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('AnalyzeAgent');

export async function analyzeProblem(problemText: string): Promise<AnalysisResult> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: buildAnalyzePrompt(problemText) }] as any,
        temperature: 0.2,
        maxOutputTokens: 512,
      },
      'analyze-agent',
      { retries: 1 },
      undefined,
      ANALYZE_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed) {
      log.warn('analyzeProblem: LLM returned invalid JSON');
      return DEFAULT_ANALYSIS;
    }

    const analysis: AnalysisResult = {
      subject: typeof parsed.subject === 'string' ? parsed.subject : DEFAULT_ANALYSIS.subject,
      knowledgePoints: Array.isArray(parsed.knowledgePoints)
        ? (parsed.knowledgePoints as string[]).slice(0, 4)
        : DEFAULT_ANALYSIS.knowledgePoints,
      difficulty: ['easy', 'medium', 'hard'].includes(parsed.difficulty as string)
        ? (parsed.difficulty as AnalysisResult['difficulty'])
        : DEFAULT_ANALYSIS.difficulty,
      questionType: ['choice', 'fill', 'solve', 'judge'].includes(parsed.questionType as string)
        ? (parsed.questionType as AnalysisResult['questionType'])
        : DEFAULT_ANALYSIS.questionType,
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : DEFAULT_ANALYSIS.confidence,
    };

    log.info(`analyzeProblem: subject=${analysis.subject}, type=${analysis.questionType}, difficulty=${analysis.difficulty}`);
    return analysis;
  } catch (err) {
    log.warn('analyzeProblem failed, returning default:', err);
    return DEFAULT_ANALYSIS;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/agents/analyze-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/solve/agents/analyze-agent.ts tests/solve/agents/analyze-agent.test.ts
git commit -m "feat(solve): add Analyze Agent with tests (C-001)"
```

---

## Task 3: Answer Matcher + Tests

**Files:**
- Create: `lib/solve/agents/answer-matcher.ts`
- Create: `tests/solve/agents/answer-matcher.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/solve/agents/answer-matcher.test.ts
import { describe, it, expect } from 'vitest';
import { matchAnswers, normalizeAnswer } from '@/lib/solve/agents/answer-matcher';

describe('normalizeAnswer', () => {
  it('strips LaTeX delimiters', () => {
    expect(normalizeAnswer('$3$')).toBe('3');
    expect(normalizeAnswer('$$\\frac{1}{2}$$')).toBe('\\frac{1}{2}');
  });

  it('strips option prefixes', () => {
    expect(normalizeAnswer('A')).toBe('a');
    expect(normalizeAnswer('选项B')).toBe('b');
    expect(normalizeAnswer('(C)')).toBe('c');
    expect(normalizeAnswer('（D）')).toBe('d');
  });

  it('normalizes whitespace', () => {
    expect(normalizeAnswer('  3  ')).toBe('3');
    expect(normalizeAnswer('1, 2, 3')).toBe('1,2,3');
  });
});

describe('matchAnswers', () => {
  it('matches identical answers', () => {
    expect(matchAnswers('3', '3').match).toBe(true);
  });

  it('matches LaTeX vs plain', () => {
    expect(matchAnswers('$3$', '3').match).toBe(true);
    expect(matchAnswers('$\\frac{1}{2}$', '1/2').match).toBe(true);
  });

  it('matches option formats', () => {
    expect(matchAnswers('C', '选项C').match).toBe(true);
    expect(matchAnswers('(A)', 'A').match).toBe(true);
  });

  it('matches numeric equivalence', () => {
    expect(matchAnswers('3.0', '3').match).toBe(true);
    expect(matchAnswers('0.5', '1/2').match).toBe(true);
  });

  it('rejects different answers', () => {
    expect(matchAnswers('3', '4').match).toBe(false);
    expect(matchAnswers('A', 'B').match).toBe(false);
  });

  it('handles empty answers', () => {
    expect(matchAnswers('', '').match).toBe(true);
    expect(matchAnswers('', '3').match).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/agents/answer-matcher.test.ts`
Expected: FAIL — module `answer-matcher` not found

- [ ] **Step 3: Write implementation**

```typescript
// lib/solve/agents/answer-matcher.ts

/**
 * Normalize an answer string for comparison.
 * Strips LaTeX delimiters, option prefixes, extra whitespace.
 */
export function normalizeAnswer(raw: string): string {
  let s = raw.trim();

  // Strip $$ block delimiters
  s = s.replace(/^\$\$([\s\S]*)\$\$$/, '$1');
  // Strip $ inline delimiters
  s = s.replace(/^\$(.*)\$$/, '$1');
  // Strip remaining $
  s = s.replace(/\$/g, '');

  s = s.trim();

  // Option prefix: A/B/C/D or 选项A or (A) or （A）
  const optionMatch = s.match(/^(?:选项|[（(])?([A-Da-d])[）)]?$/);
  if (optionMatch) {
    return optionMatch[1]!.toLowerCase();
  }

  // Normalize Chinese parentheses
  s = s.replace(/（/g, '(').replace(/）/g, ')');

  // Normalize whitespace around commas
  s = s.replace(/\s*,\s*/g, ',');

  return s.trim();
}

/**
 * Try to parse a string as a number.
 */
function tryParseNumber(s: string): number | null {
  // Handle fractions like 1/2
  const fracMatch = s.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]!, 10);
    const den = parseInt(fracMatch[2]!, 10);
    if (den !== 0) return num / den;
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Compare two normalized answers.
 * Returns { match, confidence }.
 */
export function matchAnswers(
  answerA: string,
  answerB: string,
): { match: boolean; confidence: number } {
  const a = normalizeAnswer(answerA);
  const b = normalizeAnswer(answerB);

  // Exact match after normalization
  if (a === b) return { match: true, confidence: 1.0 };

  // Case-insensitive for single-letter options
  if (a.length === 1 && b.length === 1 && a.toLowerCase() === b.toLowerCase()) {
    return { match: true, confidence: 1.0 };
  }

  // Numeric comparison
  const numA = tryParseNumber(a);
  const numB = tryParseNumber(b);
  if (numA !== null && numB !== null) {
    if (Math.abs(numA - numB) < 1e-9) return { match: true, confidence: 0.95 };
  }

  // Set comparison: {1,2,3} vs {1, 2, 3}
  const setA = parseSet(a);
  const setB = parseSet(b);
  if (setA && setB) {
    const match = setA.length === setB.length && setA.every((v, i) => v === setB[i]);
    return { match, confidence: match ? 0.9 : 0 };
  }

  // Interval comparison: [0,1] vs [0, 1]
  const intervalA = a.replace(/\s+/g, '');
  const intervalB = b.replace(/\s+/g, '');
  if (intervalA === intervalB) return { match: true, confidence: 0.9 };

  return { match: false, confidence: 0 };
}

function parseSet(s: string): string[] | null {
  const match = s.match(/^\{(.+)\}$/);
  if (!match) return null;
  return match[1]!
    .split(',')
    .map((v) => v.trim())
    .sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/agents/answer-matcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/solve/agents/answer-matcher.ts tests/solve/agents/answer-matcher.test.ts
git commit -m "feat(solve): add answer matcher with normalization (C-002)"
```

---

## Task 4: Verify Agent + Tests

**Files:**
- Create: `lib/solve/agents/verify-types.ts`
- Create: `lib/solve/agents/verify-prompts.ts`
- Create: `lib/solve/agents/verify-agent.ts`
- Create: `tests/solve/agents/verify-agent.test.ts`

- [ ] **Step 1: Create `verify-types.ts`**

```typescript
// lib/solve/agents/verify-types.ts

export interface VerifyResult {
  isCorrect: boolean;
  confidence: number;
  suggestedAnswer?: string;
  reasoning: string;
}

export const DEFAULT_VERIFY: VerifyResult = {
  isCorrect: true,
  confidence: 0,
  reasoning: 'verify skipped or failed',
};
```

- [ ] **Step 2: Create `verify-prompts.ts`**

```typescript
// lib/solve/agents/verify-prompts.ts

export const VERIFY_SYSTEM_PROMPT = `你是解题校验专家。独立解答给定的题目，然后对比你的答案和提供的答案是否一致。

考虑以下格式差异：
- $3$ 和 3 是相同的
- \\frac{1}{2} 和 1/2 是相同的
- C 和 选项C 是相同的
- {1,2,3} 和 {1, 2, 3} 是相同的

输出纯 JSON：
{"yourAnswer":"你独立解出的答案","isCorrect":true,"confidence":0.95,"reasoning":"简要说明对比过程"}

如果答案不一致：
{"yourAnswer":"正确答案","isCorrect":false,"suggestedAnswer":"正确答案","confidence":0.9,"reasoning":"说明为什么不一致"}`;

export function buildVerifyPrompt(problemText: string, originalAnswer: string): string {
  return `题目：${problemText}\n\n待验证的答案：${originalAnswer}\n\n请独立解答并对比答案。`;
}
```

- [ ] **Step 3: Write the failing test**

```typescript
// tests/solve/agents/verify-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { verifyAnswer } from '@/lib/solve/agents/verify-agent';
import { DEFAULT_VERIFY } from '@/lib/solve/agents/verify-types';

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

describe('verifyAnswer', () => {
  it('returns isCorrect=true when LLM confirms', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        yourAnswer: '3',
        isCorrect: true,
        confidence: 0.95,
        reasoning: 'Both answers are 3',
      }),
    } as any);

    const result = await verifyAnswer('求x²=9的正根', '3');
    expect(result.isCorrect).toBe(true);
    expect(result.confidence).toBe(0.95);
  });

  it('returns isCorrect=false with suggestedAnswer when mismatch', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        yourAnswer: '4',
        isCorrect: false,
        suggestedAnswer: '4',
        confidence: 0.9,
        reasoning: 'My solution gives 4, not 3',
      }),
    } as any);

    const result = await verifyAnswer('求2+2', '3');
    expect(result.isCorrect).toBe(false);
    expect(result.suggestedAnswer).toBe('4');
  });

  it('returns DEFAULT_VERIFY on failure', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('timeout'));

    const result = await verifyAnswer('problem', 'answer');
    expect(result).toEqual(DEFAULT_VERIFY);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/agents/verify-agent.test.ts`
Expected: FAIL — module `verify-agent` not found

- [ ] **Step 5: Write implementation**

```typescript
// lib/solve/agents/verify-agent.ts
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel } from '../solver-constants';
import { VERIFY_SYSTEM_PROMPT, buildVerifyPrompt } from './verify-prompts';
import { matchAnswers } from './answer-matcher';
import { DEFAULT_VERIFY, type VerifyResult } from './verify-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('VerifyAgent');

export async function verifyAnswer(
  problemText: string,
  originalAnswer: string,
): Promise<VerifyResult> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: buildVerifyPrompt(problemText, originalAnswer) }] as any,
        temperature: 0.2,
        maxOutputTokens: 512,
      },
      'verify-agent',
      { retries: 0 },
      undefined,
      VERIFY_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed) {
      log.warn('verifyAnswer: LLM returned invalid JSON');
      return DEFAULT_VERIFY;
    }

    // Use answer-matcher for robust comparison
    const llmAnswer = typeof parsed.yourAnswer === 'string' ? parsed.yourAnswer : '';
    const comparison = matchAnswers(llmAnswer, originalAnswer);

    if (comparison.match) {
      return {
        isCorrect: true,
        confidence: comparison.confidence,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'answers match',
      };
    }

    // Answers differ — use LLM's suggested answer if available
    const suggested = typeof parsed.suggestedAnswer === 'string'
      ? parsed.suggestedAnswer
      : llmAnswer;

    return {
      isCorrect: false,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : comparison.confidence,
      suggestedAnswer: suggested,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : 'answers differ',
    };
  } catch (err) {
    log.warn('verifyAnswer failed, returning optimistic default:', err);
    return DEFAULT_VERIFY;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/agents/verify-agent.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/solve/agents/verify-types.ts lib/solve/agents/verify-prompts.ts lib/solve/agents/verify-agent.ts tests/solve/agents/verify-agent.test.ts
git commit -m "feat(solve): add Verify Agent with tests (C-002)"
```

---

## Task 5: Correct Agent + Tests

**Files:**
- Create: `lib/solve/agents/correct-prompts.ts`
- Create: `lib/solve/agents/correct-agent.ts`
- Create: `tests/solve/agents/correct-agent.test.ts`

- [ ] **Step 1: Create `correct-prompts.ts`**

```typescript
// lib/solve/agents/correct-prompts.ts

export function buildCorrectPrompt(
  problemText: string,
  originalAnswer: string,
  suggestedAnswer: string,
  verificationReasoning: string,
): string {
  return `你之前的解答有误。请重新解答这道题目。

题目：${problemText}

你之前的答案：${originalAnswer}
校验结果：答案不正确
提示的正确答案：${suggestedAnswer}
校验推理：${verificationReasoning}

请重新给出完整的解题过程，最终答案应该与提示的正确答案一致。

输出 JSON：
{"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"answer":"最终答案"}`;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/solve/agents/correct-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { correctAnswer } from '@/lib/solve/agents/correct-agent';

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock-model' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

describe('correctAnswer', () => {
  it('returns corrected steps and answer', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        steps: [{ label: '修正', content: '重新计算...', keyPoints: [] }],
        answer: '4',
      }),
    } as any);

    const result = await correctAnswer('求2+2', '3', '4', '算错了');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]!.label).toBe('修正');
    expect(result.answer).toBe('4');
  });

  it('returns null on failure', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('fail'));

    const result = await correctAnswer('problem', 'wrong', 'right', 'reason');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/agents/correct-agent.test.ts`
Expected: FAIL — module `correct-agent` not found

- [ ] **Step 4: Write implementation**

```typescript
// lib/solve/agents/correct-agent.ts
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { resolveSolverModel } from '../solver-constants';
import { buildCorrectPrompt } from './correct-prompts';
import { cleanLatexContent } from '../streaming-solver';
import { createLogger } from '@/lib/logger';

const log = createLogger('CorrectAgent');

export interface CorrectResult {
  steps: { label: string; content: string; keyPoints?: string[] }[];
  answer: string;
}

export async function correctAnswer(
  problemText: string,
  originalAnswer: string,
  suggestedAnswer: string,
  reasoning: string,
): Promise<CorrectResult | null> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const prompt = buildCorrectPrompt(problemText, originalAnswer, suggestedAnswer, reasoning);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
      'correct-agent',
      { retries: 0 },
      undefined,
      '你是解题修正专家。根据校验反馈重新解答题目。输出纯JSON。',
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed || !Array.isArray(parsed.steps) || typeof parsed.answer !== 'string') {
      log.warn('correctAnswer: invalid response');
      return null;
    }

    return {
      steps: (parsed.steps as any[]).map((s) => ({
        label: String(s.label || '修正'),
        content: cleanLatexContent(String(s.content || '')),
        keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints.map(String) : [],
      })),
      answer: String(parsed.answer),
    };
  } catch (err) {
    log.warn('correctAnswer failed:', err);
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/agents/correct-agent.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/solve/agents/correct-prompts.ts lib/solve/agents/correct-agent.ts tests/solve/agents/correct-agent.test.ts
git commit -m "feat(solve): add Correct Agent with tests (C-002)"
```

---

## Task 6: Solve Chain Types + Orchestrator + Tests

**Files:**
- Create: `lib/solve/solve-chain-types.ts`
- Create: `lib/solve/solve-chain.ts`
- Create: `tests/solve/solve-chain.test.ts`

- [ ] **Step 1: Create `solve-chain-types.ts`**

```typescript
// lib/solve/solve-chain-types.ts
import type { AnalysisResult } from './agents/analyze-types';
import type { VerifyResult } from './agents/verify-types';
import type { SolverAgentType } from './types';

export interface SolveChainInput {
  problemText: string;
  problemImage?: string | null;
  userAnswer?: string | null;
}

export interface SolveChainMetadata {
  agentType: SolverAgentType;
  analysis?: AnalysisResult;
  verification?: VerifyResult;
  corrected: boolean;
  fromQuestionBank: boolean;
  fromSolveCache: boolean;
  totalTimeMs: number;
}

export type SolveChainEvent =
  | { type: 'phase'; phase: string }
  | { type: 'analysis'; data: AnalysisResult }
  | { type: 'step'; label: string; content: string; keyPoints?: string[] }
  | { type: 'answer'; answer: string }
  | { type: 'verification'; data: VerifyResult }
  | { type: 'knowledge'; points: { name: string; description: string; difficulty: string }[] }
  | { type: 'similar'; questions: { problem: string; difficulty: number; knowledgePoint: string; answer?: string }[] }
  | { type: 'done'; metadata: SolveChainMetadata }
  | { type: 'error'; message: string };
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/solve/solve-chain.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { solveChain } from '@/lib/solve/solve-chain';

// Mock all agents
vi.mock('@/lib/solve/agents/analyze-agent', () => ({
  analyzeProblem: vi.fn(),
}));

vi.mock('@/lib/solve/agents/verify-agent', () => ({
  verifyAnswer: vi.fn(),
}));

vi.mock('@/lib/solve/agents/correct-agent', () => ({
  correctAnswer: vi.fn(),
}));

vi.mock('@/lib/solve/streaming-solver', () => ({
  streamSolve: vi.fn(),
}));

vi.mock('@/lib/solve/solve-cache', () => ({
  findSolveCacheMatches: vi.fn(() => []),
}));

vi.mock('@/lib/solve/question-bank', () => ({
  findSimilarQuestions: vi.fn(() => []),
  findSimilarByKnowledgePoints: vi.fn(() => []),
  saveToQuestionBank: vi.fn(),
  saveToSolveCache: vi.fn(),
  isProblemInBank: vi.fn(() => false),
  hashProblemText: vi.fn(() => 'hash'),
}));

vi.mock('@/lib/solve/question-bank-utils', () => ({
  hashProblemText: vi.fn(() => 'hash'),
}));

vi.mock('@/lib/solve/explain-stream/route', () => ({}));

// We need to mock the knowledge generation that's called inline
vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn(() => ({ knowledgePoints: [] })),
}));

describe('solveChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits phase events in correct order', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValueOnce({
      subject: '数学',
      knowledgePoints: ['代数'],
      difficulty: 'easy',
      questionType: 'solve',
      confidence: 0.9,
    });

    const { streamSolve } = await import('@/lib/solve/streaming-solver');
    vi.mocked(streamSolve).mockImplementation(async function* () {
      yield { type: 'step', label: '解答', content: 'x=3', keyPoints: [] };
      yield { type: 'answer', answer: '3' };
      yield { type: 'knowledge', points: [] };
      yield { type: 'similar', questions: [] };
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValueOnce({
      isCorrect: true,
      confidence: 0.95,
      reasoning: 'correct',
    });

    const events: string[] = [];
    for await (const event of solveChain({ problemText: '求x=3' })) {
      if (event.type === 'phase') events.push(event.phase);
    }

    expect(events).toContain('analyzing');
    expect(events).toContain('solving');
    expect(events).toContain('verifying');
    expect(events).toContain('done');
  });

  it('emits analysis event', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValueOnce({
      subject: '物理',
      knowledgePoints: ['力学'],
      difficulty: 'medium',
      questionType: 'solve',
      confidence: 0.8,
    });

    const { streamSolve } = await import('@/lib/solve/streaming-solver');
    vi.mocked(streamSolve).mockImplementation(async function* () {
      yield { type: 'answer', answer: '10N' };
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValueOnce({
      isCorrect: true,
      confidence: 0.9,
      reasoning: 'match',
    });

    const events: any[] = [];
    for await (const event of solveChain({ problemText: '力学题' })) {
      events.push(event);
    }

    const analysisEvent = events.find((e) => e.type === 'analysis');
    expect(analysisEvent).toBeDefined();
    expect(analysisEvent.data.subject).toBe('物理');
  });

  it('triggers correction when verify returns isCorrect=false', async () => {
    const { analyzeProblem } = await import('@/lib/solve/agents/analyze-agent');
    vi.mocked(analyzeProblem).mockResolvedValueOnce({
      subject: '数学', knowledgePoints: [], difficulty: 'easy', questionType: 'solve', confidence: 0.9,
    });

    const { streamSolve } = await import('@/lib/solve/streaming-solver');
    vi.mocked(streamSolve).mockImplementation(async function* () {
      yield { type: 'answer', answer: 'wrong' };
    });

    const { verifyAnswer } = await import('@/lib/solve/agents/verify-agent');
    vi.mocked(verifyAnswer).mockResolvedValueOnce({
      isCorrect: false,
      confidence: 0.9,
      suggestedAnswer: 'correct',
      reasoning: 'wrong answer',
    });

    const { correctAnswer } = await import('@/lib/solve/agents/correct-agent');
    vi.mocked(correctAnswer).mockResolvedValueOnce({
      steps: [{ label: '修正', content: 'corrected', keyPoints: [] }],
      answer: 'correct',
    });

    const events: any[] = [];
    for await (const event of solveChain({ problemText: 'math' })) {
      events.push(event);
    }

    expect(events.some((e) => e.type === 'verification' && e.data.isCorrect === false)).toBe(true);
    expect(correctAnswer).toHaveBeenCalled();

    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent.metadata.corrected).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/solve-chain.test.ts`
Expected: FAIL — module `solve-chain` not found

- [ ] **Step 4: Write implementation**

```typescript
// lib/solve/solve-chain.ts
import { createLogger } from '@/lib/logger';
import { analyzeProblem } from './agents/analyze-agent';
import { verifyAnswer } from './agents/verify-agent';
import { correctAnswer } from './agents/correct-agent';
import { streamSolve } from './streaming-solver';
import { findSimilarQuestions, findSimilarByKnowledgePoints, hashProblemText } from './question-bank';
import { findSolveCacheMatches } from './solve-cache';
import { classifyProblem } from './solver-constants';
import { postProcessMathContent } from './math-postprocessor';
import type { SolveChainInput, SolveChainEvent, SolveChainMetadata } from './solve-chain-types';
import type { AnalysisResult } from './agents/analyze-types';
import type { VerifyResult } from './agents/verify-types';

const log = createLogger('SolveChain');

const STEP_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 60_000;

/**
 * With timeout: race a promise against a timeout.
 * Returns the promise result or a default value on timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label: string,
): Promise<T> {
  const timer = new Promise<T>((resolve) => setTimeout(() => {
    log.warn(`[${label}] timed out after ${ms}ms`);
    resolve(fallback);
  }, ms));
  return Promise.race([promise, timer]);
}

/**
 * Generate knowledge points (extracted from explain-stream for reuse).
 */
async function generateKnowledgePoints(
  problemText: string,
  answer: string,
): Promise<{ name: string; description: string; difficulty: string }[]> {
  try {
    const { callLLM } = await import('@/lib/ai/llm');
    const { getModel } = await import('@/lib/ai/providers');
    const { parseJsonResponse } = await import('@/lib/generation/json-repair');
    const { resolveSolverModel } = await import('./solver-constants');

    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const prompt = `你是知识点总结专家。根据题目和答案生成2-4个知识点。
输出JSON：{"knowledgePoints":[{"name":"...","description":"核心概念+应用场景+易错点","difficulty":"easy|medium|hard"}]}

题目：${problemText}
答案：${answer}`;

    const result = await callLLM(
      { model, messages: [{ role: 'user', content: prompt }] as any, temperature: 0.3, maxOutputTokens: 1024 },
      'knowledge-gen',
      { retries: 0 },
      undefined,
      '你是知识点总结专家。请直接输出JSON。',
    );

    const parsed = parseJsonResponse<any>(result.text || '');
    if (parsed && Array.isArray(parsed.knowledgePoints)) {
      return parsed.knowledgePoints.map((k: any) => ({
        name: k.name || '',
        description: k.description || '',
        difficulty: k.difficulty || 'medium',
      }));
    }
  } catch (err) {
    log.warn('generateKnowledgePoints failed:', err);
  }
  return [];
}

/**
 * Solve chain orchestrator.
 * AsyncGenerator that yields SSE events as each agent completes.
 */
export async function* solveChain(input: SolveChainInput): AsyncGenerator<SolveChainEvent> {
  const startTime = Date.now();
  const { problemText, problemImage, userAnswer } = input;

  // ── Phase 1: Check cache and question bank ──────────────────────
  yield { type: 'phase', phase: 'checking' };

  let fromQuestionBank = false;
  let fromSolveCache = false;

  const [bankMatches, cacheMatches] = await Promise.all([
    findSimilarQuestions(problemText, 0.85),
    findSolveCacheMatches(problemText, 0.70),
  ]);

  // Fast path: question bank hit
  if (bankMatches.length > 0) {
    const hit = bankMatches[0]!;
    fromQuestionBank = true;
    log.info(`Question bank hit`);

    yield { type: 'step', label: '解答', content: postProcessMathContent(hit.answer), keyPoints: [] };
    yield { type: 'answer', answer: postProcessMathContent(hit.answer) };
    if (hit.knowledgePoints?.length) {
      yield { type: 'knowledge', points: hit.knowledgePoints };
    }
    yield { type: 'similar', questions: hit.similarQuestions ?? [] };
    yield {
      type: 'done',
      metadata: {
        agentType: classifyProblem(problemText),
        corrected: false,
        fromQuestionBank: true,
        fromSolveCache: false,
        totalTimeMs: Date.now() - startTime,
      },
    };
    return;
  }

  // Fast path: solve cache hit
  if (cacheMatches.length > 0) {
    const hit = cacheMatches[0]!;
    fromSolveCache = true;
    log.info(`Solve cache hit`);

    yield { type: 'step', label: '解答', content: postProcessMathContent(hit.solution), keyPoints: [] };
    yield { type: 'answer', answer: postProcessMathContent(hit.solution) };
    yield {
      type: 'done',
      metadata: {
        agentType: classifyProblem(problemText),
        corrected: false,
        fromQuestionBank: false,
        fromSolveCache: true,
        totalTimeMs: Date.now() - startTime,
      },
    };
    return;
  }

  // ── Phase 2: Analyze ────────────────────────────────────────────
  yield { type: 'phase', phase: 'analyzing' };

  const analysis = await withTimeout(
    analyzeProblem(problemText),
    STEP_TIMEOUT_MS,
    { subject: 'unknown', knowledgePoints: [], difficulty: 'medium' as const, questionType: 'solve' as const, confidence: 0 },
    'analyze',
  );

  yield { type: 'analysis', data: analysis };

  // ── Phase 3: Solve ──────────────────────────────────────────────
  yield { type: 'phase', phase: 'solving' };

  const agentType = analysis.subject !== 'unknown'
    ? classifyProblem(problemText)
    : classifyProblem(problemText);

  let streamedAnswer = '';
  const streamedSteps: { label: string; content: string; keyPoints?: string[] }[] = [];
  let streamedKnowledge: { name: string; description: string; difficulty: string }[] = [];
  let streamedSimilar: { problem: string; difficulty: number; knowledgePoint: string; answer?: string }[] = [];

  // Start knowledge generation in parallel
  const knowledgePromise = generateKnowledgePoints(problemText, '');

  try {
    for await (const event of streamSolve(agentType, problemText, problemImage ?? null)) {
      if (event.type === 'step') {
        const processed = {
          ...event,
          content: postProcessMathContent(event.content),
          keyPoints: (event.keyPoints ?? []).map(postProcessMathContent),
        };
        yield processed;
        streamedSteps.push({ label: processed.label, content: processed.content, keyPoints: processed.keyPoints });
      } else if (event.type === 'answer') {
        const processed = { ...event, answer: postProcessMathContent(event.answer) };
        yield processed;
        streamedAnswer = processed.answer;
      } else if (event.type === 'knowledge') {
        yield event;
        streamedKnowledge = event.points;
      } else if (event.type === 'similar') {
        yield event;
        streamedSimilar = event.questions;
      }
    }
  } catch (err) {
    log.error('Solve agent failed:', err);
    yield { type: 'error', message: err instanceof Error ? err.message : '解题失败' };
    return;
  }

  // ── Phase 4: Verify ─────────────────────────────────────────────
  yield { type: 'phase', phase: 'verifying' };

  let verification: VerifyResult | undefined;
  let corrected = false;

  if (streamedAnswer) {
    verification = await withTimeout(
      verifyAnswer(problemText, streamedAnswer),
      STEP_TIMEOUT_MS,
      { isCorrect: true, confidence: 0, reasoning: 'verify timeout' } as VerifyResult,
      'verify',
    );

    yield { type: 'verification', data: verification };

    // ── Phase 5: Correct (if needed) ───────────────────────────────
    if (!verification.isCorrect && verification.suggestedAnswer) {
      yield { type: 'phase', phase: 'correcting' };

      const correction = await withTimeout(
        correctAnswer(problemText, streamedAnswer, verification.suggestedAnswer, verification.reasoning),
        STEP_TIMEOUT_MS,
        null,
        'correct',
      );

      if (correction) {
        corrected = true;
        streamedAnswer = correction.answer;
        // Re-yield corrected steps
        for (const step of correction.steps) {
          yield { type: 'step', label: step.label, content: postProcessMathContent(step.content), keyPoints: step.keyPoints?.map(postProcessMathContent) };
        }
        yield { type: 'answer', answer: postProcessMathContent(correction.answer) };
      }
    }
  }

  // ── Phase 6: Knowledge points ───────────────────────────────────
  yield { type: 'phase', phase: 'knowledge' };

  if (streamedKnowledge.length === 0) {
    streamedKnowledge = await knowledgePromise;
  }
  // If still empty, try generating with the (possibly corrected) answer
  if (streamedKnowledge.length === 0 && streamedAnswer) {
    streamedKnowledge = await generateKnowledgePoints(problemText, streamedAnswer);
  }
  if (streamedKnowledge.length > 0) {
    yield { type: 'knowledge', points: streamedKnowledge };
  }

  // ── Phase 7: Similar questions ──────────────────────────────────
  yield { type: 'phase', phase: 'similar' };

  if (streamedSimilar.length === 0 && streamedKnowledge.length > 0) {
    try {
      const currentHash = hashProblemText(problemText);
      const kbSimilar = await findSimilarByKnowledgePoints(problemText, streamedKnowledge, currentHash, 3);
      if (kbSimilar.length >= 2) {
        streamedSimilar = kbSimilar.map((q) => ({
          problem: q.problem,
          difficulty: q.difficulty,
          knowledgePoint: q.knowledgePoint,
          answer: q.answer,
        }));
      }
    } catch (err) {
      log.warn('KB similar questions lookup failed:', err);
    }
  }
  yield { type: 'similar', questions: streamedSimilar };

  // ── Done ────────────────────────────────────────────────────────
  const metadata: SolveChainMetadata = {
    agentType,
    analysis,
    verification,
    corrected,
    fromQuestionBank,
    fromSolveCache,
    totalTimeMs: Date.now() - startTime,
  };

  yield { type: 'done', metadata };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/solve-chain.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/solve/solve-chain-types.ts lib/solve/solve-chain.ts tests/solve/solve-chain.test.ts
git commit -m "feat(solve): add Solve Chain orchestrator with tests (C-003)"
```

---

## Task 7: Refactor explain-stream to use solve-chain (C-004)

**Files:**
- Modify: `app/api/sky/solve/explain-stream/route.ts`

- [ ] **Step 1: Refactor the route to use `solveChain()`**

Replace the body of the `POST` handler. Keep the same SSE event format for backward compatibility, and add new event types.

```typescript
// app/api/sky/solve/explain-stream/route.ts
// REFACTORED: uses solveChain() instead of manual logic

import { createLogger } from '@/lib/logger';
import { solveChain } from '@/lib/solve/solve-chain';
import type { SolveChainEvent } from '@/lib/solve/solve-chain-types';

const log = createLogger('API:ExplainStream');

function formatSSEEvent(event: SolveChainEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { problem, problemImage, userAnswer } = body;

    if (!problem) {
      return new Response(
        `data: ${JSON.stringify({ type: 'error', message: 'Missing required field: problem' })}\n\n`,
        { status: 400, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    log.info(`[ExplainStream] Solving: ${problem.slice(0, 60)}...`);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = async (data: string) => {
      await writer.write(encoder.encode(data));
    };

    (async () => {
      try {
        for await (const event of solveChain({
          problemText: problem,
          problemImage: problemImage ?? null,
          userAnswer: userAnswer ?? null,
        })) {
          await write(formatSSEEvent(event));
        }
        await writer.close();
      } catch (err) {
        log.error('ExplainStream error:', err);
        try {
          await write(`data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : '解题失败' })}\n\n`);
          await writer.close();
        } catch {
          // already closed
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    log.error('ExplainStream API error:', err);
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: '解题失败' })}\n\n`,
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }
}
```

- [ ] **Step 2: Verify the app still compiles**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new type errors from our changes

- [ ] **Step 3: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add app/api/sky/solve/explain-stream/route.ts
git commit -m "refactor(solve): replace explain-stream internals with solveChain (C-004)"
```

---

## Task 8: Frontend — Analysis Card + Verification Badge + Chain Progress (C-005)

**Files:**
- Create: `components/sky/solve/analysis-card.tsx`
- Create: `components/sky/solve/verification-badge.tsx`
- Create: `components/sky/solve/chain-progress.tsx`
- Modify: `components/sky/solve/solution-panel.tsx` (add event handlers)

- [ ] **Step 1: Create `analysis-card.tsx`**

```tsx
// components/sky/solve/analysis-card.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AnalysisResult } from '@/lib/solve/agents/analyze-types';

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '基础',
  medium: '中等',
  hard: '困难',
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-red-100 text-red-700',
};

const TYPE_LABEL: Record<string, string> = {
  choice: '选择题',
  fill: '填空题',
  solve: '解答题',
  judge: '判断题',
};

interface AnalysisCardProps {
  analysis: AnalysisResult;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{analysis.subject}</Badge>
          <Badge className={DIFFICULTY_COLOR[analysis.difficulty] ?? ''}>
            {DIFFICULTY_LABEL[analysis.difficulty] ?? analysis.difficulty}
          </Badge>
          <Badge variant="secondary">
            {TYPE_LABEL[analysis.questionType] ?? analysis.questionType}
          </Badge>
        </div>
        {analysis.knowledgePoints.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {analysis.knowledgePoints.map((kp) => (
              <Badge key={kp} variant="outline" className="text-xs">
                {kp}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `verification-badge.tsx`**

```tsx
// components/sky/solve/verification-badge.tsx
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { VerifyResult } from '@/lib/solve/agents/verify-types';

interface VerificationBadgeProps {
  verification: VerifyResult;
}

export function VerificationBadge({ verification }: VerificationBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = verification.isCorrect
    ? { label: '校验通过', icon: '✓', color: 'bg-green-100 text-green-700 border-green-300' }
    : verification.suggestedAnswer
      ? { label: '已修正', icon: '✗', color: 'bg-orange-100 text-orange-700 border-orange-300' }
      : { label: '待确认', icon: '?', color: 'bg-gray-100 text-gray-700 border-gray-300' };

  return (
    <div className="space-y-1">
      <Badge
        className={`cursor-pointer ${statusConfig.color}`}
        onClick={() => setExpanded(!expanded)}
      >
        {statusConfig.icon} {statusConfig.label}
      </Badge>
      {expanded && (
        <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
          <p><strong>推理：</strong>{verification.reasoning}</p>
          {!verification.isCorrect && verification.suggestedAnswer && (
            <p><strong>修正答案：</strong>{verification.suggestedAnswer}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `chain-progress.tsx`**

```tsx
// components/sky/solve/chain-progress.tsx
'use client';

import { cn } from '@/lib/utils';

const PHASES = [
  { key: 'analyzing', label: '分析' },
  { key: 'solving', label: '解题' },
  { key: 'verifying', label: '校验' },
  { key: 'correcting', label: '修正' },
  { key: 'knowledge', label: '知识点' },
  { key: 'similar', label: '类似题' },
  { key: 'done', label: '完成' },
] as const;

interface ChainProgressProps {
  currentPhase: string;
}

export function ChainProgress({ currentPhase }: ChainProgressProps) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {PHASES.map((phase, idx) => {
        const isActive = idx === currentIdx;
        const isDone = idx < currentIdx;

        return (
          <div key={phase.key} className="flex items-center">
            <div
              className={cn(
                'px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors',
                isActive && 'bg-blue-500 text-white',
                isDone && 'bg-green-100 text-green-700',
                !isActive && !isDone && 'bg-muted text-muted-foreground',
              )}
            >
              {phase.label}
            </div>
            {idx < PHASES.length - 1 && (
              <div className={cn('w-4 h-px mx-0.5', isDone ? 'bg-green-300' : 'bg-muted')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Modify `solution-panel.tsx` to handle new events**

Read the existing `solution-panel.tsx` first, then add handlers for `analysis` and `verification` events. The key change is in the SSE event handler — add cases for the new event types.

Add these state variables and event handlers to the existing component:

```tsx
// Add to imports at top of solution-panel.tsx
import { AnalysisCard } from './analysis-card';
import { VerificationBadge } from './verification-badge';
import { ChainProgress } from './chain-progress';
import type { AnalysisResult } from '@/lib/solve/agents/analyze-types';
import type { VerifyResult } from '@/lib/solve/agents/verify-types';

// Add to component state
const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
const [verification, setVerification] = useState<VerifyResult | null>(null);
const [chainPhase, setChainPhase] = useState<string>('');

// Add to the SSE event switch/handler
// case 'analysis': setAnalysis(event.data); break;
// case 'verification': setVerification(event.data); break;
// case 'phase': setChainPhase(event.phase); break;

// Add to JSX (above the existing steps area)
// {chainPhase && <ChainProgress currentPhase={chainPhase} />}
// {analysis && <AnalysisCard analysis={analysis} />}
// {verification && <VerificationBadge verification={verification} />}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add components/sky/solve/analysis-card.tsx components/sky/solve/verification-badge.tsx components/sky/solve/chain-progress.tsx components/sky/solve/solution-panel.tsx
git commit -m "feat(solve): add analysis card, verification badge, chain progress (C-005)"
```

---

## Task 9: Student Profile Types + Builder + API (D-001)

**Files:**
- Create: `lib/student/profile-types.ts`
- Create: `lib/student/profile-builder.ts`
- Create: `app/api/sky/student/profile/route.ts`
- Create: `tests/teaching/profile-builder.test.ts`

- [ ] **Step 1: Create `profile-types.ts`**

```typescript
// lib/student/profile-types.ts
import type { MistakeCause } from '@/lib/solve/types';

export interface StudentProfile {
  masteryBySubject: Record<string, number>;
  masteryByKnowledge: Record<string, number>;
  weakPoints: string[];
  strongPoints: string[];
  errorPatterns: ErrorPattern[];
  totalProblems: number;
  totalCorrect: number;
  overallAccuracy: number;
}

export interface ErrorPattern {
  cause: MistakeCause;
  count: number;
  percentage: number;
}

export interface StudentProfileSummary {
  weakPoints: string[];
  strongPoints: string[];
  overallAccuracy: number;
  subjectCount: number;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/teaching/profile-builder.test.ts
import { describe, it, expect, vi } from 'vitest';
import { buildStudentProfile } from '@/lib/student/profile-builder';

vi.mock('@/lib/mistakes/db', () => ({
  getAllMistakes: vi.fn(() => []),
}));

vi.mock('@/lib/mistakes/knowledge-graph', () => ({
  buildKnowledgeGraph: vi.fn(() => ({
    nodes: [
      { id: '二次函数', name: '二次函数', category: '代数', mastery: 40, problemCount: 5, mistakeCount: 3, children: [] },
      { id: '概率', name: '概率', category: '概率', mastery: 80, problemCount: 3, mistakeCount: 1, children: [] },
      { id: '几何', name: '几何', category: '几何', mastery: 20, problemCount: 4, mistakeCount: 4, children: [] },
    ],
    edges: [],
    weakPoints: ['几何'],
  })),
}));

vi.mock('@/lib/mistakes/mistake-tracker', () => ({
  getMistakes: vi.fn(() => [
    { id: '1', cause: 'calculation-error', knowledgePoints: ['二次函数'] },
    { id: '2', cause: 'concept-unclear', knowledgePoints: ['几何'] },
    { id: '3', cause: 'calculation-error', knowledgePoints: ['几何'] },
  ]),
  getMistakeStats: vi.fn(() => ({
    totalCount: 10,
    reviewedCount: 5,
    causeDistribution: { 'calculation-error': 4, 'concept-unclear': 3, 'misreading': 1, 'method-wrong': 1, 'careless': 1, 'format-error': 0 },
    recentCount: 3,
  })),
}));

describe('buildStudentProfile', () => {
  it('builds profile from mistakes and knowledge graph', async () => {
    const profile = await buildStudentProfile();

    expect(profile.masteryByKnowledge['二次函数']).toBe(40);
    expect(profile.masteryByKnowledge['概率']).toBe(80);
    expect(profile.masteryByKnowledge['几何']).toBe(20);
    expect(profile.weakPoints).toContain('几何');
    expect(profile.strongPoints).toContain('概率');
  });

  it('computes error patterns', async () => {
    const profile = await buildStudentProfile();

    const calcPattern = profile.errorPatterns.find((p) => p.cause === 'calculation-error');
    expect(calcPattern).toBeDefined();
    expect(calcPattern!.count).toBeGreaterThan(0);
  });

  it('caches results within TTL', async () => {
    const { getMistakes } = await import('@/lib/mistakes/mistake-tracker');

    // Clear cache
    const { clearProfileCache } = await import('@/lib/student/profile-builder');
    clearProfileCache();

    await buildStudentProfile();
    await buildStudentProfile();

    // getMistakes should only be called once due to caching
    expect(vi.mocked(getMistakes)).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/teaching/profile-builder.test.ts`
Expected: FAIL — module `profile-builder` not found

- [ ] **Step 4: Write implementation**

```typescript
// lib/student/profile-builder.ts
import { createLogger } from '@/lib/logger';
import { buildKnowledgeGraph } from '@/lib/mistakes/knowledge-graph';
import { getMistakes } from '@/lib/mistakes/mistake-tracker';
import type { StudentProfile, StudentProfileSummary } from './profile-types';

const log = createLogger('ProfileBuilder');

// ── Cache (5 min TTL) ─────────────────────────────────────────────

let cachedProfile: StudentProfile | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function clearProfileCache(): void {
  cachedProfile = null;
  cacheTimestamp = 0;
}

/**
 * Build a student profile by aggregating mistakes + knowledge graph.
 */
export async function buildStudentProfile(): Promise<StudentProfile> {
  const now = Date.now();
  if (cachedProfile && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProfile;
  }

  try {
    const mistakes = await getMistakes();
    const graph = buildKnowledgeGraph(mistakes);

    // masteryByKnowledge: directly from KnowledgeNode
    const masteryByKnowledge: Record<string, number> = {};
    for (const node of graph.nodes) {
      masteryByKnowledge[node.name] = node.mastery;
    }

    // masteryBySubject: group by category, average mastery
    const categoryNodes = new Map<string, number[]>();
    for (const node of graph.nodes) {
      if (!categoryNodes.has(node.category)) categoryNodes.set(node.category, []);
      categoryNodes.get(node.category)!.push(node.mastery);
    }
    const masteryBySubject: Record<string, number> = {};
    for (const [category, masteries] of categoryNodes) {
      masteryBySubject[category] = Math.round(masteries.reduce((a, b) => a + b, 0) / masteries.length);
    }

    // weak/strong points
    const weakPoints = graph.nodes.filter((n) => n.mastery < 50).map((n) => n.name);
    const strongPoints = graph.nodes.filter((n) => n.mastery >= 80).map((n) => n.name);

    // error patterns
    const causeCounts = new Map<string, number>();
    for (const m of mistakes) {
      causeCounts.set(m.cause, (causeCounts.get(m.cause) ?? 0) + 1);
    }
    const totalMistakes = mistakes.length;
    const errorPatterns = [...causeCounts.entries()].map(([cause, count]) => ({
      cause: cause as StudentProfile['errorPatterns'][0]['cause'],
      count,
      percentage: totalMistakes > 0 ? Math.round((count / totalMistakes) * 100) : 0,
    }));

    // overall stats
    const totalProblems = graph.nodes.reduce((sum, n) => sum + n.problemCount, 0);
    const totalMistakesCount = graph.nodes.reduce((sum, n) => sum + n.mistakeCount, 0);
    const totalCorrect = totalProblems - totalMistakesCount;
    const overallAccuracy = totalProblems > 0 ? totalCorrect / totalProblems : 0;

    const profile: StudentProfile = {
      masteryBySubject,
      masteryByKnowledge,
      weakPoints,
      strongPoints,
      errorPatterns,
      totalProblems,
      totalCorrect,
      overallAccuracy: Math.round(overallAccuracy * 100) / 100,
    };

    cachedProfile = profile;
    cacheTimestamp = now;

    log.info(`Profile built: ${graph.nodes.length} nodes, ${weakPoints.length} weak points`);
    return profile;
  } catch (err) {
    log.warn('buildStudentProfile failed, returning empty profile:', err);
    return EMPTY_PROFILE;
  }
}

const EMPTY_PROFILE: StudentProfile = {
  masteryBySubject: {},
  masteryByKnowledge: {},
  weakPoints: [],
  strongPoints: [],
  errorPatterns: [],
  totalProblems: 0,
  totalCorrect: 0,
  overallAccuracy: 0,
};

/**
 * Create a summary for SSE events (lighter than full profile).
 */
export function summarizeProfile(profile: StudentProfile): StudentProfileSummary {
  return {
    weakPoints: profile.weakPoints.slice(0, 5),
    strongPoints: profile.strongPoints.slice(0, 5),
    overallAccuracy: profile.overallAccuracy,
    subjectCount: Object.keys(profile.masteryBySubject).length,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/teaching/profile-builder.test.ts`
Expected: PASS

- [ ] **Step 6: Create the API route**

```typescript
// app/api/sky/student/profile/route.ts
import { createLogger } from '@/lib/logger';
import { buildStudentProfile } from '@/lib/student/profile-builder';

const log = createLogger('API:StudentProfile');

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const subject = url.searchParams.get('subject');

    const profile = await buildStudentProfile();

    // Filter by subject if requested
    if (subject && profile.masteryBySubject[subject] !== undefined) {
      const subjectMastery = profile.masteryBySubject[subject];
      return Response.json({
        ...profile,
        filteredSubject: subject,
        subjectMastery,
      });
    }

    return Response.json(profile);
  } catch (err) {
    log.error('Student profile API error:', err);
    return Response.json({ error: 'Failed to build student profile' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept profile snapshot from client
    // For future use: persist to server-side cache
    log.info('Received profile snapshot (not yet persisted)');
    return Response.json({ ok: true });
  } catch (err) {
    log.error('Student profile POST error:', err);
    return Response.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
```

- [ ] **Step 7: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/student/profile-types.ts lib/student/profile-builder.ts app/api/sky/student/profile/route.ts tests/teaching/profile-builder.test.ts
git commit -m "feat(teaching): add student profile system with API (D-001)"
```

---

## Task 10: Lesson Types + Planner + Tests (D-002)

**Files:**
- Create: `lib/teaching/lesson-types.ts`
- Create: `lib/teaching/lesson-planner.ts`
- Create: `tests/teaching/lesson-planner.test.ts`

- [ ] **Step 1: Create `lesson-types.ts`**

```typescript
// lib/teaching/lesson-types.ts

export interface LessonPlan {
  topic: string;
  sections: LessonSection[];
  estimatedDuration: number;
  focusPoints: string[];
}

export interface LessonSection {
  id: string;
  title: string;
  knowledgePoint: string;
  depth: 'basic' | 'normal' | 'advanced';
  hasQuiz: boolean;
  estimatedMinutes: number;
}

export type ContentChunkType = 'text' | 'example' | 'diagram' | 'quiz';

export interface ContentChunk {
  sectionId: string;
  type: ContentChunkType;
  content: string;
  isLast: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options?: string[];
  questionType: 'choice' | 'fill' | 'solve' | 'judge';
  answer: string;
  explanation: string;
}

export interface QuizStats {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
}

export type TeachingEvent =
  | { type: 'profile'; data: { weakPoints: string[]; strongPoints: string[]; overallAccuracy: number } }
  | { type: 'plan'; data: LessonPlan }
  | { type: 'content'; sectionId: string; chunkType: ContentChunkType; content: string; isLast: boolean }
  | { type: 'quiz'; sectionId: string; question: QuizQuestion }
  | { type: 'quiz-result'; isCorrect: boolean; explanation: string; nextAction: string }
  | { type: 'adjustment'; reason: string; newPace: string }
  | { type: 'done'; totalSections: number; quizStats: QuizStats; duration: number }
  | { type: 'error'; message: string };
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/teaching/lesson-planner.test.ts
import { describe, it, expect, vi } from 'vitest';
import { planLesson } from '@/lib/teaching/lesson-planner';
import type { StudentProfile } from '@/lib/student/profile-types';

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

const MOCK_PROFILE: StudentProfile = {
  masteryBySubject: { 数学: 45 },
  masteryByKnowledge: { '二次函数': 30, '概率': 75, '几何': 20 },
  weakPoints: ['几何', '二次函数'],
  strongPoints: ['概率'],
  errorPatterns: [{ cause: 'calculation-error', count: 5, percentage: 50 }],
  totalProblems: 20,
  totalCorrect: 12,
  overallAccuracy: 0.6,
};

describe('planLesson', () => {
  it('returns a lesson plan with sections', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        topic: '二次函数',
        sections: [
          { id: 's1', title: '基础概念', knowledgePoint: '二次函数', depth: 'basic', hasQuiz: true, estimatedMinutes: 5 },
          { id: 's2', title: '图像性质', knowledgePoint: '二次函数', depth: 'basic', hasQuiz: true, estimatedMinutes: 8 },
        ],
        estimatedDuration: 13,
        focusPoints: ['二次函数', '几何'],
      }),
    } as any);

    const plan = await planLesson(MOCK_PROFILE, '二次函数');

    expect(plan.topic).toBe('二次函数');
    expect(plan.sections).toHaveLength(2);
    expect(plan.sections[0]!.depth).toBe('basic'); // mastery < 30
    expect(plan.focusPoints).toContain('二次函数');
  });

  it('returns default plan on LLM failure', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockRejectedValueOnce(new Error('fail'));

    const plan = await planLesson(MOCK_PROFILE, '概率');
    expect(plan.topic).toBe('概率');
    expect(plan.sections.length).toBeGreaterThan(0);
  });

  it('sets depth based on mastery level', async () => {
    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        topic: '概率',
        sections: [
          { id: 's1', title: '基础', knowledgePoint: '概率', depth: 'advanced', hasQuiz: true, estimatedMinutes: 5 },
        ],
        estimatedDuration: 5,
        focusPoints: [],
      }),
    } as any);

    const plan = await planLesson(MOCK_PROFILE, '概率');
    // 概率 mastery=75, should be advanced (>70)
    expect(plan.sections[0]!.depth).toBe('advanced');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/teaching/lesson-planner.test.ts`
Expected: FAIL — module `lesson-planner` not found

- [ ] **Step 4: Write implementation**

```typescript
// lib/teaching/lesson-planner.ts
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { createLogger } from '@/lib/logger';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { LessonPlan, LessonSection } from './lesson-types';

const log = createLogger('LessonPlanner');

const LESSON_SYSTEM_PROMPT = `你是授课规划专家。根据学生的知识掌握情况，规划一节课的内容。

掌握度分层策略：
- mastery < 30%：depth="basic"，重点讲解基础概念，增加例题
- 30% ≤ mastery ≤ 70%：depth="normal"，标准讲解
- mastery > 70%：depth="advanced"，拓展提升

薄弱知识点优先排序。每个 section 都要标记 hasQuiz=true。

输出纯JSON：
{
  "topic": "主题",
  "sections": [
    {"id": "s1", "title": "...", "knowledgePoint": "...", "depth": "basic|normal|advanced", "hasQuiz": true, "estimatedMinutes": 5}
  ],
  "estimatedDuration": 20,
  "focusPoints": ["重点1", "重点2"]
}`;

function getDefaultPlan(topic: string, profile: StudentProfile): LessonPlan {
  const sections: LessonSection[] = [];

  // Create sections from weak points related to the topic
  const relatedWeak = profile.weakPoints.filter(
    (wp) => topic.includes(wp) || wp.includes(topic),
  );

  if (relatedWeak.length > 0) {
    for (let i = 0; i < relatedWeak.length; i++) {
      sections.push({
        id: `s${i + 1}`,
        title: `${relatedWeak[i]}基础`,
        knowledgePoint: relatedWeak[i]!,
        depth: 'basic',
        hasQuiz: true,
        estimatedMinutes: 5,
      });
    }
  }

  // Always include the main topic
  sections.push({
    id: `s${sections.length + 1}`,
    title: `${topic}讲解`,
    knowledgePoint: topic,
    depth: 'normal',
    hasQuiz: true,
    estimatedMinutes: 10,
  });

  return {
    topic,
    sections,
    estimatedDuration: sections.reduce((sum, s) => sum + s.estimatedMinutes, 0),
    focusPoints: [...new Set([...relatedWeak, topic])].slice(0, 3),
  };
}

export async function planLesson(
  profile: StudentProfile,
  topic: string,
): Promise<LessonPlan> {
  try {
    const modelConfig = { providerId: 'deepseek' as const, modelId: 'deepseek-v4-flash' };
    const { model } = getModel(modelConfig);

    const masteryContext = Object.entries(profile.masteryByKnowledge)
      .map(([kp, m]) => `- ${kp}: ${m}%`)
      .join('\n');

    const prompt = `学生当前知识掌握度：
${masteryContext || '暂无数据'}

薄弱知识点：${profile.weakPoints.join('、') || '暂无'}
强项知识点：${profile.strongPoints.join('、') || '暂无'}
总正确率：${Math.round(profile.overallAccuracy * 100)}%

请为以下主题规划一节课：${topic}`;

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
      'lesson-planner',
      { retries: 1 },
      undefined,
      LESSON_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed || !Array.isArray(parsed.sections)) {
      log.warn('planLesson: invalid LLM response, using default');
      return getDefaultPlan(topic, profile);
    }

    const sections: LessonSection[] = (parsed.sections as any[]).map((s) => {
      const mastery = profile.masteryByKnowledge[s.knowledgePoint] ?? 50;
      const depth = mastery < 30 ? 'basic' : mastery <= 70 ? 'normal' : 'advanced';

      return {
        id: String(s.id || `s${Math.random().toString(36).slice(2, 6)}`),
        title: String(s.title || s.knowledgePoint || topic),
        knowledgePoint: String(s.knowledgePoint || topic),
        depth: s.depth as LessonSection['depth'] ?? depth,
        hasQuiz: s.hasQuiz !== false,
        estimatedMinutes: typeof s.estimatedMinutes === 'number' ? s.estimatedMinutes : 5,
      };
    });

    return {
      topic: typeof parsed.topic === 'string' ? parsed.topic : topic,
      sections,
      estimatedDuration: typeof parsed.estimatedDuration === 'number'
        ? parsed.estimatedDuration
        : sections.reduce((sum, s) => sum + s.estimatedMinutes, 0),
      focusPoints: Array.isArray(parsed.focusPoints)
        ? (parsed.focusPoints as string[]).slice(0, 5)
        : profile.weakPoints.slice(0, 3),
    };
  } catch (err) {
    log.warn('planLesson failed, using default:', err);
    return getDefaultPlan(topic, profile);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/teaching/lesson-planner.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/teaching/lesson-types.ts lib/teaching/lesson-planner.ts tests/teaching/lesson-planner.test.ts
git commit -m "feat(teaching): add lesson planner with mastery-based depth (D-002)"
```

---

## Task 11: Content Generator + Quiz Injector + Tests (D-003, D-004)

**Files:**
- Create: `lib/teaching/content-generator.ts`
- Create: `lib/teaching/quiz-injector.ts`
- Create: `tests/teaching/content-generator.test.ts`
- Create: `tests/teaching/quiz-injector.test.ts`

- [ ] **Step 1: Write content generator test**

```typescript
// tests/teaching/content-generator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateTeachingContent } from '@/lib/teaching/content-generator';
import type { LessonPlan } from '@/lib/teaching/lesson-types';

vi.mock('@/lib/ai/llm', () => ({
  streamLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock' })),
}));

vi.mock('@/lib/teaching/quiz-injector', () => ({
  generateQuiz: vi.fn(),
}));

const MOCK_PLAN: LessonPlan = {
  topic: '二次函数',
  sections: [
    { id: 's1', title: '基础概念', knowledgePoint: '二次函数', depth: 'basic', hasQuiz: true, estimatedMinutes: 5 },
  ],
  estimatedDuration: 5,
  focusPoints: ['二次函数'],
};

describe('generateTeachingContent', () => {
  it('emits plan event first', async () => {
    const { streamLLM } = await import('@/lib/ai/llm');
    vi.mocked(streamLLM).mockReturnValueOnce({
      textStream: (async function* () { yield '讲解内容'; })(),
    } as any);

    const { generateQuiz } = await import('@/lib/teaching/quiz-injector');
    vi.mocked(generateQuiz).mockResolvedValueOnce(null);

    const events: any[] = [];
    for await (const event of generateTeachingContent(MOCK_PLAN, { weakPoints: [], strongPoints: [], overallAccuracy: 0.5 })) {
      events.push(event);
    }

    expect(events[0]!.type).toBe('plan');
    expect(events[0]!.data.topic).toBe('二次函数');
  });

  it('emits content events for each section', async () => {
    const { streamLLM } = await import('@/lib/ai/llm');
    vi.mocked(streamLLM).mockReturnValueOnce({
      textStream: (async function* () { yield '内容'; })(),
    } as any);

    const { generateQuiz } = await import('@/lib/teaching/quiz-injector');
    vi.mocked(generateQuiz).mockResolvedValueOnce(null);

    const events: any[] = [];
    for await (const event of generateTeachingContent(MOCK_PLAN, { weakPoints: [], strongPoints: [], overallAccuracy: 0.5 })) {
      events.push(event);
    }

    const contentEvents = events.filter((e) => e.type === 'content');
    expect(contentEvents.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Write quiz injector test**

```typescript
// tests/teaching/quiz-injector.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateQuiz } from '@/lib/teaching/quiz-injector';

vi.mock('@/lib/question-bank/dao', () => ({
  search: vi.fn(() => []),
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn(),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn(() => ({ model: 'mock' })),
}));

vi.mock('@/lib/generation/json-repair', () => ({
  parseJsonResponse: vi.fn((text: string) => JSON.parse(text)),
}));

describe('generateQuiz', () => {
  it('returns quiz from question bank if available', async () => {
    const { search } = await import('@/lib/question-bank/dao');
    vi.mocked(search).mockResolvedValueOnce([{
      id: 'q1',
      content: '求二次函数顶点',
      answer: '(0,0)',
      questionType: 'solve',
      options: null,
      explanation: '配方法',
      subject: '数学',
      grade: '高一',
      difficulty: 'easy',
      knowledgePoints: ['二次函数'],
      image: null,
      source: null,
      tags: [],
      problemHash: 'h',
      verified: true,
      createdAt: '',
      updatedAt: '',
    }] as any);

    const quiz = await generateQuiz('二次函数', 'basic');
    expect(quiz).not.toBeNull();
    expect(quiz!.question).toBe('求二次函数顶点');
    expect(quiz!.answer).toBe('(0,0)');
  });

  it('generates quiz via LLM when bank is empty', async () => {
    const { search } = await import('@/lib/question-bank/dao');
    vi.mocked(search).mockResolvedValueOnce([]);

    const { callLLM } = await import('@/lib/ai/llm');
    vi.mocked(callLLM).mockResolvedValueOnce({
      text: JSON.stringify({
        question: '二次函数y=x²的顶点是？',
        options: ['(0,0)', '(1,0)', '(0,1)', '(1,1)'],
        questionType: 'choice',
        answer: '(0,0)',
        explanation: 'y=x²的顶点在原点',
      }),
    } as any);

    const quiz = await generateQuiz('二次函数', 'basic');
    expect(quiz).not.toBeNull();
    expect(quiz!.questionType).toBe('choice');
  });

  it('returns null on failure', async () => {
    const { search } = await import('@/lib/question-bank/dao');
    vi.mocked(search).mockRejectedValueOnce(new Error('db fail'));

    const quiz = await generateQuiz('topic', 'basic');
    expect(quiz).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/teaching/content-generator.test.ts tests/teaching/quiz-injector.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 4: Write `quiz-injector.ts`**

```typescript
// lib/teaching/quiz-injector.ts
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { search } from '@/lib/question-bank/dao';
import { createLogger } from '@/lib/logger';
import type { QuizQuestion } from './lesson-types';

const log = createLogger('QuizInjector');

const QUIZ_SYSTEM_PROMPT = `你是出题专家。根据知识点和难度生成一道检测题。

难度策略：
- basic：基础概念题，考察定义和基本理解
- normal：应用题，考察知识运用能力
- advanced：综合题，考察灵活运用和推理能力

输出纯JSON：
{
  "question": "题目文本",
  "options": ["A选项", "B选项", "C选项", "D选项"],
  "questionType": "choice",
  "answer": "正确答案",
  "explanation": "解析"
}`;

export async function generateQuiz(
  knowledgePoint: string,
  depth: 'basic' | 'normal' | 'advanced',
): Promise<QuizQuestion | null> {
  // First try question bank
  try {
    const matches = await search({
      keyword: knowledgePoint,
      difficulty: depth === 'basic' ? 'easy' : depth === 'advanced' ? 'hard' : 'medium',
      limit: 5,
    });

    if (matches.length > 0) {
      const pick = matches[Math.floor(Math.random() * matches.length)]!;
      return {
        id: pick.id,
        question: pick.content,
        options: pick.options ?? undefined,
        questionType: pick.questionType,
        answer: pick.answer,
        explanation: pick.explanation || '暂无解析',
      };
    }
  } catch (err) {
    log.warn('Question bank search failed:', err);
  }

  // Fallback: generate via LLM
  try {
    const modelConfig = { providerId: 'deepseek' as const, modelId: 'deepseek-v4-flash' };
    const { model } = getModel(modelConfig);

    const result = await callLLM(
      {
        model,
        messages: [{
          role: 'user',
          content: `知识点：${knowledgePoint}\n难度：${depth}\n\n请生成一道检测题。`,
        }] as any,
        temperature: 0.5,
        maxOutputTokens: 512,
      },
      'quiz-injector',
      { retries: 0 },
      undefined,
      QUIZ_SYSTEM_PROMPT,
    );

    const parsed = parseJsonResponse<Record<string, unknown>>(result.text || '');
    if (!parsed || typeof parsed.question !== 'string') {
      return null;
    }

    return {
      id: `gen_${Date.now().toString(36)}`,
      question: parsed.question as string,
      options: Array.isArray(parsed.options) ? (parsed.options as string[]) : undefined,
      questionType: ['choice', 'fill', 'solve', 'judge'].includes(parsed.questionType as string)
        ? (parsed.questionType as QuizQuestion['questionType'])
        : 'choice',
      answer: String(parsed.answer ?? ''),
      explanation: String(parsed.explanation ?? ''),
    };
  } catch (err) {
    log.warn('Quiz generation failed:', err);
    return null;
  }
}
```

- [ ] **Step 5: Write `content-generator.ts`**

```typescript
// lib/teaching/content-generator.ts
import { streamLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { createLogger } from '@/lib/logger';
import { generateQuiz } from './quiz-injector';
import type { LessonPlan, TeachingEvent, QuizQuestion } from './lesson-types';
import type { StudentProfileSummary } from '@/lib/student/profile-types';

const log = createLogger('ContentGenerator');

const CONTENT_SYSTEM_PROMPT = `你是授课老师。根据教学计划，逐段生成授课内容。

要求：
- 语言通俗易懂，适合学生理解
- 数学公式用 $...$ 包裹
- 重要概念加粗
- 每段内容 100-300 字
- 每个知识点讲完后给出 1-2 个例题`;

/**
 * Streaming content generator.
 * Yields TeachingEvent as each section is generated.
 */
export async function* generateTeachingContent(
  plan: LessonPlan,
  profileSummary: StudentProfileSummary,
): AsyncGenerator<TeachingEvent> {
  const startTime = Date.now();

  // Emit profile summary
  yield { type: 'profile', data: profileSummary };

  // Emit lesson plan
  yield { type: 'plan', data: plan };

  // Generate content for each section
  for (const section of plan.sections) {
    try {
      yield { type: 'content', sectionId: section.id, chunkType: 'text', content: '', isLast: false };

      const modelConfig = { providerId: 'deepseek' as const, modelId: 'deepseek-v4-flash' };
      const { model } = getModel(modelConfig);

      const prompt = `请讲解以下内容：

主题：${plan.topic}
当前知识点：${section.knowledgePoint}
深度：${section.depth === 'basic' ? '基础讲解' : section.depth === 'advanced' ? '拓展提升' : '标准讲解'}
${section.depth === 'basic' ? '请从最基础的概念开始，多举例子。' : ''}
${section.depth === 'advanced' ? '请适当拓展，增加一些延伸思考。' : ''}

请生成讲解内容。`;

      const result = streamLLM(
        {
          model,
          system: CONTENT_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }] as any,
          temperature: 0.5,
          maxOutputTokens: 2048,
        },
        'content-gen',
      );

      let content = '';
      for await (const chunk of result.textStream) {
        content += chunk;
        yield { type: 'content', sectionId: section.id, chunkType: 'text', content: chunk, isLast: false };
      }

      // Mark last chunk for this section
      yield { type: 'content', sectionId: section.id, chunkType: 'text', content: '', isLast: true };

      // Inject quiz if section hasQuiz
      if (section.hasQuiz) {
        const quiz = await generateQuiz(section.knowledgePoint, section.depth);
        if (quiz) {
          yield { type: 'quiz', sectionId: section.id, question: quiz };
        }
      }
    } catch (err) {
      log.warn(`Content generation failed for section ${section.id}:`, err);
      // Continue to next section instead of failing
    }
  }

  // Emit done
  const quizSections = plan.sections.filter((s) => s.hasQuiz);
  yield {
    type: 'done',
    totalSections: plan.sections.length,
    quizStats: { totalQuestions: quizSections.length, correctAnswers: 0, accuracy: 0 },
    duration: Math.round((Date.now() - startTime) / 1000),
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/teaching/content-generator.test.ts tests/teaching/quiz-injector.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add lib/teaching/content-generator.ts lib/teaching/quiz-injector.ts tests/teaching/content-generator.test.ts tests/teaching/quiz-injector.test.ts
git commit -m "feat(teaching): add content generator and quiz injector (D-003, D-004)"
```

---

## Task 12: Teaching Stream API (D-003)

**Files:**
- Create: `app/api/sky/teaching/generate-stream/route.ts`

- [ ] **Step 1: Create the SSE route**

```typescript
// app/api/sky/teaching/generate-stream/route.ts
import { createLogger } from '@/lib/logger';
import { buildStudentProfile, summarizeProfile } from '@/lib/student/profile-builder';
import { planLesson } from '@/lib/teaching/lesson-planner';
import { generateTeachingContent } from '@/lib/teaching/content-generator';
import type { TeachingEvent } from '@/lib/teaching/lesson-types';

const log = createLogger('API:TeachingStream');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, subject } = body;

    if (!topic || typeof topic !== 'string') {
      return new Response(
        `data: ${JSON.stringify({ type: 'error', message: 'Missing required field: topic' })}\n\n`,
        { status: 400, headers: { 'Content-Type': 'text/event-stream' } },
      );
    }

    log.info(`[TeachingStream] topic=${topic}, subject=${subject ?? 'all'}`);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = async (event: TeachingEvent) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    };

    (async () => {
      try {
        // Step 1: Build student profile
        const profile = await buildStudentProfile();
        const summary = summarizeProfile(profile);

        // Step 2: Plan lesson
        const plan = await planLesson(profile, topic);

        // Step 3: Generate content with SSE streaming
        for await (const event of generateTeachingContent(plan, summary)) {
          await write(event);
        }

        await writer.close();
      } catch (err) {
        log.error('TeachingStream error:', err);
        try {
          await write({ type: 'error', message: err instanceof Error ? err.message : '授课失败' });
          await writer.close();
        } catch {
          // already closed
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    log.error('TeachingStream API error:', err);
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: '授课失败' })}\n\n`,
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add app/api/sky/teaching/generate-stream/route.ts
git commit -m "feat(teaching): add SSE teaching stream API (D-003)"
```

---

## Task 13: Inline Quiz Component (D-004)

**Files:**
- Create: `components/sky/teaching/inline-quiz.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/sky/teaching/inline-quiz.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { QuizQuestion } from '@/lib/teaching/lesson-types';

interface InlineQuizProps {
  question: QuizQuestion;
  onAnswer: (answer: string) => void;
}

export function InlineQuiz({ question, onAnswer }: InlineQuizProps) {
  const [selected, setSelected] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
    onAnswer(selected);
  };

  return (
    <Card className="border-l-4 border-l-purple-500 my-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">随堂检测</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{question.question}</p>

        {question.questionType === 'choice' && question.options ? (
          <RadioGroup value={selected} onValueChange={setSelected} disabled={submitted}>
            {question.options.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`opt-${idx}`} />
                <Label htmlFor={`opt-${idx}`} className="text-sm">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        ) : (
          <Input
            placeholder="输入答案..."
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={submitted}
          />
        )}

        {!submitted ? (
          <Button size="sm" onClick={handleSubmit} disabled={!selected}>
            提交
          </Button>
        ) : (
          <div className="text-sm p-2 bg-muted rounded">
            <p><strong>正确答案：</strong>{question.answer}</p>
            <p><strong>解析：</strong>{question.explanation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add components/sky/teaching/inline-quiz.tsx
git commit -m "feat(teaching): add inline quiz component (D-004)"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Run all module C tests**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/ --reporter=verbose`
Expected: All tests pass

- [ ] **Step 2: Run all module D tests**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/teaching/ --reporter=verbose`
Expected: All tests pass

- [ ] **Step 3: TypeScript type check**

Run: `cd D:/github/OpenMAIC-firsted-team- && npx tsc --noEmit --pretty 2>&1 | tail -20`
Expected: No new errors

- [ ] **Step 4: Final commit**

```bash
cd D:/github/OpenMAIC-firsted-team-
git add -A
git status
git commit -m "feat: complete team3 Module C (solve chain) + Module D (adaptive teaching)"
```

---

*Plan complete*
