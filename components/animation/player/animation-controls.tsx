'use client';

import { Pause, Play, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UseAnimationPlayerReturn } from './use-animation-player';

export function AnimationControls({ player }: { player: UseAnimationPlayerReturn }) {
  const { status, stepIndex, totalSteps, speed, speedOptions } = player;
  const playing = status === 'playing';
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card p-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={player.prev}
        disabled={stepIndex === 0}
        aria-label="上一步"
      >
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button
        variant="default"
        size="icon"
        onClick={player.toggle}
        aria-label={playing ? '暂停' : '播放'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={player.next}
        disabled={stepIndex >= totalSteps - 1 && status === 'finished'}
        aria-label="下一步"
      >
        <SkipForward className="h-4 w-4" />
      </Button>
      {status === 'finished' ? (
        <Button variant="ghost" size="icon" onClick={player.toggle} aria-label="重播">
          <RotateCcw className="h-4 w-4" />
        </Button>
      ) : null}
      <input
        type="range"
        min={0}
        max={Math.max(0, totalSteps - 1)}
        step={1}
        value={stepIndex}
        onChange={(e) => player.seek(Number(e.target.value))}
        className="mx-2 flex-1 accent-primary"
        aria-label="进度"
      />
      <span className="min-w-16 text-center text-sm text-muted-foreground">
        {stepIndex + 1} / {totalSteps}
      </span>
      <div className="flex gap-1">
        {speedOptions.map((s) => (
          <button
            key={s}
            onClick={() => player.setSpeed(s)}
            className={cn(
              'rounded-md px-2 py-1 text-xs',
              speed === s
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
