'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CelestialCanvas } from '../design-system/celestial-canvas';
import { GeneratingThumbnail } from './generating-thumbnail';
import { StageIcon } from './stage-icon';

const STAGES = [
  { key: 'planning', label: '规划大纲', desc: '分析主题结构' },
  { key: 'sections_generating', label: '生成内容', desc: '撰写各章节内容' },
  { key: 'pages_designing', label: '设计排版', desc: '布局与视觉设计' },
  { key: 'qa_reviewing', label: '质量检查', desc: 'AI 质检与评分' },
  { key: 'repairing', label: '修复优化', desc: '自动修复问题' },
  { key: 'merging', label: '合并导出', desc: '生成最终文件' },
  { key: 'done', label: '完成', desc: '课件已就绪' },
] as const;

export interface CompletedSlide {
  pageNum: number;
  title: string;
  type: string;
}

export interface CurrentPage {
  pageNum: number;
  title: string;
  type: string;
}

interface StageTiming {
  startAt: number;
  endAt?: number;
  durationMs?: number;
}

export interface GeneratingStateProps {
  stage: string;
  progress: number;
  status?: string;
  totalPages?: number;
  completedPages?: number;
  currentPage?: CurrentPage | null;
  completedSlides?: CompletedSlide[];
  outline?: CompletedSlide[];
  stageTimings?: Record<string, StageTiming>;
  startedAt?: number;
}

function estimateTimeRemaining(
  stage: string,
  progress: number,
  totalPages: number,
  stageTimings?: Record<string, StageTiming>,
  startedAt?: number
): string {
  if (progress >= 100) return '即将完成';
  if (!startedAt) return '计算中...';

  const STAGE_RANGES: Record<string, [number, number]> = {
    planning: [0, 15],
    sections_generating: [20, 40],
    pages_designing: [42, 70],
    qa_reviewing: [72, 78],
    repairing: [80, 82],
    merging: [82, 100],
  };

  const currentRange = STAGE_RANGES[stage];
  if (!currentRange) return '计算中...';

  const allStages = ['planning', 'sections_generating', 'pages_designing', 'qa_reviewing', 'repairing', 'merging'];
  const currentIdx = allStages.indexOf(stage);

  function defaultDuration(s: string): number {
    switch (s) {
      case 'planning':
        return 15000;
      case 'sections_generating':
        return Math.max(1, Math.round((totalPages || 25) / 8)) * 30000;
      case 'pages_designing':
        return (totalPages || 25) * 6000;
      case 'qa_reviewing':
        return 20000;
      case 'repairing':
        return 8000;
      case 'merging':
        return 15000;
      default:
        return 10000;
    }
  }

  const now = Date.now();
  let remainingMs = 0;

  for (let i = 0; i < allStages.length; i++) {
    const s = allStages[i];
    const timing = stageTimings?.[s];

    if (i < currentIdx) {
      continue;
    }

    if (i === currentIdx) {
      const stageStartAt = timing?.startAt || startedAt;
      const stageElapsed = now - stageStartAt;
      const [startProg, endProg] = currentRange;
      const stageRatio = endProg === startProg ? 1 : Math.min(1, Math.max(0, (progress - startProg) / (endProg - startProg)));

      let estimatedTotalMs: number;
      if (stageRatio > 0.05 && stageElapsed > 2000) {
        estimatedTotalMs = stageElapsed / stageRatio;
      } else {
        estimatedTotalMs = defaultDuration(s);
      }
      remainingMs += Math.max(0, estimatedTotalMs - stageElapsed);
    } else {
      remainingMs += defaultDuration(s);
    }
  }

  const remainingSec = Math.round(remainingMs / 1000);
  if (remainingSec < 5) return '预计剩余 < 10 秒';
  if (remainingSec < 60) return `预计剩余 ${remainingSec} 秒`;
  return `预计剩余 ${Math.ceil(remainingSec / 60)} 分钟`;
}

interface Point {
  x: number;
  y: number;
  pageNum: number;
}

function ConstellationLines({
  points,
  activePoint,
  containerSize,
}: {
  points: Point[];
  activePoint?: Point;
  containerSize: { width: number; height: number };
}) {
  const sorted = useMemo(() => [...points].sort((a, b) => a.pageNum - b.pageNum), [points]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0"
      width={containerSize.width}
      height={containerSize.height}
    >
      <defs>
        <linearGradient id="constellation-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(245,230,200,0.14)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.08)" />
        </linearGradient>
        <linearGradient id="active-constellation-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,140,105,0.35)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0.15)" />
        </linearGradient>
      </defs>

      {/* Base constellation path between completed pages */}
      {sorted.length > 1 && (
        <path
          d={sorted
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
            .join(' ')}
          fill="none"
          stroke="url(#constellation-gradient)"
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4 6"
          style={{
            filter: 'drop-shadow(0 0 3px rgba(245,230,200,0.15))',
          }}
        />
      )}

      {/* Flowing dash overlay along the same path */}
      {sorted.length > 1 && (
        <path
          d={sorted
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
            .join(' ')}
          fill="none"
          stroke="rgba(255,140,105,0.35)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 120"
          className="animate-dash-flow"
        />
      )}

      {/* Highlight line from last completed to active */}
      {activePoint && sorted.length > 0 && (
        <>
          <line
            x1={sorted[sorted.length - 1].x}
            y1={sorted[sorted.length - 1].y}
            x2={activePoint.x}
            y2={activePoint.y}
            stroke="url(#active-constellation-gradient)"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="animate-pulse-line"
          />
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r={4}
            fill="rgba(255,140,105,0.6)"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,140,105,0.6))' }}
          />
        </>
      )}
    </svg>
  );
}

export function GeneratingState({
  stage,
  progress,
  status,
  totalPages = 0,
  completedPages = 0,
  currentPage,
  completedSlides = [],
  outline,
  stageTimings,
  startedAt,
}: GeneratingStateProps) {
  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  const activeIdx = Math.max(0, currentIdx >= 0 ? currentIdx : 0);

  const thumbRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [centers, setCenters] = useState<Map<number, Point>>(new Map());
  const pendingRafRef = useRef<number | null>(null);

  function pointsRoughlyEqual(a: Map<number, Point>, b: Map<number, Point>, tolerance = 2) {
    if (a.size !== b.size) return false;
    for (const [k, p] of a) {
      const q = b.get(k);
      if (!q) return false;
      if (Math.abs(p.x - q.x) > tolerance || Math.abs(p.y - q.y) > tolerance) return false;
    }
    return true;
  }

  function sizeRoughlyEqual(
    a: { width: number; height: number },
    b: { width: number; height: number },
    tolerance = 2
  ) {
    return Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance;
  }

  const { allThumbs, completedCount } = useMemo(() => {
    const thumbs: Array<{ pageNum: number; title: string; type: string; state: 'completed' | 'active' | 'pending' }> = [];

    const completedMap = new Map(completedSlides.map((s) => [s.pageNum, s]));
    const outlineMap = new Map((outline || []).map((s) => [s.pageNum, s]));

    for (const slide of completedSlides) {
      thumbs.push({
        pageNum: slide.pageNum,
        title: slide.title,
        type: slide.type,
        state: currentPage?.pageNum === slide.pageNum ? 'active' : 'completed',
      });
    }

    if (currentPage && !completedMap.has(currentPage.pageNum)) {
      thumbs.push({
        pageNum: currentPage.pageNum,
        title: currentPage.title,
        type: currentPage.type,
        state: 'active',
      });
    }

    const outlineLen = outline?.length || 0;
    const maxPage = totalPages > 0 ? totalPages : Math.max(outlineLen, thumbs.length + 1, 1);
    const existingPageNums = new Set(thumbs.map((t) => t.pageNum));

    for (let i = 1; i <= maxPage; i++) {
      if (!existingPageNums.has(i)) {
        const outlineItem = outlineMap.get(i);
        thumbs.push({
          pageNum: i,
          title: outlineItem?.title || '',
          type: outlineItem?.type || 'content',
          state: 'pending',
        });
      }
    }

    thumbs.sort((a, b) => a.pageNum - b.pageNum);
    return { allThumbs: thumbs, completedCount: thumbs.filter((t) => t.state === 'completed').length };
  }, [completedSlides, currentPage, totalPages, outline]);

  // Measure thumb centers for constellation lines
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    function measure() {
      if (pendingRafRef.current !== null) return;
      pendingRafRef.current = requestAnimationFrame(() => {
        pendingRafRef.current = null;
        const elContainer = gridContainerRef.current;
        if (!elContainer) return;
        const containerRect = elContainer.getBoundingClientRect();
        const nextSize = { width: containerRect.width, height: containerRect.height };
        const next = new Map<number, Point>();
        for (const thumb of allThumbs) {
          const el = thumbRefs.current.get(thumb.pageNum);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          next.set(thumb.pageNum, {
            pageNum: thumb.pageNum,
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top + rect.height / 2,
          });
        }
        setCenters((prev) => (pointsRoughlyEqual(next, prev) ? prev : next));
        setContainerSize((prev) => (sizeRoughlyEqual(nextSize, prev) ? prev : nextSize));
      });
    }

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => {
      ro.disconnect();
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
    };
  }, [allThumbs]);

  const completedPoints = useMemo(
    () => allThumbs.filter((t) => t.state === 'completed').map((t) => centers.get(t.pageNum)).filter(Boolean) as Point[],
    [allThumbs, centers]
  );

  const activePoint = useMemo(() => {
    const active = allThumbs.find((t) => t.state === 'active');
    return active ? centers.get(active.pageNum) : undefined;
  }, [allThumbs, centers]);

  const timeEstimate = estimateTimeRemaining(stage, progress, totalPages, stageTimings, startedAt);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.03 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0 },
  };

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Deep space background */}
      <CelestialCanvas starCount={50} parallax={false} nebula grid={false} />

      {/* Ambient void overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(139,92,246,0.04) 0%, transparent 60%)' }}
      />

      {/* Left Panel — Star Almanac */}
      <div className="relative z-10 flex w-[42%] min-w-[320px] flex-col items-center justify-center gap-6 px-8 py-6 border-r border-[var(--celestial-haze)]/10">
        {/* Orbiting system */}
        <div className="relative h-20 w-20 flex-shrink-0">
          <div className="absolute inset-0 rounded-full border border-[var(--celestial-starlight)]/8 animate-[spin_12s_linear_infinite]" />
          <div className="absolute inset-2 rounded-full border border-[var(--celestial-starlight)]/5 animate-[spin_8s_linear_infinite_reverse]" />
          <div className="absolute inset-4 rounded-full border border-[var(--celestial-dawn)]/10 animate-[spin_5s_linear_infinite]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="h-2.5 w-2.5 rounded-full bg-[var(--celestial-dawn)] animate-soft-pulse" />
              <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-[var(--celestial-dawn)]/40 animate-ring-expand" />
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center font-mono">
          <p className="text-sm font-semibold tracking-wide text-[var(--celestial-starlight)]/90">
            {status || STAGES[activeIdx]?.label || '准备中'}
          </p>
          <p className="mt-0.5 text-xs text-[var(--celestial-starlight)]/30">
            {STAGES[activeIdx]?.desc}
          </p>
        </div>

        {/* Page counter */}
        {totalPages > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-starlight)]/[0.02]">
            <span className="text-[11px] font-mono text-[var(--celestial-dawn)]">
              {completedCount}/{totalPages} 页
            </span>
            <span className="text-[11px] text-[var(--celestial-starlight)]/20">·</span>
            <span className="text-[11px] text-[var(--celestial-starlight)]/30">{timeEstimate}</span>
          </div>
        )}

        {/* Constellation timeline */}
        <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
          {STAGES.map((s, i) => {
            const isDone = i < activeIdx;
            const isActive = i === activeIdx;
            const isFuture = i > activeIdx;

            return (
              <div
                key={s.key}
                data-stage-state={isDone ? 'done' : isActive ? 'active' : 'pending'}
                className="flex items-center gap-3 py-1 transition-all duration-500"
                style={{
                  opacity: isFuture ? 0.3 : isActive ? 1 : 0.75,
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <StageIcon stage={s.key} state={isDone ? 'done' : isActive ? 'active' : 'pending'} />
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    isActive
                      ? 'text-[var(--celestial-dawn)]'
                      : isDone
                        ? 'text-[var(--celestial-starlight)]/70'
                        : 'text-[var(--celestial-starlight)]/20'
                  }`}
                >
                  {s.label}
                </span>
                {i < STAGES.length - 1 && (
                  <div className="flex-1 h-px mx-1">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        background: isDone
                          ? 'linear-gradient(90deg, rgba(245,230,200,0.35), rgba(245,230,200,0.1))'
                          : 'rgba(45,53,97,0.3)',
                        width: isDone ? '100%' : isActive ? `${Math.min((progress % 15) / 15 * 100, 100)}%` : '0%',
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Star-trail progress bar */}
        <div className="w-full max-w-[240px] flex flex-col gap-2">
          <div className="w-full h-[3px] rounded-full overflow-hidden bg-[var(--celestial-haze)]/20">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--celestial-nebula), var(--celestial-dawn))',
                boxShadow: '0 0 8px rgba(255,140,105,0.25)',
              }}
            />
          </div>
          <p className="text-center text-[11px] font-mono text-[var(--celestial-starlight)]/30 tabular-nums">
            {Math.round(progress)}%
          </p>
        </div>
      </div>

      {/* Right Panel — Star Map Index */}
      <div
        className="relative z-10 flex-1 flex flex-col p-6 overflow-hidden"
        style={{ boxShadow: 'inset 0 0 60px rgba(139,92,246,0.03)' }}
      >
        {/* HUD corner brackets */}
        <div className="pointer-events-none absolute inset-5 z-20">
          <div className="absolute top-0 left-0 h-3 w-3 border-t border-l border-[var(--celestial-starlight)]/10 rounded-tl" />
          <div className="absolute top-0 right-0 h-3 w-3 border-t border-r border-[var(--celestial-starlight)]/10 rounded-tr" />
          <div className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-[var(--celestial-starlight)]/10 rounded-bl" />
          <div className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-[var(--celestial-starlight)]/10 rounded-br" />
        </div>

        {/* Scanline */}
        <div className="pointer-events-none absolute inset-5 z-20 overflow-hidden">
          <div
            className="absolute left-0 right-0 h-px animate-scan-sweep"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.06), transparent)',
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--celestial-starlight)]/80">
              星图索引
            </h3>
            <p className="text-[11px] text-[var(--celestial-starlight)]/50 mt-0.5">
              {totalPages > 0 || (outline && outline.length > 0)
                ? `已生成 ${completedCount} 页，共 ${totalPages > 0 ? totalPages : outline!.length} 页`
                : '准备生成页面预览...'}
            </p>
          </div>
          {currentPage && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--celestial-dawn)]/10 bg-[var(--celestial-dawn)]/[0.03]">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--celestial-dawn)] animate-pulse" />
              <span className="text-[11px] font-mono text-[var(--celestial-dawn)]">
                TARGET: PAGE {String(currentPage.pageNum).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* Thumbnail Grid with chapter grouping */}
        <div
          ref={gridContainerRef}
          data-testid="preview-grid"
          className="relative flex-1 overflow-y-auto content-start scrollbar-hide pr-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Constellation overlay */}
          {containerSize.width > 0 && (
            <ConstellationLines
              points={completedPoints}
              activePoint={activePoint}
              containerSize={containerSize}
            />
          )}

          <motion.div
            className="relative z-10 grid grid-cols-3 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {allThumbs.map((thumb, idx) => {
              const isChapter = thumb.type === 'chapter' || thumb.type === 'cover';
              const prevIsChapter = idx > 0 ? allThumbs[idx - 1].type === 'chapter' || allThumbs[idx - 1].type === 'cover' : false;
              const showSeparator = isChapter && idx > 0 && !prevIsChapter;
              return (
                <motion.div
                  key={thumb.pageNum}
                  variants={itemVariants}
                  className={showSeparator ? 'col-span-3 contents' : ''}
                >
                  {showSeparator && (
                    <div className="col-span-3 my-3 flex items-center gap-3">
                      <div className="flex flex-1 items-center gap-2">
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: 'var(--celestial-dawn)', boxShadow: '0 0 6px var(--celestial-dawn)' }}
                        />
                        <div className="h-px flex-1 bg-[var(--celestial-haze)]/30" />
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-mono text-[var(--celestial-starlight)]/60 uppercase tracking-widest">
                          {thumb.title || 'CHAPTER'}
                        </span>
                        <span className="text-[8px] font-mono text-[var(--celestial-starlight)]/25 tracking-[0.2em]">
                          ORBITAL NODE
                        </span>
                      </div>
                      <div className="flex flex-1 items-center gap-2">
                        <div className="h-px flex-1 bg-[var(--celestial-haze)]/30" />
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: 'var(--celestial-dawn)', boxShadow: '0 0 6px var(--celestial-dawn)' }}
                        />
                      </div>
                    </div>
                  )}
                  <GeneratingThumbnail
                    ref={(el) => {
                      if (el) thumbRefs.current.set(thumb.pageNum, el);
                      else thumbRefs.current.delete(thumb.pageNum);
                    }}
                    pageNum={thumb.pageNum}
                    title={thumb.title}
                    type={thumb.type}
                    state={thumb.state}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
