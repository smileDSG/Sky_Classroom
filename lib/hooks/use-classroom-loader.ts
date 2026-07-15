'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStageStore } from '@/lib/store';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { shouldUseServerClassroom } from '@/lib/classroom/server-classroom-sync';
import { createLogger } from '@/lib/logger';
import type { Scene, Stage as ClassroomStage } from '@/lib/types/stage';

const log = createLogger('useClassroomLoader');

interface ServerClassroomPayload {
  id?: string;
  stage: ClassroomStage;
  scenes: Scene[];
  createdAt?: string;
  updatedAt?: string;
}

interface UseClassroomLoaderReturn {
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useClassroomLoader(classroomId: string): UseClassroomLoaderReturn {
  const { loadFromStorage } = useStageStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClassroom = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      await loadFromStorage(classroomId);

      try {
        const res = await fetch(`/api/classroom?id=${encodeURIComponent(classroomId)}`, {
          cache: 'no-store',
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          const classroom = json.classroom as ServerClassroomPayload | undefined;
          const localStage = useStageStore.getState().stage;

          if (json.success && classroom && shouldUseServerClassroom(classroom, localStage)) {
            const { stage, scenes } = classroom;
            const localCurrentSceneId = useStageStore.getState().currentSceneId;
            const nextCurrentSceneId = scenes.some((scene) => scene.id === localCurrentSceneId)
              ? localCurrentSceneId
              : (scenes[0]?.id ?? null);
            useStageStore.setState((state) => ({
              stage,
              scenes,
              currentSceneId: nextCurrentSceneId,
              chats: [],
              outlines: [],
              generatingOutlines: [],
              generationEpoch: state.generationEpoch + 1,
              generationStatus: 'idle' as const,
              currentGeneratingOrder: -1,
              failedOutlines: [],
            }));
            await useStageStore.getState().saveToStorage();
            log.info('Loaded from server-side storage:', classroomId);

            if (stage.generatedAgentConfigs?.length) {
              const { saveGeneratedAgents } = await import('@/lib/orchestration/registry/store');
              await saveGeneratedAgents(stage.id, stage.generatedAgentConfigs);
              log.info('Hydrated server-generated agents for stage:', stage.id);
            }
          }
        }
      } catch (fetchErr) {
        log.warn('Server-side storage fetch failed:', fetchErr);
      }

      await useMediaGenerationStore.getState().restoreFromDB(classroomId);

      const { loadGeneratedAgentsForStage, useAgentRegistry } = await import(
        '@/lib/orchestration/registry/store'
      );
      const generatedAgentIds = await loadGeneratedAgentsForStage(classroomId);
      const { useSettingsStore } = await import('@/lib/store/settings');
      if (generatedAgentIds.length > 0) {
        useSettingsStore.getState().setAgentMode('auto');
        useSettingsStore.getState().setSelectedAgentIds(generatedAgentIds);
      } else {
        const stage = useStageStore.getState().stage;
        const stageAgentIds = stage?.agentIds;
        const registry = useAgentRegistry.getState();
        const cleanIds = stageAgentIds?.filter((id) => {
          const a = registry.getAgent(id);
          return a && !a.isGenerated;
        });
        useSettingsStore.getState().setAgentMode('preset');
        useSettingsStore
          .getState()
          .setSelectedAgentIds(
            cleanIds && cleanIds.length > 0 ? cleanIds : ['default-1', 'default-2', 'default-3'],
          );
      }
    } catch (err) {
      log.error('Failed to load classroom:', err);
      setError(err instanceof Error ? err.message : 'Failed to load classroom');
    } finally {
      setLoading(false);
    }
  }, [classroomId, loadFromStorage]);

  useEffect(() => {
    loadClassroom();
  }, [loadClassroom]);

  return { loading, error, retry: loadClassroom };
}
