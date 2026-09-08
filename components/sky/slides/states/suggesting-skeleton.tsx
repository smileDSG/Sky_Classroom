'use client';

import { motion } from 'motion/react';

interface SuggestingSkeletonProps {
  progress: number;
}

export function SuggestingSkeleton({ progress }: SuggestingSkeletonProps) {
  const filledCount = progress >= 85 ? 3 : progress >= 50 ? 2 : progress >= 20 ? 1 : 0;

  const nebulae = [
    { id: 1, label: '方案 α', color: 'rgba(139, 92, 246, 0.25)', glow: 'rgba(139, 92, 246, 0.15)' },
    { id: 2, label: '方案 β', color: 'rgba(56, 189, 248, 0.25)', glow: 'rgba(56, 189, 248, 0.15)' },
    {
      id: 3,
      label: '方案 γ',
      color: 'rgba(255, 140, 105, 0.25)',
      glow: 'rgba(255, 140, 105, 0.15)',
    },
  ];

  return (
    <div className="flex items-center justify-center gap-4">
      {nebulae.map((neb, i) => {
        const isFilled = i < filledCount;
        const isFilling = i === filledCount && progress > 0;

        return (
          <motion.div
            key={neb.id}
            className="relative flex flex-col items-center justify-center"
            style={{ width: 110, height: 84 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: isFilled ? 1.02 : 1 }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
          >
            {/* Nebula cloud */}
            <div
              className={`absolute inset-0 rounded-2xl transition-all duration-700 ${isFilled || isFilling ? 'animate-nebula-breathe' : ''}`}
              style={{
                background: `radial-gradient(ellipse at center, ${neb.color}, transparent 70%)`,
                filter: 'blur(8px)',
                opacity: isFilled ? 0.8 : isFilling ? 0.5 : 0.3,
              }}
            />

            {/* Inner glow when filling */}
            {isFilling && (
              <motion.div
                className="absolute inset-2 rounded-xl"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  background: `radial-gradient(ellipse at center, ${neb.glow}, transparent 60%)`,
                }}
              />
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              {isFilled ? (
                <>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--celestial-starlight)]/20 bg-[var(--celestial-starlight)]/5">
                    <div className="h-2 w-2 rounded-full bg-[var(--celestial-starlight)]/80" />
                  </div>
                  <span className="text-[10px] font-medium tracking-wide text-[var(--celestial-starlight)]/70">
                    {neb.label}
                  </span>
                  <span className="text-[9px] text-[var(--celestial-dawn)]/80 font-mono">
                    LOCKED
                  </span>
                </>
              ) : isFilling ? (
                <>
                  <div
                    className="h-6 w-6 rounded-full border border-dashed border-[var(--celestial-haze)] animate-spin"
                    style={{ animationDuration: '3s' }}
                  />
                  <span className="text-[10px] font-medium text-[var(--celestial-starlight)]/40">
                    {neb.label}
                  </span>
                  <span className="text-[9px] text-[var(--celestial-nebula)]/60 font-mono animate-pulse">
                    ACQUIRING...
                  </span>
                </>
              ) : (
                <>
                  <div className="h-6 w-6 rounded-full border border-[var(--celestial-haze)]/30" />
                  <span className="text-[10px] text-[var(--celestial-starlight)]/20">
                    {neb.label}
                  </span>
                  <span className="text-[9px] text-[var(--celestial-starlight)]/15 font-mono">
                    DARK
                  </span>
                </>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
