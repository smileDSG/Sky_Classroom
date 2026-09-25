'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  BookOpen,
  GraduationCap,
  School,
  Brain,
  Target,
  Gauge,
  Clock3,
  Layers3,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Route,
  Presentation,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { buildSlidesAdaptivePolicyFromContext } from '@/lib/slides/personalization';
import { FeatureWorkspace } from '@/components/sky/layout/feature-page-chrome';

interface EmptyStateProps {
  topic: string;
  difficulty: 'junior' | 'senior' | 'college';
  generating: boolean;
  personalizationNotice?: string | null;
  personalizationContext?: PersonalizationContext | null;
  onTopicChange: (t: string) => void;
  onDifficultyChange: (d: 'junior' | 'senior' | 'college') => void;
  onGenerate: () => void;
}

const DIFFICULTIES = [
  { value: 'senior' as const, label: '高中', icon: GraduationCap },
  { value: 'college' as const, label: '大学', icon: School },
];

const ACTION_LABELS = {
  diagnostic: '诊断型课件',
  teach: '补弱型课件',
  review: '复习型课件',
  quiz: '进阶验证课件',
} as const;

const CONTENT_DIFFICULTY_LABELS = {
  easy: '基础拆解',
  medium: '标准进阶',
  hard: '挑战迁移',
} as const;

const FORMAT_LABELS = {
  'worked-example': '例题逐步拆解',
  diagram: '图示关系讲解',
  interactive: '互动问题驱动',
} as const;

const PACING_LABELS = {
  remedial: '小步补基础',
  steady: '讲练均衡',
  sprint: '高密度冲刺',
} as const;

function normalizeTopic(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function EmptyState({
  topic,
  difficulty,
  generating,
  personalizationNotice,
  personalizationContext,
  onTopicChange,
  onDifficultyChange,
  onGenerate,
}: EmptyStateProps) {
  const adaptivePolicy = buildSlidesAdaptivePolicyFromContext(personalizationContext);
  const recommendedTopic = adaptivePolicy?.targetTopic;
  const hasManualTopicOverride = Boolean(
    topic.trim() && recommendedTopic && normalizeTopic(topic) !== normalizeTopic(recommendedTopic),
  );

  const [detailsOpen, setDetailsOpen] = useState(false);

  const metrics = adaptivePolicy
    ? [
        {
          icon: Gauge,
          label: '内容难度',
          value: CONTENT_DIFFICULTY_LABELS[adaptivePolicy.difficulty],
        },
        {
          icon: Layers3,
          label: '讲解结构',
          value: FORMAT_LABELS[adaptivePolicy.format],
        },
        {
          icon: Clock3,
          label: '推进节奏',
          value: PACING_LABELS[adaptivePolicy.pacing],
        },
        {
          icon: BookOpen,
          label: '课件规模',
          value: `${adaptivePolicy.minPages}-${adaptivePolicy.maxPages} 页`,
        },
      ]
    : [];

  const adaptiveCard = adaptivePolicy ? (
    <Card className="overflow-hidden border-sky-200/50 shadow-md shadow-sky-100/50 dark:border-sky-800/40 dark:shadow-sky-900/20">
      <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-transparent dark:from-sky-950/30 dark:to-transparent">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="w-full text-left"
        >
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base text-sky-700 dark:text-sky-300">
            <span className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-sky-500" />
              按你的情况制作课件
            </span>
            <span className="flex items-center gap-2">
              <Badge className="bg-sky-500 text-white dark:bg-sky-500 dark:text-slate-950">
                {ACTION_LABELS[adaptivePolicy.action]}
              </Badge>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${detailsOpen ? 'rotate-180' : ''}`}
              />
            </span>
          </CardTitle>
          <CardDescription>{adaptivePolicy.summary}</CardDescription>
        </button>
      </CardHeader>

      {detailsOpen && (
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Icon className="h-4 w-4 text-sky-500" />
                    {item.label}
                  </div>
                  <div className="mt-1.5 text-base font-bold text-slate-900 dark:text-slate-100">
                    {item.value}
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              课件会这样变化
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {adaptivePolicy.contentPlan.map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white dark:text-slate-950">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>

          {hasManualTopicOverride && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm leading-6 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              你已把主题改为「{topic.trim()}
              」。系统会保留这个主题，但继续参考你的学习情况调整难度、结构和练习比例。
            </div>
          )}

          <Link
            href="/sky/learning/path"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
          >
            <Route className="h-4 w-4" /> 查看我的学习路线与薄弱点
          </Link>
        </CardContent>
      )}
    </Card>
  ) : personalizationNotice ? (
    <Card className="border-sky-200/40 dark:border-sky-800/30">
      <CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">
        {personalizationNotice}
      </CardContent>
    </Card>
  ) : null;

  const formCard = (
    <Card className="overflow-hidden border-violet-200/70 shadow-sm dark:border-violet-300/20">
      <CardHeader className="border-b bg-violet-50/70 dark:bg-violet-300/[0.07]">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-slate-100">
          <Presentation className="h-4 w-4 text-violet-600 dark:text-violet-300" />
          课件主题
        </CardTitle>
        <CardDescription>输入主题，AI 会规划大纲与内容</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-4">
        <div className="w-full">
          <label
            htmlFor="slides-topic"
            className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            课件主题
          </label>
          <input
            id="slides-topic"
            type="text"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="例如：导数与函数单调性"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-lg text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="w-full">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            目标学段（决定语言与知识范围）
          </label>
          <div className="grid w-full max-w-md grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/60">
            {DIFFICULTIES.map((d) => {
              const Icon = d.icon;
              const isActive = difficulty === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => onDifficultyChange(d.value)}
                  aria-pressed={isActive}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${isActive ? 'text-violet-600 dark:text-violet-300' : 'text-slate-400 dark:text-slate-500'}`}
                  />
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Button
            onClick={() => onGenerate()}
            disabled={generating || !topic.trim()}
            className="h-12 flex-1 gap-2 bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? '正在生成…' : '生成课件'}
            {!generating && <ArrowRight className="h-4 w-4" />}
          </Button>
          <Button asChild variant="outline" className="h-12 gap-2">
            <Link href="/sky/learning/path">
              <Target className="h-4 w-4" /> 我的薄弱点
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="slides-empty-state relative min-h-0 w-full flex-1 flex-col overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6"
      >
        <FeatureWorkspace
          primaryTourStep={false}
          preview={
            <SlidesSetupPreview
              topic={topic}
              difficulty={difficulty}
              adaptivePolicy={adaptivePolicy}
              adaptiveCard={adaptiveCard}
            />
          }
        >
          {formCard}
        </FeatureWorkspace>
      </motion.div>
    </div>
  );
}

function SlidesSetupPreview({
  topic,
  difficulty,
  adaptivePolicy,
  adaptiveCard,
}: {
  topic: string;
  difficulty: 'junior' | 'senior' | 'college';
  adaptivePolicy: ReturnType<typeof buildSlidesAdaptivePolicyFromContext>;
  adaptiveCard: ReactNode;
}) {
  const difficultyLabel = DIFFICULTIES.find((item) => item.value === difficulty)?.label ?? '高中';

  return (
    <div className="sticky top-4 space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/85 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Presentation className="h-4 w-4 text-violet-600 dark:text-violet-300" />
            课件大纲预览
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            AI 会根据主题先规划结构，再完成页面设计与质量检查。
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-400/20 dark:bg-violet-400/[0.07]">
            <div className="text-xs font-medium text-violet-700 dark:text-violet-300">课件主题</div>
            <div className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {topic.trim() || '等待填写课件主题'}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs text-violet-700 dark:border-violet-400/20 dark:bg-white/[0.04] dark:text-violet-300">
                {difficultyLabel}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-white/[0.04] dark:text-slate-300">
                {adaptivePolicy
                  ? `${adaptivePolicy.minPages}-${adaptivePolicy.maxPages} 页`
                  : '自动规划页数'}
              </span>
            </div>
          </div>
          <ol className="space-y-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {(
              adaptivePolicy?.contentPlan ?? [
                '建立主题与学习目标',
                '讲解核心概念与示例',
                '加入练习、总结与复习提示',
              ]
            ).map((item, index) => (
              <li key={item} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {adaptiveCard}
    </div>
  );
}
