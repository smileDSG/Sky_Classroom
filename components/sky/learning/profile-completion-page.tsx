'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
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
  type LucideIcon,
} from 'lucide-react';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import {
  ProfileOnboardingChat,
  type ProfileSuggestionPrompt,
} from '@/components/sky/student/profile-onboarding-chat';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import type { ConversationalProfilePatch } from '@/lib/student/conversation-profile';
import { PageTour } from '@/components/sky/tour/page-tour';
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

function buildProfileFields(
  personalization: PersonalizationContext | null,
  patch?: ConversationalProfilePatch,
): ProfileField[] {
  const conversation = personalization?.conversationProfile;
  const weakPointsFromContext =
    personalization?.weakPoints.map((item) => item.knowledgePoint) ?? [];

  const learningGoal = patch?.learningGoal ?? conversation?.learningGoal;
  const majorBackground = patch?.majorBackground ?? conversation?.majorBackground;
  const knowledgeBase = patch?.knowledgeBase ?? conversation?.knowledgeBase;
  const resourcePreference = patch?.resourcePreference ?? conversation?.resourcePreference;
  const interactionPreference = patch?.interactionPreference ?? conversation?.interactionPreference;
  const learningPace = patch?.learningPace ?? conversation?.learningPace;
  const currentLearningState = patch?.currentLearningState ?? conversation?.currentLearningState;

  const weakPointText = joinValues(knowledgeBase?.weakPoints) || joinValues(weakPointsFromContext);
  const resourcePreferenceText = joinValues(resourcePreference?.value);

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
      value: resourcePreferenceText,
      helper: '例如图解、代码案例、练习题或讲义。',
      evidence: resourcePreference?.evidence ?? [],
      confidence: resourcePreference?.confidence,
      status: fieldStatus(resourcePreferenceText, resourcePreference?.confidence),
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

function resourceFormatLabel(format: string): string {
  const labels: Record<string, string> = {
    worked_example: '例题拆解',
    code_case: '代码案例',
    diagram: '图解',
    practice: '练习题',
    video: '视频',
    summary: '文字总结',
  };
  return labels[format] ?? format;
}

function difficultyLabel(difficulty?: string): string {
  if (difficulty === 'easy') return '基础';
  if (difficulty === 'hard') return '进阶';
  return '适中';
}

function explanationStyleLabel(style?: string): string {
  if (style === 'principle_first') return '先讲原理再做题';
  if (style === 'example_first') return '先看例子再总结';
  if (style === 'practice_first') return '先做小题再讲解';
  if (style === 'step_first') return '步骤讲清楚一点';
  return '';
}

function addUniquePrompt(prompts: ProfileSuggestionPrompt[], next: ProfileSuggestionPrompt | null) {
  if (!next) return;
  if (prompts.some((prompt) => prompt.label === next.label || prompt.text === next.text)) return;
  prompts.push(next);
}

function buildSuggestionPrompts(
  personalization: PersonalizationContext | null,
  patch?: ConversationalProfilePatch,
): ProfileSuggestionPrompt[] {
  const conversation = personalization?.conversationProfile;
  const goal = patch?.learningGoal?.value ?? conversation?.learningGoal?.value;
  const weakPoints =
    (patch?.knowledgeBase?.weakPoints.length
      ? patch.knowledgeBase.weakPoints
      : conversation?.knowledgeBase?.weakPoints.length
        ? conversation.knowledgeBase.weakPoints
        : personalization?.weakPoints.map((item) => item.knowledgePoint)) ?? [];
  const resourcePreferences =
    (patch?.resourcePreference?.value.length
      ? patch.resourcePreference.value
      : conversation?.resourcePreference?.value.length
        ? conversation.resourcePreference.value
        : personalization?.tutoringPolicy?.resourceFormats.map(resourceFormatLabel)) ?? [];
  const interactionPreference =
    patch?.interactionPreference?.value ??
    conversation?.interactionPreference?.value ??
    explanationStyleLabel(personalization?.tutoringPolicy?.explanationStyle);
  const targetTopic =
    personalization?.tutoringPolicy?.targetTopic ??
    weakPoints[0] ??
    personalization?.learningPath?.next;
  const resourceText = resourcePreferences.slice(0, 2).join('、');
  const weakPointText = weakPoints.slice(0, 2).join('、');
  const prompts: ProfileSuggestionPrompt[] = [];

  if (targetTopic) {
    addUniquePrompt(prompts, {
      label: `继续补强${targetTopic}`,
      text: `我想继续补强${targetTopic}，希望先用${resourceText || '例题拆解'}讲清楚，再给我一组${difficultyLabel(
        personalization?.tutoringPolicy?.difficulty ?? personalization?.preferredDifficulty,
      )}练习。`,
    });
  }

  if (goal || weakPointText || resourceText || interactionPreference) {
    addUniquePrompt(prompts, {
      label: '目标和偏好',
      text: `我的目标是${goal || '先把当前课程基础补稳'}，目前最卡的是${
        weakPointText || targetTopic || '还不确定'
      }，希望多用${resourceText || '图解和例题'}，讲解时${interactionPreference || '一步一步来'}。`,
    });
  }

  if (personalization?.learningPath?.next && personalization.learningPath.next !== targetTopic) {
    addUniquePrompt(prompts, {
      label: `规划${personalization.learningPath.next}`,
      text: `接下来我想学${personalization.learningPath.next}，请先帮我确认前置知识缺口，再安排一条短练习路线。`,
    });
  }

  addUniquePrompt(prompts, {
    label: '先做摸底练习',
    text: '我还不太确定哪里薄弱，想先做一次小练习，再根据结果安排讲解和复习。',
  });

  return prompts.slice(0, 3);
}

function StatusIcon({ status }: { status: FieldStatus }) {
  if (status === 'complete') return <CheckCircle2 className="h-4 w-4 text-sky-600" />;
  if (status === 'weak') return <ClipboardCheck className="h-4 w-4 text-blue-600" />;
  return <Circle className="h-4 w-4 text-slate-400" />;
}

function ProfileFieldPreview({ field }: { field: ProfileField }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-950/45">
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
                  'bg-sky-50 text-sky-700 dark:bg-sky-300/10 dark:text-sky-100',
                field.status === 'weak' &&
                  'bg-blue-50 text-blue-700 dark:bg-blue-300/10 dark:text-blue-100',
                field.status === 'missing' &&
                  'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {field.status === 'complete'
                ? '已识别'
                : field.status === 'weak'
                  ? '待确认'
                  : '待补充'}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {field.value || field.helper}
          </p>
        </div>
      </div>
    </div>
  );
}

function NextAction({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-50 dark:border-sky-300/20 dark:bg-slate-950/40 dark:text-sky-100 dark:hover:bg-sky-300/10"
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function ProfileCompletionPage() {
  const [personalization, setPersonalization] = useState<PersonalizationContext | null>(null);
  const [patch, setPatch] = useState<ConversationalProfilePatch>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fields = useMemo(
    () => buildProfileFields(personalization, patch),
    [personalization, patch],
  );
  const coreFields = fields.filter((field) =>
    ['learningGoal', 'weakPoints', 'resourcePreference', 'interactionPreference'].includes(
      field.key,
    ),
  );
  const previewFields = coreFields;
  const completedCoreCount = coreFields.filter((field) => field.status !== 'missing').length;
  const hasActionContext = coreFields.some((field) => field.status !== 'missing');
  const suggestionPrompts = useMemo(
    () => buildSuggestionPrompts(personalization, patch),
    [personalization, patch],
  );
  return (
    <SkyAppShell>
      <main className="mx-auto max-w-7xl space-y-5 px-4 pb-8 sm:px-6 lg:px-8">
        <section
          data-tour-step="page-header"
          className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100">
                <UserCheck className="h-3.5 w-3.5" />
                学习情况
              </div>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white md:text-3xl">
                完善学习情况
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                用几句话告诉摘星锦囊你的目标、薄弱点和偏好，后续推荐会更贴近你。
              </p>
            </div>

            <div className="flex min-w-56 items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-700 dark:bg-slate-900/70">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-300/10 dark:text-sky-300">
                  <Sparkles className="h-6 w-6" />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  关键信息完成度
                </p>
                <p className="mt-0.5 text-2xl font-semibold text-slate-950 dark:text-white">
                  {completedCoreCount}/4
                </p>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-300/25 dark:bg-sky-300/10 dark:text-sky-100">
            {error}
          </div>
        )}

        <div
          data-tour-step="page-primary"
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]"
        >
          <section className="min-w-0">
            <ProfileOnboardingChat
              title="告诉我你现在怎么学"
              description="用自然语言说就够，我会整理你的目标、薄弱点和偏好。"
              starterQuestion="你最近最想提升哪门课或哪项能力？也可以直接说最卡的知识点。"
              placeholder="例如：我想两周内补机器学习，过拟合和模型评估总搞不懂，希望多用代码案例和图解讲。"
              submitLabel="更新学习情况"
              suggestionPrompts={suggestionPrompts}
              onPatchChange={(incomingPatch) => {
                setPatch(incomingPatch);
                void loadPersonalization();
              }}
            />
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  实时学习情况预览
                </h2>
              </div>
              <div className="space-y-3">
                {previewFields.map((field) => (
                  <ProfileFieldPreview key={field.key} field={field} />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-300/20 dark:bg-sky-300/10">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-sky-700 dark:text-sky-100" />
                <h2 className="text-base font-semibold text-sky-950 dark:text-sky-50">下一步</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-sky-800 dark:text-sky-100">
                {hasActionContext
                  ? '已经可以按当前学习情况开始推荐。信息越完整，后续建议越贴近你。'
                  : '先补充目标或薄弱点，也可以直接进入工具后继续完善。'}
              </p>
              <div className="mt-3 grid gap-2">
                <NextAction
                  href="/sky/cloud-mind/course-studio"
                  icon={Layers}
                  label="生成个性化资料"
                />
                <NextAction href="/sky/cloud-mind/quiz" icon={BookOpenCheck} label="开始智能练习" />
                <NextAction
                  href="/sky/learning#learning-plan"
                  icon={Target}
                  label="查看个人学习计划"
                />
                <NextAction href="/sky/student" icon={UserCheck} label="查看完整分析" />
              </div>
            </section>
          </aside>
        </div>
      </main>

      <PageTour id="learning-profile" />
    </SkyAppShell>
  );
}
