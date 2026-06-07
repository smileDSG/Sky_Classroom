'use client';

interface AmbientGlowProps {
  color?: string;
  accentColor?: string;
  intensity?: 'low' | 'medium' | 'high';
  variant?: 'generating' | 'success' | 'default';
}

export function AmbientGlow({
  color = '#722ed1',
  accentColor = '#6366f1',
  intensity = 'medium',
  variant = 'default',
}: AmbientGlowProps) {
  const opacityMap = { low: 0.03, medium: 0.05, high: 0.08 };
  const opacity = opacityMap[intensity];

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{
          width: '600px',
          height: '600px',
          background: `radial-gradient(circle, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, transparent 70%)`,
        }}
      />
      {variant === 'success' && (
        <div
          className="absolute top-1/3 right-1/4 rounded-full blur-[100px]"
          style={{
            width: '300px',
            height: '300px',
            background: `radial-gradient(circle, ${accentColor}10, transparent 70%)`,
          }}
        />
      )}
    </div>
  );
}
