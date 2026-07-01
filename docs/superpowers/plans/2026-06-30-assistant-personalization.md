# Assistant Personalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sky Assistant use student profile, preferences, RAG evidence, and lightweight action decisions to produce more personalized learning responses.

**Architecture:** Add pure assistant personalization modules under `lib/assistant/`, test them with Vitest, then inject the generated strategy prompt into `app/api/sky/assistant/route.ts`. The first implementation keeps tool routing lightweight and prompt-driven, so existing streaming behavior and UI remain stable.

**Tech Stack:** Next.js 16 API routes, TypeScript, Vitest, existing storage DAOs, existing student profile and mistake graph modules.

---

### Task 1: Strategy And Evidence Tests

**Files:**
- Create: `tests/assistant/personalization.test.ts`
- Create: `lib/assistant/personalization.ts`

- [ ] **Step 1: Write failing unit tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildAssistantActionPlan,
  buildAssistantPersonalizationPrompt,
  buildAssistantRagEvidence,
  buildAssistantStrategy,
} from '@/lib/assistant/personalization';

describe('assistant personalization', () => {
  it('lowers difficulty and starts with hints when the question touches weak knowledge', () => {
    const strategy = buildAssistantStrategy({
      userMessage: '二次函数顶点式怎么配方？',
      style: 'detailed',
      profile: {
        userId: 'u1',
        masteryBySubject: { math: 40 } as any,
        masteryByKnowledge: { 二次函数顶点式: 22 },
        weakPoints: ['二次函数顶点式'],
        strongPoints: [],
        errorPatterns: [
          {
            knowledgePoint: '二次函数顶点式',
            errorType: 'concept-unclear',
            frequency: 4,
            lastOccurrence: new Date('2026-06-01'),
          },
        ],
        totalQuestions: 12,
        totalCorrect: 5,
        lastUpdated: new Date('2026-06-01'),
      },
    });

    expect(strategy.difficulty).toBe('easier');
    expect(strategy.teachingMode).toBe('hint_first');
    expect(strategy.shouldMentionProfile).toBe(true);
    expect(strategy.recommendedNextAction).toBe('quiz');
  });

  it('respects explicit concise and visual preferences', () => {
    const strategy = buildAssistantStrategy({
      userMessage: '解释一下力的合成',
      style: 'detailed',
      personalization: {
        detailLevel: 'concise',
        learningStyle: 'visual',
        aiPersonality: 'professional',
      },
    });

    expect(strategy.answerDepth).toBe('concise');
    expect(strategy.teachingMode).toBe('visual');
    expect(strategy.tone).toBe('professional');
  });

  it('selects RAG evidence from matching mistakes and solve history', () => {
    const evidence = buildAssistantRagEvidence({
      userMessage: '二次函数图像平移老是弄错',
      mistakes: [
        {
          id: 'm1',
          problemText: '二次函数图像向左平移',
          userAnswer: '向右',
          correctAnswer: '向左',
          errorType: 'concept',
          knowledgePoints: ['二次函数图像平移'],
          reviewCount: 0,
          masteryLevel: 0,
          reviewed: false,
        },
        {
          id: 'm2',
          problemText: '英语语法题',
          userAnswer: 'A',
          correctAnswer: 'B',
          errorType: 'reading',
          knowledgePoints: ['定语从句'],
          reviewCount: 0,
          masteryLevel: 0,
          reviewed: false,
        },
      ],
      solveHistory: [
        {
          id: 'q1',
          problemText: '求二次函数顶点',
          knowledgePoints: [{ name: '二次函数图像平移' }],
        } as any,
      ],
    });

    expect(evidence.items.map((item) => item.sourceId)).toEqual(['m1', 'q1']);
    expect(evidence.summary).toContain('二次函数图像平移');
  });

  it('detects lightweight action plans from student feedback', () => {
    expect(buildAssistantActionPlan('我懂了').primaryAction).toBe('update_mastery');
    expect(buildAssistantActionPlan('再练一题').primaryAction).toBe('generate_quiz');
    expect(buildAssistantActionPlan('复习一下三角函数').primaryAction).toBe('review_plan');
  });

  it('builds a compact prompt without leaking raw JSON', () => {
    const prompt = buildAssistantPersonalizationPrompt({
      userMessage: '这道二次函数题怎么做？',
      strategy: {
        answerDepth: 'detailed',
        teachingMode: 'hint_first',
        difficulty: 'easier',
        tone: 'encouraging',
        shouldMentionProfile: true,
        recommendedNextAction: 'quiz',
      },
      evidence: {
        summary: '相关证据：二次函数顶点式掌握度较低。',
        items: [],
      },
    });

    expect(prompt).toContain('【个性化教学策略】');
    expect(prompt).toContain('自然提及');
    expect(prompt).not.toContain('{');
    expect(prompt.length).toBeLessThan(1800);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/assistant/personalization.test.ts`

Expected: FAIL because `@/lib/assistant/personalization` does not exist.

- [ ] **Step 3: Implement minimal pure module**

Create `lib/assistant/personalization.ts` exporting:

```ts
export function buildAssistantStrategy(input: BuildAssistantStrategyInput): AssistantStrategy
export function buildAssistantRagEvidence(input: BuildAssistantRagEvidenceInput): AssistantRagEvidence
export function buildAssistantActionPlan(message: string): AssistantActionPlan
export function buildAssistantPersonalizationPrompt(input: BuildAssistantPromptInput): string
export function pickPersonalizationFromUser(user: UserEntry | null): AssistantPersonalization
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/assistant/personalization.test.ts`

Expected: PASS.

### Task 2: Assistant API Integration

**Files:**
- Modify: `app/api/sky/assistant/route.ts`

- [ ] **Step 1: Extend context loading**

Add authenticated user lookup with `getCurrentUser()`, safely build `StudentProfile` for authenticated users, and keep anonymous users on the current fallback path.

- [ ] **Step 2: Build and append personalization prompt**

Use:

```ts
const latestUserMessage = aiMessages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
const personalization = pickPersonalizationFromUser(currentUser);
const strategy = buildAssistantStrategy({ userMessage: latestUserMessage, style, profile, personalization });
const evidence = buildAssistantRagEvidence({ userMessage: latestUserMessage, mistakes, graphNodes, solveHistory });
const actionPlan = buildAssistantActionPlan(latestUserMessage);
systemPrompt += buildAssistantPersonalizationPrompt({ userMessage: latestUserMessage, strategy, evidence, actionPlan });
```

- [ ] **Step 3: Preserve streaming behavior**

Do not change the SSE event schema: keep `text_delta`, `done`, and `error`.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run tests/assistant/personalization.test.ts`

Expected: PASS.

### Task 3: Verification

**Files:**
- Verify only, no required edits.

- [ ] **Step 1: Typecheck relevant changes**

Run: `npx tsc --noEmit --pretty false`

Expected: no TypeScript errors from new assistant files or route integration.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: no ESLint errors from new assistant files or route integration.

- [ ] **Step 3: Report pre-existing failures separately**

If project-level checks fail in unrelated dirty files, report the exact command and the unrelated files/errors without reverting user changes.
