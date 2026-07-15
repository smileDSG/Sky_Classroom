# Star Tips Profile Completion UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/sky/learning/profile` profile-completion page for Star Tips, focused on conversational onboarding, live profile preview, completion quality, and next actions.

**Architecture:** Keep `/sky/student` as the full learning-analysis page. Replace the current `/sky/learning/profile` generic feature-page route with a focused page component that reuses `ProfileOnboardingChat`, `/api/sky/cloud-mind/personalization-context`, and `ConversationalProfilePatch`. The page owns display composition only; extraction and persistence stay in existing API/service layers.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui primitives, lucide-react, Vitest + Testing Library.

---

## UI/UX Design System

Use the `ui-ux-pro-max` high-priority rules. Its local search script is not available in this workspace, so apply the loaded checklist directly.

- **Product type:** Learning productivity tool, not marketing site.
- **Audience:** Students who need quick, low-friction personalization before using AI study tools.
- **Layout:** Desktop two-column workspace; mobile single-column flow. No horizontal scroll.
- **Visual tone:** Calm, capable, product-focused. Use emerald and sky accents for growth and intelligence, with amber only for attention.
- **Surfaces:** White or dark slate work surfaces with clear borders. Avoid nested cards inside cards; use sections and panels with restrained 8-16px radius.
- **Typography:** Existing project font stack; headings 20-28px, body 14-16px, label text 12-13px.
- **Interaction:** Primary touch targets at least 44px high. Every link and button has visible text and a lucide icon where helpful.
- **Accessibility:** Do not rely on color alone. Use icons plus text for complete, missing, and low-confidence states.
- **Motion:** Keep existing route/page motion minimal. Avoid decorative animation; state changes can crossfade via normal React rendering.

## File Structure

- Modify `app/sky/learning/profile/page.tsx`
  - Replace the generic `LearningFeaturePage activeFeature="profile"` route with the dedicated `ProfileCompletionPage`.
- Create `components/sky/learning/profile-completion-page.tsx`
  - Page-level client component that fetches personalization context, holds latest conversation patch, renders profile preview, progress, and action links.
- Modify `components/sky/student/profile-onboarding-chat.tsx`
  - Add optional copy props so the same chat component can be used with page-specific title, description, starter question, placeholder, and submit label.
- Create `tests/sky/profile-completion-page.test.tsx`
  - Route/page behavior tests for the dedicated page, patch-driven preview updates, empty state, and next action links.

## Task 1: Add Failing Page Tests

**Files:**
- Create: `tests/sky/profile-completion-page.test.tsx`

- [ ] **Step 1: Create the page test file**

Create `tests/sky/profile-completion-page.test.tsx` with this content:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LearningProfilePage from '@/app/sky/learning/profile/page';

vi.mock('@/components/sky/layout/app-shell', () => ({
  SkyAppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

vi.mock('@/components/sky/student/profile-onboarding-chat', () => ({
  ProfileOnboardingChat: ({
    title,
    description,
    starterQuestion,
    placeholder,
    submitLabel,
    onPatchChange,
  }: {
    title?: string;
    description?: string;
    starterQuestion?: string;
    placeholder?: string;
    submitLabel?: string;
    onPatchChange?: (patch: {
      learningGoal?: { value: string; confidence: number; evidence: string[] };
      knowledgeBase?: {
        weakPoints: string[];
        strongPoints: string[];
        confidence: number;
        evidence: string[];
      };
      resourcePreference?: { value: string[]; confidence: number; evidence: string[] };
      interactionPreference?: { value: string; confidence: number; evidence: string[] };
    }) => void;
  }) => (
    <section aria-label="画像对话采集">
      <h2>{title}</h2>
      <p>{description}</p>
      <p>{starterQuestion}</p>
      <textarea aria-label="画像补充输入" placeholder={placeholder} />
      <button
        type="button"
        onClick={() =>
          onPatchChange?.({
            learningGoal: {
              value: '两周内补强机器学习',
              confidence: 0.86,
              evidence: ['两周内', '机器学习'],
            },
            knowledgeBase: {
              weakPoints: ['过拟合', '模型评估'],
              strongPoints: [],
              confidence: 0.82,
              evidence: ['过拟合', '模型评估'],
            },
            resourcePreference: {
              value: ['代码案例', '图解'],
              confidence: 0.8,
              evidence: ['代码', '图解'],
            },
            interactionPreference: {
              value: '步骤优先',
              confidence: 0.78,
              evidence: ['步骤'],
            },
          })
        }
      >
        {submitLabel}
      </button>
    </section>
  ),
}));

describe('LearningProfilePage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          userId: 'student-1',
          generatedAt: Date.now(),
          hasLearningData: false,
          hasPersonalizationSignals: false,
          weakPoints: [],
          masteryByKnowledge: {},
          recentAccuracy: null,
          dueReviews: [],
          errorPatterns: [],
          preferredDifficulty: 'medium',
          recommendation: null,
          conversationProfile: null,
        },
      }),
    } as Response);
    global.fetch = mockFetch;
  });

  it('renders a dedicated profile-completion page instead of the generic analysis page', async () => {
    render(<LearningProfilePage />);

    expect(await screen.findByRole('heading', { name: '完善学习画像' })).toBeInTheDocument();
    expect(screen.getByText('让摘星锦囊先认识你的目标、薄弱点和学习偏好。')).toBeInTheDocument();
    expect(screen.getByLabelText('画像对话采集')).toBeInTheDocument();
    expect(screen.queryByText('学情分析')).not.toBeInTheDocument();
  });

  it('shows empty profile fields before the learner adds conversational signals', async () => {
    render(<LearningProfilePage />);

    expect(await screen.findByText('待补充')).toBeInTheDocument();
    expect(screen.getByText('先说清楚你最想达成的学习结果。')).toBeInTheDocument();
    expect(screen.getByText('目标已明确')).toBeInTheDocument();
    expect(screen.getByText('薄弱点已明确')).toBeInTheDocument();
  });

  it('updates the live profile preview after the chat extracts a profile patch', async () => {
    const user = userEvent.setup();
    render(<LearningProfilePage />);

    await user.click(await screen.findByRole('button', { name: '更新画像' }));

    expect(screen.getByText('两周内补强机器学习')).toBeInTheDocument();
    expect(screen.getByText('过拟合、模型评估')).toBeInTheDocument();
    expect(screen.getByText('代码案例、图解')).toBeInTheDocument();
    expect(screen.getByText('步骤优先')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  it('provides next action links for personalized study workflows', async () => {
    render(<LearningProfilePage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(screen.getByRole('link', { name: /生成个性化资料/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/course-studio',
    );
    expect(screen.getByRole('link', { name: /开始智能练习/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/quiz',
    );
    expect(screen.getByRole('link', { name: /进入学习实验室/ })).toHaveAttribute(
      'href',
      '/sky/study-lab',
    );
    expect(screen.getByRole('link', { name: /查看完整分析/ })).toHaveAttribute(
      'href',
      '/sky/student',
    );
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm vitest run tests/sky/profile-completion-page.test.tsx
```

Expected result: FAIL because `app/sky/learning/profile/page.tsx` still renders `LearningFeaturePage` and the dedicated heading is missing.

## Task 2: Make ProfileOnboardingChat Customizable

**Files:**
- Modify: `components/sky/student/profile-onboarding-chat.tsx`

- [ ] **Step 1: Extend the props interface**

Change the props block to:

```tsx
interface ProfileOnboardingChatProps {
  title?: string;
  description?: string;
  starterQuestion?: string;
  placeholder?: string;
  submitLabel?: string;
  onPatchChange?: (patch: ConversationalProfilePatch) => void;
}
```

- [ ] **Step 2: Add stable default copy**

Keep the existing `STARTER_QUESTION` constant if desired, and add these constants next to it:

```tsx
const DEFAULT_TITLE = '对话式学习画像';
const DEFAULT_DESCRIPTION =
  '聊 2 分钟，我会把目标、薄弱点和讲解偏好转成后续推荐依据。';
const DEFAULT_PLACEHOLDER =
  '例如：我想两周内补机器学习，过拟合和模型评估总是搞不懂，希望多用代码案例和图解讲。';
const DEFAULT_SUBMIT_LABEL = '发送';
```

- [ ] **Step 3: Destructure props with defaults**

Change the function signature to:

```tsx
export function ProfileOnboardingChat({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  starterQuestion = STARTER_QUESTION,
  placeholder = DEFAULT_PLACEHOLDER,
  submitLabel = DEFAULT_SUBMIT_LABEL,
  onPatchChange,
}: ProfileOnboardingChatProps) {
```

- [ ] **Step 4: Use the customizable copy in render**

Replace the hard-coded title, description, initial message, placeholder, and submit label references:

```tsx
const [messages, setMessages] = useState<ChatMessage[]>([
  { role: 'assistant', content: starterQuestion },
]);
```

```tsx
<h3 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
<p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
  {description}
</p>
```

```tsx
content: json.data?.nextQuestion || starterQuestion,
```

```tsx
placeholder={placeholder}
```

```tsx
{submitLabel}
```

- [ ] **Step 5: Run the page test and verify the failure has moved**

Run:

```bash
pnpm vitest run tests/sky/profile-completion-page.test.tsx
```

Expected result: FAIL still, but no TypeScript complaint about the mocked custom chat props once the page component is added in the next task.

## Task 3: Build the Dedicated ProfileCompletionPage

**Files:**
- Create: `components/sky/learning/profile-completion-page.tsx`

- [ ] **Step 1: Create the file with imports, types, and helpers**

Create the top of `components/sky/learning/profile-completion-page.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Layers,
  Loader2,
  MessageSquareText,
  Sparkles,
  Target,
  UserCheck,
} from 'lucide-react';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { ProfileOnboardingChat } from '@/components/sky/student/profile-onboarding-chat';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import type { ConversationalProfilePatch } from '@/lib/student/conversation-profile';
import { cn } from '@/lib/utils';

type FieldStatus = 'complete' | 'missing' | 'weak';

interface ProfileField {
  key: string;
  label: string;
  value: string;
  helper: string;
  evidence: string[];
  confidence?: number;
  status: FieldStatus;
}

function joinValues(values?: string[]): string {
  return values && values.length > 0 ? values.join('、') : '';
}

function fieldStatus(value: string, confidence?: number): FieldStatus {
  if (!value) return 'missing';
  if (confidence !== undefined && confidence < 0.72) return 'weak';
  return 'complete';
}
```

- [ ] **Step 2: Add field composition logic**

Append:

```tsx
function buildProfileFields(
  personalization: PersonalizationContext | null,
  patch?: ConversationalProfilePatch,
): ProfileField[] {
  const conversation = personalization?.conversationProfile;
  const weakPointsFromContext = personalization?.weakPoints.map((item) => item.knowledgePoint) ?? [];

  const learningGoal = patch?.learningGoal ?? conversation?.learningGoal;
  const majorBackground = patch?.majorBackground ?? conversation?.majorBackground;
  const knowledgeBase = patch?.knowledgeBase ?? conversation?.knowledgeBase;
  const resourcePreference = patch?.resourcePreference ?? conversation?.resourcePreference;
  const interactionPreference = patch?.interactionPreference ?? conversation?.interactionPreference;
  const learningPace = patch?.learningPace ?? conversation?.learningPace;
  const currentLearningState = patch?.currentLearningState ?? conversation?.currentLearningState;

  const weakPointText =
    joinValues(knowledgeBase?.weakPoints) || joinValues(weakPointsFromContext.map(String));

  return [
    {
      key: 'learningGoal',
      label: '学习目标',
      value: learningGoal?.value ?? '',
      helper: '先说清楚你最想达成的学习结果。',
      evidence: learningGoal?.evidence ?? [],
      confidence: learningGoal?.confidence,
      status: fieldStatus(learningGoal?.value ?? '', learningGoal?.confidence),
    },
    {
      key: 'majorBackground',
      label: '专业背景',
      value: majorBackground?.value ?? '',
      helper: '告诉我你的专业、年级或课程背景。',
      evidence: majorBackground?.evidence ?? [],
      confidence: majorBackground?.confidence,
      status: fieldStatus(majorBackground?.value ?? '', majorBackground?.confidence),
    },
    {
      key: 'weakPoints',
      label: '薄弱点',
      value: weakPointText,
      helper: '描述现在最卡的知识点或能力。',
      evidence: knowledgeBase?.evidence ?? [],
      confidence: knowledgeBase?.confidence,
      status: fieldStatus(weakPointText, knowledgeBase?.confidence),
    },
    {
      key: 'resourcePreference',
      label: '资源偏好',
      value: joinValues(resourcePreference?.value),
      helper: '例如图解、代码案例、练习题或讲义。',
      evidence: resourcePreference?.evidence ?? [],
      confidence: resourcePreference?.confidence,
      status: fieldStatus(joinValues(resourcePreference?.value), resourcePreference?.confidence),
    },
    {
      key: 'interactionPreference',
      label: '讲解偏好',
      value: interactionPreference?.value ?? '',
      helper: '例如步骤优先、原理优先或例题带练。',
      evidence: interactionPreference?.evidence ?? [],
      confidence: interactionPreference?.confidence,
      status: fieldStatus(interactionPreference?.value ?? '', interactionPreference?.confidence),
    },
    {
      key: 'learningPace',
      label: '学习节奏',
      value: learningPace?.value ?? '',
      helper: '告诉我是否有考试、比赛或项目截止时间。',
      evidence: learningPace?.evidence ?? [],
      confidence: learningPace?.confidence,
      status: fieldStatus(learningPace?.value ?? '', learningPace?.confidence),
    },
    {
      key: 'currentLearningState',
      label: '当前状态',
      value: currentLearningState?.value ?? '',
      helper: '可以说焦虑、赶进度、刚入门或想冲刺。',
      evidence: currentLearningState?.evidence ?? [],
      confidence: currentLearningState?.confidence,
      status: fieldStatus(currentLearningState?.value ?? '', currentLearningState?.confidence),
    },
  ];
}
```

- [ ] **Step 3: Add small presentational components**

Append:

```tsx
function StatusIcon({ status }: { status: FieldStatus }) {
  if (status === 'complete') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === 'weak') return <ClipboardCheck className="h-4 w-4 text-amber-600" />;
  return <Circle className="h-4 w-4 text-slate-400" />;
}

function ProfileFieldPreview({ field }: { field: ProfileField }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-950/45">
      <div className="flex items-start gap-2.5">
        <StatusIcon status={field.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              {field.label}
            </h3>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                field.status === 'complete' &&
                  'bg-emerald-50 text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-100',
                field.status === 'weak' &&
                  'bg-amber-50 text-amber-700 dark:bg-amber-300/10 dark:text-amber-100',
                field.status === 'missing' &&
                  'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {field.status === 'complete' ? '已识别' : field.status === 'weak' ? '待确认' : '待补充'}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">
            {field.value || field.helper}
          </p>
          {field.evidence.length > 0 && (
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              依据：{field.evidence.slice(0, 3).join('、')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the main page component**

Append:

```tsx
export function ProfileCompletionPage() {
  const [personalization, setPersonalization] = useState<PersonalizationContext | null>(null);
  const [patch, setPatch] = useState<ConversationalProfilePatch>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPersonalization() {
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
        if (cancelled) return;
        if (response.ok && json.success && json.data) {
          setPersonalization(json.data);
        } else {
          setError(json.error ?? '画像上下文暂时不可用，你仍然可以先通过对话补充画像。');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '画像上下文加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPersonalization();
    return () => {
      cancelled = true;
    };
  }, []);

  const fields = useMemo(() => buildProfileFields(personalization, patch), [personalization, patch]);
  const coreFields = fields.filter((field) =>
    ['learningGoal', 'weakPoints', 'resourcePreference', 'interactionPreference'].includes(
      field.key,
    ),
  );
  const completedCoreCount = coreFields.filter((field) => field.status !== 'missing').length;
  const hasActionContext = coreFields.some((field) => field.status !== 'missing');

  return (
    <SkyAppShell>
      <main className="mx-auto max-w-7xl space-y-5 px-4 pb-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
          <Link
            href="/sky"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            返回摘星锦囊
          </Link>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100">
                <UserCheck className="h-3.5 w-3.5" />
                学习画像
              </div>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white md:text-3xl">
                完善学习画像
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                让摘星锦囊先认识你的目标、薄弱点和学习偏好。后续资料生成、智能练习和学习路径都会按画像调整。
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    关键画像完成度
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                    {completedCoreCount}/4
                  </p>
                </div>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                ) : (
                  <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span>目标已明确</span>
                <span>薄弱点已明确</span>
                <span>偏好已明确</span>
                <span>讲解方式已明确</span>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0">
            <ProfileOnboardingChat
              title="告诉我你现在怎么学"
              description="用自然语言说就好，我会把目标、薄弱点和偏好拆成可用于推荐的画像字段。"
              starterQuestion="你最近最想提升哪门课或哪项能力？也可以直接说当前最卡的知识点，以及你希望我怎么带你学。"
              placeholder="例如：我想两周内补机器学习，过拟合和模型评估总是搞不懂，希望多用代码案例和图解讲。"
              submitLabel="更新画像"
              onPatchChange={setPatch}
            />
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  实时画像预览
                </h2>
              </div>
              <div className="space-y-2.5">
                {fields.map((field) => (
                  <ProfileFieldPreview key={field.key} field={field} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-300/20 dark:bg-emerald-300/10">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-700 dark:text-emerald-100" />
                <h2 className="text-base font-semibold text-emerald-950 dark:text-emerald-50">
                  下一步
                </h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-100">
                {hasActionContext
                  ? '已经可以按当前画像开始推荐。信息越完整，后续建议越贴近你。'
                  : '先补充目标或薄弱点，也可以直接进入工具后继续完善。'}
              </p>
              <div className="mt-3 grid gap-2">
                <NextAction href="/sky/cloud-mind/course-studio" icon={Layers} label="生成个性化资料" />
                <NextAction href="/sky/cloud-mind/quiz" icon={BookOpenCheck} label="开始智能练习" />
                <NextAction href="/sky/study-lab" icon={Target} label="进入学习实验室" />
                <NextAction href="/sky/student" icon={UserCheck} label="查看完整分析" />
              </div>
            </section>
          </aside>
        </div>
      </main>
    </SkyAppShell>
  );
}

function NextAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Target;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 dark:border-emerald-300/20 dark:bg-slate-950/40 dark:text-emerald-100 dark:hover:bg-emerald-300/10"
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
```

- [ ] **Step 5: Run the page test and verify the remaining route failure**

Run:

```bash
pnpm vitest run tests/sky/profile-completion-page.test.tsx
```

Expected result: FAIL because the route file has not imported and rendered `ProfileCompletionPage` yet.

## Task 4: Wire `/sky/learning/profile` to the Dedicated Page

**Files:**
- Modify: `app/sky/learning/profile/page.tsx`

- [ ] **Step 1: Replace the route content**

Replace the file with:

```tsx
import { ProfileCompletionPage } from '@/components/sky/learning/profile-completion-page';

export default function LearningProfilePage() {
  return <ProfileCompletionPage />;
}
```

- [ ] **Step 2: Run the focused page test**

Run:

```bash
pnpm vitest run tests/sky/profile-completion-page.test.tsx
```

Expected result: PASS.

## Task 5: Verify Integration and Formatting

**Files:**
- Verify only; no new files unless formatting changes are produced by Prettier.

- [ ] **Step 1: Run the focused regression tests**

Run:

```bash
pnpm vitest run tests/sky/profile-completion-page.test.tsx tests/sky/star-tips-dashboard.test.tsx tests/teaching/conversation-profile.test.ts
```

Expected result: PASS.

- [ ] **Step 2: Run the project formatter check for touched files**

Run:

```bash
pnpm prettier --check app/sky/learning/profile/page.tsx components/sky/learning/profile-completion-page.tsx components/sky/student/profile-onboarding-chat.tsx tests/sky/profile-completion-page.test.tsx
```

Expected result: PASS. If it reports formatting differences, run:

```bash
pnpm prettier --write app/sky/learning/profile/page.tsx components/sky/learning/profile-completion-page.tsx components/sky/student/profile-onboarding-chat.tsx tests/sky/profile-completion-page.test.tsx
```

Then rerun the check and expect PASS.

- [ ] **Step 3: Run type-aware lint on the touched files if supported by the project command**

Run:

```bash
pnpm lint
```

Expected result: PASS or only unrelated pre-existing warnings. Record any unrelated failures with file paths.

## Self-Review

- **Spec coverage:** The plan implements the dedicated `/sky/learning/profile` page, reuses `ProfileOnboardingChat`, displays live profile preview, handles empty/loading/error states, and provides next actions to course studio, quiz, study lab, and full analysis.
- **Placeholder scan:** This plan contains no placeholder steps. Every created or modified file has exact code or exact command guidance.
- **Type consistency:** The plan uses existing `PersonalizationContext` and `ConversationalProfilePatch` types, and keeps persistence inside existing APIs.

