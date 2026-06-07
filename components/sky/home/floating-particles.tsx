'use client';

import { useMemo } from 'react';

const COLORS = [
  'bg-sky-400/30',
  'bg-blue-400/25',
  'bg-indigo-400/20',
  'bg-cyan-400/25',
  'bg-violet-400/20',
  'bg-sky-300/25',
  'bg-blue-300/20',
  'bg-indigo-300/25',
];

export function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        size: 4 + (i % 3) * 2,
        x: `${5 + ((i * 13) % 90)}%`,
        y: `${10 + ((i * 17) % 75)}%`,
        duration: 15 + ((i * 3) % 10),
        delay: i * 0.8,
        dx: (i % 2 === 0 ? 1 : -1) * (20 + ((i * 5) % 30)),
        dy: (i % 3 === 0 ? 1 : -1) * (15 + ((i * 4) % 25)),
        opacity: 0.15 + (i % 3) * 0.05,
        color: COLORS[i],
      })),
    [],
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] hidden md:block">
      <style>{`
        ${particles
          .map(
            (p) => `
          @keyframes float-${p.id} {
            0%   { transform: translate(0, 0) scale(1);   opacity: ${p.opacity}; }
            25%  { transform: translate(${p.dx}px, ${p.dy}px) scale(1.5); opacity: ${p.opacity * 1.5}; }
            50%  { transform: translate(${-p.dx * 0.5}px, ${-p.dy * 0.5}px) scale(0.8); opacity: ${p.opacity * 0.5}; }
            100% { transform: translate(0, 0) scale(1);   opacity: ${p.opacity}; }
          }
        `,
          )
          .join('\n')}
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute rounded-full ${p.color} blur-sm`}
          style={{
            width: p.size,
            height: p.size,
            left: p.x,
            top: p.y,
            opacity: p.opacity,
            animation: `float-${p.id} ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
