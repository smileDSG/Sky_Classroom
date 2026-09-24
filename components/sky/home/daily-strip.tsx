'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Lightbulb, RefreshCw, Zap } from 'lucide-react';

// ── 数据 ─────────────────────────────────────────────────────

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

const studyTips = [
  '番茄工作法：学习 25 分钟，休息 5 分钟',
  '每天回顾昨天的内容，记忆更牢固',
  '早晨是记忆的黄金时间',
  '把知识讲给别人听，理解更深',
];

// ── 栏目标签 ─────────────────────────────────────────────────

function CellLabel({
  icon: Icon,
  label,
  action,
}: {
  icon: typeof BookOpen;
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
      </div>
      {action}
    </div>
  );
}

// ── 每日一句 ─────────────────────────────────────────────────

function DailyQuote() {
  const quote = useMemo(() => {
    const today = new Date();
    const index = (today.getDate() + today.getMonth()) % dailyQuotes.length;
    return dailyQuotes[index];
  }, []);

  return (
    <div className="px-5 py-4">
      <CellLabel icon={BookOpen} label="每日一句" />
      <p className="text-sm italic leading-relaxed text-slate-700 dark:text-slate-200">
        「{quote.text}」
      </p>
      <p className="mt-1.5 text-right text-xs text-slate-400 dark:text-slate-500">
        —— {quote.author}
      </p>
    </div>
  );
}

// ── 趣味知识 ─────────────────────────────────────────────────

function FunFact() {
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    setFactIndex(Math.floor(Math.random() * funFacts.length));
  }, []);

  return (
    <div className="px-5 py-4">
      <CellLabel
        icon={Lightbulb}
        label="趣味知识"
        action={
          <button
            type="button"
            aria-label="换一条"
            onClick={() => setFactIndex((prev) => (prev + 1) % funFacts.length)}
            className="rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-sky-600 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-sky-400"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        }
      />
      <AnimatePresence mode="wait">
        <motion.p
          key={factIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="text-sm leading-relaxed text-slate-700 dark:text-slate-200"
        >
          {funFacts[factIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ── 学习小贴士 ───────────────────────────────────────────────

function StudyTip() {
  const [tipIndex, setTipIndex] = useState(() => {
    const now = new Date();
    return (now.getHours() + now.getDate()) % studyTips.length;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % studyTips.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="px-5 py-4">
      <CellLabel icon={Zap} label="学习小贴士" />
      <AnimatePresence mode="wait">
        <motion.p
          key={tipIndex}
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.2 }}
          className="text-sm leading-relaxed text-slate-700 dark:text-slate-200"
        >
          {studyTips[tipIndex]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ── 主组件：一张通栏卡，内部分三栏 ─────────────────────────────

export function DailyStrip() {
  return (
    <motion.section
      aria-label="每日内容"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="grid grid-cols-1 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white md:grid-cols-3 md:divide-x md:divide-y-0 dark:divide-slate-800 dark:border-slate-700/60 dark:bg-slate-900"
    >
      <DailyQuote />
      <FunFact />
      <StudyTip />
    </motion.section>
  );
}
