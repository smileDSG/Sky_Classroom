'use client';

import { motion } from 'motion/react';
import { useMemo } from 'react';

// 轻量装饰粒子 —— 只在桌面端渲染，不影响性能
export function FloatingParticles() {
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: 4 + (i % 3) * 2,
      x: `${5 + (i * 13) % 90}%`,
      y: `${10 + (i * 17) % 75}%`,
      duration: 15 + (i * 3) % 10,
      delay: i * 0.8,
      dx: ((i % 2 === 0) ? 1 : -1) * (20 + (i * 5) % 30),
      dy: ((i % 3 === 0) ? 1 : -1) * (15 + (i * 4) % 25),
      opacity: 0.15 + (i % 3) * 0.05,
      color: [
        'bg-sky-400/30',
        'bg-blue-400/25',
        'bg-indigo-400/20',
        'bg-cyan-400/25',
        'bg-violet-400/20',
        'bg-sky-300/25',
        'bg-blue-300/20',
        'bg-indigo-300/25',
      ][i],
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] hidden md:block">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${p.color} blur-sm`}
          style={{
            width: p.size,
            height: p.size,
            left: p.x,
            top: p.y,
            opacity: p.opacity,
          }}
          animate={{
            x: [0, p.dx, -p.dx * 0.5, 0],
            y: [0, p.dy, -p.dy * 0.5, 0],
            scale: [1, 1.5, 0.8, 1],
            opacity: [p.opacity, p.opacity * 1.5, p.opacity * 0.5, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
