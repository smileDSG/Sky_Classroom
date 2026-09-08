'use client';

import { motion } from 'motion/react';
import { Download, RotateCcw, Presentation } from 'lucide-react';
import { CelestialCanvas } from '../design-system/celestial-canvas';

interface SuccessStateProps {
  fileName: string;
  onDownload: () => void;
  onRegenerate: () => void;
}

export function SuccessState({ fileName, onDownload, onRegenerate }: SuccessStateProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 overflow-hidden">
      {/* Starfield background */}
      <CelestialCanvas starCount={80} parallax={false} nebula grid={false} />

      {/* Nebula bloom */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(245,230,200,0.06), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full px-6"
      >
        {/* Convergence animation */}
        <div className="relative h-16 w-16 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border border-dashed border-[var(--celestial-starlight)]/10"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-1 rounded-full border border-dotted border-[var(--celestial-dawn)]/10"
          />
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-starlight)]/5 text-[var(--celestial-starlight)]">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <Presentation className="h-5 w-5" />
            </motion.div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-lg font-extrabold tracking-tight text-[var(--celestial-starlight)]">
            课件已凝结为星图
          </h2>
          <p className="mt-1 text-sm text-[var(--celestial-starlight)]/40">{fileName}</p>
        </div>

        {/* File container */}
        <div className="w-full rounded-xl celestial-panel p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--celestial-dawn)]/15 bg-[var(--celestial-dawn)]/5 text-[var(--celestial-dawn)] flex-shrink-0">
            <Presentation className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-medium text-[var(--celestial-starlight)]/80 truncate">
              {fileName}
            </p>
            <p className="text-[10px] font-mono text-[var(--celestial-starlight)]/25">
              FORMAT: PPTX
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex gap-3">
          <motion.button
            onClick={onDownload}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex-1 h-10 overflow-hidden rounded-xl border border-[var(--celestial-dawn)]/30 bg-[var(--celestial-dawn)]/5 text-sm font-semibold text-[var(--celestial-dawn)] transition-all duration-300 hover:border-[var(--celestial-dawn)]/50 hover:bg-[var(--celestial-dawn)]/10"
          >
            <div className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-[var(--celestial-dawn)]/10 to-transparent transition-transform duration-700 group-hover:translate-x-[100%]" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Download className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
              下载课件
            </span>
          </motion.button>

          <motion.button
            onClick={onRegenerate}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex-1 h-10 overflow-hidden rounded-xl border border-[var(--celestial-starlight)]/15 bg-transparent text-sm font-semibold text-[var(--celestial-starlight)]/60 transition-all duration-300 hover:border-[var(--celestial-starlight)]/30 hover:text-[var(--celestial-starlight)]/80"
          >
            <div
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent, rgba(245,230,200,0.1), transparent)',
              }}
            />
            <span className="relative z-10 flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4 transition-transform duration-500 group-hover:-rotate-180" />
              重新生成
            </span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
