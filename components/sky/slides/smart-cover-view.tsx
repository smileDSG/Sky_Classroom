'use client';

import type { DesignDNA } from '@/lib/slides/agent/design-dna';
import type { Density } from '@/lib/slides/hooks/use-cover-draft';
import { AnimatePresence, motion } from 'motion/react';
import CoverSVGRenderer from './cover-svg-renderer';
import { StyleLabPanel } from './style-lab-panel';
import { COLOR_PALETTES } from '@/lib/slides/agent/design-dna';
import {
  Sparkles,
  Check,
  RefreshCw,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Palette,
  X,
} from 'lucide-react';

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

const QUICK_PALETTES = [
  'midnight-executive',
  'forest-fresh',
  'ocean-breeze',
  'coral-warmth',
  'lavender-dream',
  'ember-glow',
] as const;

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

  const accentColor = draftDNA.colors.accent.startsWith('#')
    ? draftDNA.colors.accent
    : `#${draftDNA.colors.accent}`;

  const coverBg = draftDNA.colors.coverBg.startsWith('#')
    ? draftDNA.colors.coverBg
    : `#${draftDNA.colors.coverBg}`;

  return (
    <div className="relative flex h-full flex-col"
    >
      {/* ── Background layers — deep space ── */}
      <div className="pointer-events-none absolute inset-0"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 40%, ${accentColor}08 0%, transparent 55%)`,
          }}
        />
        <div
          className="absolute -top-[10%] -left-[5%] h-[50%] w-[50%]"
          style={{
            background: `radial-gradient(ellipse at 30% 30%, ${accentColor}08, transparent 60%)`,
            filter: 'blur(50px)',
          }}
        />
        <div
          className="absolute -bottom-[5%] -right-[5%] h-[40%] w-[40%]"
          style={{
            background: `radial-gradient(ellipse at 70% 70%, ${coverBg}06, transparent 55%)`,
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.15) 100%)',
          }}
        />
      </div>

      {/* ── Main: Cover + Drawer ── */}
      <div className="relative z-10 flex flex-1 min-h-0"
      >
        {/* Cover stage */}
        <div
          className={`flex flex-1 items-center justify-center px-8 pt-4 transition-all duration-300 ${
            showStyleLab ? 'pr-4' : ''
          }`}
        >
          <div className="relative w-full max-w-5xl"
          >
            {/* Corner brackets — observational viewport */}
            <div className="absolute -top-2 -left-2 h-4 w-4 border-t border-l border-[var(--celestial-starlight)]/15 rounded-tl pointer-events-none" />
            <div className="absolute -top-2 -right-2 h-4 w-4 border-t border-r border-[var(--celestial-starlight)]/15 rounded-tr pointer-events-none" />
            <div className="absolute -bottom-2 -left-2 h-4 w-4 border-b border-l border-[var(--celestial-starlight)]/15 rounded-bl pointer-events-none" />
            <div className="absolute -bottom-2 -right-2 h-4 w-4 border-b border-r border-[var(--celestial-starlight)]/15 rounded-br pointer-events-none" />

            <div
              className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border transition-shadow duration-500"
              style={{
                borderColor: `${accentColor}20`,
                boxShadow: `0 24px 60px -16px ${accentColor}18, 0 0 0 1px ${accentColor}10`,
              }}
            >
              <CoverSVGRenderer designDNA={draftDNA} title={topic} subtitle={subtitle} />
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }} />
            </div>

            {/* Coordinate readout */}
            <div className="mt-2 flex justify-center"
            >
              <span className="text-[10px] font-mono text-[var(--celestial-starlight)]/15 tracking-widest"
              >
                RA: {draftDNA.layoutType?.slice(0, 4).toUpperCase() || 'HERO'} / DEC: +{draftDNA.decoration?.density?.toUpperCase().slice(0, 3) || 'MED'}
              </span>
            </div>
          </div>
        </div>

        {/* Right drawer: Style Lab */}
        <AnimatePresence>
          {showStyleLab && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex flex-col border-l border-[var(--celestial-haze)]/15 overflow-hidden shrink-0"
              style={{ background: 'linear-gradient(180deg, rgba(11,16,33,0.95), rgba(19,24,50,0.98))' }}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--celestial-haze)]/10 shrink-0"
              >
                <div className="flex items-center gap-2"
                >
                  <Palette size={14} className="text-[var(--celestial-starlight)]/30" />
                  <span className="text-xs font-semibold text-[var(--celestial-starlight)]/50">风格调整</span>
                </div>
                <button
                  onClick={onToggleStyleLab}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--celestial-starlight)]/30 hover:bg-[var(--celestial-starlight)]/[0.03] hover:text-[var(--celestial-starlight)]/60 transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Drawer content */}
              <div className="flex-1 overflow-y-auto p-4"
              >
                <StyleLabPanel
                  draftDNA={draftDNA}
                  onUpdatePalette={onUpdatePalette}
                  onUpdateLayout={onUpdateLayout}
                  onUpdateFont={onUpdateFont}
                  onUpdateDensity={onUpdateDensity}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Control deck (bottom) ── */}
      <div className="relative z-10 flex flex-col items-center gap-3 px-6 pb-8 pt-2"
      >
        {/* Style badge + quick palettes */}
        <div className="flex items-center gap-4">
          {/* Spectral classification badge */}
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white font-mono"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${coverBg})`,
              boxShadow: `0 2px 8px ${accentColor}20`,
            }}
          >
            {draftDNA.styleName}
          </span>
          <span className="text-[11px] text-[var(--celestial-starlight)]/25">
            {draftDNA.mood}
          </span>
          <div className="h-3 w-px bg-[var(--celestial-haze)]/20" />
          {/* Quick palette dots */}
          <AnimatePresence>
            {!showStyleLab && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5"
              >
                {QUICK_PALETTES.map((pid) => {
                  const palette = COLOR_PALETTES[pid];
                  if (!palette) return null;
                  const isActive = (
                    palette.coverBg.toUpperCase() === draftDNA.colors.coverBg.toUpperCase() &&
                    palette.accent.toUpperCase() === draftDNA.colors.accent.toUpperCase()
                  );
                  return (
                    <button
                      key={pid}
                      onClick={() => onUpdatePalette(pid)}
                      className={`relative h-4 w-4 rounded-full transition-all duration-200 ${
                        isActive ? 'ring-2 ring-offset-1 scale-110' : 'hover:scale-110 opacity-50 hover:opacity-90'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${palette.coverBg}, ${palette.accent})`,
                        '--tw-ring-color': palette.accent,
                        boxShadow: isActive ? `0 0 6px ${palette.accent}40` : 'none',
                      } as React.CSSProperties}
                      title={pid}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleStyleLab}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-medium text-[var(--celestial-starlight)]/60 border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-starlight)]/[0.02] backdrop-blur-sm hover:bg-[var(--celestial-starlight)]/[0.04] hover:border-[var(--celestial-starlight)]/20 transition-all"
          >
            <Sparkles className="h-3 w-3 text-[var(--celestial-nebula)]" />
            {showStyleLab ? '收起' : '风格'}
            {showStyleLab ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={onRefresh}
            className="group inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-medium text-[var(--celestial-starlight)]/60 border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-starlight)]/[0.02] backdrop-blur-sm hover:bg-[var(--celestial-starlight)]/[0.04] hover:border-[var(--celestial-starlight)]/20 transition-all"
          >
            <RefreshCw className="h-3 w-3 text-[var(--celestial-zenith)] transition-transform duration-300 group-hover:rotate-180" />
            换一换
          </button>
          <button
            onClick={onShowGallery}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[11px] font-medium text-[var(--celestial-starlight)]/60 border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-starlight)]/[0.02] backdrop-blur-sm hover:bg-[var(--celestial-starlight)]/[0.04] hover:border-[var(--celestial-starlight)]/20 transition-all"
          >
            <LayoutGrid className="h-3 w-3 text-[var(--celestial-dawn)]" />
            模板
          </button>
          <button
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[11px] font-bold text-white transition-all hover:shadow-md"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              boxShadow: `0 2px 12px -2px ${accentColor}35`,
            }}
          >
            <Check className="h-3 w-3" />
            确认生成
          </button>
        </div>
      </div>
    </div>
  );
}
