'use client';

import { useEffect, useState } from 'react';

interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  sublabel?: string;
  animate?: boolean;
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  color = '#722ed1',
  bgColor = 'rgba(0,0,0,0.06)',
  label,
  sublabel,
  animate = true,
}: CircularProgressProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (displayValue / 100) * circumference;

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }
    const duration = 1200;
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(from + (value - from) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, animate]);

  const isPass = value >= 80;
  const statusColor = isPass ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';
  const activeColor = color === '#722ed1' && value > 0 ? statusColor : color;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Glow effect behind */}
      <div
        className="absolute inset-0 rounded-full opacity-20 blur-xl transition-colors duration-700"
        style={{ backgroundColor: activeColor }}
      />
      <svg width={size} height={size} className="relative -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: animate ? 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
            filter: `drop-shadow(0 0 4px ${activeColor}40)`,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: activeColor, lineHeight: 1 }}
        >
          {displayValue}
        </span>
        {label && (
          <span className="text-[10px] font-medium text-slate-400 dark:text-gray-500 mt-0.5">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-[9px] text-slate-300 dark:text-gray-600 mt-px">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
