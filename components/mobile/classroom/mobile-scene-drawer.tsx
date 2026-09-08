'use client';

import { MobileSheet } from '@/components/mobile/ui/mobile-sheet';
import { CheckCircle2, Presentation, HelpCircle, Puzzle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Scene } from '@/lib/types/stage';

interface MobileSceneDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenes: Scene[];
  currentSceneId: string | null;
  onSelect: (id: string) => void;
}

const TYPE_ICON: Record<Scene['type'], typeof Presentation> = {
  slide: Presentation,
  quiz: HelpCircle,
  interactive: Puzzle,
  pbl: Users,
};

const TYPE_LABEL: Record<Scene['type'], string> = {
  slide: '幻灯片',
  quiz: '测验',
  interactive: '互动',
  pbl: 'PBL',
};

export function MobileSceneDrawer({
  open,
  onOpenChange,
  scenes,
  currentSceneId,
  onSelect,
}: MobileSceneDrawerProps) {
  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      title="场景列表"
      description={`共 ${scenes.length} 个场景`}
    >
      <div className="space-y-2">
        {scenes.map((scene, index) => {
          const Icon = TYPE_ICON[scene.type];
          const active = scene.id === currentSceneId;

          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => {
                onSelect(scene.id);
                onOpenChange(false);
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                active
                  ? 'border-sky-500/30 bg-sky-500/10'
                  : 'border-white/10 bg-[#0d1728] hover:bg-[#172436]',
              )}
            >
              <div
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl',
                  active ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400',
                )}
              >
                {active ? <CheckCircle2 className="size-5" /> : <Icon className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-sm font-medium',
                    active ? 'text-sky-100' : 'text-slate-200',
                  )}
                >
                  {index + 1}. {scene.title || '未命名场景'}
                </p>
                <p className="text-xs text-slate-500">{TYPE_LABEL[scene.type]}</p>
              </div>
            </button>
          );
        })}
      </div>
    </MobileSheet>
  );
}
