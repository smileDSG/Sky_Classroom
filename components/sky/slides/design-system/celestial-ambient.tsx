'use client';

import { useMemo } from 'react';

interface StarLight {
  x: string;
  y: string;
  color: string;
  intensity: number;
  size?: number;
}

interface NebulaLight {
  color: string;
  spread: number;
  x?: string;
  y?: string;
}

interface CelestialAmbientProps {
  /** Primary star light sources */
  stars?: StarLight[];
  /** Nebula haze layers */
  nebulas?: NebulaLight[];
  /** Enable bottom horizon glow band */
  horizon?: boolean;
  /** Horizon color (default: dawn orange) */
  horizonColor?: string;
  /** Overall background tint (default: void) */
  voidColor?: string;
}

export function CelestialAmbient({
  stars,
  nebulas,
  horizon = false,
  horizonColor = 'rgba(255, 140, 105, 0.06)',
  voidColor = '#0B1021',
}: CelestialAmbientProps) {
  const defaultStars: StarLight[] = useMemo(
    () => [
      { x: '50%', y: '40%', color: '#8B5CF6', intensity: 0.06, size: 500 },
      { x: '20%', y: '70%', color: '#38BDF8', intensity: 0.04, size: 350 },
    ],
    [],
  );

  const defaultNebulas: NebulaLight[] = useMemo(
    () => [
      { color: 'rgba(139, 92, 246, 0.08)', spread: 400, x: '60%', y: '30%' },
      { color: 'rgba(56, 189, 248, 0.06)', spread: 350, x: '30%', y: '60%' },
    ],
    [],
  );

  const activeStars = stars ?? defaultStars;
  const activeNebulas = nebulas ?? defaultNebulas;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ background: `linear-gradient(180deg, ${voidColor} 0%, ${voidColor} 100%)` }}
    >
      {/* Nebula layers */}
      {activeNebulas.map((n, i) => (
        <div
          key={`nebula-${i}`}
          className="absolute rounded-full animate-nebula-drift"
          style={{
            left: n.x ?? '50%',
            top: n.y ?? '50%',
            width: n.spread,
            height: n.spread,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${n.color}, transparent 70%)`,
            filter: 'blur(60px)',
            animationDelay: `${i * 3}s`,
          }}
        />
      ))}

      {/* Star light sources */}
      {activeStars.map((s, i) => (
        <div
          key={`star-${i}`}
          className="absolute rounded-full"
          style={{
            left: s.x,
            top: s.y,
            width: s.size ?? 400,
            height: s.size ?? 400,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${s.color}${Math.round(s.intensity * 255)
              .toString(16)
              .padStart(2, '0')}, transparent 70%)`,
            filter: 'blur(80px)',
          }}
        />
      ))}

      {/* Horizon glow */}
      {horizon && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[40%] animate-horizon-glow"
          style={{
            background: `linear-gradient(to top, ${horizonColor}, transparent)`,
          }}
        />
      )}

      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
}
