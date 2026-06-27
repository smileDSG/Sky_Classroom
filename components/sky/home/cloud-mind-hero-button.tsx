'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Brain, Presentation, Search, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';

const tools = [
  {
    icon: Presentation,
    label: 'PPT 课件',
    desc: '一键生成精美课件',
    iconColor: 'text-sky-300',
    iconBg: 'bg-sky-400/20 group-hover/item:bg-sky-400/30',
    cardBg: 'bg-sky-500/15 hover:bg-sky-500/25',
    cardBorder: 'border-sky-400/20 hover:border-sky-400/35',
    dot: 'bg-sky-400',
    href: '/sky/cloud-mind/slides',
  },
  {
    icon: Search,
    label: '拍照搜题',
    desc: '拍照秒出解析答案',
    iconColor: 'text-amber-300',
    iconBg: 'bg-amber-400/20 group-hover/item:bg-amber-400/30',
    cardBg: 'bg-amber-500/15 hover:bg-amber-500/25',
    cardBorder: 'border-amber-400/20 hover:border-amber-400/35',
    dot: 'bg-amber-400',
    href: '/sky/cloud-mind/solve',
  },
  {
    icon: MessageSquare,
    label: '互动课堂',
    desc: '沉浸式 AI 教学',
    iconColor: 'text-emerald-300',
    iconBg: 'bg-emerald-400/20 group-hover/item:bg-emerald-400/30',
    cardBg: 'bg-emerald-500/15 hover:bg-emerald-500/25',
    cardBorder: 'border-emerald-400/20 hover:border-emerald-400/35',
    dot: 'bg-emerald-400',
    href: '/sky/assistant',
  },
];

export function CloudMindHeroButton() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className="w-full"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-lg shadow-indigo-500/20">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Soft glow blobs */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-pink-400/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-5 md:p-6">
          {/* Header */}
          <div
            className="flex items-center justify-between mb-5 cursor-pointer group"
            onClick={() => router.push('/sky')}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm group-hover:bg-white/25 transition-all duration-300">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-bold text-white tracking-wide">
                  云端智囊
                </h3>
                <p className="text-xs text-white/50">AI 驱动的智能学习工具集</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/60 group-hover:text-white transition-colors duration-300">
              <span className="text-xs hidden sm:block">探索全部</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>

          {/* Sub tool buttons */}
          <div className="grid grid-cols-3 gap-2.5 md:gap-3">
            {tools.map((tool, i) => {
              const Icon = tool.icon;
              return (
                <motion.div
                  key={tool.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.08 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.push(tool.href)}
                  className={`
                    group/item relative flex flex-col items-center gap-2.5
                    rounded-xl ${tool.cardBg}
                    backdrop-blur-sm cursor-pointer
                    p-4 md:p-5 transition-all duration-300
                    border ${tool.cardBorder}
                  `}
                >
                  <div className="relative flex flex-col items-center gap-2">
                    {/* Colored dot + icon */}
                    <div className="relative">
                      <div
                        className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${tool.dot}`}
                      />
                      <div
                        className={`flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-xl ${tool.iconBg} transition-all duration-300`}
                      >
                        <Icon className={`h-5 w-5 ${tool.iconColor}`} />
                      </div>
                    </div>
                    <div className="text-center min-w-0">
                      <p className="text-xs md:text-sm font-semibold text-white">{tool.label}</p>
                      <p className="text-[10px] md:text-xs text-white/40 mt-0.5 hidden sm:block">
                        {tool.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
