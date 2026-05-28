'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface IntroSequenceProps {
  onComplete: () => void;
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [scene, setScene] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const t0 = setTimeout(() => setScene(1), 2000);
    const t1 = setTimeout(() => setScene(2), 3500);
    const t2 = setTimeout(() => setFadeOut(true), 4500);
    const t3 = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 5200);

    timerRef.current = [t0, t1, t2, t3];
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

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{
        background: scene < 2
          ? 'linear-gradient(180deg, #0D47A1 0%, #1E88E5 45%, #90CAF9 100%)'
          : 'linear-gradient(180deg, #E8F0F8 0%, #F8FAFC 80%, #FFFFFF 100%)',
        transition: 'background 1.2s ease-in-out',
      }}
      animate={{ opacity: fadeOut ? 0 : 1 }}
      transition={{ duration: 0.7 }}
    >
      {/* ── Scene 0-1: Sun, clouds, title ── */}
      {scene <= 1 && (
        <div className="absolute inset-0">
          {/* Sun */}
          <motion.div
            className="absolute"
            style={{ top: '10%', right: '20%' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 shadow-[0_0_60px_rgba(255,215,0,0.5)]" />
          </motion.div>

          {/* Clouds - simplified static */}
          {[
            { top: '8%', left: '5%', size: 'w-32 h-16 md:w-40 md:h-20', opacity: 0.7 },
            { top: '15%', left: '50%', size: 'w-40 h-20 md:w-48 md:h-24', opacity: 0.8 },
            { top: '25%', left: '70%', size: 'w-28 h-14 md:w-36 md:h-18', opacity: 0.6 },
            { top: '35%', left: '15%', size: 'w-36 h-18 md:w-44 md:h-22', opacity: 0.65 },
            { top: '50%', left: '60%', size: 'w-24 h-12 md:w-32 h-16', opacity: 0.5 },
          ].map((cloud, i) => (
            <motion.div
              key={i}
              className={`absolute ${cloud.size} rounded-full bg-white`}
              style={{ top: cloud.top, left: cloud.left, opacity: cloud.opacity }}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: cloud.opacity }}
              transition={{ duration: 0.8, delay: 0.3 + i * 0.15 }}
            />
          ))}

          {/* Title text */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold text-white/95 tracking-wider drop-shadow-lg">
              天空课堂
            </h1>
            <p className="mt-3 text-lg md:text-xl text-white/80 font-medium tracking-wide drop-shadow">
              AI 驱动的智能学习平台
            </p>
          </motion.div>
        </div>
      )}

      {/* ── Scene 2: Book at center ── */}
      {scene >= 2 && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Book SVG */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <svg
              viewBox="0 0 200 140"
              className="w-44 h-32 md:w-64 md:h-44"
              fill="none"
              strokeWidth="2"
            >
              <defs>
                <linearGradient id="bookStroke" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4A90D9" />
                  <stop offset="100%" stopColor="#2C5F8A" />
                </linearGradient>
              </defs>
              <path d="M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z" fill="rgba(255,255,255,0.9)" stroke="url(#bookStroke)" />
              <path d="M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z" fill="rgba(255,255,255,0.9)" stroke="url(#bookStroke)" />
              <line x1="100" y1="20" x2="100" y2="120" stroke="url(#bookStroke)" strokeWidth="2.5" />
            </svg>
          </motion.div>
        </motion.div>
      )}

      {/* Skip button */}
      {!fadeOut && (
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
      )}
    </motion.div>
  );
}
