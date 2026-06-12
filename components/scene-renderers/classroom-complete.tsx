'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { animate, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { FileText, HelpCircle, Gamepad2, Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import type { Scene, SceneType } from '@/lib/types/stage';
import { summarizeScenes } from '@/lib/classroom/complete-summary';
import { readAnswersForSummary } from '@/lib/quiz/persistence';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import type { MistakeRecord, MistakeCause } from '@/lib/mistakes/types';
import { deriveReviewQuizParams } from '@/lib/classroom/review-quiz-params';

const SCENE_TYPE_ICONS: Record<SceneType, typeof FileText> = {
  slide: FileText,
  quiz: HelpCircle,
  interactive: Gamepad2,
  pbl: Puzzle,
};

const TYPE_ORDER: SceneType[] = ['slide', 'quiz', 'interactive', 'pbl'];

const CONFETTI_COLORS = [
  '#4A90D9', // Sky blue
  '#60A5FA', // Light sky blue
  '#3B82F6', // Blue
  '#87CEEB', // Sky
  '#93C5FD', // Light blue
  '#1E40AF', // Dark blue
  '#0EA5E9', // Cyan
];

function inferCauseFromAnalysis(analysis: string | undefined): MistakeCause {
  if (!analysis) return 'concept-unclear';
  const a = analysis.toLowerCase();
  if (/计算|算错|运算|加减|乘除|数值/.test(a)) return 'calculation-error';
  if (/粗心|漏看|笔误|抄写/.test(a)) return 'careless';
  if (/审题|读题|理解题意|条件/.test(a)) return 'misreading';
  if (/方法|思路|技巧|策略/.test(a)) return 'method-wrong';
  if (/格式|步骤|书写/.test(a)) return 'format-error';
  return 'concept-unclear';
}

function encouragementKey(pct: number): 'high' | 'mid' | 'low' {
  if (pct >= 90) return 'high';
  if (pct >= 70) return 'mid';
  return 'low';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  w: number;
  h: number;
  duration: number;
  delay: number;
  round: boolean;
}

function makeConfetti(count: number): Particle[] {
  const arr: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
    const distance = 180 + Math.random() * 280;
    const w = 6 + Math.random() * 6;
    arr.push({
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 50,
      rotate: (Math.random() - 0.5) * 720,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w,
      h: Math.random() > 0.3 ? w * 0.4 : w,
      duration: 1.0 + Math.random() * 0.9,
      delay: Math.random() * 0.12,
      round: Math.random() > 0.72,
    });
  }
  return arr;
}

function Confetti() {
  const prefersReducedMotion = useReducedMotion();
  const particles = useMemo(() => makeConfetti(55), []);
  if (prefersReducedMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.2 }}
          animate={{
            x: p.x,
            y: p.y + 220,
            opacity: 0,
            rotate: p.rotate,
            scale: 1,
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.1, 0.5, 0.4, 1] }}
          style={{
            position: 'absolute',
            width: p.w,
            height: p.h,
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : 2,
          }}
        />
      ))}
    </div>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M10 1 L12 8 L19 10 L12 12 L10 19 L8 12 L1 10 L8 8 Z" fill="currentColor" />
    </svg>
  );
}

function Sparkles() {
  const prefersReducedMotion = useReducedMotion();
  const sparkles = useMemo(
    () => [
      { x: -95, y: -40, size: 14, delay: 0.8, repeatDelay: 0.8 },
      { x: 95, y: -20, size: 18, delay: 1.1, repeatDelay: 1.0 },
      { x: -78, y: 55, size: 11, delay: 1.35, repeatDelay: 1.2 },
      { x: 82, y: 62, size: 15, delay: 1.55, repeatDelay: 0.9 },
      { x: 0, y: -88, size: 10, delay: 1.75, repeatDelay: 1.1 },
    ],
    [],
  );
  if (prefersReducedMotion) return null;

  return (
    <>
      {sparkles.map((s, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute text-amber-300 dark:text-amber-200"
          style={{
            width: s.size,
            height: s.size,
            left: `calc(50% + ${s.x}px - ${s.size / 2}px)`,
            top: `calc(50% + ${s.y}px - ${s.size / 2}px)`,
          }}
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1, 0.7, 1, 0], opacity: [0, 1, 0.7, 1, 0], rotate: 180 }}
          transition={{
            duration: 2.2,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: s.repeatDelay,
            ease: 'easeInOut',
          }}
        >
          <Sparkle className="w-full h-full" />
        </motion.div>
      ))}
    </>
  );
}

function TrophySvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 150" className={className} aria-hidden>
      <defs>
        <linearGradient id="tc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="35%" stopColor="#60A5FA" />
          <stop offset="75%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
        <linearGradient id="tc-sky-light" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="50%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="tc-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Handles */}
      <path
        d="M 28 32 Q 6 32 8 60 Q 10 82 32 86"
        fill="none"
        stroke="url(#tc-sky)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M 92 32 Q 114 32 112 60 Q 110 82 88 86"
        fill="none"
        stroke="url(#tc-sky)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Cup */}
      <path d="M 25 18 L 95 18 L 95 50 Q 95 90 60 100 Q 25 90 25 50 Z" fill="url(#tc-sky)" />
      {/* Shine */}
      <path d="M 33 22 Q 32 60 42 88 L 38 88 Q 30 60 31 22 Z" fill="url(#tc-shine)" />
      {/* Rim */}
      <ellipse cx="60" cy="19" rx="36" ry="4.5" fill="#BFDBFE" />
      <ellipse
        cx="60"
        cy="19"
        rx="36"
        ry="4.5"
        fill="none"
        stroke="#1E40AF"
        strokeWidth="0.6"
        opacity="0.35"
      />
      {/* Star */}
      <path
        d="M 60 42 L 63.6 52.3 L 74.5 52.3 L 65.7 58.7 L 69 69 L 60 62.7 L 51 69 L 54.3 58.7 L 45.5 52.3 L 56.4 52.3 Z"
        fill="#ffffff"
        opacity="0.92"
      />
      {/* Stem */}
      <path d="M 52 100 L 68 100 L 66 116 L 54 116 Z" fill="url(#tc-sky)" />
      {/* Base tiers */}
      <rect x="40" y="116" width="40" height="7" rx="2" fill="url(#tc-sky-light)" />
      <rect x="32" y="123" width="56" height="9" rx="2" fill="url(#tc-sky)" />
      <rect x="28" y="132" width="64" height="6" rx="3" fill="url(#tc-sky-light)" />
    </svg>
  );
}

function AnimatedCounter({
  value,
  delay = 0,
  duration = 0.9,
}: {
  value: number;
  delay?: number;
  duration?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const controls = animate(0, value, {
      delay,
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, delay, duration, prefersReducedMotion]);

  return <>{prefersReducedMotion ? value : display}</>;
}

function QuizRing({ pct, delay = 0 }: { pct: number; delay?: number }) {
  const prefersReducedMotion = useReducedMotion();
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
      <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="tc-ring-sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-sky-200/70 dark:text-sky-900/40"
        />
        <motion.circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="url(#tc-ring-sky)"
          strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{
            duration: prefersReducedMotion ? 0 : 1.1,
            delay,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-black text-sky-700 dark:text-sky-300">
          <AnimatedCounter value={pct} delay={delay} duration={1.0} />
          <span className="text-sm font-bold">%</span>
        </span>
      </div>
    </div>
  );
}

interface ClassroomCompletePageProps {
  readonly scenes: Scene[];
  readonly title: string;
}
export function ClassroomCompletePage({
  scenes, title }: ClassroomCompletePageProps) {
  const locale = 'zh-CN';
  const t = (key: string) => key;
  const prefersReducedMotion = useReducedMotion();

  // Computed once on mount: re-grading on every render would be wasteful and
  // the underlying localStorage values only change when the user revisits a
  // quiz scene (which unmounts this page).
  const summary = useMemo(() => summarizeScenes(scenes, readAnswersForSummary), [scenes]);

  const handleStartReviewQuiz = useCallback(() => {
    if (!summary.quiz || summary.quizDetails.length === 0) return;
    const params = deriveReviewQuizParams(summary.quizDetails, summary.quiz.pct);
    const qs = new URLSearchParams();
    qs.set('subject', params.subject);
    qs.set('difficulty', params.difficulty);
    qs.set('topic', params.topic);
    qs.set('count', String(params.count));
    qs.set('mode', 'review');
    window.location.href = `/sky/cloud-mind/quiz?${qs.toString()}`;
  }, [summary]);

  // Sync classroom quiz mistakes to the mistake book on mount
  useEffect(() => {
    if (!stage?.id || summary.quizDetails.length === 0) return;
    const syncKey = `classroom-mistakes-synced:${stage.id}`;
    if (localStorage.getItem(syncKey)) return;

    const { addMistake } = useSkyClassroomStore.getState();
    for (const detail of summary.quizDetails) {
      const cause: MistakeCause = inferCauseFromAnalysis(detail.analysis);
      const mistake: MistakeRecord = {
        id: `classroom-${stage.id}-${detail.questionId}`,
        problem: detail.question,
        userAnswer: detail.userAnswer.join(', '),
        correctAnswer: detail.correctAnswer.join(', '),
        cause,
        solvedAt: new Date(),
        reviewed: false,
        reviewCount: 0,
        knowledgePoints: detail.knowledgePoints ?? [],
        source: 'classroom-quiz',
        sourceSessionId: stage.id,
      };
      addMistake(mistake);
    }
    localStorage.setItem(syncKey, 'true');
  }, [stage?.id, summary.quizDetails]);

  const dateLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale).format(new Date());
    } catch {
      return new Date().toLocaleDateString();
    }
  }, [locale]);

  const trailItems = TYPE_ORDER.filter((type) => (summary.countsByType[type] ?? 0) > 0).map(
    (type) => ({
      type,
      count: summary.countsByType[type] ?? 0,
      Icon: SCENE_TYPE_ICONS[type],
      label: t(`classroomComplete.trailLabels.${type}`),
    }),
  );

  return (
    <MotionConfig reducedMotion={prefersReducedMotion ? 'always' : 'user'}>
      <section
        className="absolute inset-0 z-[105] flex items-center justify-center overflow-auto"
        aria-label={'课程完成'}
      >
        {/* Single-shot announcement for screen readers — replaces the noisy
            outer aria-live region that used to wrap the live-updating counters. */}
        <span className="sr-only" role="status">
          {'课程完成'}
        </span>
        {/* Base background - Sky Theme */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30" />
        {/* Radial glow */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, rgba(74, 144, 217, 0.32), rgba(59, 130, 246, 0.12) 38%, transparent 68%)',
          }}
        />
        {/* Confetti */}
        <Confetti />

        {/* Content */}
        <div className="relative flex flex-col items-center gap-6 max-w-2xl w-full px-8 py-10">
          {/* Trophy + halo + sparkles */}
          <div className="relative" style={{ width: 200, height: 200 }}>
            <motion.div
              aria-hidden
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.9, 1.15, 0.95, 1.1], opacity: [0, 0.55, 0.4, 0.5] }}
              transition={{
                delay: 0.15,
                duration: 2.6,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(74, 144, 217, 0.5), rgba(59, 130, 246, 0.12) 55%, transparent 72%)',
                filter: 'blur(14px)',
              }}
            />
            <motion.div
              aria-hidden
              initial={{ y: 44, scale: 0.4, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.2 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 148, height: 185 }}
              >
                <TrophySvg className="w-full h-full drop-shadow-[0_10px_18px_rgba(180,83,9,0.35)]" />
              </motion.div>
            </motion.div>
            <Sparkles />
          </div>

          {/* Ribbon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.65, type: 'spring', stiffness: 280, damping: 18 }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-400 via-blue-400 to-sky-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-sky-500/30"
          >
            <Sparkle className="w-3 h-3" />
            {'课程完成'}
            <Sparkle className="w-3 h-3" />
          </motion.div>

          {/* Title + date */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.78, duration: 0.4, ease: 'easeOut' }}
            className="text-center space-y-1.5"
          >
            <h2 className="text-3xl md:text-4xl font-black leading-tight bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 dark:from-sky-300 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent">
              {title || '课程完成'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{dateLabel}</p>
          </motion.div>

          {/* Stats cards */}
          {trailItems.length > 0 && (
            <div
              className={cn(
                'grid gap-3 w-full',
                trailItems.length === 1 && 'grid-cols-1 max-w-[180px]',
                trailItems.length === 2 && 'grid-cols-2 max-w-md',
                trailItems.length === 3 && 'grid-cols-3',
                trailItems.length === 4 && 'grid-cols-2 sm:grid-cols-4',
              )}
            >
              {trailItems.map(({ type, count, Icon, label }, idx) => {
                const cardDelay = 0.96 + idx * 0.08;
                return (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, y: 14, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: cardDelay,
                      type: 'spring',
                      stiffness: 260,
                      damping: 20,
                    }}
                    className="rounded-2xl bg-white/90 dark:bg-slate-900/70 border border-sky-100 dark:border-sky-900/40 shadow-sm px-4 py-4 flex flex-col items-center gap-1.5 backdrop-blur-sm"
                  >
                    <Icon
                      className="w-6 h-6 text-sky-500 dark:text-sky-400"
                      strokeWidth={1.8}
                    />
                    <div className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-none">
                      <AnimatedCounter value={count} delay={cardDelay + 0.15} />
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {label}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Quiz card */}
          {summary.quiz && (
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.2, type: 'spring', stiffness: 220, damping: 20 }}
              className="w-full rounded-2xl bg-gradient-to-br from-sky-100 via-blue-50 to-sky-100 dark:from-sky-950/50 dark:via-blue-950/30 dark:to-sky-950/50 border border-sky-200 dark:border-sky-900/50 px-6 py-5 shadow-md shadow-sky-200/30 dark:shadow-sky-950/20"
            >
              <div className="flex items-center gap-5">
                <QuizRing pct={summary.quiz.pct} delay={1.3} />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-sky-700 dark:text-sky-300">
                    {`答对 ${summary.quiz.correct} / ${summary.quiz.total}`}
                  </div>
                  <div className="mt-1 text-sm text-sky-700/80 dark:text-sky-300/80">
                    {t(`classroomComplete.encouragement.${encouragementKey(summary.quiz.pct)}`)}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Review quiz button */}
          {summary.quizDetails.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.35, type: 'spring', stiffness: 220, damping: 20 }}
              className="w-full"
            >
              <button
                onClick={handleStartReviewQuiz}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 text-white font-bold px-6 py-4 shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                针对薄弱点巩固练习 →
              </button>
            </motion.div>
          )}
        </div>
      </section>
    </MotionConfig>
  );
}

export function ClassroomCompletePageConnected() {
  const stage = useStageStore((s) => s.stage);
  const scenes = useStageStore((s) => s.scenes);
  return <ClassroomCompletePage scenes={scenes} title={stage?.name ?? ''} />;
}
