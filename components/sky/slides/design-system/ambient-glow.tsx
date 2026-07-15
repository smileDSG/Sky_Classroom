'use client';

import { cn } from '@/lib/utils/cn';

interface AmbientGlowProps {
  color?: string;
  accentColor?: string;
  intensity?: 'low' | 'medium' | 'high';
  variant?: 'default' | 'generating' | 'success';
  className?: string;
}

export function AmbientGlow({
  color = '#722ed1',
  accentColor = '#0ea5e9',
  intensity = 'medium',
  variant = 'default',
  className = '',
}: AmbientGlowProps) {
  const opacityMap = { low: 0.06, medium: 0.10, high: 0.18 };
  const opacity = opacityMap[intensity];

  const variantStyles = {
    default: {
      blob1: { bg: color, opacity: opacity },
      blob2: { bg: accentColor, opacity: opacity * 0.6 },
      blob3: { bg: color, opacity: opacity * 0.4 },
    },
    generating: {
      blob1: { bg: color, opacity: opacity * 1.2 },
      blob2: { bg: accentColor, opacity: opacity * 0.8 },
      blob3: { bg: '#6366f1', opacity: opacity * 0.5 },
    },
    success: {
      blob1: { bg: '#a855f7', opacity: opacity * 0.9 },
      blob2: { bg: '#06b6d4', opacity: opacity * 0.5 },
      blob3: { bg: color, opacity: opacity * 0.3 },
    },
  };

  const vs = variantStyles[variant];

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      {/* ── Layer 1: Subtle grid texture ── */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          color: 'inherit',
        }}
      />

      {/* ── Layer 2: Organic blob shapes ── */}
      {/* Top-left large organic blob */}
      <div
        className="absolute -top-[30%] -left-[15%] w-[70%] h-[70%] animate-mesh-drift-1"
        style={{
          background: `radial-gradient(ellipse at 40% 40%, ${vs.blob1.bg}, transparent 65%)`,
          opacity: vs.blob1.opacity,
          filter: 'blur(80px)',
          borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
        }}
      />
      {/* Bottom-right organic blob */}
      <div
        className="absolute -bottom-[25%] -right-[10%] w-[60%] h-[60%] animate-mesh-drift-2"
        style={{
          background: `radial-gradient(ellipse at 60% 60%, ${vs.blob2.bg}, transparent 60%)`,
          opacity: vs.blob2.opacity,
          filter: 'blur(70px)',
          borderRadius: '40% 60% 70% 30% / 40% 50% 50% 60%',
        }}
      />
      {/* Center subtle accent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45%] h-[45%] animate-mesh-breathe"
        style={{
          background: `radial-gradient(circle, ${vs.blob3.bg}20, transparent 70%)`,
          filter: 'blur(60px)',
          borderRadius: '50%',
        }}
      />

      {/* ── Layer 3: Fine grain noise overlay ── */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />

      {/* ── Layer 4: Floating light orbs (subtle) ── */}
      <div
        className="absolute top-[20%] right-[25%] w-1 h-1 rounded-full animate-floaty"
        style={{
          backgroundColor: vs.blob1.bg,
          opacity: vs.blob1.opacity * 1.5,
          boxShadow: `0 0 20px 4px ${vs.blob1.bg}30`,
          animationDelay: '0s',
        }}
      />
      <div
        className="absolute bottom-[35%] left-[20%] w-1.5 h-1.5 rounded-full animate-floaty"
        style={{
          backgroundColor: vs.blob2.bg,
          opacity: vs.blob2.opacity * 1.5,
          boxShadow: `0 0 24px 6px ${vs.blob2.bg}25`,
          animationDelay: '1.5s',
        }}
      />
      <div
        className="absolute top-[60%] right-[15%] w-1 h-1 rounded-full animate-floaty"
        style={{
          backgroundColor: vs.blob1.bg,
          opacity: vs.blob1.opacity,
          boxShadow: `0 0 16px 3px ${vs.blob1.bg}20`,
          animationDelay: '3s',
        }}
      />

      {/* ── Layer 5: Radial vignette for depth ── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.03) 100%)',
        }}
      />
    </div>
  );
}
