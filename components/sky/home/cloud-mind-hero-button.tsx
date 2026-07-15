'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Brain, Presentation, Search, MessageSquare, Sparkles, ArrowRight } from 'lucide-react';

const tools = [
  {
    icon: Presentation,
    label: 'PPT 课件',
    desc: '一键生成精美课件',
    accent: 'sky',
    iconColor: 'text-sky-100',
    iconBg: 'bg-sky-500/30',
    iconBorder: 'ring-sky-400/40',
    cardBg: 'bg-white/10 hover:bg-white/18',
    cardBorder: 'border-white/10 hover:border-sky-400/40',
    glow: 'group-hover/item:shadow-sky-500/20',
    href: '/sky/slides',
  },
  {
    icon: Search,
    label: '拍照搜题',
    desc: '拍照秒出解析答案',
    accent: 'amber',
    iconColor: 'text-amber-100',
    iconBg: 'bg-amber-500/30',
    iconBorder: 'ring-amber-400/40',
    cardBg: 'bg-white/10 hover:bg-white/18',
    cardBorder: 'border-white/10 hover:border-amber-400/40',
    glow: 'group-hover/item:shadow-amber-500/20',
    href: '/sky/solve',
  },
  {
    icon: MessageSquare,
    label: '互动课堂',
    desc: '沉浸式 AI 教学',
    accent: 'emerald',
    iconColor: 'text-emerald-100',
    iconBg: 'bg-emerald-500/30',
    iconBorder: 'ring-emerald-400/40',
    cardBg: 'bg-white/10 hover:bg-white/18',
    cardBorder: 'border-white/10 hover:border-emerald-400/40',
    glow: 'group-hover/item:shadow-emerald-500/20',
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
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {tools.map((tool, i) => {
              const Icon = tool.icon;
              return (
                <motion.div
                  key={tool.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + i * 0.08 }}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => router.push(tool.href)}
                  className={`
                    group/item relative flex flex-col items-center
                    rounded-2xl ${tool.cardBg}
                    backdrop-blur-md cursor-pointer
                    p-5 md:p-6 transition-all duration-300
                    border ${tool.cardBorder}
                    hover:shadow-lg ${tool.glow}
                    overflow-hidden
                  `}
                >
                  {/* Top accent line */}
                  <div
                    className={`absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity duration-300 ${tool.iconBg.replace('/30', '')}`}
                  />

                  {/* Shimmer on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/item:translate-x-full transition-transform duration-1000 ease-in-out" />
                  </div>

                  <div className="relative flex flex-col items-center gap-3">
                    {/* Icon container — larger with ring and glow */}
                    <div className="relative">
                      {/* Outer glow ring */}
                      <div
                        className={`absolute inset-0 rounded-2xl blur-md opacity-0 group-hover/item:opacity-60 transition-opacity duration-300 ${tool.iconBg}`}
                      />
                      <div
                        className={`
                        relative flex h-12 w-12 md:h-14 md:w-14
                        items-center justify-center rounded-2xl
                        ${tool.iconBg}
                        ring-1 ${tool.iconBorder}
                        shadow-inner shadow-white/10
                        group-hover/item:scale-110 group-hover/item:shadow-lg
                        transition-all duration-300
                      `}
                      >
                        <Icon
                          className={`h-6 w-6 md:h-7 md:w-7 ${tool.iconColor} drop-shadow-sm`}
                        />
                      </div>
                    </div>

                    {/* Text */}
                    <div className="text-center min-w-0">
                      <p className="text-sm md:text-base font-bold text-white tracking-wide drop-shadow-sm">
                        {tool.label}
                      </p>
                      <p className="text-[11px] md:text-xs text-white/50 mt-1 hidden sm:block">
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
