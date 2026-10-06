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

// script 未加载前给 hook 一个空壳避免条件调用 hook——此时页面处于 loading 分支
const FALLBACK_SCRIPT: AnimationScript = {
  id: 'loading',
  title: '',
  topic: '',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [],
  steps: [{ id: 's0', title: '', narration: '', actorStates: [{ actorId: 'none', x: 0, y: 0 }] }],
};

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

  const player = useAnimationPlayer(script ?? FALLBACK_SCRIPT);

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
