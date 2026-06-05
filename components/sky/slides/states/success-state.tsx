'use client';

import { useEffect, useState } from 'react';
import { Download, RotateCcw, FileCheck } from 'lucide-react';
import { AmbientGlow } from '../design-system/ambient-glow';

interface SuccessStateProps {
  fileName?: string;
  pageCount?: number;
  onDownload: () => void;
  onRegenerate: () => void;
}

export function SuccessState({ fileName, pageCount, onDownload, onRegenerate }: SuccessStateProps) {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden">
      {/* Success ambient glow — themed purple instead of jarring green */}
      <AmbientGlow color="#a855f7" accentColor="#06b6d4" intensity="medium" variant="success" />

      {/* Animated checkmark */}
      <div className="relative">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-700"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05))',
            border: '1px solid rgba(168,85,247,0.2)',
            boxShadow: drawn ? '0 0 40px rgba(168,85,247,0.15), 0 0 80px rgba(168,85,247,0.05)' : '0 0 0px rgba(168,85,247,0)',
          }}
        >
          <svg
            className="h-10 w-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a855f7"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeDasharray={drawn ? undefined : 30}
              strokeDashoffset={drawn ? 0 : 30}
              style={{
                transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </svg>
        </div>
        {/* Ring expand on success */}
        {drawn && (
          <div className="absolute inset-0 rounded-2xl border-2 border-purple-400/30 animate-ring-expand" />
        )}
      </div>

      {/* Text */}
      <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
          课件生成成功
        </p>
        {fileName && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{fileName}</p>
        )}
        {pageCount && pageCount > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10">
            <FileCheck className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-medium text-primary">{pageCount} 页</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-3 animate-fade-in-up"
        style={{ animationDelay: '0.5s', animationFillMode: 'both' }}
      >
        <button
          onClick={onRegenerate}
          className="group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 hover:-translate-y-px hover:shadow-sm"
        >
          <RotateCcw className="h-4 w-4 transition-transform duration-300 group-hover:rotate-[-360deg]" />
          重新生成
        </button>
        <button
          onClick={onDownload}
          className="group inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px hover:shadow-lg active:translate-y-0"
          style={{
            background: 'linear-gradient(135deg, #9333ea, #06b6d4)',
            boxShadow: '0 4px 16px -4px rgba(147,51,234,0.4)',
          }}
        >
          <Download className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" />
          下载课件
        </button>
      </div>
    </div>
  );
}
