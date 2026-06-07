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
      <span className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        讲解形象
      </span>
      <div className="flex flex-col gap-1">
        {avatars.map((avatar) => {
          const active = avatar.id === selectedId;
          return (
            <button
              key={avatar.id}
              onClick={() => onSelect(avatar.id)}
              title={avatar.personality}
              className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-300 ${
                active
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50/50 ring-1 ring-blue-200/60 shadow-sm shadow-blue-100/50'
                  : 'hover:bg-slate-50/80'
              }`}
            >
              <div className="relative flex-shrink-0">
                <img
                  src={avatar.avatarUrl}
                  alt={avatar.name}
                  className={`h-9 w-9 flex-shrink-0 rounded-full object-cover transition-all duration-300 ${
                    active
                      ? 'ring-2 ring-blue-400/40 ring-offset-2 ring-offset-white shadow-md shadow-blue-100'
                      : 'group-hover:scale-110 group-hover:shadow-md'
                  }`}
                />
                {active && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-white shadow-sm">
                    <svg className="h-2 w-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className={`truncate text-[13px] font-bold transition-colors ${
                  active ? 'text-blue-700' : 'text-slate-600'
                }`}>
                  {avatar.name}
                </span>
                <span className="truncate text-[10px] text-slate-400">
                  {avatar.personality.slice(0, 12)}…
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
