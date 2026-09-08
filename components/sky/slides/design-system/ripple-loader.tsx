'use client';

interface RippleLoaderProps {
  size?: number;
  color?: string;
  count?: number;
  className?: string;
}

export function RippleLoader({
  size = 80,
  color = '#722ed1',
  count = 3,
  className = '',
}: RippleLoaderProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full border-2"
          style={{
            width: size * (0.3 + i * 0.35),
            height: size * (0.3 + i * 0.35),
            borderColor: color,
            opacity: 0,
            animation: `ripple-pulse 2s ease-out infinite`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
      {/* Center dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.12,
          height: size * 0.12,
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}60`,
        }}
      />
    </div>
  );
}
