'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface IntroSequenceProps {
  onComplete: () => void;
}

// 云朵 SVG — 阴影层 + 主体层
function CloudShape({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 200 120" className={className} style={style}>
      {/* 阴影层 — 稍偏移、稍大、更深 */}
      <path
        d="M42 92 Q12 92 12 72 Q12 52 32 47 Q30 22 57 17 Q82 7 102 22 Q117 7 142 12 Q172 17 177 42 Q202 47 197 72 Q197 92 167 92 Z"
        fill="#93c5fd"
        opacity="0.35"
        transform="translate(1, 3)"
      />
      {/* 主体云 */}
      <path
        d="M40 90 Q10 90 10 70 Q10 50 30 45 Q28 20 55 15 Q80 5 100 20 Q115 5 140 10 Q170 15 175 40 Q200 45 195 70 Q195 90 165 90 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

// 均匀分布但会飘动的云
function DriftingCloud({
  top,
  startX,
  size,
  opacity,
  speed,
}: {
  top: string;
  startX: string;
  size: number;
  opacity: number;
  speed: number;
}) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ top }}
      initial={{ left: startX, opacity: 0 }}
      animate={{
        left: '120%',
        opacity: [0, opacity, opacity, 0],
        y: [0, -8, 0, 6, 0],
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: 'linear',
        opacity: { duration: speed },
        y: { duration: speed * 0.4, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      <CloudShape
        style={{
          width: size,
          height: size * 0.55,
          filter: 'drop-shadow(0 4px 6px rgba(147,197,253,0.4))',
        }}
      />
    </motion.div>
  );
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t0 = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, 5000);
    timerRef.current = [t0];
    return () => timerRef.current.forEach(clearTimeout);
  }, [onComplete, mounted]);

  const handleSkip = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    timerRef.current.forEach(clearTimeout);
    onComplete();
  };

  return (
    <motion.div className="fixed inset-0 z-[100] overflow-hidden">
      {/* 天空背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0D47A1] via-[#1E88E5] via-40% to-[#90CAF9]" />

      {/* 白色圆形扩散 — 书停稳后从书底端开始，盖住一切 */}
      <motion.div
        className="absolute inset-0 bg-white dark:bg-slate-950"
        style={{ zIndex: 50 }}
        initial={{ clipPath: 'circle(0% at 50% 65%)' }}
        animate={{ clipPath: 'circle(150% at 50% 65%)' }}
        transition={{ delay: 3.5, duration: 1.5, ease: 'easeInOut' }}
      />

      {/* 太阳 + 云朵 — 仅客户端渲染，避免 SSR hydration mismatch */}
      {mounted && (
        <>
          {/* 太阳 — 柔和金色，不抢视觉 */}
          <motion.div
            className="absolute pointer-events-none"
            style={{ top: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.75, scale: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            <svg viewBox="0 0 120 120" className="w-44 h-44 md:w-60 md:h-60">
              <defs>
                {/* 柔和光晕 */}
                <radialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#fde68a" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#fcd34d" stopOpacity="0" />
                </radialGradient>
                {/* 太阳本体渐变 */}
                <radialGradient id="sunBody" cx="45%" cy="40%" r="55%">
                  <stop offset="0%" stopColor="#fef9c3" />
                  <stop offset="70%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </radialGradient>
              </defs>
              {/* 柔和光晕 — 呼吸动画 */}
              <motion.circle
                cx="60"
                cy="60"
                r="52"
                fill="url(#sunHalo)"
                animate={{ r: [48, 54, 48], opacity: [0.6, 0.9, 0.6] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* 光线 — 柔和的圆角矩形，缓慢旋转 */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                style={{ transformOrigin: '60px 60px' }}
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <rect
                    key={i}
                    x="57"
                    y="8"
                    width="6"
                    height="18"
                    rx="3"
                    fill="#fbbf24"
                    opacity={i % 2 === 0 ? 0.5 : 0.3}
                    transform={`rotate(${i * 36}, 60, 60)`}
                  />
                ))}
              </motion.g>
              {/* 太阳本体 — 温暖柔和 */}
              <circle cx="60" cy="60" r="24" fill="url(#sunBody)" />
            </svg>
          </motion.div>

          {/* 云朵 — 大小不一，有阴影，向右飘动 */}
          <div style={{ zIndex: 15 }}>
            <DriftingCloud top="4%" startX="5%" size={80} opacity={0.5} speed={38} />
            <DriftingCloud top="10%" startX="60%" size={160} opacity={0.7} speed={28} />
            <DriftingCloud top="20%" startX="15%" size={200} opacity={0.8} speed={24} />
            <DriftingCloud top="30%" startX="75%" size={100} opacity={0.55} speed={34} />
            <DriftingCloud top="40%" startX="5%" size={130} opacity={0.65} speed={30} />
            <DriftingCloud top="52%" startX="45%" size={180} opacity={0.75} speed={26} />
            <DriftingCloud top="60%" startX="20%" size={70} opacity={0.5} speed={36} />
            <DriftingCloud top="70%" startX="60%" size={150} opacity={0.7} speed={22} />
            <DriftingCloud top="82%" startX="10%" size={110} opacity={0.6} speed={32} />
            <DriftingCloud top="90%" startX="50%" size={190} opacity={0.8} speed={20} />
          </div>
        </>
      )}

      {/* 书 + 涟漪 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ zIndex: 20 }}
      >
        <motion.div
          initial={{ y: -500, scale: 0.3, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          transition={{ delay: 1, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            animate={{
              filter: [
                'drop-shadow(0 0 15px rgba(255,255,255,0.4))',
                'drop-shadow(0 0 50px rgba(255,255,255,1)) drop-shadow(0 0 100px rgba(100,181,246,0.8))',
                'drop-shadow(0 0 20px rgba(255,255,255,0.5))',
              ],
            }}
            transition={{ duration: 2, delay: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg
              viewBox="0 0 200 160"
              className="w-44 h-36 md:w-60 md:h-48"
              fill="none"
              strokeWidth="2"
            >
              <defs>
                <linearGradient id="bookFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E3F2FD" />
                  <stop offset="100%" stopColor="#BBDEFB" />
                </linearGradient>
                <linearGradient id="bookEdge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1565C0" />
                  <stop offset="100%" stopColor="#0D47A1" />
                </linearGradient>
              </defs>
              <path
                d="M100 25 Q65 12 10 30 L10 125 Q65 107 100 135Z"
                fill="url(#bookFill)"
                stroke="url(#bookEdge)"
              />
              <path
                d="M100 25 Q135 12 190 30 L190 125 Q135 107 100 135Z"
                fill="url(#bookFill)"
                stroke="url(#bookEdge)"
              />
              <line x1="100" y1="25" x2="100" y2="135" stroke="url(#bookEdge)" strokeWidth="3" />
              <line
                x1="35"
                y1="55"
                x2="80"
                y2="48"
                stroke="#1565C0"
                strokeWidth="1"
                opacity="0.3"
              />
              <line
                x1="35"
                y1="70"
                x2="80"
                y2="63"
                stroke="#1565C0"
                strokeWidth="1"
                opacity="0.3"
              />
              <line
                x1="35"
                y1="85"
                x2="80"
                y2="78"
                stroke="#1565C0"
                strokeWidth="1"
                opacity="0.3"
              />
              <line
                x1="120"
                y1="48"
                x2="165"
                y2="55"
                stroke="#1565C0"
                strokeWidth="1"
                opacity="0.3"
              />
              <line
                x1="120"
                y1="63"
                x2="165"
                y2="70"
                stroke="#1565C0"
                strokeWidth="1"
                opacity="0.3"
              />
              <line
                x1="120"
                y1="78"
                x2="165"
                y2="85"
                stroke="#1565C0"
                strokeWidth="1"
                opacity="0.3"
              />
            </svg>
          </motion.div>

          {/* 标题 */}
          <motion.div
            className="text-center mt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg tracking-wider">
              天空课堂
            </h1>
            <p className="mt-2 text-base md:text-lg text-white/80 font-medium tracking-wide drop-shadow">
              AI 驱动的智能学习平台
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* 跳过按钮 */}
      <motion.button
        className="absolute bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-2 rounded-full text-sm text-white/70 hover:text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={handleSkip}
      >
        跳过
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}
