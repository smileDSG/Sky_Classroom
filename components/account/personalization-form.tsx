'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  learnerPreferencesInputSchema,
  type LearnerPreferencesInput,
} from '@/lib/adaptive-learning/contracts';
import {
  createInitialLearnerPreferences,
  LearnerProfileClientError,
  loadLearnerPreferences,
  saveLearnerPreferences,
  toLearnerPreferencesInput,
} from '@/lib/adaptive-learning/profile/client';
import { cn } from '@/lib/utils';

type TabKey = 'formats' | 'learning' | 'ai' | 'privacy';
type LoadState = 'loading' | 'ready' | 'missing' | 'error';
type SaveState = 'idle' | 'saving' | 'success' | 'conflict' | 'error';

const FORMAT_OPTIONS: Array<{
  value: LearnerPreferencesInput['contentFormatPreferences'][number];
  label: string;
  hint: string;
}> = [
  { value: 'text', label: '文字讲解', hint: '结构清晰的文字说明' },
  { value: 'worked-example', label: '例题演示', hint: '先看完整解法再练习' },
  { value: 'diagram', label: '图示理解', hint: '图表、流程与空间关系' },
  { value: 'interactive', label: '互动练习', hint: '边学边答、即时反馈' },
  { value: 'audio', label: '语音讲解', hint: '适合听学与复述' },
];

const DEPTH_OPTIONS: Array<{
  value: LearnerPreferencesInput['explanationDepth'];
  label: string;
}> = [
  { value: 'concise', label: '简洁' },
  { value: 'standard', label: '标准' },
  { value: 'detailed', label: '详细' },
  { value: 'comprehensive', label: '全面' },
];

const PACE_OPTIONS: Array<{
  value: LearnerPreferencesInput['learningPace'];
  label: string;
}> = [
  { value: 'slow', label: '稳步慢学' },
  { value: 'standard', label: '标准节奏' },
  { value: 'fast', label: '快速推进' },
];

const STEP_OPTIONS: Array<{
  value: LearnerPreferencesInput['stepByStepMode'];
  label: string;
  hint: string;
}> = [
  { value: 'always', label: '始终分步', hint: '每次都展示完整步骤' },
  { value: 'when-needed', label: '按需分步', hint: '复杂内容才展开步骤' },
  { value: 'hints-first', label: '提示优先', hint: '先给线索，再揭示答案' },
];

const TONE_OPTIONS: Array<{
  value: LearnerPreferencesInput['interactionTone'];
  label: string;
}> = [
  { value: 'friendly', label: '友善亲切' },
  { value: 'professional', label: '专业严谨' },
  { value: 'encouraging', label: '鼓励引导' },
  { value: 'strict', label: '严格要求' },
  { value: 'humorous', label: '幽默风趣' },
];

const MEMORY_OPTIONS: Array<{
  value: LearnerPreferencesInput['privacy']['conversationMemory'];
  label: string;
  hint: string;
}> = [
  { value: 'off', label: '关闭', hint: '不使用历史对话记忆' },
  { value: 'session', label: '仅本次会话', hint: '离开会话后不再使用' },
  { value: 'persistent', label: '跨会话记忆', hint: '持续辅助后续学习' },
];

const TABS: Array<{ key: TabKey; label: string; icon: typeof BookOpen }> = [
  { key: 'formats', label: '呈现偏好', icon: BookOpen },
  { key: 'learning', label: '学习节奏', icon: Brain },
  { key: 'ai', label: 'AI 交互', icon: MessageCircle },
  { key: 'privacy', label: '隐私授权', icon: ShieldCheck },
];

function profileErrorMessage(error: unknown): string {
  if (!(error instanceof LearnerProfileClientError)) {
    return '学习情况读取失败，请重试。';
  }

  switch (error.code) {
    case 'UNAUTHORIZED':
      return '登录状态已失效，请重新登录后再试。';
    case 'PERSISTENT_STORAGE_UNAVAILABLE':
      return '学习情况暂时无法保存，当前更改未保存。';
    case 'INVALID_PROFILE_RESPONSE':
      return '返回的学习情况不完整，已停止加载。';
    default:
      return '学习情况读取失败，当前更改未保存。';
  }
}

function OptionButton({
  selected,
  disabled,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-violet-300 bg-violet-50 text-violet-800 shadow-sm dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200'
          : 'border-border bg-background text-foreground hover:border-violet-200 hover:bg-violet-50/50 dark:hover:border-violet-800 dark:hover:bg-violet-950/20',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PersonalizationForm() {
  const [activeTab, setActiveTab] = useState<TabKey>('formats');
  const [draft, setDraft] = useState<LearnerPreferencesInput>(() =>
    createInitialLearnerPreferences(),
  );
  const [version, setVersion] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const loadProfile = useCallback(async () => {
    setLoadState('loading');
    setSaveState('idle');
    setStatusMessage('');

    try {
      const preferences = await loadLearnerPreferences();
      setDraft(toLearnerPreferencesInput(preferences));
      setVersion(preferences.version);
      setLoadState('ready');
    } catch (error) {
      if (error instanceof LearnerProfileClientError && error.code === 'PROFILE_NOT_FOUND') {
        setDraft(createInitialLearnerPreferences());
        setVersion(0);
        setLoadState('missing');
        return;
      }

      setLoadState('error');
      setStatusMessage(profileErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadProfile();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadProfile]);

  const markEdited = () => {
    setSaveState((current) => (current === 'success' || current === 'error' ? 'idle' : current));
    setStatusMessage('');
  };

  const updateDraft = <K extends keyof LearnerPreferencesInput>(
    key: K,
    value: LearnerPreferencesInput[K],
  ) => {
    markEdited();
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updatePrivacy = <K extends keyof LearnerPreferencesInput['privacy']>(
    key: K,
    value: LearnerPreferencesInput['privacy'][K],
  ) => {
    markEdited();
    setDraft((current) => ({
      ...current,
      privacy: { ...current.privacy, [key]: value },
    }));
  };

  const toggleFormat = (format: LearnerPreferencesInput['contentFormatPreferences'][number]) => {
    const selected = draft.contentFormatPreferences.includes(format);
    if (selected && draft.contentFormatPreferences.length === 1) {
      setSaveState('error');
      setStatusMessage('至少保留一种内容呈现偏好。');
      return;
    }

    updateDraft(
      'contentFormatPreferences',
      selected
        ? draft.contentFormatPreferences.filter((item) => item !== format)
        : [...draft.contentFormatPreferences, format],
    );
  };

  const handleReset = () => {
    if (!window.confirm('恢复为待保存的初始偏好？保存后学习情况会更新。')) return;
    setDraft(createInitialLearnerPreferences());
    setSaveState('idle');
    setStatusMessage('已恢复初始值，尚未保存。');
  };

  const handleSave = async () => {
    const parsed = learnerPreferencesInputSchema.safeParse(draft);
    if (!parsed.success) {
      setSaveState('error');
      setStatusMessage(parsed.error.issues[0]?.message ?? '学习情况填写有误。');
      return;
    }

    setSaveState('saving');
    setStatusMessage('');

    try {
      const saved = await saveLearnerPreferences({
        expectedVersion: version,
        preferences: parsed.data,
      });
      setDraft(toLearnerPreferencesInput(saved));
      setVersion(saved.version);
      setLoadState('ready');
      setSaveState('success');
    } catch (error) {
      if (error instanceof LearnerProfileClientError && error.code === 'PROFILE_VERSION_CONFLICT') {
        setSaveState('conflict');
        setStatusMessage('学习情况已在其他位置更新。当前更改未覆盖已保存内容。');
        return;
      }

      setSaveState('error');
      setStatusMessage(profileErrorMessage(error));
    }
  };

  const isSaving = saveState === 'saving';
  const saveDisabled = isSaving || saveState === 'conflict';
  const onboardingLink = (
    <Link
      href="/sky/onboarding?mode=edit&redirect=%2Faccount"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      填写/编辑学习情况
      <ArrowRight className="size-4" />
    </Link>
  );

  if (loadState === 'loading') {
    return (
      <div className="space-y-4">
        {onboardingLink}
        <Card
          role="status"
          aria-live="polite"
          className="flex min-h-56 items-center justify-center gap-3 border-violet-100 bg-violet-50/40 p-8 dark:border-violet-900 dark:bg-violet-950/20"
        >
          <LoaderCircle className="size-5 animate-spin text-violet-600" />
          <span className="text-sm text-muted-foreground">正在加载已保存的学习情况…</span>
        </Card>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <Card className="border-red-200 bg-red-50/70 p-6 dark:border-red-900 dark:bg-red-950/20">
        <div role="alert" className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
          <div className="space-y-3">
            <div>
            <h2 className="font-semibold text-red-900 dark:text-red-100">学习情况加载失败</h2>
              <p className="mt-1 text-sm text-red-800 dark:text-red-200">{statusMessage}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadProfile()}>
              <RefreshCw className="size-4" />
              重新加载
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">我的学习情况</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              这些偏好会统一保存，用于上课、查资料、安排学习和学习反馈。
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isSaving}
          onClick={handleReset}
          className="min-h-11 self-start text-muted-foreground"
        >
          <RotateCcw className="size-4" />
          恢复初始值
        </Button>
      </div>

      {onboardingLink}

      <div
        role="tablist"
        aria-label="学习情况设置分类"
        className="grid grid-cols-4 gap-1 rounded-xl bg-muted/60 p-1"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            id={`profile-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`profile-panel-${key}`}
            disabled={isSaving}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2',
              activeTab === key
                ? 'bg-background text-violet-700 shadow-sm dark:text-violet-300'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            <span aria-hidden="true" className="hidden sm:inline">
              {label}
            </span>
            <span className="sr-only">{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'formats' && (
        <div
          id="profile-panel-formats"
          role="tabpanel"
          aria-labelledby="profile-tab-formats"
          className="space-y-5"
        >
          <Card className="space-y-4 p-5">
            <div>
              <h3 className="text-sm font-semibold">内容呈现方式</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                可多选，不把你固定归类为单一“学习类型”。
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FORMAT_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={draft.contentFormatPreferences.includes(option.value)}
                  disabled={isSaving}
                  onClick={() => toggleFormat(option.value)}
                >
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
                </OptionButton>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <label htmlFor="preferred-language" className="text-sm font-semibold">
              首选语言
            </label>
            <select
              id="preferred-language"
              value={draft.preferredLanguage}
              disabled={isSaving}
              onChange={(event) => updateDraft('preferredLanguage', event.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </select>
          </Card>
        </div>
      )}

      {activeTab === 'learning' && (
        <div
          id="profile-panel-learning"
          role="tabpanel"
          aria-labelledby="profile-tab-learning"
          className="space-y-5"
        >
          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">讲解深度</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEPTH_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={draft.explanationDepth === option.value}
                  disabled={isSaving}
                  onClick={() => updateDraft('explanationDepth', option.value)}
                  className="text-center"
                >
                  {option.label}
                </OptionButton>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">学习节奏</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {PACE_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={draft.learningPace === option.value}
                  disabled={isSaving}
                  onClick={() => updateDraft('learningPace', option.value)}
                  className="text-center"
                >
                  {option.label}
                </OptionButton>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">分步引导方式</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {STEP_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={draft.stepByStepMode === option.value}
                  disabled={isSaving}
                  onClick={() => updateDraft('stepByStepMode', option.value)}
                >
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
                </OptionButton>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'ai' && (
        <div
          id="profile-panel-ai"
          role="tabpanel"
          aria-labelledby="profile-tab-ai"
          className="space-y-5"
        >
          <Card className="space-y-3 p-5">
            <label htmlFor="assistant-name" className="text-sm font-semibold">
              AI 助手称呼
            </label>
            <input
              id="assistant-name"
              type="text"
              value={draft.assistantName}
              disabled={isSaving}
              maxLength={20}
              onChange={(event) => updateDraft('assistantName', event.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            />
          </Card>

          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">互动语气</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TONE_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={draft.interactionTone === option.value}
                  disabled={isSaving}
                  onClick={() => updateDraft('interactionTone', option.value)}
                  className="text-center"
                >
                  {option.label}
                </OptionButton>
              ))}
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="preference-notes" className="text-sm font-semibold">
                补充偏好说明
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {draft.preferenceNotes.length}/500
              </span>
            </div>
            <Textarea
              id="preference-notes"
              value={draft.preferenceNotes}
              disabled={isSaving}
              maxLength={500}
              rows={4}
              onChange={(event) => updateDraft('preferenceNotes', event.target.value)}
              placeholder="例如：讲抽象概念时先给生活类比，再给正式定义。"
              className="resize-none"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              这里只保存学习偏好，不会保存系统内部设置或私密对话内容。
            </p>
          </Card>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div
          id="profile-panel-privacy"
          role="tabpanel"
          aria-labelledby="profile-tab-privacy"
          className="space-y-5"
        >
          <Card className="space-y-3 p-5">
            <h3 className="text-sm font-semibold">对话记忆范围</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {MEMORY_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  selected={draft.privacy.conversationMemory === option.value}
                  disabled={isSaving}
                  onClick={() => updatePrivacy('conversationMemory', option.value)}
                >
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
                </OptionButton>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-5">
              <div>
                <label htmlFor="behavior-signals" className="text-sm font-semibold">
                  允许可选行为信号
                </label>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  允许使用停留、点击等操作帮助改进体验；不会直接改变你的掌握情况。
                </p>
              </div>
              <Switch
                id="behavior-signals"
                checked={draft.privacy.optionalBehaviorSignals}
                disabled={isSaving}
                onCheckedChange={(checked) => updatePrivacy('optionalBehaviorSignals', checked)}
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-5">
              <div>
                <label htmlFor="private-retrieval" className="text-sm font-semibold">
                  允许查找我上传的资料
                </label>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  只影响个人上传的资料；课程资料仍按正常权限使用。
                </p>
              </div>
              <Switch
                id="private-retrieval"
                checked={draft.privacy.privateKnowledgeRetrieval}
                disabled={isSaving}
                onCheckedChange={(checked) => updatePrivacy('privateKnowledgeRetrieval', checked)}
              />
            </div>
          </Card>
        </div>
      )}

      <div aria-live="polite" aria-atomic="true">
        {loadState === 'missing' && saveState === 'idle' && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            还没有保存学习情况。以上是待确认的初始内容，保存后才会生效。
          </div>
        )}
        {saveState === 'saving' && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border bg-muted/50 p-4 text-sm"
          >
            <LoaderCircle className="size-4 animate-spin" />
            正在保存学习情况…
          </div>
        )}
        {saveState === 'success' && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100"
          >
            <CheckCircle2 className="size-4" />
            学习情况已保存。
          </div>
        )}
        {saveState === 'conflict' && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{statusMessage}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadProfile()}>
              <RefreshCw className="size-4" />
            加载最新学习情况
            </Button>
          </div>
        )}
        {saveState === 'error' && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/20 dark:text-red-100"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {statusMessage}
          </div>
        )}
        {saveState === 'idle' && loadState === 'ready' && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground"
          >
            <ShieldCheck className="size-4 text-emerald-600" />
          已连接并保存学习情况
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={saveDisabled}
          onClick={() => void handleSave()}
          className="min-h-11 min-w-36 bg-violet-600 text-white hover:bg-violet-700"
        >
          {isSaving ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {loadState === 'missing' ? '保存学习情况' : '保存学习情况'}
        </Button>
      </div>
    </div>
  );
}
