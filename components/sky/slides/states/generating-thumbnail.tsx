'use client';

import { forwardRef } from 'react';
import { motion } from 'motion/react';

export interface GeneratingThumbnailProps {
  pageNum: number;
  title: string;
  type: string;
  state: 'completed' | 'active' | 'pending';
}

const TYPE_WATERMARKS: Record<string, string> = {
  cover: '◈',
  end: '◉',
  toc: '≡',
  chapter: '§',
  content: '⊕',
  concept: '⊗',
  case: '□',
  compare: '≠',
  process: '→',
  table: '▦',
  formula: '∑',
  timeline: '◷',
  summary: '◆',
  quiz: '?',
};

const TYPE_GLOW: Record<string, { color: string; alpha: number }> = {
  cover: { color: '#F5E6C8', alpha: 0.45 },
  chapter: { color: '#FF8C69', alpha: 0.5 },
  concept: { color: '#8B5CF6', alpha: 0.45 },
  formula: { color: '#38BDF8', alpha: 0.45 },
  case: { color: '#FF8C69', alpha: 0.4 },
  quiz: { color: '#F43F5E', alpha: 0.4 },
  summary: { color: '#F5E6C8', alpha: 0.4 },
  toc: { color: '#38BDF8', alpha: 0.35 },
  content: { color: '#A78BFA', alpha: 0.35 },
  end: { color: '#F5E6C8', alpha: 0.35 },
  compare: { color: '#FF8C69', alpha: 0.35 },
  process: { color: '#38BDF8', alpha: 0.35 },
  table: { color: '#A78BFA', alpha: 0.35 },
  timeline: { color: '#F5E6C8', alpha: 0.35 },
};

const TYPE_LABELS: Record<string, string> = {
  cover: '封面',
  end: '封底',
  toc: '目录',
  chapter: '章节',
  content: '内容',
  concept: '概念',
  case: '案例',
  compare: '对比',
  process: '流程',
  table: '表格',
  formula: '公式',
  timeline: '时间线',
  summary: '总结',
  quiz: '测验',
};

function toHexAlpha(a: number) {
  return Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Abstract wireframe hints that make pending cards feel content-rich. */
function TypeWireframe({ type, color }: { type: string; color: string }) {
  const c = `${color}18`;
  const stroke = `${color}30`;

  switch (type) {
    case 'cover':
      return (
        <div className="absolute inset-0 flex items-center justify-center opacity-50">
          <div className="w-1/2 h-1 rounded-full" style={{ background: c }} />
        </div>
      );
    case 'chapter':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-60">
          <div className="w-2/3 h-1 rounded-full" style={{ background: c }} />
          <div className="w-1/2 h-0.5 rounded-full" style={{ background: stroke }} />
        </div>
      );
    case 'toc':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3px] opacity-50 px-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-full flex items-center gap-1">
              <div className="h-[2px] flex-1 rounded-full" style={{ background: c }} />
              <div className="h-[2px] w-3 rounded-full" style={{ background: stroke }} />
            </div>
          ))}
        </div>
      );
    case 'formula':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-50">
          <div className="w-1/2 h-2 rounded" style={{ background: c }} />
          <div className="w-8 h-[1px]" style={{ background: stroke }} />
          <div className="w-1/3 h-2 rounded" style={{ background: c }} />
        </div>
      );
    case 'table':
      return (
        <div className="absolute inset-0 flex items-center justify-center opacity-45">
          <div className="grid grid-cols-2 gap-[2px] w-2/3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-2 rounded-sm" style={{ background: c }} />
            ))}
          </div>
        </div>
      );
    case 'process':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3px] opacity-50">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="h-1.5 w-8 rounded-full" style={{ background: c }} />
              {i < 3 && <div className="h-[1px] w-2" style={{ background: stroke }} />}
            </div>
          ))}
        </div>
      );
    case 'compare':
      return (
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-50">
          <div className="h-8 w-1/3 rounded-sm" style={{ background: c }} />
          <div className="text-[10px]" style={{ color: stroke }}>
            vs
          </div>
          <div className="h-8 w-1/3 rounded-sm" style={{ background: c }} />
        </div>
      );
    case 'timeline':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3px] opacity-50">
          <div className="w-2/3 h-[1px]" style={{ background: stroke }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-full flex items-center gap-2 px-6">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              <div className="h-[2px] flex-1 rounded-full" style={{ background: c }} />
            </div>
          ))}
        </div>
      );
    case 'case':
      return (
        <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-50 gap-[2px]">
          <div className="h-1.5 w-2/3 rounded-full" style={{ background: c }} />
          <div className="h-1 w-1/2 rounded-full" style={{ background: stroke }} />
          <div className="h-1 w-3/4 rounded-full" style={{ background: stroke }} />
        </div>
      );
    case 'summary':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3px] opacity-50 px-4">
          <div className="h-1 w-1.5 rounded-full" style={{ background: color }} />
          <div className="h-[2px] w-full rounded-full" style={{ background: c }} />
          <div className="h-1 w-1.5 rounded-full" style={{ background: color }} />
          <div className="h-[2px] w-full rounded-full" style={{ background: c }} />
        </div>
      );
    case 'quiz':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-50">
          <div className="text-[16px] font-bold" style={{ color: stroke }}>
            ?
          </div>
          <div className="h-1 w-10 rounded-full" style={{ background: c }} />
          <div className="h-1 w-8 rounded-full" style={{ background: stroke }} />
        </div>
      );
    default:
      return (
        <div className="absolute inset-0 flex flex-col justify-end p-3 opacity-50 gap-[3px]">
          <div className="h-1.5 w-3/4 rounded-full" style={{ background: c }} />
          <div className="h-1 w-1/2 rounded-full" style={{ background: stroke }} />
          <div className="h-1 w-2/3 rounded-full" style={{ background: stroke }} />
        </div>
      );
  }
}

function StarMarker({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="block">
      <path
        d="M12 2L13.5 9.5L21 12L13.5 14.5L12 22L10.5 14.5L3 12L10.5 9.5L12 2Z"
        fill={color}
        fillOpacity={0.9}
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  );
}

function RadarBeacon({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            borderColor: `${color}40`,
            width: 24,
            height: 24,
          }}
          initial={{ opacity: 0.6, scale: 0.3 }}
          animate={{ opacity: 0, scale: 2.6 }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeOut',
            delay: i * 0.8,
          }}
        />
      ))}
      <div
        className="relative h-2 w-2 rounded-full z-10"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
      />
    </div>
  );
}

export const GeneratingThumbnail = forwardRef<HTMLDivElement, GeneratingThumbnailProps>(
  ({ pageNum, title, type, state }, ref) => {
    const watermark = TYPE_WATERMARKS[type] || '•';
    const typeLabel = TYPE_LABELS[type] || '内容';
    const displayTitle = title.length > 22 ? title.slice(0, 22) + '…' : title;
    const glow = TYPE_GLOW[type] || { color: '#F5E6C8', alpha: 0.25 };
    const hexAlpha = toHexAlpha(glow.alpha);

    const isPending = state === 'pending';
    const isActive = state === 'active';
    const isCompleted = state === 'completed';

    return (
      <motion.div
        ref={ref}
        data-testid={isActive ? 'current-thumb' : isPending ? 'skeleton-thumb' : 'generating-thumb'}
        data-page-num={pageNum}
        layout
        transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}
        initial={false}
        animate={{
          scale: isActive ? 1.04 : isPending ? 0.96 : 1,
          opacity: isPending ? 0.65 : 1,
        }}
        whileHover={isPending ? { scale: 1, opacity: 0.9 } : { scale: 1.02 }}
        className="relative flex flex-col rounded-xl overflow-hidden transition-colors duration-500 group"
        style={{
          aspectRatio: '16/9',
          zIndex: isActive ? 10 : 1,
          background: isActive
            ? `linear-gradient(145deg, rgba(11,16,33,0.98), rgba(19,24,50,0.95))`
            : `linear-gradient(145deg, rgba(11,16,33,0.92), rgba(19,24,50,0.85))`,
          borderColor: isActive
            ? `${glow.color}70`
            : isCompleted
              ? `${glow.color}35`
              : `${glow.color}15`,
          borderWidth: 1,
          borderStyle: 'solid',
          boxShadow: isActive
            ? `0 0 28px -4px ${glow.color}55, inset 0 0 0 1px ${glow.color}30`
            : isCompleted
              ? `0 4px 18px -4px ${glow.color}25, inset 0 0 0 1px ${glow.color}15`
              : `inset 0 0 0 1px ${glow.color}08`,
        }}
      >
        {/* Nebula wash */}
        <div
          className="absolute inset-0 opacity-50 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at ${25 + (pageNum % 3) * 18}% ${35 + (pageNum % 2) * 18}%, ${glow.color}${isPending ? '10' : '18'}, transparent 55%)`,
          }}
        />

        {/* Type wireframe for pending/completed */}
        {(isPending || isCompleted) && displayTitle && (
          <TypeWireframe type={type} color={glow.color} />
        )}

        {/* Active radar beacon */}
        {isActive && <RadarBeacon color={glow.color} />}

        {/* Active breathing border animation overlay */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none z-0"
            animate={{
              boxShadow: [
                `inset 0 0 0 1px ${glow.color}20`,
                `inset 0 0 0 1px ${glow.color}50`,
                `inset 0 0 0 1px ${glow.color}20`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-2.5 pt-2">
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors duration-500 ${
              isActive
                ? 'text-[var(--celestial-starlight)]'
                : isCompleted
                  ? 'text-[var(--celestial-starlight)]/85'
                  : 'text-[var(--celestial-starlight)]/50'
            }`}
            style={{
              borderColor: isActive ? `${glow.color}55` : `${glow.color}30`,
              background: isActive ? `${glow.color}22` : `${glow.color}10`,
              boxShadow: isActive ? `0 0 8px ${glow.color}30` : 'none',
            }}
          >
            {typeLabel}
          </span>
          <span
            className={`font-mono text-[10px] tabular-nums transition-colors duration-500 ${
              isActive ? 'text-[var(--celestial-dawn)]' : 'text-[var(--celestial-starlight)]/25'
            }`}
          >
            {String(pageNum).padStart(2, '0')}
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-start justify-end flex-1 p-2.5 gap-1">
          {displayTitle ? (
            <span
              className={`text-[11px] font-semibold text-left leading-snug line-clamp-2 transition-colors duration-500 ${
                isActive
                  ? 'text-[var(--celestial-dawn)]'
                  : isCompleted
                    ? 'text-[var(--celestial-starlight)]/90'
                    : 'text-[var(--celestial-starlight)]/50'
              }`}
            >
              {displayTitle}
            </span>
          ) : (
            <span
              className={`text-[10px] font-mono animate-pulse ${
                isActive
                  ? 'text-[var(--celestial-dawn)]/80'
                  : 'text-[var(--celestial-starlight)]/25'
              }`}
            >
              {isActive ? 'ACQUIRING…' : '等待生成…'}
            </span>
          )}
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 flex items-center justify-between px-2.5 pb-2">
          <span
            className={`font-mono text-[9px] tabular-nums transition-colors duration-500 ${
              isActive
                ? 'text-[var(--celestial-starlight)]/60'
                : 'text-[var(--celestial-starlight)]/35'
            }`}
          >
            {watermark}
          </span>
          {isCompleted && <StarMarker color={glow.color} />}
        </div>
      </motion.div>
    );
  },
);

GeneratingThumbnail.displayName = 'GeneratingThumbnail';
