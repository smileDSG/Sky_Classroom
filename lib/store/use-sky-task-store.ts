/**
 * Global task store for Sky Classroom.
 *
 * Keeps long-running tasks (solve, generate, export) alive across page
 * navigation. Each tab component reads from this store on mount to
 * restore active task state and display progress.
 */
import { create } from 'zustand';

export type TaskStatus = 'idle' | 'running' | 'done' | 'error';

export interface ActiveTask {
  type: 'solve' | 'generate' | 'export';
  status: TaskStatus;
  message?: string;
  startedAt: number;
  abortController?: AbortController;
}

interface SkyTaskState {
  activeTask: ActiveTask | null;
  setTask: (task: ActiveTask | null) => void;
  abortTask: () => void;
}

export const useSkyTaskStore = create<SkyTaskState>((set) => ({
  activeTask: null,
  setTask: (task) => set({ activeTask: task }),
  abortTask: () =>
    set((state) => {
      state.activeTask?.abortController?.abort();
      return { activeTask: null };
    }),
}));
