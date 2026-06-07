'use client';

interface ShimmerBarProps {
  progress: number;
  height?: number;
  color?: string;
  bgColor?: string;
  className?: string;
}

export function ShimmerBar({
  progress,
  height = 6,
  color = '#722ed1',
  bgColor = 'rgba(0,0,0,0.06)',
  className = '',
}: ShimmerBarProps) {
  return (
    <div
      data-testid="shimmer-bar"
      className={`relative overflow-hidden rounded-full ${className}`}
      style={{ height, backgroundColor: bgColor }}
    >
      <style>{`
        @keyframes shimmer-flow {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes shimmer-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(progress, 2)}%`,
          background: `linear-gradient(90deg, ${color}cc, ${color}, ${color}cc)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer-flow 1.5s linear infinite, shimmer-pulse 2s ease-in-out infinite',
          boxShadow: `0 0 12px ${color}40`,
        }}
      />
    </div>
  );
}
