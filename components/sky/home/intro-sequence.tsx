'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface IntroSequenceProps {
  onComplete: () => void;
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [scene, setScene] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const t0 = setTimeout(() => setScene(1), 2500);
    const t1 = setTimeout(() => setScene(2), 4500);
    const t2 = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 6000);

    timerRef.current = [t0, t1, t2];
    return () => {
      timerRef.current.forEach(clearTimeout);
    };
  }, []);

  const handleSkip = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    timerRef.current.forEach(clearTimeout);
    onCompleteRef.current();
  };

  const skyGradients = [
    'linear-gradient(180deg, #87CEEB 0%, #B0E0E6 30%, #E0F7FA 60%, #FFF8E1 100%)',
    'linear-gradient(180deg, #6BB5E0 0%, #9DD5F0 30%, #C8E8F8 60%, #FFF0D0 100%)',
    'linear-gradient(180deg, #E8F0F8 0%, #F0F4F8 50%, #F8FAFC 80%, #FFFFFF 100%)',
  ];

  const cloudConfigs = [
    { top: '6%',  w: 'w-48 h-26', dur: 22, delay: 6,   opacity: 0.5,  viewBox: '0 0 200 100',
      shapes: [{ cx: 50, cy: 65, rx: 35, ry: 24 }, { cx: 100, cy: 45, rx: 50, ry: 34 }, { cx: 155, cy: 62, rx: 32, ry: 22 }] },
    { top: '10%', w: 'w-44 h-24', dur: 16, delay: 0,   opacity: 0.85, viewBox: '0 0 180 90',
      shapes: [{ cx: 45, cy: 60, rx: 32, ry: 22 }, { cx: 90, cy: 42, rx: 45, ry: 32 }, { cx: 140, cy: 58, rx: 30, ry: 20 }] },
    { top: '14%', w: 'w-40 h-22', dur: 20, delay: 4,   opacity: 0.65, viewBox: '0 0 170 85',
      shapes: [{ cx: 42, cy: 58, rx: 30, ry: 21 }, { cx: 85, cy: 40, rx: 42, ry: 30 }, { cx: 130, cy: 56, rx: 28, ry: 18 }] },
    { top: '20%', w: 'w-32 h-18', dur: 12, delay: 1,   opacity: 0.75, viewBox: '0 0 140 70',
      shapes: [{ cx: 35, cy: 48, rx: 26, ry: 18 }, { cx: 70, cy: 32, rx: 36, ry: 26 }, { cx: 110, cy: 46, rx: 24, ry: 16 }] },
    { top: '28%', w: 'w-28 h-16', dur: 10, delay: 2.5, opacity: 0.7,  viewBox: '0 0 120 60',
      shapes: [{ cx: 30, cy: 40, rx: 22, ry: 16 }, { cx: 60, cy: 26, rx: 30, ry: 22 }, { cx: 95, cy: 38, rx: 18, ry: 14 }] },
    { top: '36%', w: 'w-24 h-14', dur: 14, delay: 0.5, opacity: 0.6,  viewBox: '0 0 100 50',
      shapes: [{ cx: 25, cy: 35, rx: 18, ry: 13 }, { cx: 50, cy: 22, rx: 26, ry: 19 }, { cx: 78, cy: 33, rx: 17, ry: 12 }] },
    { top: '46%', w: 'w-36 h-20', dur: 18, delay: 3,   opacity: 0.55, viewBox: '0 0 160 80',
      shapes: [{ cx: 40, cy: 55, rx: 30, ry: 20 }, { cx: 80, cy: 38, rx: 40, ry: 30 }, { cx: 125, cy: 52, rx: 28, ry: 18 }] },
    { top: '56%', w: 'w-20 h-12', dur: 11, delay: 1.8, opacity: 0.5,  viewBox: '0 0 90 45',
      shapes: [{ cx: 22, cy: 30, rx: 16, ry: 12 }, { cx: 45, cy: 18, rx: 24, ry: 18 }, { cx: 72, cy: 30, rx: 14, ry: 10 }] },
    { top: '64%', w: 'w-32 h-18', dur: 13, delay: 2,   opacity: 0.45, viewBox: '0 0 140 70',
      shapes: [{ cx: 35, cy: 48, rx: 26, ry: 18 }, { cx: 70, cy: 32, rx: 36, ry: 26 }, { cx: 110, cy: 46, rx: 24, ry: 16 }] },
    { top: '74%', w: 'w-28 h-16', dur: 15, delay: 5,   opacity: 0.4,  viewBox: '0 0 120 60',
      shapes: [{ cx: 30, cy: 40, rx: 22, ry: 16 }, { cx: 60, cy: 26, rx: 30, ry: 22 }, { cx: 95, cy: 38, rx: 18, ry: 14 }] },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        background: skyGradients[Math.min(scene, skyGradients.length - 1)],
        transition: 'background 1.5s ease-in-out',
      }}
    >
      <AnimatePresence>
        {/* ── Scene 0: Sun, sky, clouds, birds ── */}
        {scene <= 1 && (
          <motion.div
            key="sky-scene"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {/* Sun with glow */}
            <motion.div
              className="absolute"
              style={{ top: '8%', right: '20%' }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2, type: 'spring', stiffness: 150 }}
            >
              <svg viewBox="0 0 100 100" className="w-20 h-20 md:w-28 md:h-28">
                <defs>
                  <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="100%" stopColor="#FFA500" />
                  </radialGradient>
                </defs>
                <circle cx="50" cy="50" r="25" fill="url(#sunGrad)" />
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
                  <motion.line
                    key={angle}
                    x1="50"
                    y1="18"
                    x2="50"
                    y2="10"
                    stroke="#FFD700"
                    strokeWidth="2"
                    strokeLinecap="round"
                    transform={`rotate(${angle} 50 50)`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    transition={{ delay: 0.5 + angle * 0.02, duration: 0.4 }}
                  />
                ))}
              </svg>
            </motion.div>

            {/* Sun glow aura */}
            <motion.div
              className="absolute"
              style={{ top: '4%', right: '16%' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <div
                className="w-40 h-40 md:w-52 md:h-52 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.4), transparent 70%)' }}
              />
            </motion.div>

            {/* Clouds */}
            {cloudConfigs.map((cloud, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{ top: cloud.top }}
                initial={{ x: '-15vw', opacity: 0 }}
                animate={{ x: '110vw', opacity: cloud.opacity }}
                transition={{ duration: cloud.dur, delay: cloud.delay, ease: 'linear' }}
              >
                <svg viewBox={cloud.viewBox} className={cloud.w}>
                  {cloud.shapes.map((s, j) => (
                    <ellipse key={j} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill="white" />
                  ))}
                </svg>
              </motion.div>
            ))}

            {/* Birds */}
            {[
              { top: '15%', delay: 1, duration: 4 },
              { top: '22%', delay: 1.3, duration: 4.5 },
              { top: '18%', delay: 1.6, duration: 3.8 },
            ].map((bird, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{ top: bird.top }}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: '105vw', opacity: 0.7 }}
                transition={{ duration: bird.duration, delay: bird.delay, ease: 'linear' }}
              >
                <svg viewBox="0 0 40 20" className="w-8 h-4" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round">
                  <motion.path
                    d="M5 12 Q12 4 20 12 Q28 4 35 12"
                    animate={{ d: ['M5 12 Q12 4 20 12 Q28 4 35 12', 'M5 10 Q12 6 20 10 Q28 6 35 10', 'M5 12 Q12 4 20 12 Q28 4 35 12'] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                </svg>
              </motion.div>
            ))}

            {/* Title text */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold text-sky-800 tracking-wider">
                天空课堂
              </h1>
              <p className="mt-3 text-lg md:text-xl text-sky-600 font-medium tracking-wide">
                AI 驱动的智能学习平台
              </p>
            </motion.div>

            {/* Sparkle particles */}
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-yellow-300"
                style={{
                  left: `${10 + (i * 7) % 85}%`,
                  top: `${5 + (i * 13) % 70}%`,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1, 0], opacity: [0, 0.8, 0] }}
                transition={{
                  duration: 2,
                  delay: 0.5 + i * 0.25,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
              />
            ))}
          </motion.div>
        )}

        {/* ── Scene 1-2: Book flies from top to center ── */}
        {scene >= 1 && scene <= 2 && (
          <motion.div
            key="book-fly-scene"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* Book flying in from sky */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ y: '-100vh', rotate: -20, scale: 0.3 }}
              animate={{ y: 0, rotate: 0, scale: 1 }}
              transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Glow behind book */}
              <motion.div
                className="absolute"
                style={{
                  width: 250,
                  height: 250,
                  background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(135,206,235,0.3) 40%, transparent 70%)',
                  borderRadius: '50%',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 2, opacity: 1 }}
                transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
              />

              {/* Book SVG */}
              <svg
                viewBox="0 0 200 140"
                className="w-44 h-32 md:w-64 md:h-44 relative z-10"
                fill="none"
                strokeWidth="2"
                style={{
                  filter: 'drop-shadow(0 0 25px rgba(255,255,255,0.9)) drop-shadow(0 0 50px rgba(135,206,235,0.5))',
                }}
              >
                <defs>
                  <linearGradient id="bookStroke" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A90D9" />
                    <stop offset="100%" stopColor="#2C5F8A" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z"
                  fill="rgba(255,255,255,0.8)"
                  stroke="url(#bookStroke)"
                  animate={{ d: [
                    'M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z',
                    'M100 20 Q60 15 5 20 L5 105 Q60 100 100 120Z',
                    'M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z',
                  ]}}
                  transition={{ delay: 0.8, duration: 0.8, repeat: 1 }}
                />
                <motion.path
                  d="M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z"
                  fill="rgba(255,255,255,0.8)"
                  stroke="url(#bookStroke)"
                  animate={{ d: [
                    'M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z',
                    'M100 20 Q140 15 195 20 L195 105 Q140 100 100 120Z',
                    'M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z',
                  ]}}
                  transition={{ delay: 1, duration: 0.8, repeat: 1 }}
                />
                <line x1="100" y1="20" x2="100" y2="120" stroke="url(#bookStroke)" strokeWidth="2.5" />
              </svg>
            </motion.div>
          </motion.div>
        )}

        {/* ── Scene 2: Book glow + white flash transition ── */}
        {scene >= 2 && (
          <motion.div
            key="book-glow-scene"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Expanding light from book */}
            <motion.div
              className="absolute"
              style={{
                width: 250,
                height: 250,
                background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(135,206,235,0.5) 25%, transparent 55%)',
                borderRadius: '50%',
              }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 12, opacity: 0 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />

            {/* Book at center, bright glow */}
            <svg
              viewBox="0 0 200 140"
              className="w-44 h-32 md:w-64 md:h-44 relative z-10"
              fill="none"
              strokeWidth="2"
              style={{
                filter: 'drop-shadow(0 0 40px rgba(255,255,255,1)) drop-shadow(0 0 80px rgba(135,206,235,0.8))',
              }}
            >
              <path d="M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z" fill="rgba(255,255,255,0.9)" stroke="#4A90D9" />
              <path d="M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z" fill="rgba(255,255,255,0.9)" stroke="#4A90D9" />
              <line x1="100" y1="20" x2="100" y2="120" stroke="#4A90D9" strokeWidth="2.5" />
            </svg>

            {/* White flash overlay */}
            <motion.div
              className="absolute inset-0 z-50"
              style={{
                background: 'white',
                clipPath: 'circle(0% at 50% 50%)',
              }}
              animate={{
                clipPath: 'circle(150% at 50% 50%)',
              }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip button */}
      <motion.button
        className="absolute bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-2 rounded-full text-sm text-sky-700/70 hover:text-sky-800 bg-white/30 hover:bg-white/50 backdrop-blur-sm transition-all cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSkip}
      >
        跳过
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}
