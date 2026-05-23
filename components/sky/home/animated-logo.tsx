'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Sparkles, Cloud, Zap, Brain } from 'lucide-react';

// 动态Logo组件
export function AnimatedLogo() {
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* 外层光晕 */}
      <motion.div
        className="absolute inset-0 rounded-3xl"
        animate={{
          boxShadow: [
            '0 0 40px rgba(135,206,235,0.3)',
            '0 0 60px rgba(135,206,235,0.5)',
            '0 0 40px rgba(135,206,235,0.3)',
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* 主Logo容器 */}
      <div className="relative flex items-center gap-4">
        {/* 云朵图标 */}
        <motion.div
          className="relative w-16 h-16 md:w-20 md:h-20"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* 背景光 */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400/20 to-blue-500/20 blur-xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* 云朵SVG */}
          <svg
            viewBox="0 0 80 60"
            className="w-full h-full text-sky-500 dark:text-sky-400 drop-shadow-lg"
            fill="currentColor"
          >
            <defs>
              <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#87CEEB" />
                <stop offset="100%" stopColor="#4A90D9" />
              </linearGradient>
            </defs>
            <ellipse cx="25" cy="40" rx="18" ry="14" fill="url(#cloudGrad)" />
            <ellipse cx="40" cy="28" rx="22" ry="18" fill="url(#cloudGrad)" />
            <ellipse cx="58" cy="38" rx="16" ry="13" fill="url(#cloudGrad)" />
            <ellipse cx="15" cy="45" rx="12" ry="9" fill="url(#cloudGrad)" />
            <ellipse cx="65" cy="42" rx="14" ry="11" fill="url(#cloudGrad)" />
          </svg>

          {/* 太阳 */}
          <motion.div
            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-r from-amber-300 to-orange-400"
            style={{ boxShadow: '0 0 20px rgba(251,191,36,0.6)' }}
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 180, 360],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* 太阳光芒 */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-0.5 h-2 bg-amber-300/60"
                style={{
                  transform: `rotate(${i * 45}deg) translateY(-10px)`,
                  transformOrigin: 'center bottom',
                }}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* 文字部分 */}
        <div className="flex flex-col">
          <motion.h1
            className="text-3xl md:text-4xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #4A90D9 0%, #722ed1 50%, #4A90D9 100%)',
              backgroundSize: '200% 200%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            天空课堂
          </motion.h1>
          <motion.div
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
            <span>云端智学，无限可能</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// 功能亮点卡片
export function FeatureHighlights() {
  const router = useRouter();

  const features = [
    {
      icon: Brain,
      title: 'AI 智能生成',
      desc: '一键生成精美课件',
      color: 'from-violet-500 to-purple-600',
      bgColor: 'bg-violet-50 dark:bg-violet-900/20',
      iconColor: 'text-violet-500',
      href: null, // 首页直接创建，不跳转
    },
    {
      icon: Sparkles,
      title: '互动课堂',
      desc: '沉浸式学习体验',
      color: 'from-sky-400 to-blue-500',
      bgColor: 'bg-sky-50 dark:bg-sky-900/20',
      iconColor: 'text-sky-500',
      href: '/sky/assistant',
    },
    {
      icon: Zap,
      title: '搜题批改',
      desc: '拍照秒出答案',
      color: 'from-amber-400 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      iconColor: 'text-amber-500',
      href: '/sky/solve',
    },
  ];

  const handleClick = (href: string | null) => {
    if (href) {
      router.push(href);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-3 md:gap-4">
      {features.map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + index * 0.1 }}
          whileHover={{ y: -4, scale: 1.02 }}
          onClick={() => handleClick(feature.href)}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-2xl
            ${feature.bgColor}
            border border-slate-200/50 dark:border-slate-700/50
            backdrop-blur-sm cursor-pointer
            transition-shadow duration-300
            hover:shadow-lg hover:shadow-${feature.iconColor.split('-')[1]}-500/10
          `}
        >
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              bg-gradient-to-br ${feature.color}
              shadow-lg shadow-${feature.iconColor.split('-')[1]}-500/25
            `}
          >
            <feature.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {feature.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {feature.desc}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
