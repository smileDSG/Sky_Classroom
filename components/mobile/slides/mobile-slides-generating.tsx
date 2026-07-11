'use client';

import { Loader2 } from 'lucide-react';

interface MobileSlidesGeneratingProps {
  progress: number;
  status: string;
}

export function MobileSlidesGenerating({ progress, status }: MobileSlidesGeneratingProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-[22px] border border-white/10 bg-[#0d1728] p-6 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="url(#mobile-slides-progress)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - clamped / 100)}`}
                className="transition-all duration-500"
              />
              <defs>
                <linearGradient id="mobile-slides-progress" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          </div>
        </div>

        <p className="text-lg font-semibold text-white">{clamped.toFixed(0)}%</p>
        <p className="mt-2 text-sm text-slate-400">{status || '正在生成课件…'}</p>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-sky-500 transition-all duration-500"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </div>
  );
}
