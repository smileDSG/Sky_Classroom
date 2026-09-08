'use client';

export interface StageIconProps {
  stage: string;
  state: 'pending' | 'active' | 'done';
}

const STAGE_SYMBOLS: Record<string, string> = {
  planning: '☊',
  sections_generating: '☋',
  pages_designing: '☌',
  qa_reviewing: '☍',
  repairing: '☉',
  merging: '☽',
  done: '☆',
};

export function StageIcon({ stage, state }: StageIconProps) {
  const symbol = STAGE_SYMBOLS[stage] || '◦';

  if (state === 'done') {
    return (
      <div
        data-testid="stage-icon"
        data-state="done"
        className="relative flex h-5 w-5 items-center justify-center"
      >
        <div className="absolute inset-0 rounded-full bg-[var(--celestial-starlight)]/10" />
        <span className="relative text-[10px] text-[var(--celestial-starlight)]">{symbol}</span>
      </div>
    );
  }

  if (state === 'active') {
    return (
      <div
        data-testid="stage-icon"
        data-state="active"
        className="relative flex h-5 w-5 items-center justify-center"
      >
        {/* Breathing glow */}
        <div className="absolute inset-[-2px] rounded-full bg-[var(--celestial-dawn)]/20 animate-soft-pulse" />
        {/* Radiating rings */}
        <div className="absolute inset-[-4px] rounded-full border border-[var(--celestial-dawn)]/20 animate-ring-expand" />
        <span className="relative text-[10px] text-[var(--celestial-dawn)] animate-cross-flare">
          {symbol}
        </span>
      </div>
    );
  }

  // pending
  return (
    <div
      data-testid="stage-icon"
      data-state="pending"
      className="flex h-5 w-5 items-center justify-center"
    >
      <div className="h-2 w-2 rounded-full border border-[var(--celestial-haze)]/40 bg-transparent" />
    </div>
  );
}
