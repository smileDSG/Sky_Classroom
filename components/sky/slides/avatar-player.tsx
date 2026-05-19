'use client';

import type { AvatarConfig, AvatarSpeech } from '@/lib/slides/types';

export interface AvatarPlayerProps {
  avatar: AvatarConfig | null;
  speech: AvatarSpeech | null;
}

export function AvatarPlayer({ avatar, speech }: AvatarPlayerProps) {
  if (!avatar) return null;

  const hasSpeech = speech && speech.segments.length > 0;

  return (
    <div className="absolute bottom-6 right-6 z-20 flex items-end gap-3">
      {hasSpeech && (
        <div className="max-w-[280px] rounded-2xl rounded-br-md border border-white/20 bg-white/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-blue-600">
              {avatar.name}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            {speech.segments[0]?.text}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-0.5 animate-pulse rounded-full bg-blue-500/60"
                  style={{
                    height: `${6 + i * 3}px`,
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '0.8s',
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-slate-400">讲解中</span>
          </div>
        </div>
      )}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/20" />
        <img
          src={avatar.avatarUrl}
          alt={avatar.name}
          className="relative h-14 w-14 rounded-full border-2 border-white object-cover shadow-xl"
        />
      </div>
    </div>
  );
}
