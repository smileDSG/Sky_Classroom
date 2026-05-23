'use client';

import type { AvatarConfig } from '@/lib/slides/types';

export interface AvatarSelectorProps {
  avatars: AvatarConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function AvatarSelector({ avatars, selectedId, onSelect }: AvatarSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        讲解形象
      </span>
      <div className="scrollbar-hide -mx-1 flex max-h-[200px] flex-col gap-1.5 overflow-y-auto">
        {avatars.map((avatar) => {
          const active = avatar.id === selectedId;
          return (
            <button
              key={avatar.id}
              onClick={() => onSelect(avatar.id)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                active
                  ? 'bg-blue-50 ring-1 ring-blue-200/50 shadow-sm'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={avatar.avatarUrl}
                  alt={avatar.name}
                  className={`h-10 w-10 rounded-full object-cover transition-shadow ${
                    active ? 'ring-2 ring-blue-400/30 ring-offset-2' : ''
                  }`}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className={`truncate text-sm font-semibold transition-colors ${
                  active ? 'text-blue-700' : 'text-slate-700'
                }`}>
                  {avatar.name}
                </div>
                <div className="truncate text-[11px] leading-tight text-slate-400">
                  {avatar.personality.slice(0, 20)}…
                </div>
              </div>
              {active && (
                <div className="flex-shrink-0 rounded-full bg-blue-600 p-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
