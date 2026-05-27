'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface IntroSequenceProps {
  onComplete: () => void;
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [scene, setScene] = useState(0); // 0-2: clouds → book flies in → white flash
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Auto-advance scenes — runs exactly once
  useEffect(() => {
    // Scene 0: Clouds drifting (0-2s)
    const t0 = setTimeout(() => setScene(1), 2000);
    // Scene 1: Book flies from top to center (2-3.8s)
    const t1 = setTimeout(() => setScene(2), 3800);
    // Scene 2: White flash (3.8-5s) → done
    const t2 = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    }, 5000);

    timerRef.current = [t0, t1, t2];
    return () => {
      timerRef.current.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkip = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    timerRef.current.forEach(clearTimeout);
    onCompleteRef.current();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
    >
      <AnimatePresence>
        {/* ── Scene 0-1: Clouds drifting ── */}
        {scene <= 1 && (
          <motion.div
            key="clouds-scene"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            {/* Cloud 1 — large, slow */}
            <motion.div
              className="absolute"
              style={{ top: '25%' }}
              initial={{ x: -200, opacity: 0 }}
              animate={{ x: '110vw', opacity: 0.7 }}
              transition={{ duration: 6, ease: 'linear' }}
            >
              <svg viewBox="0 0 160 80" className="w-32 h-16" fill="white">
                <ellipse cx="40" cy="55" rx="30" ry="20" />
                <ellipse cx="80" cy="38" rx="40" ry="30" />
                <ellipse cx="125" cy="52" rx="28" ry="18" />
              </svg>
            </motion.div>

            {/* Cloud 2 — medium */}
            <motion.div
              className="absolute"
              style={{ top: '45%' }}
              initial={{ x: '-15vw', opacity: 0 }}
              animate={{ x: '110vw', opacity: 0.5 }}
              transition={{ duration: 8, delay: 0.5, ease: 'linear' }}
            >
              <svg viewBox="0 0 140 70" className="w-28 h-14" fill="white">
                <ellipse cx="35" cy="48" rx="26" ry="18" />
                <ellipse cx="70" cy="32" rx="36" ry="26" />
                <ellipse cx="110" cy="46" rx="24" ry="16" />
              </svg>
            </motion.div>

            {/* Cloud 3 — small, fast */}
            <motion.div
              className="absolute"
              style={{ top: '60%' }}
              initial={{ x: '-20vw', opacity: 0 }}
              animate={{ x: '110vw', opacity: 0.4 }}
              transition={{ duration: 5, delay: 1.2, ease: 'linear' }}
            >
              <svg viewBox="0 0 100 50" className="w-20 h-10" fill="white">
                <ellipse cx="25" cy="35" rx="18" ry="13" />
                <ellipse cx="50" cy="22" rx="26" ry="19" />
                <ellipse cx="78" cy="33" rx="17" ry="12" />
              </svg>
            </motion.div>

            {/* Cloud 4 — top layer, wispy */}
            <motion.div
              className="absolute"
              style={{ top: '15%' }}
              initial={{ x: '-10vw', opacity: 0 }}
              animate={{ x: '110vw', opacity: 0.3 }}
              transition={{ duration: 10, delay: 0.2, ease: 'linear' }}
            >
              <svg viewBox="0 0 180 60" className="w-36 h-12" fill="white">
                <ellipse cx="50" cy="40" rx="35" ry="16" />
                <ellipse cx="90" cy="28" rx="45" ry="22" />
                <ellipse cx="140" cy="38" rx="32" ry="14" />
              </svg>
            </motion.div>
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
            {/* Clouds fade out */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0.1 }}
              transition={{ duration: 1 }}
            >
              <svg viewBox="0 0 160 80" className="absolute w-32 h-16 top-[25%] left-1/4" fill="white">
                <ellipse cx="40" cy="55" rx="30" ry="20" />
                <ellipse cx="80" cy="38" rx="40" ry="30" />
                <ellipse cx="125" cy="52" rx="28" ry="18" />
              </svg>
            </motion.div>

            {/* Book flying in from top */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ y: '-120vh', rotate: -15 }}
              animate={{ y: 0, rotate: 0 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Glow behind book */}
              <motion.div
                className="absolute"
                style={{
                  width: 300,
                  height: 300,
                  background: 'radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 40%, transparent 70%)',
                  borderRadius: '50%',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
              />

              {/* Book SVG */}
              <svg
                viewBox="0 0 200 140"
                className="w-40 h-28 md:w-56 md:h-40 relative z-10"
                fill="none"
                stroke="white"
                strokeWidth="2"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.8)) drop-shadow(0 0 40px rgba(255,255,255,0.4))',
                }}
              >
                {/* Left page */}
                <motion.path
                  d="M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z"
                  fill="rgba(255,255,255,0.15)"
                  animate={{ d: [
                    'M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z',
                    'M100 20 Q60 15 5 20 L5 105 Q60 100 100 120Z',
                    'M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z',
                  ]}}
                  transition={{ delay: 0.8, duration: 0.8, repeat: 1 }}
                />
                {/* Right page */}
                <motion.path
                  d="M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z"
                  fill="rgba(255,255,255,0.15)"
                  animate={{ d: [
                    'M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z',
                    'M100 20 Q140 15 195 20 L195 105 Q140 100 100 120Z',
                    'M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z',
                  ]}}
                  transition={{ delay: 1, duration: 0.8, repeat: 1 }}
                />
                {/* Spine */}
                <line x1="100" y1="20" x2="100" y2="120" strokeWidth="2.5" />
              </svg>
            </motion.div>
          </motion.div>
        )}

        {/* ── Scene 2: Book glow intensifies + white flash ── */}
        {scene >= 2 && (
          <motion.div
            key="book-glow-scene"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Expanding glow */}
            <motion.div
              className="absolute"
              style={{
                width: 300,
                height: 300,
                background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.2) 30%, transparent 60%)',
                borderRadius: '50%',
              }}
              initial={{ scale: 1.5, opacity: 1 }}
              animate={{ scale: 8, opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />

            {/* Book at center, pulsing glow */}
            <svg
              viewBox="0 0 200 140"
              className="w-40 h-28 md:w-56 md:h-40 relative z-10"
              fill="none"
              stroke="white"
              strokeWidth="2"
              style={{
                filter: 'drop-shadow(0 0 30px rgba(255,255,255,1)) drop-shadow(0 0 60px rgba(255,255,255,0.6))',
              }}
            >
              <path d="M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z" fill="rgba(255,255,255,0.2)" />
              <path d="M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z" fill="rgba(255,255,255,0.2)" />
              <line x1="100" y1="20" x2="100" y2="120" strokeWidth="2.5" />
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
              transition={{ duration: 1, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip button — always visible */}
      <motion.button
        className="absolute bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-2 rounded-full text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all cursor-pointer"
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
