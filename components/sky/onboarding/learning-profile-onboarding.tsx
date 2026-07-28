'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { sanitizeInternalRedirect } from '@/components/auth/onboarding-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  LEARNING_GOALS,
  ONBOARDING_SUBJECT_IDS,
  TEACHING_PREFERENCES,
  type CompleteLearningOnboardingInput,
  type LearningOnboardingProfile,
  type TeachingPreference,
} from '@/lib/onboarding/types';
import { SUBJECT_CONFIG } from '@/lib/student/profile-config';

type Step = 0 | 1 | 2 | 3;
type EducationLevel = CompleteLearningOnboardingInput['educationLevel'];
type Grade = CompleteLearningOnboardingInput['grade'];
type LearningGoal = CompleteLearningOnboardingInput['learningGoal'];
type OnboardingSubject = (typeof ONBOARDING_SUBJECT_IDS)[number];

interface FormState {
  educationLevel: EducationLevel | null;
  grade: string;
  favoriteSubjects: OnboardingSubject[];
  weakSubjects: OnboardingSubject[];
  learningGoal: LearningGoal | null;
  goalDetail: string;
  teachingPreference: TeachingPreference;
}

interface OnboardingResponse {
  success: boolean;
  educationLevel?: string | null;
  grade?: string | null;
  favoriteSubjects?: string[];
  onboarding?: LearningOnboardingProfile | null;
}

const INITIAL_FORM: FormState = {
  educationLevel: null,
  grade: '',
  favoriteSubjects: [],
  weakSubjects: [],
  learningGoal: null,
  goalDetail: '',
  teachingPreference: 'balanced',
};

const STAGES = [
  { value: 'middle', label: '初中', grades: ['初一', '初二', '初三'] },
  { value: 'high', label: '高中', grades: ['高一', '高二', '高三'] },
] as const;

const GOAL_LABELS: Record<(typeof LEARNING_GOALS)[number], string> = {
  'improve-grades': '提升成绩',
  'exam-prep': '备战考试',
  'build-foundations': '补齐基础',
  'explore-interest': '拓展兴趣',
};

const PREFERENCE_LABELS: Record<(typeof TEACHING_PREFERENCES)[number], string> = {
  'example-first': '先看例题',
  'visual-explanation': '图示讲解',
  'step-by-step': '分步推导',
  'practice-first': '先练后讲',
  balanced: '均衡安排',
};

const SUBJECTS = ONBOARDING_SUBJECT_IDS.map((id) => ({
  id,
  label: SUBJECT_CONFIG.find((subject) => subject.id === id)?.label ?? id,
}));

function toggleSubject(
  subjects: OnboardingSubject[],
  subject: OnboardingSubject,
): OnboardingSubject[] {
  return subjects.includes(subject)
    ? subjects.filter((item) => item !== subject)
    : [...subjects, subject];
}

function ChoiceButton({
  label,
  selected,
  onClick,
  className,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <span>{label}</span>
      {selected && (
        <span aria-hidden="true" className="flex items-center gap-1 text-xs text-primary">
          <Check className="size-4" />
          已选
        </span>
      )}
    </button>
  );
}

export function LearningProfileOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const isEditMode = searchParams.get('mode') === 'edit';
  const safeRedirect = sanitizeInternalRedirect(searchParams.get('redirect'));
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>(
    isEditMode ? 'loading' : 'idle',
  );

  const activeStage = STAGES.find((stage) => stage.value === form.educationLevel);
  const firstWeakSubject = form.weakSubjects[0];
  const diagnosticHref = firstWeakSubject
    ? `/sky/cloud-mind/quiz?subject=${encodeURIComponent(firstWeakSubject)}&mode=diagnostic`
    : '/sky/cloud-mind/quiz?mode=diagnostic';

  const loadProfile = useCallback(async () => {
    setLoadState('loading');
    setError('');
    try {
      const response = await fetch('/api/user/learning-onboarding');
      if (!response.ok) throw new Error('load failed');
      const data = (await response.json()) as OnboardingResponse;
      if (!data.success) throw new Error('load failed');

      const onboarding = data.onboarding?.status === 'completed' ? data.onboarding : null;
      const favoriteSubjects = (data.favoriteSubjects ?? []).filter((subject) =>
        ONBOARDING_SUBJECT_IDS.includes(subject as OnboardingSubject),
      ) as OnboardingSubject[];
      const educationLevel =
        data.educationLevel === 'middle' || data.educationLevel === 'high'
          ? data.educationLevel
          : null;

      setForm({
        educationLevel,
        grade: data.grade ?? '',
        favoriteSubjects,
        weakSubjects: onboarding?.weakSubjects ?? [],
        learningGoal: onboarding?.learningGoal ?? null,
        goalDetail: onboarding?.goalDetail ?? '',
        teachingPreference: onboarding?.teachingPreference ?? 'balanced',
      });
      setLoadState('idle');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    if (isEditMode) void loadProfile();
  }, [isEditMode, loadProfile]);

  const progressStep = Math.min(step + 1, 3);
  const progressLabel = useMemo(() => `第 ${progressStep} 步，共 3 步`, [progressStep]);

  function nextStep() {
    setError('');
    if (step === 0) {
      if (!form.educationLevel || !form.grade) {
        setError('请选择学习阶段和年级');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) setStep(2);
  }

  async function saveProfile() {
    if (!form.learningGoal) {
      setError('请选择一个学习目标');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const payload: CompleteLearningOnboardingInput = {
        educationLevel: form.educationLevel as EducationLevel,
        grade: form.grade as Grade,
        favoriteSubjects: form.favoriteSubjects,
        weakSubjects: form.weakSubjects,
        learningGoal: form.learningGoal,
        goalDetail: form.goalDetail,
        teachingPreference: form.teachingPreference,
      };
      const response = await fetch('/api/user/learning-onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('save failed');
      await refresh();
      setStep(3);
    } catch {
      setError('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  }

  async function skipOnboarding() {
    setError('');
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/learning-onboarding/skip', { method: 'POST' });
      if (!response.ok) throw new Error('skip failed');
      await refresh();
      router.push(safeRedirect);
    } catch {
      setError('跳过失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl items-center justify-center px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" />
          正在读取学习画像…
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-destructive">学习画像读取失败</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={loadProfile}>
          重试
        </Button>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ClipboardCheck className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">学习画像已保存</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            你可以先做一组小测建立学情基线，也可以直接继续学习。
          </p>
        </div>
        <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => router.push(safeRedirect)}
          >
            先逛逛
          </Button>
          <Button type="button" className="min-h-11" onClick={() => router.push(diagnosticHref)}>
            开始诊断
            <ArrowRight />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 pt-6 sm:px-6 sm:pt-10">
      <header className="shrink-0 border-b border-border pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary">{progressLabel}</p>
            <h1 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
              {isEditMode ? '更新学习画像' : '建立学习画像'}
            </h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 text-muted-foreground"
            disabled={isSaving}
            onClick={skipOnboarding}
          >
            暂时跳过
          </Button>
        </div>
        <div
          className="mt-4 grid grid-cols-3 gap-2"
          role="progressbar"
          aria-label="问卷进度"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={progressStep}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={cn(
                'h-1.5 rounded-full transition-colors',
                index <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 py-6">
        {step === 0 && (
          <section aria-labelledby="education-heading">
            <h2 id="education-heading" className="text-lg font-semibold text-foreground">
              你目前在哪个学习阶段？
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">这会帮助我们匹配合适的内容难度。</p>
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-medium text-foreground">学习阶段</legend>
              <div className="grid grid-cols-2 gap-2">
                {STAGES.map((stage) => (
                  <ChoiceButton
                    key={stage.value}
                    label={stage.label}
                    selected={form.educationLevel === stage.value}
                    onClick={() => {
                      setError('');
                      setForm((current) => ({
                        ...current,
                        educationLevel: stage.value,
                        grade: current.educationLevel === stage.value ? current.grade : '',
                      }));
                    }}
                  />
                ))}
              </div>
            </fieldset>
            {activeStage && (
              <fieldset className="mt-6">
                <legend className="mb-2 text-sm font-medium text-foreground">年级</legend>
                <div className="grid grid-cols-3 gap-2">
                  {activeStage.grades.map((grade) => (
                    <ChoiceButton
                      key={grade}
                      label={grade}
                      selected={form.grade === grade}
                      onClick={() => {
                        setError('');
                        setForm((current) => ({ ...current, grade }));
                      }}
                      className="justify-center"
                    />
                  ))}
                </div>
              </fieldset>
            )}
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="subjects-heading">
            <h2 id="subjects-heading" className="text-lg font-semibold text-foreground">
              哪些学科更需要关注？
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">兴趣和吃力学科可以重复选择。</p>
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-medium text-foreground">感兴趣的学科</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SUBJECTS.map((subject) => (
                  <ChoiceButton
                    key={subject.id}
                    label={subject.label}
                    selected={form.favoriteSubjects.includes(subject.id)}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        favoriteSubjects: toggleSubject(current.favoriteSubjects, subject.id),
                      }))
                    }
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-7">
              <legend className="mb-2 text-sm font-medium text-foreground">目前较吃力的学科</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SUBJECTS.map((subject) => (
                  <ChoiceButton
                    key={subject.id}
                    label={subject.label}
                    selected={form.weakSubjects.includes(subject.id)}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        weakSubjects: toggleSubject(current.weakSubjects, subject.id),
                      }))
                    }
                  />
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="goal-heading">
            <h2 id="goal-heading" className="text-lg font-semibold text-foreground">
              这段时间最想达成什么？
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">选择目标和更适合你的讲解方式。</p>
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-medium text-foreground">学习目标</legend>
              <div className="grid grid-cols-2 gap-2">
                {LEARNING_GOALS.map((goal) => (
                  <ChoiceButton
                    key={goal}
                    label={GOAL_LABELS[goal]}
                    selected={form.learningGoal === goal}
                    onClick={() => {
                      setError('');
                      setForm((current) => ({ ...current, learningGoal: goal }));
                    }}
                  />
                ))}
              </div>
            </fieldset>
            <div className="mt-5">
              <label
                htmlFor="goal-detail"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                具体目标（选填）
              </label>
              <Input
                id="goal-detail"
                value={form.goalDetail}
                maxLength={120}
                placeholder="例如：补齐代数基础"
                className="min-h-11"
                onChange={(event) =>
                  setForm((current) => ({ ...current, goalDetail: event.target.value }))
                }
              />
            </div>
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-medium text-foreground">讲解偏好</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TEACHING_PREFERENCES.map((preference) => (
                  <ChoiceButton
                    key={preference}
                    label={PREFERENCE_LABELS[preference]}
                    selected={form.teachingPreference === preference}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        teachingPreference: preference,
                      }))
                    }
                  />
                ))}
              </div>
            </fieldset>
          </section>
        )}
      </div>

      <footer className="sticky bottom-0 shrink-0 border-t border-border bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        {error && (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isSaving}
              onClick={() => {
                setError('');
                setStep((step - 1) as Step);
              }}
            >
              <ArrowLeft />
              上一步
            </Button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <Button type="button" className="min-h-11" onClick={nextStep}>
              下一步
              <ArrowRight />
            </Button>
          ) : (
            <Button type="button" className="min-h-11" disabled={isSaving} onClick={saveProfile}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
              {isSaving ? '保存中…' : '保存画像'}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
