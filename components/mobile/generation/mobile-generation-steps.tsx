'use client';

import {
  CheckCircle2,
  Loader2,
  FileText,
  Search,
  Clapperboard,
  ImageIcon,
  Volume2,
  Save,
} from 'lucide-react';

const STEPS = [
  { key: 'researching', icon: Search, label: '搜索资料' },
  { key: 'generating_outlines', icon: FileText, label: '生成大纲' },
  { key: 'generating_scenes', icon: Clapperboard, label: '生成场景' },
  { key: 'generating_media', icon: ImageIcon, label: '生成媒体' },
  { key: 'generating_tts', icon: Volume2, label: '生成语音' },
  { key: 'persisting', icon: Save, label: '保存课堂' },
] as const;

interface MobileGenerationStepsProps {
  step: string;
  scenesGenerated: number;
  totalScenes: number;
}

export function MobileGenerationSteps({
  step,
  scenesGenerated,
  totalScenes,
}: MobileGenerationStepsProps) {
  const isDone = (key: string) => {
    if (key === 'researching') {
      return [
        'generating_outlines',
        'awaiting_review',
        'generating_scenes',
        'generating_media',
        'generating_tts',
        'persisting',
        'completed',
      ].includes(step);
    }
    if (key === 'generating_outlines') {
      return [
        'awaiting_review',
        'generating_scenes',
        'generating_media',
        'generating_tts',
        'persisting',
        'completed',
      ].includes(step);
    }
    if (key === 'generating_scenes') {
      return ['generating_media', 'generating_tts', 'persisting', 'completed'].includes(step);
    }
    if (key === 'generating_media') {
      return ['generating_tts', 'persisting', 'completed'].includes(step);
    }
    if (key === 'generating_tts') {
      return ['persisting', 'completed'].includes(step);
    }
    if (key === 'persisting') {
      return ['completed'].includes(step);
    }
    return false;
  };

  const isActive = (key: string) => step === key;

  return (
    <section className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1728] p-4 shadow-xl">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        生成进度
      </h3>
      <div className="space-y-1">
        {STEPS.map(({ key, icon: Icon, label }) => {
          const active = isActive(key);
          const done = isDone(key);

          return (
            <div
              key={key}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                active ? 'bg-sky-500/10 text-sky-100' : done ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                  done
                    ? 'bg-green-500/15 text-green-400'
                    : active
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-slate-800 text-slate-600'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="size-4" />
                ) : active ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </div>
              <span className={`text-sm ${active ? 'font-medium' : ''}`}>{label}</span>
              {active && key === 'generating_scenes' && totalScenes > 0 && (
                <span className="ml-auto text-xs font-mono text-sky-400">
                  {scenesGenerated}/{totalScenes}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
