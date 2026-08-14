'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  ClipboardCheck,
  Clock3,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { sanitizeInternalRedirect } from '@/components/auth/onboarding-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  IDENTITY_CONFIG,
  IDENTITY_LABELS,
  LEARNER_FOUNDATIONS,
  LEARNER_WEEKLY_TIME,
  PRODUCT_IDENTITIES,
  type CatalogOption,
  type ProductIdentity,
} from '@/lib/onboarding/catalog';
import {
  createInitialFormState,
  setPrimaryIdentity,
  toggleIdentity,
  toCompletionInput,
  updateIdentityDraft,
  type IdentityDraft,
  type UniversalOnboardingFormState,
} from '@/lib/onboarding/form-state';
import { resolveOnboardingRecommendation } from '@/lib/onboarding/selectors';
import type { InitialProfileSnapshot } from '@/lib/onboarding/initial-profile';
import type { UniversalOnboardingProfile } from '@/lib/onboarding/types';
import { ProfileChoice } from './domain-picker';
import { IdentityContextEditor } from './identity-context-editor';

type Step = 0 | 1 | 2 | 3;
type Goal = IdentityDraft['goals'][number];

interface OnboardingResponse {
  success: boolean;
  status?: string;
  onboarding?: UniversalOnboardingProfile | null;
  initialProfile?: InitialProfileSnapshot | null;
}

function goalKey(goal: Goal): string {
  return goal.source === 'catalog' ? `catalog:${goal.id}` : `custom:${goal.label.toLowerCase()}`;
}

function toggleLimited<T>(
  values: T[],
  value: T,
  equals: (left: T, right: T) => boolean,
  max: number,
) {
  return values.some((item) => equals(item, value))
    ? values.filter((item) => !equals(item, value))
    : values.length < max
      ? [...values, value]
      : values;
}

function IdentityStep({
  state,
  onChange,
}: {
  state: UniversalOnboardingFormState;
  onChange: (state: UniversalOnboardingFormState) => void;
}) {
  function changeIdentity(identity: ProductIdentity) {
    if (
      state.identities.includes(identity) &&
      state.completedProfiles[identity] &&
      !window.confirm('移除身份会同时删除该身份已保存的学习情况，是否继续？')
    ) {
      return;
    }
    onChange(toggleIdentity(state, identity));
  }

  return (
    <section aria-labelledby="identity-heading">
      <h2 id="identity-heading" className="text-lg font-semibold text-foreground">
        你会以哪些身份使用天空课堂？
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        可多选。这里的身份只影响内容与工具推荐，不改变账号权限。
      </p>
      <fieldset className="mt-6">
        <legend className="sr-only">使用身份</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRODUCT_IDENTITIES.map((identity) => (
            <ProfileChoice
              key={identity}
              label={IDENTITY_LABELS[identity]}
              selected={state.identities.includes(identity)}
              onClick={() => changeIdentity(identity)}
            />
          ))}
        </div>
      </fieldset>

      {state.identities.length > 1 && (
        <fieldset className="mt-7">
          <legend className="mb-2 text-sm font-medium text-foreground">当前主要身份</legend>
          <p className="mb-3 text-sm text-muted-foreground">
            首次只需完善这个身份，其他身份可以稍后补充。
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {state.identities.map((identity) => (
              <ProfileChoice
                key={identity}
                label={IDENTITY_LABELS[identity]}
                selected={state.primaryIdentity === identity}
                onClick={() => onChange(setPrimaryIdentity(state, identity))}
              />
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );
}

function GoalPreferenceStep({
  state,
  onChange,
}: {
  state: UniversalOnboardingFormState;
  onChange: (state: UniversalOnboardingFormState) => void;
}) {
  const identity = state.primaryIdentity;
  const [customGoal, setCustomGoal] = useState('');
  if (!identity) return null;
  const activeIdentity: ProductIdentity = identity;
  const draft = state.drafts[activeIdentity];
  const config = IDENTITY_CONFIG[activeIdentity];
  const goals = config.goals as readonly CatalogOption[];
  const needs = config.needs as readonly CatalogOption[];
  const preferences = config.preferences as readonly CatalogOption[];

  function update(updateDraft: (draft: IdentityDraft) => IdentityDraft) {
    onChange(updateIdentityDraft(state, activeIdentity, updateDraft));
  }

  function toggleGoal(goal: Goal) {
    update((current) => ({
      ...current,
      goals: toggleLimited(
        current.goals,
        goal,
        (left, right) => goalKey(left) === goalKey(right),
        3,
      ),
    }));
  }

  function addCustomGoal() {
    const label = customGoal.trim().replace(/\s+/g, ' ');
    if (!label || label.length > 40) return;
    const goal: Goal = { source: 'custom', label };
    if (draft.goals.some((item) => goalKey(item) === goalKey(goal)) || draft.goals.length >= 3)
      return;
    update((current) => ({ ...current, goals: [...current.goals, goal] }));
    setCustomGoal('');
  }

  return (
    <section aria-labelledby="goal-heading">
      <h2 id="goal-heading" className="text-lg font-semibold text-foreground">
        你希望先解决什么？
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        目标选 1-3 项，其余选项均可保持默认，之后随时可改。
      </p>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-medium text-foreground">当前目标</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {goals.map((item) => {
            const goal: Goal = { source: 'catalog', id: item.id, label: item.label };
            return (
              <ProfileChoice
                key={item.id}
                label={item.label}
                selected={draft.goals.some((selected) => goalKey(selected) === goalKey(goal))}
                onClick={() => toggleGoal(goal)}
              />
            );
          })}
          {draft.goals
            .filter((goal) => goal.source === 'custom')
            .map((goal) => (
              <ProfileChoice
                key={goalKey(goal)}
                label={goal.label}
                selected
                onClick={() => toggleGoal(goal)}
              />
            ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            aria-label="其他目标"
            value={customGoal}
            maxLength={40}
            className="min-h-11 min-w-0"
            onChange={(event) => setCustomGoal(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomGoal();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0"
            disabled={!customGoal.trim() || draft.goals.length >= 3}
            onClick={addCustomGoal}
          >
            <Plus />
            添加目标
          </Button>
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="mb-2 text-sm font-medium text-foreground">希望获得的支持（选填）</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {needs.map((item) => (
            <ProfileChoice
              key={item.id}
              label={item.label}
              selected={draft.needs.includes(item.id)}
              onClick={() =>
                update((current) => ({
                  ...current,
                  needs: toggleLimited(current.needs, item.id, (left, right) => left === right, 3),
                }))
              }
            />
          ))}
        </div>
      </fieldset>

      {activeIdentity === 'learner' && (
        <div className="mt-7 grid gap-6 rounded-xl border border-primary/15 bg-primary/[0.03] p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Brain className="size-4 text-primary" />
              初始学习状态
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              这些是自评数据，只用于设置初始难度与学习节奏，后续会由真实作答自动校准。
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">你目前的基础状态</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LEARNER_FOUNDATIONS.map((item) => (
                <ProfileChoice
                  key={item.id}
                  label={item.label}
                  selected={draft.foundation === item.id}
                  onClick={() => update((current) => ({ ...current, foundation: item.id }))}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock3 className="size-4 text-primary" />
              每周可投入时间
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {LEARNER_WEEKLY_TIME.map((item) => (
                <ProfileChoice
                  key={item.id}
                  label={item.label}
                  selected={draft.weeklyTime === item.id}
                  onClick={() => update((current) => ({ ...current, weeklyTime: item.id }))}
                />
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <fieldset className="mt-7">
        <legend className="mb-2 text-sm font-medium text-foreground">
          {config.preferenceLabel}
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {preferences.map((item) => (
            <ProfileChoice
              key={item.id}
              label={item.label}
              selected={draft.preference === item.id}
              onClick={() => update((current) => ({ ...current, preference: item.id }))}
            />
          ))}
        </div>
      </fieldset>

      <div className="mt-7">
        <label htmlFor="profile-detail" className="mb-2 block text-sm font-medium text-foreground">
          最重要的问题（选填）
        </label>
        <Input
          id="profile-detail"
          value={draft.detail}
          maxLength={120}
          className="min-h-11"
          onChange={(event) => update((current) => ({ ...current, detail: event.target.value }))}
        />
      </div>
    </section>
  );
}

export function LearningProfileOnboarding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();
  const isEditMode = searchParams.get('mode') === 'edit';
  const safeRedirect = sanitizeInternalRedirect(searchParams.get('redirect'));
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState(createInitialFormState);
  const [savedProfile, setSavedProfile] = useState<UniversalOnboardingProfile | null>(null);
  const [initialProfile, setInitialProfile] = useState<InitialProfileSnapshot | null>(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>(
    isEditMode ? 'loading' : 'idle',
  );

  const loadProfile = useCallback(async () => {
    setLoadState('loading');
    setError('');
    try {
      const response = await fetch('/api/user/learning-onboarding');
      const data = (await response.json()) as OnboardingResponse;
      if (!response.ok || !data.success) throw new Error('load failed');
      setForm(createInitialFormState(data.onboarding));
      setLoadState('idle');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    if (isEditMode) void loadProfile();
  }, [isEditMode, loadProfile]);

  const recommendation = useMemo(
    () => resolveOnboardingRecommendation(savedProfile, safeRedirect),
    [safeRedirect, savedProfile],
  );
  const completionHref = isEditMode
    ? recommendation.primaryHref
    : '/sky/learning/profile?from=learning';
  const progressStep = Math.min(step + 1, 3);

  function nextStep() {
    setError('');
    if (step === 0) {
      if (!form.primaryIdentity || form.identities.length === 0) {
        setError('请至少选择一个身份');
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      const draft = form.primaryIdentity ? form.drafts[form.primaryIdentity] : null;
      if (!draft || draft.contexts.some((context) => !context.stage)) {
        setError('请为每个使用场景选择学习阶段');
        return;
      }
      if (form.primaryIdentity === 'learner' && draft.contexts[0]?.domains.length === 0) {
        setError('请至少选择一个当前学习领域');
        return;
      }
      setStep(2);
    }
  }

  async function saveProfile() {
    const primaryDraft = form.primaryIdentity ? form.drafts[form.primaryIdentity] : null;
    if (!primaryDraft || primaryDraft.goals.length === 0) {
      setError('请至少选择一个当前目标');
      return;
    }
    if (
      form.primaryIdentity === 'learner' &&
      (!primaryDraft.foundation || !primaryDraft.weeklyTime)
    ) {
      setError('请选择当前基础状态和每周可投入时间');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const payload = toCompletionInput(form);
      const response = await fetch('/api/user/learning-onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as OnboardingResponse;
      if (!response.ok || !data.success) throw new Error('save failed');
      setSavedProfile(data.onboarding?.status === 'completed' ? data.onboarding : null);
      setInitialProfile(data.initialProfile ?? null);
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
          正在读取你的学习情况…
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-destructive">学习情况读取失败</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={loadProfile}>
          重试
        </Button>
      </div>
    );
  }

  if (step === 3) {
    const hasDistinctRecommendation = recommendation.primaryHref !== recommendation.secondaryHref;
    return (
      <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ClipboardCheck className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">学习情况已保存</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            推荐会结合当前身份、阶段、领域和目标，并随着后续使用继续更新。
          </p>
          {initialProfile && (
            <div className="mt-6 w-full max-w-2xl text-left">
              <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Sparkles className="size-5 text-primary" />
                    初始学习情况已建立
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    完整度 {initialProfile.completeness}%
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground">{initialProfile.summary}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  当前难度建议：{initialProfile.recommendedDifficulty}
                  。内容来自你的自我介绍，完成练习后会自动更新。
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {initialProfile.toolSuggestions.map((suggestion) => (
                  <Button
                    key={`${suggestion.tool}:${suggestion.href}`}
                    type="button"
                    variant="outline"
                    className="h-auto min-h-24 items-start justify-start whitespace-normal p-4 text-left"
                    onClick={() => router.push(suggestion.href)}
                  >
                    <span>
                      <span className="block font-semibold text-foreground">
                        {suggestion.title}
                      </span>
                      <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                        {suggestion.reason}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div
          className={cn(
            'grid gap-3 border-t border-border pt-4',
            hasDistinctRecommendation && 'sm:grid-cols-2',
          )}
        >
          {hasDistinctRecommendation && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => router.push(recommendation.secondaryHref)}
            >
              先返回
            </Button>
          )}
          <Button type="button" className="min-h-11" onClick={() => router.push(completionHref)}>
            {recommendation.primaryLabel}
            <ArrowRight />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col overflow-x-hidden px-4 pt-6 sm:px-6 sm:pt-10">
      <header className="shrink-0 border-b border-border pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary">第 {progressStep} 步，共 3 步</p>
            <h1 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
              {isEditMode ? '更新学习情况' : '填写学习情况'}
            </h1>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 shrink-0 text-muted-foreground"
            disabled={isSaving}
            onClick={() => (isEditMode ? router.push(safeRedirect) : void skipOnboarding())}
          >
            {isEditMode ? '返回' : '暂时跳过'}
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
        {step === 0 && <IdentityStep state={form} onChange={setForm} />}
        {step === 1 && <IdentityContextEditor state={form} onChange={setForm} />}
        {step === 2 && <GoalPreferenceStep state={form} onChange={setForm} />}
      </div>

      <footer className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-background/95 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-background/85">
        {error && (
          <p id="onboarding-error" className="mb-3 text-sm text-destructive" role="alert">
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
            <Button
              type="button"
              className="min-h-11"
              aria-describedby={error ? 'onboarding-error' : undefined}
              onClick={nextStep}
            >
              下一步
              <ArrowRight />
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-11"
              aria-describedby={error ? 'onboarding-error' : undefined}
              disabled={isSaving}
              onClick={saveProfile}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
              {isSaving ? '保存中…' : '保存学习情况'}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
