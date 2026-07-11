'use client';

import { useState, useCallback, useEffect } from 'react';
import { useStageStore } from '@/lib/store';
import { SceneRenderer } from '@/components/stage/scene-renderer';
import { MobileClassroomShell } from './mobile-classroom-shell';
import { MobileSlideViewport } from './mobile-slide-viewport';
import { MobilePlaybackBar } from './mobile-playback-bar';
import { MobileSceneDrawer } from './mobile-scene-drawer';
import { MobileScriptSheet } from './mobile-script-sheet';
import { useMobileClassroom } from './use-mobile-classroom';
import { useMobilePlayback } from './use-mobile-playback';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight, List } from 'lucide-react';

interface MobileClassroomPlayerProps {
  classroomId: string;
}

export function MobileClassroomPlayer({ classroomId }: MobileClassroomPlayerProps) {
  const { loading, error, retry, scenes, currentScene, currentIndex, goToScene, goNext, goPrev } =
    useMobileClassroom(classroomId);

  const stage = useStageStore((s) => s.stage);
  const { mode, currentSpeech, transcript, isMuted, toggleMute, playPause, stop } =
    useMobilePlayback(currentScene);

  const [sceneDrawerOpen, setSceneDrawerOpen] = useState(false);
  const [scriptSheetOpen, setScriptSheetOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handleChange = () => setIsLandscape(mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const isSlideScene = currentScene?.type === 'slide';
  const immersiveSlide = isSlideScene && isLandscape;

  // Stop playback when switching scenes
  const handleGoToScene = useCallback(
    (id: string) => {
      stop();
      goToScene(id);
    },
    [goToScene, stop],
  );

  const handleGoNext = useCallback(() => {
    stop();
    goNext();
  }, [goNext, stop]);

  const handleGoPrev = useCallback(() => {
    stop();
    goPrev();
  }, [goPrev, stop]);

  if (loading) {
    return (
      <MobileClassroomShell>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-sky-400" />
        </div>
      </MobileClassroomShell>
    );
  }

  if (error) {
    return (
      <MobileClassroomShell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <AlertTriangle className="size-12 text-red-400" />
          <p className="mt-4 text-sm text-slate-300">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 rounded-2xl bg-sky-500 px-6 py-2.5 text-sm font-bold text-white"
          >
            重试
          </button>
        </div>
      </MobileClassroomShell>
    );
  }

  return (
    <MobileClassroomShell title={stage?.name || '课堂播放'} hideHeader={immersiveSlide}>
      {isSlideScene ? (
        immersiveSlide ? (
          <div className="relative flex flex-1 bg-black">
            <div className="flex flex-1 items-center justify-center">
              <MobileSlideViewport scene={currentScene} onTap={playPause} fillScreen />
            </div>

            {/* Floating page indicator */}
            <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
              {currentIndex + 1} / {scenes.length}
            </div>

            {/* Floating playback bar */}
            <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/70 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-2xl backdrop-blur-md">
              <MobilePlaybackBar
                mode={mode}
                currentIndex={currentIndex}
                totalScenes={scenes.length}
                isMuted={isMuted}
                onPlayPause={playPause}
                onPrev={handleGoPrev}
                onNext={handleGoNext}
                onToggleMute={toggleMute}
                onOpenScenes={() => setSceneDrawerOpen(true)}
                onOpenScript={() => setScriptSheetOpen(true)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center px-4 pb-28 pt-4">
            <MobileSlideViewport scene={currentScene} onTap={playPause} />

            {currentScene && (
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-white">
                  {currentIndex + 1}. {currentScene.title || '未命名场景'}
                </p>
                {currentSpeech && (
                  <p className="mt-1 line-clamp-2 text-xs text-sky-300">{currentSpeech}</p>
                )}
              </div>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            {currentScene ? (
              <SceneRenderer scene={currentScene} mode="playback" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                暂无场景
              </div>
            )}
          </div>

          {/* Minimal bottom bar for non-slide scenes */}
          <div className="border-t border-white/10 bg-[#0d1728]/95 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-2xl backdrop-blur-xl">
            <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4">
              <button
                type="button"
                onClick={handleGoPrev}
                disabled={currentIndex <= 0}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-200 transition-colors active:bg-white/10 disabled:text-slate-600"
                aria-label="上一场景"
              >
                <ChevronLeft className="size-5" />
                上一场景
              </button>

              <button
                type="button"
                onClick={() => setSceneDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors active:bg-white/10"
                aria-label="场景列表"
              >
                <List className="size-4" />
                {currentIndex + 1} / {scenes.length}
              </button>

              <button
                type="button"
                onClick={handleGoNext}
                disabled={currentIndex >= scenes.length - 1}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-200 transition-colors active:bg-white/10 disabled:text-slate-600"
                aria-label="下一场景"
              >
                下一场景
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!immersiveSlide && isSlideScene && (
        <MobilePlaybackBar
          mode={mode}
          currentIndex={currentIndex}
          totalScenes={scenes.length}
          isMuted={isMuted}
          onPlayPause={playPause}
          onPrev={handleGoPrev}
          onNext={handleGoNext}
          onToggleMute={toggleMute}
          onOpenScenes={() => setSceneDrawerOpen(true)}
          onOpenScript={() => setScriptSheetOpen(true)}
        />
      )}

      <MobileSceneDrawer
        open={sceneDrawerOpen}
        onOpenChange={setSceneDrawerOpen}
        scenes={scenes}
        currentSceneId={currentScene?.id ?? null}
        onSelect={handleGoToScene}
      />

      <MobileScriptSheet
        open={scriptSheetOpen}
        onOpenChange={setScriptSheetOpen}
        currentSpeech={currentSpeech}
        transcript={transcript}
      />
    </MobileClassroomShell>
  );
}
