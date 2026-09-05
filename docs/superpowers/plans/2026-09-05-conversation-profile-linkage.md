# 学情画像对话联动三项改进 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/sky/learning/profile` 的对话画像真正做到"LLM 抽取、匿名落库、聊完即同步"。

**Architecture:** 新增 `lib/student/conversation-profile-llm.ts` 用 `callLLM` 做结构化抽取，路由侧 LLM 失败自动回落现有规则抽取；放宽 conversation 路由的落库门控让匿名信号写入 default-user；profile 页把加载逻辑提为 `useCallback` 并在聊天回调后立即 reload 服务端上下文。

**Tech Stack:** Next.js 16 App Router、TypeScript strict、Zod v4、vitest + jsdom、`callLLM`（`lib/ai/llm.ts`）、`parseJsonResponseWithSchema`（`lib/generation/json-repair.ts`）。

**设计文档:** `docs/superpowers/specs/2026-09-05-conversation-profile-linkage-design.md`

**环境注意:** 本机 `pnpm` CLI 损坏（store 链接缺失），所有命令用 `npx` 直调（已验证 `npx vitest` 可用）。

---

### Task 1: LLM 抽取模块 `conversation-profile-llm.ts`

**Files:**
- Create: `lib/student/conversation-profile-llm.ts`
- Test: `tests/student/conversation-profile-llm.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/student/conversation-profile-llm.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedModel } from '@/lib/server/resolve-model';

const callLLMMock = vi.fn();

vi.mock('@/lib/ai/llm', () => ({
  callLLM: (...args: unknown[]) => callLLMMock(...args),
}));

const fakeModel = {
  model: { modelId: 'test-model' },
  modelInfo: {},
  modelString: 'openai/gpt-test',
  providerId: 'openai',
  modelId: 'gpt-test',
  apiKey: 'sk-test',
  keyPool: ['sk-test'],
} as unknown as ResolvedModel;

const VALID_LLM_JSON = {
  learningGoal: {
    value: '两周内补完机器学习',
    confidence: 0.9,
    evidence: ['两周内补机器学习'],
  },
  knowledgeBase: {
    strongPoints: [],
    weakPoints: ['过拟合', '模型评估'],
    confidence: 0.88,
    evidence: ['过拟合和模型评估总是搞不懂'],
  },
  resourcePreference: {
    value: ['代码案例', '图解'],
    confidence: 0.85,
    evidence: ['代码案例和图解'],
  },
  nextQuestion: '我先按这个画像来：目标是两周内补完机器学习。对吗？',
  needsConfirmation: true,
};

describe('extractConversationProfileWithLLM', () => {
  beforeEach(() => {
    callLLMMock.mockReset();
  });

  it('parses a valid LLM JSON payload into an extraction result', async () => {
    callLLMMock.mockResolvedValue({ text: JSON.stringify(VALID_LLM_JSON) });
    const { extractConversationProfileWithLLM } = await import(
      '@/lib/student/conversation-profile-llm'
    );

    const result = await extractConversationProfileWithLLM({
      message: '我想两周内补机器学习，过拟合和模型评估总是搞不懂，希望多用代码案例和图解讲。',
      stage: 'onboarding',
      model: fakeModel,
    });

    expect(result.stage).toBe('onboarding');
    expect(result.profilePatch.learningGoal?.value).toBe('两周内补完机器学习');
    expect(result.profilePatch.knowledgeBase?.weakPoints).toEqual(['过拟合', '模型评估']);
    expect(result.profilePatch.resourcePreference?.value).toEqual(['代码案例', '图解']);
    expect(result.evidence).toContain('过拟合和模型评估总是搞不懂');
    expect(result.nextQuestion).toContain('对吗');
    expect(result.needsConfirmation).toBe(true);

    expect(callLLMMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: fakeModel.model, system: expect.any(String) }),
      'student-profile-conversation',
      expect.objectContaining({ retries: 1, timeoutMs: 25_000 }),
      undefined,
    );
  });

  it('throws when the LLM replies with invalid JSON', async () => {
    callLLMMock.mockResolvedValue({ text: '这不是 JSON' });
    const { extractConversationProfileWithLLM } = await import(
      '@/lib/student/conversation-profile-llm'
    );

    await expect(
      extractConversationProfileWithLLM({ message: '随便聊聊', stage: 'onboarding', model: fakeModel }),
    ).rejects.toThrow();
  });

  it('throws when the payload fails schema validation', async () => {
    callLLMMock.mockResolvedValue({
      text: JSON.stringify({
        learningGoal: { value: '补数学', confidence: 'high', evidence: [] },
        nextQuestion: '下一步？',
        needsConfirmation: false,
      }),
    });
    const { extractConversationProfileWithLLM } = await import(
      '@/lib/student/conversation-profile-llm'
    );

    await expect(
      extractConversationProfileWithLLM({ message: '我想补数学', stage: 'onboarding', model: fakeModel }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/student/conversation-profile-llm.test.ts`
Expected: FAIL（模块不存在，`Cannot find module '@/lib/student/conversation-profile-llm'`）

- [ ] **Step 3: 实现模块**

创建 `lib/student/conversation-profile-llm.ts`：

```ts
import { z } from 'zod';

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponseWithSchema } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type {
  ConversationProfileExtractionResult,
  ConversationProfileStage,
  ConversationalProfilePatch,
} from '@/lib/student/conversation-profile';

export const PROFILE_EXTRACTION_SOURCE = 'student-profile-conversation';
export const PROFILE_EXTRACTION_TIMEOUT_MS = 25_000;

const stringDimensionSchema = z.object({
  value: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
});

const stringListDimensionSchema = z.object({
  value: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
});

const knowledgeBaseSchema = z.object({
  strongPoints: z.array(z.string()).default([]),
  weakPoints: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
});

const llmExtractionSchema = z.object({
  majorBackground: stringDimensionSchema.optional(),
  learningGoal: stringDimensionSchema.optional(),
  knowledgeBase: knowledgeBaseSchema.optional(),
  cognitiveStyle: stringDimensionSchema.optional(),
  errorPatternPreference: stringListDimensionSchema.optional(),
  resourcePreference: stringListDimensionSchema.optional(),
  interactionPreference: stringDimensionSchema.optional(),
  learningPace: stringDimensionSchema.optional(),
  currentLearningState: stringDimensionSchema.optional(),
  nextQuestion: z.string().min(1),
  needsConfirmation: z.boolean(),
});

const SYSTEM_PROMPT = `你是学习画像抽取器。从学生的一条消息中抽取画像信息，stage 表示对话阶段（onboarding 破冰 / learning 学习中 / review 复习）。
只输出一个 JSON 对象，不要输出任何其他内容。字段：
- majorBackground: { value, confidence, evidence } 专业/年级/课程背景
- learningGoal: { value, confidence, evidence } 学习目标
- knowledgeBase: { strongPoints, weakPoints, confidence, evidence } 已会与薄弱知识点列表
- cognitiveStyle: { value, confidence, evidence } 认知风格（如具象化理解、抽象推理）
- errorPatternPreference: { value: string[], confidence, evidence } 易错模式
- resourcePreference: { value: string[], confidence, evidence } 资源偏好，取值仅限：例题拆解、代码案例、图解、练习题、视频、文字总结
- interactionPreference: { value, confidence, evidence } 讲解偏好（如步骤优先、原理优先、先例题后总结）
- learningPace: { value, confidence, evidence } 学习节奏与时间压力
- currentLearningState: { value, confidence, evidence } 当前状态（焦虑、赶进度、刚入门等）
- nextQuestion: string，根据已抽取内容提出的下一个追问，中文一句话
- needsConfirmation: boolean，当目标、薄弱点、偏好已基本齐全时为 true，用于触发画像确认
规则：confidence 取 0-1；evidence 填学生原话片段；消息里没提到的维度一律省略，不要编造。`;

export async function extractConversationProfileWithLLM(input: {
  message: string;
  stage: ConversationProfileStage;
  model: ResolvedModel;
}): Promise<ConversationProfileExtractionResult> {
  const result = await callLLM(
    {
      model: input.model.model,
      system: SYSTEM_PROMPT,
      prompt: `学生消息（stage=${input.stage}）：\n${input.message}`,
      temperature: 0.2,
      maxOutputTokens: 800,
    },
    PROFILE_EXTRACTION_SOURCE,
    { retries: 1, timeoutMs: PROFILE_EXTRACTION_TIMEOUT_MS },
    input.model.thinkingConfig,
  );

  const parsed = parseJsonResponseWithSchema(result.text, llmExtractionSchema);
  if (!parsed) {
    throw new Error('LLM profile extraction returned invalid JSON');
  }

  const profilePatch: ConversationalProfilePatch = {
    majorBackground: parsed.majorBackground,
    learningGoal: parsed.learningGoal,
    knowledgeBase: parsed.knowledgeBase,
    cognitiveStyle: parsed.cognitiveStyle,
    errorPatternPreference: parsed.errorPatternPreference,
    resourcePreference: parsed.resourcePreference,
    interactionPreference: parsed.interactionPreference,
    learningPace: parsed.learningPace,
    currentLearningState: parsed.currentLearningState,
  };
  for (const key of Object.keys(profilePatch) as (keyof ConversationalProfilePatch)[]) {
    if (!profilePatch[key]) delete profilePatch[key];
  }

  const evidence = Array.from(
    new Set(
      Object.values(profilePatch).flatMap((dimension) =>
        dimension && 'evidence' in dimension ? dimension.evidence : [],
      ),
    ),
  );

  return {
    stage: input.stage,
    profilePatch,
    evidence,
    nextQuestion: parsed.nextQuestion,
    needsConfirmation: parsed.needsConfirmation,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/student/conversation-profile-llm.test.ts`
Expected: PASS（3 个用例全绿）

- [ ] **Step 5: 提交**

```bash
git add lib/student/conversation-profile-llm.ts tests/student/conversation-profile-llm.test.ts
git commit -m "feat: add LLM-based conversational profile extraction with schema validation"
```

---

### Task 2: 路由接入 LLM 优先 + 匿名落库 default-user

**Files:**
- Modify: `app/api/sky/student/profile/conversation/route.ts`
- Test: `tests/student/profile-conversation-route.test.ts`（现有 1 个用例当前是红的，本任务让它转绿并补 LLM 路径用例）

- [ ] **Step 1: 更新测试（先失败）**

`tests/student/profile-conversation-route.test.ts` 全量替换为：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import { createProfileSignalDAO } from '@/lib/student/profile-signals';

vi.mock('server-only', () => ({}));

const storage = new MemoryStorageProvider();

vi.mock('@/lib/server/server-storage', () => ({
  getServerStorage: async () => storage,
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

const resolveModelFromRequestMock = vi.fn();

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModelFromRequest: (...args: unknown[]) => resolveModelFromRequestMock(...args),
}));

const callLLMMock = vi.fn();

vi.mock('@/lib/ai/llm', () => ({
  callLLM: (...args: unknown[]) => callLLMMock(...args),
}));

const VALID_LLM_JSON = {
  learningGoal: {
    value: '考前补完数据结构的链表与树',
    confidence: 0.9,
    evidence: ['下周要考数据结构'],
  },
  knowledgeBase: {
    strongPoints: [],
    weakPoints: ['链表'],
    confidence: 0.86,
    evidence: ['链表老是写错'],
  },
  nextQuestion: '我先按这个画像来：目标是考前补完数据结构。对吗？',
  needsConfirmation: true,
};

async function postMessage(message: string) {
  const { POST } = await import('@/app/api/sky/student/profile/conversation/route');
  const req = new Request('http://localhost/api/sky/student/profile/conversation', {
    method: 'POST',
    body: JSON.stringify({ sessionId: 'profile-onboarding-test', message, stage: 'onboarding' }),
  });
  const response = await POST(req as unknown as NextRequest);
  return response.json();
}

describe('profile conversation route', () => {
  beforeEach(() => {
    resolveModelFromRequestMock.mockReset();
    callLLMMock.mockReset();
    resolveModelFromRequestMock.mockRejectedValue(new Error('no model configured'));
  });

  it('persists extracted profile signals for the demo user when no userId is provided', async () => {
    const payload = await postMessage(
      '我想两周内补机器学习，过拟合和模型评估总是搞不懂，希望多用代码案例和图解讲。',
    );
    const signals = await createProfileSignalDAO(storage).listByUser('default-user');

    expect(payload.success).toBe(true);
    expect(payload.data.extractionSource).toBe('rules');
    expect(payload.data.profileSignals.length).toBeGreaterThan(0);
    expect(payload.data.conversationProfile).toBeDefined();
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'default-user',
          source: 'onboarding_chat',
        }),
      ]),
    );
  });

  it('uses LLM extraction and persists its patch when a model resolves', async () => {
    resolveModelFromRequestMock.mockResolvedValue({
      model: { modelId: 'test-model' },
      thinkingConfig: undefined,
    });
    callLLMMock.mockResolvedValue({ text: JSON.stringify(VALID_LLM_JSON) });

    const payload = await postMessage('我下周要考数据结构，链表老是写错，多给点代码案例。');
    const signals = await createProfileSignalDAO(storage).listByUser('default-user');

    expect(payload.success).toBe(true);
    expect(payload.data.extractionSource).toBe('llm');
    expect(payload.data.profilePatch.learningGoal.value).toBe('考前补完数据结构的链表与树');
    expect(payload.data.profileSignals.length).toBeGreaterThan(0);
    expect(signals.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/student/profile-conversation-route.test.ts`
Expected: FAIL——第一个用例仍因 `currentUser &&` 门控断言 `0 to be greater than 0` 失败；第二个用例因路由尚未返回 `extractionSource` 失败。

- [ ] **Step 3: 改造路由**

`app/api/sky/student/profile/conversation/route.ts` 全量替换为：

```ts
import { NextRequest } from 'next/server';

import { buildSoftwareCupProfile } from '@/lib/software-cup/demo-service';
import { createLogger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/server/auth/helpers';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { getServerStorage } from '@/lib/server/server-storage';
import {
  extractConversationProfile,
  extractConversationProfileWithLLM,
  type ConversationProfileExtractionResult,
  type ConversationProfileStage,
} from '@/lib/student/conversation-profile';
import {
  buildConversationProfileFromSignals,
  conversationPatchToSignals,
  createProfileSignalDAO,
} from '@/lib/student/profile-signals';

const log = createLogger('API:StudentProfileConversation');
const DEFAULT_PROFILE_USER_ID = 'default-user';

async function extractWithFallback(
  req: NextRequest,
  body: { stage?: ConversationProfileStage },
  input: string,
): Promise<{ extraction: ConversationProfileExtractionResult; extractionSource: 'llm' | 'rules' }> {
  const stage = body.stage ?? 'onboarding';
  const rulesExtraction = extractConversationProfile({ message: input, stage });

  try {
    const { model } = await resolveModelFromRequest(req, body);
    const extraction = await extractConversationProfileWithLLM({ message: input, stage, model });
    return { extraction, extractionSource: 'llm' };
  } catch (err) {
    log.warn('LLM profile extraction unavailable, falling back to rules:', err);
    return { extraction: rulesExtraction, extractionSource: 'rules' };
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    input?: string;
    message?: string;
    sessionId?: string;
    stage?: ConversationProfileStage;
  };
  const input = body.input || body.message || '';
  const currentUser = await getCurrentUser();
  const userId = currentUser?.id ?? DEFAULT_PROFILE_USER_ID;
  const [{ extraction, extractionSource }, profile] = await Promise.all([
    extractWithFallback(req, body, input),
    buildSoftwareCupProfile(input),
  ]);

  profile.userId = userId;

  const profileSignals = input.trim()
    ? conversationPatchToSignals({
        userId,
        patch: extraction.profilePatch,
        stage: extraction.stage,
      })
    : [];

  let conversationProfile = {};

  if (profileSignals.length > 0) {
    const storage = await getServerStorage();
    const profileSignalDAO = createProfileSignalDAO(storage);
    await profileSignalDAO.addMany(profileSignals);
    const signals = await profileSignalDAO.listByUser(userId);
    conversationProfile = buildConversationProfileFromSignals(signals);
  }

  return Response.json({
    success: true,
    data: {
      sessionId: body.sessionId,
      stage: extraction.stage,
      nextQuestion: extraction.nextQuestion,
      profilePatch: extraction.profilePatch,
      profileSignals,
      conversationProfile,
      needsConfirmation: extraction.needsConfirmation,
      extractionSource,
      profile,
      patch: profile.dimensions,
      evidence: [
        ...extraction.evidence,
        ...profile.dimensions.majorBackground.evidence,
        ...profile.dimensions.learningGoal.evidence,
        ...profile.dimensions.knowledgeBase.evidence,
        ...profile.dimensions.cognitiveStyle.evidence,
        ...profile.dimensions.errorPatternPreference.evidence,
        ...profile.dimensions.resourcePreference.evidence,
        ...profile.dimensions.learningPace.evidence,
        ...profile.dimensions.currentLearningState.evidence,
      ],
    },
  });
}
```

注意差异：`profileSignals` 条件从 `currentUser && input.trim()` 改为 `input.trim()`；`extractionSource` 进入响应；`buildSoftwareCupProfile` 调用保持不动（Promise.all 改为并行 `extractWithFallback` 与 `buildSoftwareCupProfile`）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/student/profile-conversation-route.test.ts`
Expected: PASS（2 个用例全绿，含之前失败的匿名落库回归用例）

- [ ] **Step 5: 提交**

```bash
git add app/api/sky/student/profile/conversation/route.ts tests/student/profile-conversation-route.test.ts
git commit -m "fix: persist anonymous profile signals and prefer LLM extraction with rule fallback"
```

---

### Task 3: profile 页聊天后即时刷新服务端画像

**Files:**
- Modify: `components/sky/learning/profile-completion-page.tsx`
- Test: `tests/components/profile-completion-page.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `tests/components/profile-completion-page.test.tsx`：

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { PersonalizationContext } from '@/lib/cloud-mind/types';

const fetchMock = vi.fn();

const contextPayload = {
  success: true,
  data: {
    userId: 'u1',
    generatedAt: Date.now(),
    hasLearningData: true,
    weakPoints: [],
    masteryByKnowledge: {},
    recentAccuracy: null,
    dueReviews: [],
    errorPatterns: [],
    preferredDifficulty: 'medium',
    recommendation: { title: 't', reason: 'r', targetTool: 'quiz' },
  } as unknown as PersonalizationContext,
};

vi.mock('@/components/sky/layout/app-shell', () => ({
  SkyAppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/sky/student/profile-onboarding-chat', () => ({
  ProfileOnboardingChat: ({
    onPatchChange,
  }: {
    onPatchChange?: (patch: unknown) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onPatchChange?.({
          learningGoal: { value: '两周内补机器学习', confidence: 0.9, evidence: [] },
        })
      }
    >
      simulate-patch
    </button>
  ),
}));

describe('ProfileCompletionPage', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => contextPayload,
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('reloads the personalization context after a chat patch arrives', async () => {
    const { ProfileCompletionPage } = await import(
      '@/components/sky/learning/profile-completion-page'
    );

    render(<ProfileCompletionPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('simulate-patch'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/sky/cloud-mind/personalization-context',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/components/profile-completion-page.test.tsx`
Expected: FAIL——点击后 fetch 仍只被调用 1 次（`expected 1 to be 2`）。

- [ ] **Step 3: 实现改动**

修改 `components/sky/learning/profile-completion-page.tsx`：

3a. import 行补充 `useCallback`（第 3 行改为）：

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
```

3b. 把组件内原 `useEffect(() => { ... loadPersonalization 定义与调用 ... }, [])` 整块（约 312-348 行）替换为：

```tsx
  const loadPersonalization = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = (await response.json()) as {
        success?: boolean;
        data?: PersonalizationContext;
        error?: string;
      };

      if (response.ok && json.success && json.data) {
        setPersonalization(json.data);
      } else {
        setError(json.error ?? '学习情况暂时不可用，你仍然可以先通过对话补充信息。');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '学习情况加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPersonalization();
  }, [loadPersonalization]);
```

3c. 聊天组件的 `onPatchChange`（原第 428 行 `onPatchChange={setPatch}`）替换为：

```tsx
              onPatchChange={(incomingPatch) => {
                setPatch(incomingPatch);
                void loadPersonalization();
              }}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/components/profile-completion-page.test.tsx`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add components/sky/learning/profile-completion-page.tsx tests/components/profile-completion-page.test.tsx
git commit -m "feat: reload personalization context after profile chat updates"
```

---

### Task 4: 全量验证

- [ ] **Step 1: Prettier**

Run: `npx prettier lib/student/conversation-profile-llm.ts tests/student/conversation-profile-llm.test.ts app/api/sky/student/profile/conversation/route.ts tests/student/profile-conversation-route.test.ts components/sky/learning/profile-completion-page.tsx tests/components/profile-completion-page.test.tsx --write`
Expected: 全部文件被格式化或无变更，无报错

- [ ] **Step 2: ESLint**

Run: `npx eslint lib/student/conversation-profile-llm.ts app/api/sky/student/profile/conversation/route.ts components/sky/learning/profile-completion-page.tsx tests/student/conversation-profile-llm.test.ts tests/student/profile-conversation-route.test.ts tests/components/profile-completion-page.test.tsx`
Expected: 0 error（warning 允许）

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增错误（若仓库已有历史错误，确认不涉及本次改动的文件）

- [ ] **Step 4: 全量单测**

Run: `npx vitest run`
Expected: 全绿（重点关注 `tests/student/`、`tests/components/` 无回归）

- [ ] **Step 5: 提交格式化产物（如有）**

```bash
git add -A lib/student tests/student components/sky/learning tests/components
git diff --cached --quiet || git commit -m "style: format conversation profile changes"
```
