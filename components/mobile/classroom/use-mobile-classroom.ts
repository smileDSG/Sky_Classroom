'use client';

import { useEffect } from 'react';
import { useClassroomLoader } from '@/lib/hooks/use-classroom-loader';
import { useStageStore } from '@/lib/store';

interface UseMobileClassroomReturn {
  loading: boolean;
  error: string | null;
  retry: () => void;
  scenes: ReturnType<typeof useStageStore.getState>['scenes'];
  currentScene: ReturnType<typeof useStageStore.getState>['scenes'][number] | null;
  currentIndex: number;
  goToScene: (id: string) => void;
  goNext: () => void;
  goPrev: () => void;
}

export function useMobileClassroom(classroomId: string): UseMobileClassroomReturn {
  const { loading, error, retry } = useClassroomLoader(classroomId);
  const scenes = useStageStore((s) => s.scenes);
  const currentSceneId = useStageStore((s) => s.currentSceneId);
  const setCurrentSceneId = useStageStore((s) => s.setCurrentSceneId);

  useEffect(() => {
    if (!loading && !error && scenes.length > 0 && !currentSceneId) {
      setCurrentSceneId(scenes[0].id);
    }
  }, [loading, error, scenes, currentSceneId, setCurrentSceneId]);

  const currentIndex = scenes.findIndex((s) => s.id === currentSceneId);
  const currentScene = currentIndex >= 0 ? scenes[currentIndex] : null;

  const goToScene = (id: string) => setCurrentSceneId(id);

  const goNext = () => {
    if (currentIndex >= 0 && currentIndex < scenes.length - 1) {
      setCurrentSceneId(scenes[currentIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentSceneId(scenes[currentIndex - 1].id);
    }
  };

  return {
    loading,
    error,
    retry,
    scenes,
    currentScene,
    currentIndex,
    goToScene,
    goNext,
    goPrev,
  };
}
