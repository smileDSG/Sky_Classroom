'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { cn } from '@/lib/utils';

interface WorkshopSnapshot {
  generatedAt?: number;
  review?: {
    dueCount?: number;
    overdue?: number;
    completed?: number;
    total?: number;
  } | null;
  learningStats?: {
    masteryPercent?: number;
    todayStudyMinutes?: number;
    streakDays?: number;
    problemsAttempted?: number;
    problemsCorrect?: number;
  } | null;
  memoryProgress?: {
    totalFlipped?: number;
    topicCount?: number;
    lastStudied?: number | null;
  } | null;
  profile?: {
    masteryByKnowledge?: Record<string, number>;
    weakPoints?: string[];
    strongPoints?: string[];
    errorPatterns?: Array<{
      knowledgePoint: string;
      errorType: string;
      frequency: number;
    }>;
    totalQuestions?: number;
    totalCorrect?: number;
  } | null;
}

interface CompletionSignal {
  label: string;
  ready: boolean;
  detail: string;
}

function clampPercent(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

function getAccuracy(
  profile?: WorkshopSnapshot['profile'],
  stats?: WorkshopSnapshot['learningStats'],
) {
  const total = profile?.totalQuestions ?? stats?.problemsAttempted ?? 0;
  const correct = profile?.totalCorrect ?? stats?.problemsCorrect ?? 0;
  if (!total) return 0;
  return clampPercent((correct / total) * 100);
}

function getMastery(
  profile?: WorkshopSnapshot['profile'],
  stats?: WorkshopSnapshot['learningStats'],
) {
  const statMastery = stats?.masteryPercent;
  if (typeof statMastery === 'number' && statMastery > 0) return clampPercent(statMastery);
  const values = Object.values(profile?.masteryByKnowledge ?? {});
  if (values.length === 0) return 0;
  return clampPercent(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildSignals(snapshot: WorkshopSnapshot | null): CompletionSignal[] {
  const profile = snapshot?.profile;
  const masteryCount = Object.keys(profile?.masteryByKnowledge ?? {}).length;
  const totalQuestions = profile?.totalQuestions ?? snapshot?.learningStats?.problemsAttempted ?? 0;
  const weakCount = profile?.weakPoints?.length ?? 0;
  const reviewTotal = snapshot?.review?.total ?? 0;

  return [
    {
      label: '题目样本',
      ready: totalQuestions >= 5,
      detail: totalQuestions > 0 ? `${totalQuestions} 题` : '待采样',
    },
    {
      label: '薄弱点',
      ready: weakCount > 0,
      detail: weakCount > 0 ? `${weakCount} 个` : '待识别',
    },
    {
      label: '掌握情况',
      ready: masteryCount > 0,
      detail: masteryCount > 0 ? `${masteryCount} 项` : '待生成',
    },
    {
      label: '复习节奏',
      ready: reviewTotal > 0 || (snapshot?.review?.dueCount ?? 0) > 0,
      detail: reviewTotal > 0 ? `${reviewTotal} 次` : '待建立',
    },
  ];
}

function getFocusTopic(snapshot: WorkshopSnapshot | null) {
  const weakPoint = snapshot?.profile?.weakPoints?.[0];
  if (weakPoint) return weakPoint;
  const masteryEntries = Object.entries(snapshot?.profile?.masteryByKnowledge ?? {}).sort(
    ([, a], [, b]) => a - b,
  );
  return masteryEntries[0]?.[0] ?? '综合摸底';
}

function getPreferenceLines(snapshot: WorkshopSnapshot | null, accuracy: number) {
  const weakCount = snapshot?.profile?.weakPoints?.length ?? 0;
  const dueCount = snapshot?.review?.dueCount ?? 0;
  const memoryCount = snapshot?.memoryProgress?.topicCount ?? 0;

  return [
    {
      label: weakCount > 0 ? '先补薄弱点' : '先做入门练习',
      detail:
        weakCount > 0 ? `当前优先处理 ${weakCount} 个不熟悉的知识点` : '完成几道题后系统会更了解你',
    },
    {
      label: accuracy >= 75 ? '挑战进阶题' : '步骤拆解优先',
      detail: accuracy >= 75 ? '正确率稳定，可以加一点难度' : '先把解题步骤拆细，降低跳步',
    },
    {
      label: dueCount > 0 ? '复习窗口优先' : memoryCount > 0 ? '记忆卡片巩固' : '短练习建立节奏',
      detail:
        dueCount > 0
          ? `${dueCount} 道内容需要及时回看`
          : memoryCount > 0
            ? `${memoryCount} 个主题可用于间隔复习`
            : '每次 10-15 分钟更容易坚持',
    },
  ];
}

function buildWeakTopics(snapshot: WorkshopSnapshot | null) {
  const mastery = snapshot?.profile?.masteryByKnowledge ?? {};
  const weak = snapshot?.profile?.weakPoints ?? [];
  const fallback = Object.entries(mastery)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([name]) => name);
  const names = weak.length > 0 ? weak : fallback;

  return names.slice(0, 4).map((name) => ({
    name,
    mastery: clampPercent(mastery[name]),
    frequency:
      snapshot?.profile?.errorPatterns?.find((pattern) => pattern.knowledgePoint === name)
        ?.frequency ?? 0,
  }));
}

export default function MobileLearningProfilePage() {
  const [snapshot, setSnapshot] = useState<WorkshopSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/sky/workshop', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok || !data?.success) throw new Error(data?.error ?? '学习情况加载失败');
        if (cancelled) return;
        setSnapshot({
          generatedAt: data.generatedAt ?? Date.now(),
          review: data.review ?? null,
          learningStats: data.learningStats ?? null,
          memoryProgress: data.memoryProgress ?? null,
          profile: data.profile ?? null,
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '学习情况加载失败');
          setSnapshot(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = snapshot?.profile;
  const stats = snapshot?.learningStats;
  const mastery = getMastery(profile, stats);
  const accuracy = getAccuracy(profile, stats);
  const signals = useMemo(() => buildSignals(snapshot), [snapshot]);
  const readyCount = signals.filter((signal) => signal.ready).length;
  const completion = Math.round((readyCount / signals.length) * 100);
  const focusTopic = getFocusTopic(snapshot);
  const weakTopics = buildWeakTopics(snapshot);
  const preferences = getPreferenceLines(snapshot, accuracy);
  const dueCount = snapshot?.review?.dueCount ?? 0;

  return (
    <MobileSkyShell fullBleed>
      <div className="space-y-3 px-4 pb-24">
        <section
          aria-label="学习情况总览"
          className="relative overflow-hidden rounded-[22px] border border-sky-100 bg-[#f8fbff] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.86)]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(224,247,255,0.92),rgba(248,251,255,0.72)_48%,rgba(241,245,255,0.92)_100%)]" />
          <div className="absolute -right-16 -top-16 size-44 rounded-full bg-cyan-200/32 blur-3xl" />
          <div className="absolute -bottom-20 left-8 size-44 rounded-full bg-indigo-200/28 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-extrabold text-cyan-700">
                  <Brain className="size-3" />
                  学习情况分析
                </span>
                <h1 className="mt-3 text-[25px] font-extrabold leading-tight text-slate-950">
                  学习情况
                </h1>
                <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-5 text-slate-600">
                  {error
                    ? error
                    : loading
                      ? '正在同步你的题目、复习和掌握情况。'
                      : `当前建议先处理「${focusTopic}」，让练习更贴近你的薄弱点。`}
                </p>
              </div>
              <div className="grid size-[78px] shrink-0 place-items-center rounded-[24px] border border-slate-200 bg-white/88 shadow-[0_12px_24px_rgba(15,23,42,0.09),inset_0_1px_0_rgba(255,255,255,0.92)]">
                <div className="text-center">
                  <div className="text-[22px] font-black leading-none text-slate-950">
                    {mastery}%
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-slate-500">掌握情况</div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <HeroMetric icon={Gauge} label="正确率" value={`${accuracy}%`} />
              <HeroMetric
                icon={Clock3}
                label="今日学习"
                value={`${stats?.todayStudyMinutes ?? 0}m`}
              />
              <HeroMetric icon={Flame} label="连续学习" value={`${stats?.streakDays ?? 0}天`} />
            </div>
          </div>
        </section>

        <section
          aria-label="学习情况完整度"
          className="rounded-[20px] border border-slate-200 bg-white/88 p-3.5 shadow-[0_14px_32px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.86)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[15px] font-extrabold text-slate-950">
              <Sparkles className="size-4 text-cyan-600" />
              学习情况完整度
            </div>
            <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[12px] font-black text-cyan-700">
              {completion}%
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {signals.map((signal) => (
              <SignalTile key={signal.label} signal={signal} />
            ))}
          </div>
        </section>

        <section
          aria-label="薄弱点"
          className="rounded-[20px] border border-slate-200 bg-white/88 p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.07)]"
        >
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[15px] font-extrabold text-slate-950">
              <Target className="size-4 text-amber-600" />
              薄弱点
            </div>
            <Link
              href="/m/sky/learning/graph"
              className="inline-flex h-7 items-center gap-1 rounded-full bg-slate-100 px-2 text-[12px] font-bold text-slate-600"
            >
              知识地图
              <ArrowRight className="size-3" />
            </Link>
          </div>
          {weakTopics.length > 0 ? (
            <div className="space-y-2">
              {weakTopics.map((topic) => (
                <WeakTopicRow key={topic.name} topic={topic} />
              ))}
            </div>
          ) : (
            <EmptyHint text="完成一次拍照搜题或课堂测验后，这里会显示最需要补的知识点。" />
          )}
        </section>

        <section
          aria-label="学习偏好"
          className="rounded-[20px] border border-slate-200 bg-white/88 p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.07)]"
        >
          <div className="mb-2.5 flex items-center gap-2 text-[15px] font-extrabold text-slate-950">
            <TrendingUp className="size-4 text-emerald-600" />
            学习偏好
          </div>
          <div className="space-y-2">
            {preferences.map((item) => (
              <div
                key={item.label}
                className="rounded-[15px] border border-slate-200 bg-[#f8fbff] px-3 py-2"
              >
                <div className="text-[13px] font-extrabold text-slate-950">{item.label}</div>
                <div className="mt-0.5 text-[12px] font-medium leading-4 text-slate-500">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-label="下一步行动"
          className="rounded-[20px] border border-slate-200 bg-white/88 p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.86)]"
        >
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[15px] font-extrabold text-slate-950">
              <BookOpenCheck className="size-4 text-cyan-600" />
              下一步行动
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-bold text-slate-500">
              按学习情况排序
            </span>
          </div>

          <div className="space-y-2">
            <ActionRow
              href={dueCount > 0 ? '/m/sky/learning/review/plan' : '/m/sky/cloud-mind/solve'}
              icon={dueCount > 0 ? BookOpenCheck : Sparkles}
              title={dueCount > 0 ? '处理到期复习' : '补充练习记录'}
              desc={dueCount > 0 ? `${dueCount} 道内容需要及时回看` : '做几道题，让系统更了解你'}
              badge={dueCount > 0 ? `${dueCount} 道` : '优先'}
              tone="primary"
            />
            <ActionRow
              href={`/m/sky/cloud-mind/quiz?topic=${encodeURIComponent(focusTopic)}`}
              icon={Target}
              title="生成个性练习"
              desc={`围绕「${focusTopic}」做一组短练习`}
              badge="练习"
            />
          </div>
        </section>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}

function HeroMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="min-h-[78px] rounded-[17px] border border-slate-200 bg-white/82 px-2 py-2.5 text-center shadow-[0_8px_18px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.9)]">
      <Icon className="mx-auto size-4 text-cyan-600" />
      <div className="mt-1.5 truncate text-[14px] font-black text-slate-950">{value}</div>
      <div className="mt-0.5 truncate text-[12px] font-bold text-slate-500">{label}</div>
    </div>
  );
}

function SignalTile({ signal }: { signal: CompletionSignal }) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-[#f8fbff] px-2.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-extrabold text-slate-950">{signal.label}</span>
        <CheckCircle2
          className={cn('size-3.5 shrink-0', signal.ready ? 'text-emerald-600' : 'text-slate-400')}
        />
      </div>
      <div className="mt-1 truncate text-[12px] font-semibold text-slate-500">{signal.detail}</div>
    </div>
  );
}

function WeakTopicRow({ topic }: { topic: { name: string; mastery: number; frequency: number } }) {
  const width = Math.max(8, topic.mastery);
  return (
    <Link
      href={`/m/sky/cloud-mind/quiz?topic=${encodeURIComponent(topic.name)}`}
      className="block rounded-[15px] border border-slate-200 bg-[#f8fbff] px-3 py-2 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-extrabold text-slate-950">{topic.name}</div>
          <div className="mt-0.5 text-[12px] font-medium text-slate-500">
            {topic.frequency > 0 ? `${topic.frequency} 次错误模式` : '建议做一组巩固题'}
          </div>
        </div>
        <span className="shrink-0 text-[13px] font-black tabular-nums text-amber-700">
          {topic.mastery}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${width}%` }} />
      </div>
    </Link>
  );
}

function ActionRow({
  href,
  icon: Icon,
  title,
  desc,
  badge,
  tone = 'default',
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  badge: string;
  tone?: 'default' | 'primary';
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-[62px] items-center gap-3 rounded-[16px] border px-3 py-2.5 active:scale-[0.99]',
        tone === 'primary'
          ? 'border-cyan-200 bg-cyan-50 shadow-[0_12px_28px_rgba(8,145,178,0.10)]'
          : 'border-slate-200 bg-[#f8fbff]',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-[14px] ring-1',
          tone === 'primary'
            ? 'bg-cyan-600 text-white ring-cyan-200'
            : 'bg-cyan-50 text-cyan-700 ring-cyan-200',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-extrabold text-slate-950">{title}</span>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-black',
              tone === 'primary' ? 'bg-white text-cyan-700' : 'bg-slate-100 text-slate-500',
            )}
          >
            {badge}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] font-semibold text-slate-500">
          {desc}
        </span>
      </span>
      <ArrowRight className="size-3.5 shrink-0 text-slate-400" />
    </Link>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="rounded-[15px] border border-dashed border-slate-300 bg-[#f8fbff] px-3 py-3 text-[12px] font-medium leading-5 text-slate-500">
      {text}
    </div>
  );
}
