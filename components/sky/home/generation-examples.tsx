'use client';

import { motion } from 'motion/react';

type GenerationExample = {
  id: string;
  label: string;
  prompt: string;
  demo: string;
};

const EXAMPLES: GenerationExample[] = [
  {
    id: 'slides',
    label: '幻灯讲解',
    prompt: '用幻灯片讲透光合作用',
    demo: '/sky/generation-demos/slides.webp',
  },
  {
    id: 'quiz',
    label: '随堂测验',
    prompt: '出一套牛顿三大定律测验',
    demo: '/sky/generation-demos/quiz.webp',
  },
  {
    id: 'interactive',
    label: '模拟实验',
    prompt: '可调电压电阻的电路模拟',
    demo: '/sky/generation-demos/interactive.webp',
  },
  {
    id: 'pbl',
    label: '项目实战',
    prompt: '手把手做我的第一个网页',
    demo: '/sky/generation-demos/pbl.webp',
  },
  {
    id: 'discussion',
    label: '互动讨论',
    prompt: '辩论 AI 会不会取代老师',
    demo: '/sky/generation-demos/discussion.webp',
  },
];

export function GenerationExamples({ onFill }: { onFill: (prompt: string) => void }) {
  return (
    <section aria-labelledby="generation-examples-title">
      <h2
        id="generation-examples-title"
        className="text-sm font-semibold text-slate-800 dark:text-slate-200"
      >
        点一张卡片，看看都能生成什么
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {EXAMPLES.map((example) => (
          <motion.button
            key={example.id}
            type="button"
            whileTap={{ scale: 0.99 }}
            onClick={() => onFill(example.prompt)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-colors hover:border-slate-300 dark:border-slate-700/70 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              <img
                src={example.demo}
                alt={`${example.label}效果图`}
                width={560}
                height={315}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <div className="px-3 pb-2.5 pt-2">
              <p className="line-clamp-2 text-[13px] font-medium leading-[18px] text-slate-800 dark:text-slate-200">
                {example.prompt}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                {example.label}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}