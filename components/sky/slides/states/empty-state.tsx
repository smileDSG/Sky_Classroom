'use client';

import Link from 'next/link';
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
  Route,
} from 'lucide-react';
import { CelestialCanvas } from '../design-system/celestial-canvas';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { buildSlidesAdaptivePolicyFromContext } from '@/lib/slides/personalization';

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
  const targetWeakPoint = personalizationContext?.weakPoints.find(
    (item) =>
      recommendedTopic && normalizeTopic(item.knowledgePoint) === normalizeTopic(recommendedTopic),
  );

  return (
    <div className="slides-empty-state relative flex h-full flex-col items-center overflow-y-auto py-8">
      {/* Starfield background */}
      <div className="slides-empty-atmosphere">
        <CelestialCanvas starCount={100} parallax nebula grid horizonGlow />
      </div>

      {/* Horizon light band */}
      <div
        className="slides-empty-horizon pointer-events-none absolute bottom-0 left-0 right-0 h-[35%] animate-horizon-glow"
        style={{
          background: 'linear-gradient(to top, rgba(255, 140, 105, 0.06), transparent)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="slides-empty-content relative z-10 flex w-full max-w-3xl flex-col items-center gap-6 px-6"
      >
        <div className="slides-empty-hero">
          <div className="slides-empty-icon flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-starlight)]/5 text-[var(--celestial-starlight)]">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="slides-empty-title text-center">
            <h2 className="text-lg font-extrabold tracking-tight text-[var(--celestial-starlight)]">
              AI 智能课件生成
            </h2>
            <p className="mt-1.5 text-sm text-[var(--celestial-starlight)]/50">
              输入主题，AI 将自动规划大纲、设计排版并生成精美课件
            </p>
          </div>
        </div>

        {/* Learner-profile strategy */}
        {adaptivePolicy ? (
          <section className="slides-adaptive-brief w-full overflow-hidden rounded-2xl border border-[var(--celestial-dawn)]/25 bg-[linear-gradient(135deg,rgba(255,140,105,0.12),rgba(83,124,255,0.08))] shadow-[0_20px_65px_rgba(0,0,0,0.24)] backdrop-blur-md">
            <div className="slides-adaptive-brief-header flex flex-wrap items-start justify-between gap-3 border-b border-[var(--celestial-starlight)]/10 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--celestial-dawn)]/25 bg-[var(--celestial-dawn)]/10 text-[var(--celestial-dawn)]">
                  <Brain className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--celestial-starlight)]">
                      按你的情况制作课件
                    </h3>
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                      已根据你的情况安排
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--celestial-starlight)]/55">
                    不只是预填主题：系统会参考你的学习情况，调整内容深度、结构、节奏、页数和练习比例。
                  </p>
                </div>
              </div>
              <Link
                href="/sky/learning/path"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--celestial-starlight)]/10 bg-black/10 px-3 py-2 text-xs font-semibold text-[var(--celestial-starlight)]/65 transition-colors hover:border-[var(--celestial-dawn)]/25 hover:text-[var(--celestial-starlight)]"
              >
                <Route className="h-3.5 w-3.5" /> 查看学习路线
              </Link>
            </div>

            <div className="px-5 py-4">
              <div className="slides-adaptive-summary rounded-xl border border-[var(--celestial-starlight)]/10 bg-black/10 p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--celestial-dawn)]">
                  <Target className="h-3.5 w-3.5" /> 学习判断
                </div>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="slides-adaptive-summary-title text-lg font-extrabold text-[var(--celestial-starlight)]">
                      {recommendedTopic ?? (topic || '等待学习主题')}
                    </div>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--celestial-starlight)]/55">
                      {adaptivePolicy.summary}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--celestial-dawn)]/20 bg-[var(--celestial-dawn)]/8 px-3 py-1 text-xs font-semibold text-[var(--celestial-dawn)]">
                    {ACTION_LABELS[adaptivePolicy.action]}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
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
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="slides-adaptive-metric rounded-xl border border-[var(--celestial-starlight)]/10 bg-black/10 p-3"
                    >
                      <div className="slides-adaptive-metric-label flex items-center gap-1.5 text-[10px] text-[var(--celestial-starlight)]/40">
                        <Icon className="h-3.5 w-3.5 text-[var(--celestial-dawn)]/80" />
                        {item.label}
                      </div>
                      <div className="slides-adaptive-metric-value mt-1.5 text-xs font-bold text-[var(--celestial-starlight)]">
                        {item.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--celestial-starlight)]/40">
                    课件会这样变化
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {adaptivePolicy.contentPlan.map((step, index) => (
                      <div
                        key={step}
                        className="slides-adaptive-step flex items-start gap-2 rounded-lg border border-[var(--celestial-starlight)]/8 bg-black/10 px-3 py-2 text-[11px] leading-4 text-[var(--celestial-starlight)]/65"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--celestial-dawn)]/12 text-[10px] font-bold text-[var(--celestial-dawn)]">
                          {index + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--celestial-starlight)]/45 sm:max-w-48 sm:justify-end">
                  {targetWeakPoint && (
                    <span className="rounded-full border border-amber-300/15 bg-amber-300/8 px-2 py-1 text-amber-100/75">
                      当前掌握 {Math.round(targetWeakPoint.mastery)}%
                    </span>
                  )}
                  <span className="rounded-full border border-[var(--celestial-starlight)]/10 bg-black/10 px-2 py-1">
                    约 {adaptivePolicy.durationMinutes} 分钟
                  </span>
                  <span className="rounded-full border border-[var(--celestial-starlight)]/10 bg-black/10 px-2 py-1">
                    {adaptivePolicy.questionCount} 个检查点
                  </span>
                </div>
              </div>

              {hasManualTopicOverride && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-300/15 bg-sky-300/8 px-3 py-2 text-[11px] leading-5 text-sky-100/75">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  你已把主题改为「{topic.trim()}
                  」。系统会保留这个主题，但继续参考你的学习情况调整难度、结构和练习比例。
                </div>
              )}
            </div>
          </section>
        ) : personalizationNotice ? (
          <div className="w-full rounded-xl border border-[var(--celestial-dawn)]/20 bg-[var(--celestial-dawn)]/8 px-4 py-3 text-sm text-[var(--celestial-starlight)]/75">
            {personalizationNotice}
          </div>
        ) : null}

        <div className="slides-generation-form w-full">
          {/* Topic input — focus ring style */}
          <div className="slides-topic-control w-full">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--celestial-starlight)]/40">
              课件主题
            </label>
            <div className="group relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
                placeholder="例如：导数与函数单调性"
                className="slides-topic-input w-full bg-transparent px-1 py-3 text-sm text-[var(--celestial-starlight)] placeholder:text-[var(--celestial-starlight)]/20 focus:outline-none"
              />
              {/* Bottom line */}
              <div className="slides-topic-underline absolute bottom-0 left-0 right-0 h-px bg-[var(--celestial-starlight)]/15 transition-colors duration-300 group-focus-within:bg-[var(--celestial-dawn)]/60" />
              {/* Glow on focus */}
              <div className="slides-topic-glow absolute bottom-0 left-1/2 h-px w-0 -translate-x-1/2 bg-[var(--celestial-dawn)] shadow-[0_0_20px_rgba(255,140,105,0.3)] transition-all duration-500 group-focus-within:w-full" />
              {/* Blinking cursor simulation via placeholder */}
              {!topic && (
                <div className="pointer-events-none absolute bottom-3.5 left-1 h-4 w-px bg-[var(--celestial-dawn)]/60 animate-pulse" />
              )}
            </div>
          </div>

          {/* Difficulty selector — observatory bands */}
          <div className="slides-difficulty-control w-full">
            <label className="mb-3 block text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--celestial-starlight)]/40">
              目标学段（决定语言与知识范围）
            </label>
            <div className="slides-difficulty-options flex items-center justify-center gap-10">
              {DIFFICULTIES.map((d) => {
                const Icon = d.icon;
                const isActive = difficulty === d.value;
                return (
                  <button
                    key={d.value}
                    onClick={() => onDifficultyChange(d.value)}
                    aria-pressed={isActive}
                    className={`slides-difficulty-option group flex flex-col items-center gap-2.5 ${
                      isActive ? 'slides-difficulty-option--active' : ''
                    }`}
                  >
                    {/* Orb dot */}
                    <div className="relative flex h-5 w-5 items-center justify-center">
                      {isActive && (
                        <>
                          <span className="absolute inset-0 rounded-full bg-[var(--celestial-dawn)] animate-ping opacity-40" />
                          <span className="absolute inset-[-4px] rounded-full border border-[var(--celestial-dawn)]/30 animate-[ring-expand_2s_ease-out_infinite]" />
                        </>
                      )}
                      <div
                        className={`relative h-3 w-3 rounded-full transition-all duration-300 ${
                          isActive
                            ? 'bg-[var(--celestial-dawn)] shadow-[0_0_8px_rgba(255,140,105,0.5)]'
                            : 'border border-[var(--celestial-haze)] bg-transparent group-hover:border-[var(--celestial-starlight)]/30'
                        }`}
                      />
                    </div>
                    {/* Label */}
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={`h-3.5 w-3.5 transition-colors duration-300 ${isActive ? 'text-[var(--celestial-dawn)]' : 'text-[var(--celestial-starlight)]/25 group-hover:text-[var(--celestial-starlight)]/50'}`}
                      />
                      <span
                        className={`text-xs font-medium transition-colors duration-300 ${
                          isActive
                            ? 'text-[var(--celestial-starlight)]'
                            : 'text-[var(--celestial-starlight)]/30 group-hover:text-[var(--celestial-starlight)]/60'
                        }`}
                      >
                        {d.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="slides-generate-action">
            {/* Generate button */}
            <motion.button
              onClick={() => onGenerate()}
              disabled={generating || !topic.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="slides-generate-button group relative h-11 w-full overflow-hidden rounded-xl border border-[var(--celestial-starlight)]/20 bg-transparent text-sm font-semibold text-[var(--celestial-starlight)] transition-all duration-300 hover:border-[var(--celestial-starlight)]/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[var(--celestial-starlight)]/20"
            >
              {/* Sweep effect on hover */}
              <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-[var(--celestial-dawn)]/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
                {generating
                  ? '生成引擎启动中...'
                  : adaptivePolicy
                    ? '按你的情况生成课件'
                    : '启动生成引擎'}
                {!generating && <ArrowRight className="h-4 w-4" />}
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
