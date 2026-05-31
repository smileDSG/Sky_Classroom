'use client';

import { useRef, useState, useCallback } from 'react';
import type { DesignDNA } from '@/lib/slides/agent/design-dna';
import type { Density } from '@/lib/slides/hooks/use-cover-draft';
import CoverSVGRenderer from './cover-svg-renderer';
import { StyleLabPanel } from './style-lab-panel';

interface SmartCoverViewProps {
  topic: string;
  difficulty: string;
  draftDNA: DesignDNA;
  showStyleLab: boolean;
  onToggleStyleLab: () => void;
  onConfirm: () => void;
  onRefresh: () => void;
  onShowGallery: () => void;
  onUpdatePalette: (paletteId: string) => void;
  onUpdateLayout: (layoutType: DesignDNA['layoutType']) => void;
  onUpdateFont: (fontId: string) => void;
  onUpdateDensity: (density: Density) => void;
}

export function SmartCoverView({
  topic,
  difficulty,
  draftDNA,
  showStyleLab,
  onToggleStyleLab,
  onConfirm,
  onRefresh,
  onShowGallery,
  onUpdatePalette,
  onUpdateLayout,
  onUpdateFont,
  onUpdateDensity,
}: SmartCoverViewProps) {
  const subtitle = `${difficulty}教学课件`;
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = ((e.clientX - centerX) / (rect.width / 2)) * -6;
    const y = ((e.clientY - centerY) / (rect.height / 2)) * 6;
    setTilt({ x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setIsHovering(false);
  }, []);

  const accentColor = draftDNA.colors.accent.startsWith('#')
    ? draftDNA.colors.accent
    : `#${draftDNA.colors.accent}`;

  return (
    <div className="flex h-full flex-col items-center justify-center relative">
      {/* 3D Cover preview area */}
      <div
        className="relative w-full max-w-4xl"
        style={{ perspective: '1200px' }}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={cardRef}
          className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out will-change-transform"
          style={{
            transform: `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) scale(${isHovering ? 1.02 : 1})`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Ambient glow behind cover */}
          <div
            className="absolute -inset-1 rounded-2xl opacity-40 blur-2xl transition-opacity duration-500"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${accentColor}, transparent 70%)`,
              opacity: isHovering ? 0.6 : 0.25,
            }}
          />

          {/* Cover SVG */}
          <div className="relative z-10 w-full h-full">
            <CoverSVGRenderer designDNA={draftDNA} title={topic} subtitle={subtitle} />
          </div>

          {/* Light sweep overlay */}
          {isHovering && (
            <div
              className="absolute inset-0 z-20 pointer-events-none animate-light-sweep"
              style={{
                backgroundImage: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 55%, transparent 60%)',
                backgroundSize: '200% 100%',
              }}
            />
          )}

          {/* Corner accent lines */}
          <div className="absolute top-0 left-0 w-8 h-8 z-20 pointer-events-none">
            <div className="absolute top-3 left-3 w-4 h-[1.5px] bg-white/30" />
            <div className="absolute top-3 left-3 w-[1.5px] h-4 bg-white/30" />
          </div>
          <div className="absolute bottom-0 right-0 w-8 h-8 z-20 pointer-events-none">
            <div className="absolute bottom-3 right-3 w-4 h-[1.5px] bg-white/30" />
            <div className="absolute bottom-3 right-3 w-[1.5px] h-4 bg-white/30" />
          </div>
        </div>
      </div>

      {/* Style info pills */}
      <div className="mt-5 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-[11px] font-bold text-white shadow-lg backdrop-blur-sm"
            style={{
              background: `linear-gradient(135deg, ${accentColor}dd, ${accentColor}99)`,
              boxShadow: `0 4px 15px -3px ${accentColor}66`,
            }}
          >
            {draftDNA.styleName}
          </span>
          <span className="text-xs text-slate-400 dark:text-gray-500">
            {draftDNA.mood} · {draftDNA.decoration.density === 'sparse' ? '简约' : draftDNA.decoration.density === 'moderate' ? '标准' : '丰富'}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex items-center gap-3">
        <GlowButton onClick={onConfirm} accent={accentColor}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          确认生成课件
        </GlowButton>

        <OutlineButton onClick={onRefresh}>
          <svg className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          换一换
        </OutlineButton>

        <OutlineButton onClick={onToggleStyleLab} active={showStyleLab}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          {showStyleLab ? '收起调整' : '手动调整'}
        </OutlineButton>

        <GhostButton onClick={onShowGallery}>
          查看更多风格
        </GhostButton>
      </div>

      {/* StyleLab Panel */}
      {showStyleLab && (
        <StyleLabPanel
          draftDNA={draftDNA}
          onUpdatePalette={onUpdatePalette}
          onUpdateLayout={onUpdateLayout}
          onUpdateFont={onUpdateFont}
          onUpdateDensity={onUpdateDensity}
          onConfirm={onToggleStyleLab}
          onCancel={onToggleStyleLab}
        />
      )}

    </div>
  );
}

/** Primary CTA with dynamic glow */
function GlowButton({ children, onClick, accent }: { children: React.ReactNode; onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      className="group relative inline-flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-bold text-white overflow-hidden transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]"
      style={{
        background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        boxShadow: `0 8px 25px -5px ${accent}66, 0 0 0 1px ${accent}33 inset`,
      }}
    >
      <span className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  );
}

/** Secondary outline button */
function OutlineButton({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ${
        active
          ? 'border-sky-300 dark:border-sky-700 bg-sky-50/80 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 shadow-md shadow-sky-500/10'
          : 'border-slate-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm text-slate-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm'
      }`}
    >
      {children}
    </button>
  );
}

/** Tertiary ghost button */
function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-gray-400 transition-all duration-200 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-50/80 dark:hover:bg-gray-800/80 active:scale-[0.97]"
    >
      {children}
    </button>
  );
}
