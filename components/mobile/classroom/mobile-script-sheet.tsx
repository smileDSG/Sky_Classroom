'use client';

import { MobileSheet } from '@/components/mobile/ui/mobile-sheet';

interface TranscriptItem {
  id: string;
  text: string;
  role?: string;
  timestamp: number;
}

interface MobileScriptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSpeech: string | null;
  transcript: TranscriptItem[];
}

export function MobileScriptSheet({
  open,
  onOpenChange,
  currentSpeech,
  transcript,
}: MobileScriptSheetProps) {
  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title="讲稿"
      description="当前播放的讲解内容"
    >
      <div className="space-y-3">
        {currentSpeech && (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
            <p className="text-xs font-semibold text-sky-300">正在播放</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-100">{currentSpeech}</p>
          </div>
        )}

        {transcript.length === 0 && !currentSpeech && (
          <p className="py-8 text-center text-sm text-slate-500">还没有播放内容</p>
        )}

        <div className="space-y-2">
          {transcript.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-[#0d1728] p-3">
              {item.role && <p className="mb-1 text-xs font-medium text-sky-400">{item.role}</p>}
              <p className="text-sm leading-relaxed text-slate-200">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </MobileSheet>
  );
}
