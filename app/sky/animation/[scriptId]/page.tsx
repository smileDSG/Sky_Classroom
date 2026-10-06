'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimationCanvas } from '@/components/animation/renderer/animation-canvas';
import { AnimationControls } from '@/components/animation/player/animation-controls';
import { SubtitleBar } from '@/components/animation/player/subtitle-bar';
import { useAnimationPlayer } from '@/components/animation/player/use-animation-player';
import { unwrap } from '@/lib/animation/client-api';
import type { AnimationScript } from '@/lib/animation/types';

export default function AnimationPlayerPage({ params }: { params: Promise<{ scriptId: string }> }) {
  const { scriptId } = use(params);
  const [script, setScript] = useState<AnimationScript | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/animation/scripts/${scriptId}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return;
        }
        const { script: s } = await unwrap<{ script: AnimationScript }>(r);
        if (!cancelled) setScript(s);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  if (notFound) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">讲解不存在或已被清理</p>
        <Button asChild variant="outline">
          <Link href="/sky/animation">返回动画讲解</Link>
        </Button>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <PlayerView key={script.id} script={script} />;
}

/**
 * 播放器视图。必须在 script 就绪后挂载：
 * useAnimationPlayer 内部 useReducer 的步数边界只在首次挂载时由传入脚本初始化，
 * 之后即使脚本 prop 替换，reducer 仍按挂载时的 totalSteps 钳制 next/seek/ended。
 * 因此这里由父级以 key={script.id} 控制挂载/重挂载，禁止在脚本未就绪时用占位脚本提前挂载。
 */
function PlayerView({ script }: { script: AnimationScript }) {
  const player = useAnimationPlayer(script);

  return (
    <div className="mx-auto flex h-svh w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/sky/animation" aria-label="返回">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">{script.title}</h1>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center">
        <AnimationCanvas script={script} stepIndex={player.stepIndex} />
      </main>

      <SubtitleBar step={player.currentStep} />
      <AnimationControls player={player} />
    </div>
  );
}
