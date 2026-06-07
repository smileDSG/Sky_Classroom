'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb,
  Clock,
  Zap,
  BookOpen,
  Star,
  RefreshCw,
  Sparkles,
  GraduationCap,
  Brain,
  Code,
  Clapperboard,
  Gamepad2,
} from 'lucide-react';

// ── 天穹讲课推荐 ──────────────────────────────────────────────

const featuredTopics = [
  {
    icon: Brain,
    title: '人工智能：从入门到实践',
    desc: '大模型、机器学习与AI应用',
    color: 'from-violet-500 to-fuchsia-500',
    shadow: 'shadow-violet-500/25',
    tag: '热门',
    tagColor: 'bg-red-500',
  },
  {
    icon: Code,
    title: '编程：Python全栈开发',
    desc: '从零搭建你的第一个项目',
    color: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/25',
    tag: '推荐',
    tagColor: 'bg-amber-500',
  },
  {
    icon: Clapperboard,
    title: '动漫：日本动画赏析',
    desc: '从宫崎骏到新海诚的艺术',
    color: 'from-pink-500 to-rose-500',
    shadow: 'shadow-pink-500/25',
    tag: '新课',
    tagColor: 'bg-sky-500',
  },
  {
    icon: Gamepad2,
    title: '游戏：游戏设计入门',
    desc: '关卡设计、叙事与玩家心理',
    color: 'from-emerald-500 to-teal-500',
    shadow: 'shadow-emerald-500/25',
    tag: '推荐',
    tagColor: 'bg-violet-500',
  },
];

function FeaturedTopics() {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="w-4 h-4 text-sky-500" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">天穹讲课</h3>
        <span className="text-xs text-slate-400">— 精选推荐</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {featuredTopics.map((topic, i) => {
          const Icon = topic.icon;
          return (
            <motion.div
              key={topic.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              whileHover={{ y: -5, scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group relative cursor-pointer"
            >
              {/* Card */}
              <div className={`relative rounded-2xl bg-gradient-to-br ${topic.color} p-4 h-full ${topic.shadow} shadow-lg overflow-hidden`}>
                {/* Decorative circles */}
                <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10 group-hover:scale-125 transition-transform duration-500" />
                <div className="absolute -top-6 -left-6 w-16 h-16 rounded-full bg-white/5 group-hover:scale-110 transition-transform duration-700" />

                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '16px 16px',
                  }}
                />

                {/* Tag */}
                <span className={`absolute top-2 right-2 ${topic.tagColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                  {topic.tag}
                </span>

                <Icon className="w-6 h-6 text-white/90 mb-2" />
                <p className="text-sm font-bold text-white leading-tight">{topic.title}</p>
                <p className="text-xs text-white/70 mt-1">{topic.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── 每日一句 ──────────────────────────────────────────────────

const dailyQuotes = [
  { text: '学而不思则罔，思而不学则殆。', author: '孔子' },
  { text: '知识就是力量。', author: '培根' },
  { text: '我思故我在。', author: '笛卡尔' },
  { text: '天才是百分之一的灵感加百分之九十九的汗水。', author: '爱迪生' },
  { text: '学而时习之，不亦说乎？', author: '孔子' },
  { text: '业精于勤，荒于嬉；行成于思，毁于随。', author: '韩愈' },
  { text: '知之者不如好之者，好之者不如乐之者。', author: '孔子' },
  { text: '书山有路勤为径，学海无涯苦作舟。', author: '韩愈' },
];

function DailyQuote() {
  const quote = useMemo(() => {
    const today = new Date();
    const index = (today.getDate() + today.getMonth()) % dailyQuotes.length;
    return dailyQuotes[index];
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-4 overflow-hidden"
    >
      {/* Decorative quote mark */}
      <div className="absolute -top-2 -left-1 text-6xl text-sky-500/10 font-serif leading-none select-none">"</div>

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-3.5 h-3.5 text-sky-500" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">每日一句</span>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200 font-medium italic leading-relaxed">
          "{quote.text}"
        </p>
        <p className="text-xs text-slate-400 mt-2 text-right">—— {quote.author}</p>
      </div>
    </motion.div>
  );
}

// ── 今日趣味知识 ──────────────────────────────────────────────

const funFacts = [
  '人脑的神经连接数量比银河系的星星还多',
  '章鱼有三颗心脏，蓝色的血液',
  '光从太阳到地球需要约8分20秒',
  '蜜蜂可以识别人类的面孔',
  '一滴海水中约有1.5亿个细菌',
  '大象是唯一不能跳跃的哺乳动物',
  '宇宙的年龄约为138亿年',
  '人类的DNA有99.9%是相同的',
];

function FunFact() {
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    setFactIndex(Math.floor(Math.random() * funFacts.length));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-4 overflow-hidden"
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-amber-400/10 blur-xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">趣味知识</span>
          </div>
          <motion.button
            whileHover={{ rotate: 180 }}
            whileTap={{ scale: 0.8 }}
            transition={{ duration: 0.3 }}
            onClick={() => setFactIndex((prev) => (prev + 1) % funFacts.length)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </motion.button>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={factIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
          >
            {funFacts[factIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── 学习小贴士 ──────────────────────────────────────────────

const tips = [
  { icon: Zap, text: '番茄工作法：学习25分钟，休息5分钟', color: 'text-amber-500' },
  { icon: Star, text: '每天回顾昨天的内容，记忆更牢固', color: 'text-rose-500' },
  { icon: Clock, text: '早晨是记忆的黄金时间', color: 'text-sky-500' },
  { icon: Sparkles, text: '把知识讲给别人听，理解更深', color: 'text-violet-500' },
];

function StudyTip() {
  const [tipIndex, setTipIndex] = useState(() => {
    const now = new Date();
    return (now.getHours() + now.getDate()) % tips.length;
  });

  const tip = tips[tipIndex];
  const Icon = tip.icon;

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="relative rounded-2xl bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-4 overflow-hidden"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/50">
          <Icon className={`w-4 h-4 ${tip.color}`} />
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="text-sm text-slate-600 dark:text-slate-300"
          >
            {tip.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export function FeaturedSection() {
  return (
    <div className="space-y-4">
      <FeaturedTopics />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DailyQuote />
        <FunFact />
        <StudyTip />
      </div>
    </div>
  );
}
