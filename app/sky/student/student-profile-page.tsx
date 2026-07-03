'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  ChevronDown,
  GitBranch,
  Lightbulb,
  Loader2,
  RefreshCw,
  Target,
  UserCheck,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileOnboardingChat } from '@/components/sky/student/profile-onboarding-chat';
import type { ConversationalProfilePatch } from '@/lib/student/conversation-profile';
import {
  buildLearningPrescription,
  type LearningPrescription,
  type PrescriptionAction,
  type PrescriptionEvidence,
  type PrescriptionTopic,
} from '@/lib/student/learning-prescription';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { cn } from '@/lib/utils';

interface ErrorPattern {
  knowledgePoint: string;
  errorType: string;
  frequency: number;
  lastOccurrence: string | number;
}

interface StudentProfile {
  userId: string;
  masteryBySubject: Record<string, number>;
  masteryByKnowledge: Record<string, number>;
  weakPoints: string[];
  strongPoints: string[];
  errorPatterns: ErrorPattern[];
  totalQuestions: number;
  totalCorrect: number;
  lastUpdated: string | number;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  'calculation-error': '计算失误',
  'concept-unclear': '概念不清',
  'method-wrong': '方法选择',
  misreading: '审题错误',
  careless: '粗心大意',
  'format-error': '格式问题',
};

const ACTION_META: Record<
  PrescriptionAction['key'],
  { icon: typeof BookOpenCheck; accent: string }
> = {
  teach: {
    icon: BookOpenCheck,
    accent: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  quiz: {
    icon: Target,
    accent: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
  },
  review: {
    icon: CalendarClock,
    accent: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
  graph: {
    icon: GitBranch,
    accent: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
  diagnostic: {
    icon: Zap,
    accent: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
  },
};

function formatDate(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚更新';
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTopErrorPatterns(profile: StudentProfile): ErrorPattern[] {
  return [...(profile.errorPatterns ?? [])].sort((a, b) => b.frequency - a.frequency).slice(0, 4);
}

function getPreferenceRows(patch?: ConversationalProfilePatch): Array<{
  label: string;
  value: string;
}> {
  if (!patch) return [];

  const rows: Array<{ label: string; value: string }> = [];
  if (patch.learningGoal?.value) rows.push({ label: '学习目标', value: patch.learningGoal.value });
  if (patch.resourcePreference?.value.length) {
    rows.push({ label: '资源偏好', value: patch.resourcePreference.value.join('、') });
  }
  if (patch.interactionPreference?.value) {
    rows.push({ label: '讲解偏好', value: patch.interactionPreference.value });
  }
  if (patch.learningPace?.value) rows.push({ label: '学习节奏', value: patch.learningPace.value });
  if (patch.currentLearningState?.value) {
    rows.push({ label: '当前状态', value: patch.currentLearningState.value });
  }
  return rows;
}

export function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [preferencePatch, setPreferencePatch] = useState<ConversationalProfilePatch>();
  const [preferenceOpen, setPreferenceOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const prioritizeReview = useSkyClassroomStore((state) => state.prioritizeReview);

  const fetchProfile = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      const shouldForce = force || !hasLoadedRef.current;
      const url = `/api/sky/student/profile?force=${shouldForce}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data?.success && data.profile) {
        hasLoadedRef.current = true;
        setProfile(data.profile);
      } else {
        setError(data?.error ?? '获取学情数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络请求失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const prescription = useMemo(() => {
    if (!profile) return null;
    return buildLearningPrescription(profile, preferencePatch);
  }, [preferencePatch, profile]);

  const handleAddReview = useCallback(
    (topics: string[]) => {
      if (topics.length === 0) return;
      prioritizeReview(topics);
    },
    [prioritizeReview],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/sky/learning"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回天梯工坊
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 text-white shadow-lg shadow-emerald-500/20">
            <UserCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-950 dark:text-white">学情分析</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              把做题表现和学习偏好合成下一步学习处方
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchProfile(true)}
          disabled={loading}
          className="gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {loading && !profile && <ProfileLoadingState />}
      {error && <ProfileErrorState error={error} onRetry={() => fetchProfile()} />}

      {profile && prescription && (
        <>
          <PrescriptionHero
            profile={profile}
            prescription={prescription}
            onOpenPreference={() => setPreferenceOpen(true)}
            onAddReview={handleAddReview}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <WeakPointPriorityList
                topics={prescription.priorityTopics}
                onAddReview={handleAddReview}
              />
              <ErrorPatternPanel patterns={getTopErrorPatterns(profile)} />
              <EvidencePanel evidence={prescription.evidence} />
            </div>

            <aside className="space-y-5">
              <PreferenceSummary
                patch={preferencePatch}
                prescription={prescription}
                lastUpdated={profile.lastUpdated}
                onOpen={() => setPreferenceOpen((value) => !value)}
                open={preferenceOpen}
              />
              {preferenceOpen && (
                <ProfileOnboardingChat
                  onPatchChange={(patch) => {
                    setPreferencePatch(patch);
                  }}
                />
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function ProfileLoadingState() {
  return (
    <Card className="border-slate-200 bg-white/70 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/60">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-sky-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">正在分析学情数据...</p>
      </CardContent>
    </Card>
  );
}

function ProfileErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="border-red-200/70 bg-red-50 dark:border-red-800/30 dark:bg-red-900/20">
      <CardContent className="flex items-center gap-3 py-6">
        <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
        <span className="flex-1 text-sm text-red-600 dark:text-red-400">{error}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-red-200 text-red-600 dark:border-red-800 dark:text-red-400"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

function PrescriptionHero({
  profile,
  prescription,
  onOpenPreference,
  onAddReview,
}: {
  profile: StudentProfile;
  prescription: LearningPrescription;
  onOpenPreference: () => void;
  onAddReview: (topics: string[]) => void;
}) {
  const topTopic = prescription.priorityTopics[0]?.name ?? '入门诊断';

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-300/20 dark:bg-slate-900/70">
      <div className="bg-[linear-gradient(135deg,#ecfdf5_0%,#eef9ff_58%,#ffffff_100%)] p-5 dark:bg-[linear-gradient(135deg,#0f3035_0%,#0b2530_52%,#081827_100%)] md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm dark:border-emerald-200/20 dark:bg-emerald-300/10 dark:text-emerald-100">
              <Lightbulb className="h-3.5 w-3.5" />
              你的学习处方
            </div>
            <h1 className="mt-4 text-2xl font-semibold leading-tight text-slate-950 dark:text-white md:text-3xl">
              {prescription.headline}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {prescription.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <SummaryPill label="当前优先" value={topTopic} />
              <SummaryPill label="正确率" value={`${prescription.accuracy}%`} />
              <SummaryPill label="做题数" value={`${profile.totalQuestions} 题`} />
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPreference}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white/85 px-4 py-2.5 text-sm font-semibold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 dark:border-sky-300/20 dark:bg-white/[0.06] dark:text-sky-100 dark:shadow-none"
          >
            <UserCheck className="h-4 w-4" />
            补充学习偏好
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/25 sm:grid-cols-2 lg:grid-cols-4">
        {prescription.nextActions.map((action) => (
          <ActionCard
            key={action.key}
            action={action}
            onAddReview={() => onAddReview(action.topics)}
          />
        ))}
      </div>
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:shadow-none">
      <span className="text-slate-400 dark:text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </span>
  );
}

function ActionCard({
  action,
  onAddReview,
}: {
  action: PrescriptionAction;
  onAddReview: () => void;
}) {
  const meta = ACTION_META[action.key];
  const Icon = meta.icon;
  const content = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            meta.accent,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">{action.label}</div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {action.description}
          </p>
        </div>
      </div>
    </>
  );

  const className =
    'rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-emerald-300/30';

  if (action.key === 'review') {
    return (
      <button type="button" onClick={onAddReview} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link href={action.href ?? '/sky/cloud-mind/teaching'} className={className}>
      {content}
    </Link>
  );
}

function WeakPointPriorityList({
  topics,
  onAddReview,
}: {
  topics: PrescriptionTopic[];
  onAddReview: (topics: string[]) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">薄弱点优先级</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            按掌握度、错因频次和对话画像共同排序
          </p>
        </div>
        <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
      </div>

      {topics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          暂无薄弱点。完成一次诊断或针对练习后，这里会生成优先级列表。
        </div>
      ) : (
        <div className="space-y-3">
          {topics.slice(0, 6).map((topic, index) => (
            <div
              key={topic.name}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-xs font-bold text-rose-700 dark:bg-rose-300/15 dark:text-rose-200">
                      {index + 1}
                    </span>
                    <h4 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                      {topic.name}
                    </h4>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                      掌握度 {topic.mastery}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-900">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all"
                      style={{ width: `${Math.max(4, Math.min(topic.mastery, 100))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {topic.reason}。{topic.suggestedAction}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/sky/cloud-mind/quiz?topic=${encodeURIComponent(topic.name)}`}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    练 5 题
                  </Link>
                  <button
                    type="button"
                    onClick={() => onAddReview([topic.name])}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100"
                  >
                    加入复习
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ErrorPatternPanel({ patterns }: { patterns: ErrorPattern[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-4 flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-amber-500" />
        <h3 className="text-base font-semibold text-slate-950 dark:text-white">高频错因</h3>
      </div>

      {patterns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          暂无错误模式。错题归档后，这里会解释主要错因。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {patterns.map((pattern) => (
            <div
              key={`${pattern.knowledgePoint}-${pattern.errorType}`}
              className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-300/20 dark:bg-amber-300/10"
            >
              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                {ERROR_TYPE_LABELS[pattern.errorType] ?? pattern.errorType}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                集中在 {pattern.knowledgePoint}，出现 {pattern.frequency} 次。
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EvidencePanel({ evidence }: { evidence: PrescriptionEvidence[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
        <h3 className="text-base font-semibold text-slate-950 dark:text-white">为什么这样推荐</h3>
      </div>
      <div className="space-y-2">
        {evidence.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.label}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.value}</div>
            </div>
            <span className="w-fit rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-300">
              {item.source === 'performance' && '做题数据'}
              {item.source === 'preference' && '画像对话'}
              {item.source === 'mixed' && '综合判断'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PreferenceSummary({
  patch,
  prescription,
  lastUpdated,
  open,
  onOpen,
}: {
  patch?: ConversationalProfilePatch;
  prescription: LearningPrescription;
  lastUpdated: string | number;
  open: boolean;
  onOpen: () => void;
}) {
  const rows = getPreferenceRows(patch);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">系统当前理解你</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            推荐方式：{prescription.recommendedMode}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="展开学习偏好对话"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
              <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {row.label}
              </div>
              <div className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                {row.value}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50 px-3 py-3 text-sm leading-6 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100">
            还没有补充学习偏好。填写后，处方会更贴合你的目标、节奏和讲解方式。
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
        <RefreshCw className="h-3.5 w-3.5" />
        学情数据更新于 {formatDate(lastUpdated)}
      </div>
    </section>
  );
}
