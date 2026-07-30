# Learning Profile Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user requested inline execution with focused self-review; do not add multi-agent review stages.

**Goal:** 为新注册用户和尚未处理画像的现有普通用户增加一个可跳过、三步完成的学习画像 onboarding，并让自评信息在无学习数据时改善诊断推荐。

**Architecture:** 在现有 `UserEntry` 上增加一个版本化 `learningOnboarding` JSON 字段，继续复用原有教育阶段、年级和兴趣学科字段。认证接口只暴露精简状态，全局 gate 负责一次性引导；真实 `StudentProfile` 仍只由错题和测验生成，自评弱势学科只用于冷启动推荐。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Zod, Zustand auth context, unified StorageProvider, Vitest, Testing Library, Playwright.

## Global Constraints

- 首版仅支持初中和高中，年级限定为初一、初二、初三、高一、高二、高三。
- 问卷固定三步，允许明确跳过；跳过后不再自动引导。
- 管理员、访客、认证页面和 onboarding 页面不触发 gate。
- 自评弱势只到学科级，不得写入 `StudentProfile.masteryBySubject`、`masteryByKnowledge` 或 `weakPoints`。
- 真实学习数据存在时，实测画像优先于自评弱势。
- `redirect` 只接受单斜线开头的站内路径；拒绝 `//` 和带协议的值。
- 不增加新依赖，不新建第二套画像引擎，不重构认证或学生画像架构。
- 不做动态问卷、草稿持久化、强制诊断或学习人格分类。
- 只做聚焦自审和项目标准验证，不加入额外代码审查流程。

---

## File Map

**Create**

- `lib/onboarding/types.ts`: 常量、Zod schema、持久化类型和状态解析。
- `app/api/user/learning-onboarding/route.ts`: 读取和完成画像。
- `app/api/user/learning-onboarding/skip/route.ts`: 记录跳过。
- `components/auth/onboarding-gate.tsx`: 登录后的单次路由引导。
- `components/sky/onboarding/learning-profile-onboarding.tsx`: 三步表单和完成摘要。
- `app/sky/onboarding/page.tsx`: onboarding 页面入口。
- `components/sky/dashboard/learning-profile-prompt.tsx`: 跳过后的轻量入口。
- `migrations/006_learning_onboarding.sql`: Supabase 用户表 JSON 字段。
- `tests/onboarding/*.test.{ts,tsx}`: 契约、API、gate、UI 和入口测试。

**Modify**

- `lib/storage/dao/users.ts`, `lib/storage/mysql-provider.ts`: 用户类型和 JSON 映射。
- `app/api/auth/register/route.ts`, `app/api/auth/seed-admin/route.ts`, `lib/client/admin-seed.ts`: 默认值。
- `app/api/auth/me/route.ts`, `components/auth/auth-provider.tsx`, `app/layout.tsx`: 状态和 gate。
- `app/auth/register/page.tsx`: 注册后的入口。
- `lib/assistant/personalization.ts`, `lib/agents/personalization-utils.ts`: 具体教学偏好。
- `lib/cloud-mind/personalization-context.ts`, `app/api/sky/cloud-mind/personalization-context/route.ts`: 冷启动诊断推荐。
- `app/sky/page.tsx`, `components/account/personalization-form.tsx`: 非阻塞完善入口。

---

### Task 1: Define The Versioned Onboarding Contract

**Files:**

- Create: `lib/onboarding/types.ts`
- Create: `tests/onboarding/types.test.ts`

**Interfaces:**

- Produces: `CURRENT_ONBOARDING_VERSION`, `completeLearningOnboardingSchema`, `LearningOnboardingProfile`, `LearningOnboardingStatus`, `getLearningOnboardingStatus()`.
- Consumes: `Subject` from `lib/solve/agents/analyze-types.ts`.

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  completeLearningOnboardingSchema,
  getLearningOnboardingStatus,
} from '@/lib/onboarding/types';

const valid = {
  educationLevel: 'middle',
  grade: '初二',
  favoriteSubjects: ['math', 'physics'],
  weakSubjects: ['math'],
  learningGoal: 'build-foundations',
  goalDetail: '先补齐代数基础',
  teachingPreference: 'step-by-step',
};

describe('learning onboarding contract', () => {
  it('accepts a complete middle-school profile', () => {
    expect(completeLearningOnboardingSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a grade outside the selected stage', () => {
    expect(() =>
      completeLearningOnboardingSchema.parse({ ...valid, grade: '高一' }),
    ).toThrow('年级与学习阶段不匹配');
  });

  it('rejects unsupported subjects and long details', () => {
    expect(() =>
      completeLearningOnboardingSchema.parse({
        ...valid,
        weakSubjects: ['computer'],
        goalDetail: 'x'.repeat(121),
      }),
    ).toThrow();
  });

  it('maps null and terminal records to public status', () => {
    expect(getLearningOnboardingStatus(null)).toBe('pending');
    expect(
      getLearningOnboardingStatus({ version: 1, status: 'skipped', skippedAt: 1 }),
    ).toBe('skipped');
  });
});
```

- [ ] **Step 2: Run the test to verify the missing-module failure**

Run: `pnpm vitest run tests/onboarding/types.test.ts`

Expected: FAIL because `@/lib/onboarding/types` does not exist.

- [ ] **Step 3: Implement the contract**

```ts
import { z } from 'zod';
import type { Subject } from '@/lib/solve/agents/analyze-types';

export const CURRENT_ONBOARDING_VERSION = 1 as const;
export const ONBOARDING_SUBJECT_IDS = [
  'math', 'physics', 'chemistry', 'biology', 'chinese',
  'english', 'history', 'geography', 'politics',
] as const satisfies readonly Subject[];
export const LEARNING_GOALS = [
  'improve-grades', 'exam-prep', 'build-foundations', 'explore-interest',
] as const;
export const TEACHING_PREFERENCES = [
  'example-first', 'visual-explanation', 'step-by-step', 'practice-first', 'balanced',
] as const;

const subjectSchema = z.enum(ONBOARDING_SUBJECT_IDS);

export const completeLearningOnboardingSchema = z
  .object({
    educationLevel: z.enum(['middle', 'high']),
    grade: z.enum(['初一', '初二', '初三', '高一', '高二', '高三']),
    favoriteSubjects: z.array(subjectSchema).max(9),
    weakSubjects: z.array(subjectSchema).max(9),
    learningGoal: z.enum(LEARNING_GOALS),
    goalDetail: z.string().trim().max(120).optional(),
    teachingPreference: z.enum(TEACHING_PREFERENCES),
  })
  .superRefine((value, ctx) => {
    const grades = value.educationLevel === 'middle'
      ? ['初一', '初二', '初三']
      : ['高一', '高二', '高三'];
    if (!grades.includes(value.grade)) {
      ctx.addIssue({
        code: 'custom', path: ['grade'], message: '年级与学习阶段不匹配',
      });
    }
  });

export type CompleteLearningOnboardingInput = z.infer<
  typeof completeLearningOnboardingSchema
>;
export type TeachingPreference = CompleteLearningOnboardingInput['teachingPreference'];

export type LearningOnboardingProfile =
  | ({
      version: typeof CURRENT_ONBOARDING_VERSION;
      status: 'completed';
      completedAt: number;
    } & Pick<
      CompleteLearningOnboardingInput,
      'weakSubjects' | 'learningGoal' | 'goalDetail' | 'teachingPreference'
    >)
  | {
      version: typeof CURRENT_ONBOARDING_VERSION;
      status: 'skipped';
      skippedAt: number;
    };

export type LearningOnboardingStatus = 'pending' | 'completed' | 'skipped';

export function getLearningOnboardingStatus(
  profile: LearningOnboardingProfile | null | undefined,
): LearningOnboardingStatus {
  if (!profile || profile.version !== CURRENT_ONBOARDING_VERSION) return 'pending';
  return profile.status;
}
```

- [ ] **Step 4: Run the focused test**

Run: `pnpm vitest run tests/onboarding/types.test.ts`

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the contract**

```bash
git add lib/onboarding/types.ts tests/onboarding/types.test.ts
git commit -m "feat: define learning onboarding contract"
```

---

### Task 2: Persist The Profile In Existing User Storage

**Files:**

- Modify: `lib/storage/dao/users.ts`
- Modify: `lib/storage/mysql-provider.ts`
- Modify: `app/api/auth/register/route.ts`
- Modify: `app/api/auth/seed-admin/route.ts`
- Modify: `lib/client/admin-seed.ts`
- Create: `migrations/006_learning_onboarding.sql`
- Test: `tests/storage/memory-provider.test.ts`

**Interfaces:**

- Consumes: `LearningOnboardingProfile` from Task 1.
- Produces: `UserEntry.learningOnboarding` and MySQL JSON round trips.

- [ ] **Step 1: Add a failing user round-trip assertion**

Extend the existing memory-provider user fixture with:

```ts
learningOnboarding: {
  version: 1,
  status: 'completed',
  weakSubjects: ['math'],
  learningGoal: 'build-foundations',
  teachingPreference: 'step-by-step',
  completedAt: 100,
},
```

Assert `loaded?.data.learningOnboarding` equals the full object.

- [ ] **Step 2: Run the focused storage test**

Run: `pnpm vitest run tests/storage/memory-provider.test.ts`

Expected: FAIL because `UserEntry` has no `learningOnboarding` field.

- [ ] **Step 3: Extend the user type and creation defaults**

Add `learningOnboarding: LearningOnboardingProfile | null` to `UserEntry`. Set it to `null` in registration, server admin seed and client admin seed. Do not infer completion from existing settings.

- [ ] **Step 4: Add database columns and exact mappings**

Create the Supabase migration:

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS favorite_subjects JSONB,
  ADD COLUMN IF NOT EXISTS learning_onboarding JSONB;
```

Add `favorite_subjects JSON` and `learning_onboarding JSON` to the MySQL users table definition and users insert/upsert. Serialize values with:

```ts
data.favoriteSubjects ? JSON.stringify(data.favoriteSubjects) : null,
data.learningOnboarding ? JSON.stringify(data.learningOnboarding) : null,
```

Parse both values in `rowToUserEntry()`:

```ts
function parseJsonColumn<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}
```

Update SQL column order, placeholder count and values array together. Do not alter unrelated provider branches.

Add these idempotent upgrade statements to the MySQL initialization sequence after the users table creation so an existing database receives the columns:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_subjects JSON;
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_onboarding JSON;
```

- [ ] **Step 5: Run storage and type checks**

Run: `pnpm vitest run tests/storage/memory-provider.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit the storage change**

```bash
git add lib/storage/dao/users.ts lib/storage/mysql-provider.ts migrations/006_learning_onboarding.sql app/api/auth/register/route.ts app/api/auth/seed-admin/route.ts lib/client/admin-seed.ts tests/storage/memory-provider.test.ts
git commit -m "feat: persist learning onboarding profiles"
```

---

### Task 3: Expose Authenticated Onboarding APIs

**Files:**

- Create: `app/api/user/learning-onboarding/route.ts`
- Create: `app/api/user/learning-onboarding/skip/route.ts`
- Create: `tests/onboarding/learning-onboarding-api.test.ts`

**Interfaces:**

- Consumes: contract from Task 1, `requireAuth()`, `createUserDAO()`, `SUBJECT_CONFIG`.
- Produces: authenticated GET, PUT and skip responses.

- [ ] **Step 1: Write failing route tests**

Mock auth and DAO, then cover:

```ts
it('returns 401 without an authenticated user');
it('returns pending plus existing personalization');
it('updates existing fields and completed profile in one DAO call');
it('rejects a stage and grade mismatch');
it('records skipped without fabricating answers');
it('allows the same completion payload to be retried');
```

The completion test must verify:

```ts
expect(update).toHaveBeenCalledWith('user-1', {
  educationLevel: 'middle',
  grade: '初二',
  favoriteSubjects: expect.arrayContaining([
    { id: 'math', name: '数学', enabled: true },
  ]),
  learningOnboarding: expect.objectContaining({
    version: 1, status: 'completed', weakSubjects: ['math'],
  }),
});
```

- [ ] **Step 2: Run tests to verify missing route failures**

Run: `pnpm vitest run tests/onboarding/learning-onboarding-api.test.ts`

Expected: FAIL because the API modules do not exist.

- [ ] **Step 3: Implement GET and PUT**

GET returns current status, persisted onboarding profile, education level, grade and enabled favorite subject IDs.

PUT must parse `completeLearningOnboardingSchema`, map the full `SUBJECT_CONFIG` to `{ id, name, enabled }`, build the completed record with `Date.now()`, and call `dao.update()` once. Return:

```ts
return apiSuccess({
  onboarding: updated.learningOnboarding,
  status: getLearningOnboardingStatus(updated.learningOnboarding),
});
```

- [ ] **Step 4: Implement skip**

The skip endpoint updates only:

```ts
{
  learningOnboarding: {
    version: CURRENT_ONBOARDING_VERSION,
    status: 'skipped',
    skippedAt: Date.now(),
  },
}
```

It must not clear existing education, grade, subjects or completed learning data.

- [ ] **Step 5: Run API tests**

Run: `pnpm vitest run tests/onboarding/learning-onboarding-api.test.ts`

Expected: all six cases PASS.

- [ ] **Step 6: Commit the APIs**

```bash
git add app/api/user/learning-onboarding tests/onboarding/learning-onboarding-api.test.ts
git commit -m "feat: expose learning onboarding APIs"
```

---

### Task 4: Add Auth State And A Loop-Safe Gate

**Files:**

- Modify: `app/api/auth/me/route.ts`
- Modify: `components/auth/auth-provider.tsx`
- Create: `components/auth/onboarding-gate.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/auth/register/page.tsx`
- Create: `tests/onboarding/onboarding-gate.test.tsx`

**Interfaces:**

- Consumes: `LearningOnboardingStatus`, `getLearningOnboardingStatus()`.
- Produces: `AuthUser.onboardingStatus`, `sanitizeInternalRedirect()` and global routing behavior.

- [ ] **Step 1: Write gate tests**

Verify pending ordinary users preserve an internal URL; completed/skipped users, guests, admins, `/auth/*` and `/sky/onboarding` are not redirected. Verify `//example.com` becomes `/sky`.

```ts
expect(replace).toHaveBeenCalledWith(
  '/sky/onboarding?redirect=%2Fsky%2Fcloud-mind%2Fquiz%3Ftopic%3D%E5%87%BD%E6%95%B0',
);
```

- [ ] **Step 2: Run tests to verify the component is missing**

Run: `pnpm vitest run tests/onboarding/onboarding-gate.test.tsx`

Expected: FAIL because `OnboardingGate` does not exist.

- [ ] **Step 3: Expose status through auth**

Add `onboardingStatus: getLearningOnboardingStatus(user.learningOnboarding)` to `/api/auth/me` and the same typed field to `AuthUser`.

- [ ] **Step 4: Implement the gate**

Use this sanitizer:

```ts
export function sanitizeInternalRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/sky';
  return value;
}
```

In a client effect, return early in this order:

```ts
if (isLoading || !user) return;
if (user.role !== 'user') return;
if (user.onboardingStatus !== 'pending') return;
if (pathname.startsWith('/auth/') || pathname === '/sky/onboarding') return;
```

Preserve `pathname` plus the current query and call `router.replace()` with the encoded target.

- [ ] **Step 5: Mount the gate and update registration**

Render `<OnboardingGate />` inside `<AuthProvider>` in `app/layout.tsx`. Change both registration redirects from `/` to `/sky/onboarding`.

- [ ] **Step 6: Run gate tests and typecheck**

Run: `pnpm vitest run tests/onboarding/onboarding-gate.test.tsx && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit auth integration**

```bash
git add app/api/auth/me/route.ts components/auth/auth-provider.tsx components/auth/onboarding-gate.tsx app/layout.tsx app/auth/register/page.tsx tests/onboarding/onboarding-gate.test.tsx
git commit -m "feat: route incomplete users through onboarding"
```

---

### Task 5: Build The Three-Step Onboarding Experience

**Files:**

- Create: `components/sky/onboarding/learning-profile-onboarding.tsx`
- Create: `app/sky/onboarding/page.tsx`
- Create: `tests/onboarding/learning-profile-onboarding.test.tsx`

**Interfaces:**

- Consumes: Task 1 constants, Task 3 APIs, `useAuth().refresh()`, `sanitizeInternalRedirect()`.
- Produces: completion, skip and optional diagnostic navigation.

- [ ] **Step 1: Write interaction tests**

Cover these exact behaviors:

```ts
it('moves through education, subjects, and goal steps');
it('requires stage and grade before continuing');
it('allows favorite and weak subject selections to overlap');
it('submits one complete payload and refreshes auth state');
it('keeps answers and shows an error when save fails');
it('records skip and returns to the safe redirect');
it('offers a diagnostic prefilled with the first weak subject');
it('loads and prefills the existing profile in edit mode');
```

The submit test must assert:

```ts
expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toEqual({
  educationLevel: 'middle',
  grade: '初二',
  favoriteSubjects: ['math', 'physics'],
  weakSubjects: ['math'],
  learningGoal: 'build-foundations',
  goalDetail: '补齐代数基础',
  teachingPreference: 'step-by-step',
});
```

- [ ] **Step 2: Run tests to verify the missing component failure**

Run: `pnpm vitest run tests/onboarding/learning-profile-onboarding.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement stable local state**

Initialize one local state object:

```ts
{
  educationLevel: null,
  grade: '',
  favoriteSubjects: [],
  weakSubjects: [],
  learningGoal: null,
  goalDetail: '',
  teachingPreference: 'balanced',
}
```

Use `step: 0 | 1 | 2 | 3`, where 3 is the completion summary. Do not update global settings or persist intermediate answers before the final PUT succeeds.

When `mode=edit`, call `GET /api/user/learning-onboarding` on mount and prefill education level, grade, enabled favorite subjects and completed onboarding fields. Show a loading state until that request finishes. A failed GET shows a retry command and must not replace saved values with defaults.

- [ ] **Step 4: Implement the three semantic fieldsets**

Use these fixed display/value mappings:

```ts
const STAGES = [
  { value: 'middle', label: '初中', grades: ['初一', '初二', '初三'] },
  { value: 'high', label: '高中', grades: ['高一', '高二', '高三'] },
] as const;

const GOALS = [
  { value: 'improve-grades', label: '提升成绩' },
  { value: 'exam-prep', label: '备战考试' },
  { value: 'build-foundations', label: '补齐基础' },
  { value: 'explore-interest', label: '拓展兴趣' },
] as const;

const PREFERENCES = [
  { value: 'example-first', label: '先看例题' },
  { value: 'visual-explanation', label: '图示讲解' },
  { value: 'step-by-step', label: '分步推导' },
  { value: 'practice-first', label: '先练后讲' },
  { value: 'balanced', label: '均衡安排' },
] as const;
```

Render subjects from `SUBJECT_CONFIG`. Use `fieldset`/`legend`, keyboard-operable controls, visible focus and explicit selected text or check icons. Favorite and weak lists must use independent state arrays.

- [ ] **Step 5: Implement save, skip and completion actions**

Save calls `PUT /api/user/learning-onboarding`; skip calls `POST /api/user/learning-onboarding/skip`. On success, call `await refresh()` before navigation. Failed requests keep the current step and form data, show an inline error and re-enable the command button.

Build the optional diagnostic URL with:

```ts
const diagnosticHref = firstWeakSubject
  ? `/sky/cloud-mind/quiz?subject=${encodeURIComponent(firstWeakSubject)}&mode=diagnostic`
  : '/sky/cloud-mind/quiz?mode=diagnostic';
```

“先逛逛” uses the sanitized redirect, defaulting to `/sky`.

- [ ] **Step 6: Create the page route**

Render the component in a full-width page with a constrained inner width. Do not nest cards. Keep the progress indicator and bottom commands stable at 390px and desktop widths.

- [ ] **Step 7: Run UI tests**

Run: `pnpm vitest run tests/onboarding/learning-profile-onboarding.test.tsx`

Expected: all eight cases PASS.

- [ ] **Step 8: Commit the UI**

```bash
git add components/sky/onboarding/learning-profile-onboarding.tsx app/sky/onboarding/page.tsx tests/onboarding/learning-profile-onboarding.test.tsx
git commit -m "feat: add learning profile onboarding flow"
```

---

### Task 6: Consume Declared Preferences Without Polluting Mastery

**Files:**

- Modify: `lib/assistant/personalization.ts`
- Modify: `lib/agents/personalization-utils.ts`
- Modify: `lib/cloud-mind/personalization-context.ts`
- Modify: `app/api/sky/cloud-mind/personalization-context/route.ts`
- Modify: `tests/assistant/personalization.test.ts`
- Modify: `tests/cloud-mind/personalization-context.test.ts`

**Interfaces:**

- Consumes: completed `LearningOnboardingProfile`.
- Produces: concrete teaching instructions and a cold-start diagnostic recommendation.

- [ ] **Step 1: Add failing personalization tests**

Add these assertions to the existing assistant suite:

```ts
expect(
  pickPersonalizationFromUser(userWithPreference('example-first')).teachingPreference,
).toBe('example-first');

expect(
  buildAssistantPersonalizationPrompt({
    userMessage: '讲一下函数',
    strategy: defaultStrategy,
    personalization: { teachingPreference: 'step-by-step' },
  }),
).toContain('把推导拆成连续步骤');
```

In the cloud-mind suite, pass no observed data and `selfReportedWeakSubjects: ['physics']`; expect `subject=physics&mode=diagnostic`. Add a second case with an observed math weak point and verify the observed math recommendation wins.

- [ ] **Step 2: Run tests to verify new fields are absent**

Run: `pnpm vitest run tests/assistant/personalization.test.ts tests/cloud-mind/personalization-context.test.ts`

Expected: FAIL on missing `teachingPreference` and `selfReportedWeakSubjects`.

- [ ] **Step 3: Extend centralized assistant personalization**

Add `teachingPreference?: TeachingPreference | null` to `AssistantPersonalization`. Return it only for completed records:

```ts
teachingPreference:
  user.learningOnboarding?.status === 'completed'
    ? user.learningOnboarding.teachingPreference
    : null,
```

Export and reuse this mapping from the centralized helper instead of changing individual generation routes:

```ts
export const TEACHING_PREFERENCE_INSTRUCTIONS = {
  'example-first': '先给一个贴近当前知识点的例题，再抽象出规则。',
  'visual-explanation': '优先用表格、结构图或空间关系组织解释。',
  'step-by-step': '把推导拆成连续步骤，每步只引入一个新变化。',
  'practice-first': '先给低负担尝试题或提示，再根据作答讲解。',
  balanced: '根据问题在讲解、例子和练习之间保持平衡。',
} as const;
```

Append the selected instruction in both assistant and general agent personalization prompt builders.

- [ ] **Step 4: Add the cold-start recommendation input**

Extend `BuildPersonalizationContextInput` with `selfReportedWeakSubjects?: Subject[]`. When `hasLearningData` is false and a subject exists, return:

```ts
{
  title: `先诊断一下${subjectLabel}`,
  reason: '你将它标记为较薄弱学科，先用一组小测建立真实学情基线。',
  targetTool: 'quiz',
  href: `/sky/cloud-mind/quiz?subject=${subject}&mode=diagnostic`,
}
```

The API route passes weak subjects only when `auth.user.learningOnboarding.status === 'completed'`. Do not copy them into `weakPoints`, `masteryBySubject` or `masteryByKnowledge`.

- [ ] **Step 5: Run focused regression tests**

Run: `pnpm vitest run tests/assistant/personalization.test.ts tests/cloud-mind/personalization-context.test.ts tests/teaching/profile-builder.test.ts`

Expected: PASS, including the existing profile-builder behavior.

- [ ] **Step 6: Commit personalization consumption**

```bash
git add lib/assistant/personalization.ts lib/agents/personalization-utils.ts lib/cloud-mind/personalization-context.ts app/api/sky/cloud-mind/personalization-context/route.ts tests/assistant/personalization.test.ts tests/cloud-mind/personalization-context.test.ts
git commit -m "feat: use onboarding preferences for cold start"
```

---

### Task 7: Keep A Non-Blocking Completion Entry

**Files:**

- Create: `components/sky/dashboard/learning-profile-prompt.tsx`
- Modify: `app/sky/page.tsx`
- Modify: `components/account/personalization-form.tsx`
- Create: `tests/onboarding/learning-profile-prompt.test.tsx`

**Interfaces:**

- Consumes: `AuthUser.onboardingStatus`.
- Produces: dashboard prompt for skipped users and a settings edit entry.

- [ ] **Step 1: Write prompt tests**

```ts
it('renders an onboarding link for skipped users');
it('renders nothing for completed users on the dashboard');
it('uses /sky/onboarding?mode=edit for the account entry');
```

- [ ] **Step 2: Run tests to verify the component is missing**

Run: `pnpm vitest run tests/onboarding/learning-profile-prompt.test.tsx`

Expected: FAIL because `LearningProfilePrompt` does not exist.

- [ ] **Step 3: Implement the dashboard prompt**

Render only for `skipped` status with:

- Title: `完善学习画像`
- Body: `补充学科情况和讲解偏好，让诊断与推荐更贴合你。`
- Link: `/sky/onboarding?mode=edit&redirect=%2Fsky`

Use one restrained dashboard item, not a new dashboard section or nested card.

- [ ] **Step 4: Add the account settings entry**

At the top of `PersonalizationForm`, add a small link labeled `重新填写学习画像` pointing to `/sky/onboarding?mode=edit&redirect=%2Faccount`. It must not clear current data before successful submission.

- [ ] **Step 5: Run prompt and dashboard tests**

Run: `pnpm vitest run tests/onboarding/learning-profile-prompt.test.tsx tests/sky/dashboard.test.tsx`

Expected: PASS with existing dashboard empty-state tests unchanged.

- [ ] **Step 6: Commit the completion entries**

```bash
git add components/sky/dashboard/learning-profile-prompt.tsx app/sky/page.tsx components/account/personalization-form.tsx tests/onboarding/learning-profile-prompt.test.tsx
git commit -m "feat: add learning profile completion entry"
```

---

### Task 8: Final Verification And Focused Polish

**Files:**

- Modify only Task 1-7 files if verification exposes a defect.

**Interfaces:**

- Consumes: the complete feature.
- Produces: verified desktop/mobile behavior and standard project checks.

- [ ] **Step 1: Run formatting check**

Run: `pnpm check`

Expected: PASS. Format only changed files if it fails.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: no errors and no new warnings in changed files.

- [ ] **Step 3: Run TypeScript**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Run the focused feature suite**

Run: `pnpm vitest run tests/onboarding tests/assistant/personalization.test.ts tests/cloud-mind/personalization-context.test.ts tests/teaching/profile-builder.test.ts tests/sky/dashboard.test.tsx`

Expected: all selected tests PASS.

- [ ] **Step 5: Run the complete unit suite**

Run: `pnpm test`

Expected: PASS. If unrelated pre-existing failures remain, record their exact names and rerun Step 4 to prove the feature suite passes.

- [ ] **Step 6: Verify browser behavior at 1440x900 and 390x844**

Run `pnpm dev`, then verify:

1. A pending normal user is redirected once and the original internal URL is preserved.
2. Admin and guest behavior is unchanged.
3. Three steps fit without overlap and are keyboard operable.
4. Favorite and weak subject selections may overlap.
5. Failed save keeps answers and permits retry.
6. Completed users are not redirected after reload.
7. Skipped users are not redirected after reload and see the dashboard entry.
8. Optional diagnostic opens with the first weak subject.
9. `redirect=//example.com` returns to `/sky`.

- [ ] **Step 7: Perform one focused self-review**

Run:

```bash
git diff --check e1afc57..HEAD
git diff --stat e1afc57..HEAD
rg -n "learningOnboarding|weakSubjects|teachingPreference" app components lib tests migrations
```

Confirm every match belongs to contracts, storage, auth gate, onboarding UI, centralized personalization, dashboard entry or tests. Remove no unrelated code and do not start another review round.

- [ ] **Step 8: Commit verification fixes only when files changed**

```bash
git add app components lib tests migrations
git commit -m "test: verify learning profile onboarding"
```

Do not create an empty commit.

## Completion Boundary

The feature is complete when a new or previously unprofiled ordinary user can complete or skip the three-step questionnaire, reload without being prompted again, optionally start a subject-prefilled diagnostic, and later reopen the form from the dashboard or account settings. Self-assessment remains separate from measured mastery, and existing auth, student-profile and personalization tests continue to pass.
