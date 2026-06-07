/**
 * Background Task Store — enables multi-feature parallel work.
 *
 * Tracks all running background tasks (solve, slides generation, etc.)
 * so users can submit a task and continue using other features while
 * it completes. Completed tasks hold their results for later retrieval.
 */

import { create } from 'zustand';

export type TaskType = 'solve' | 'slides' | 'pptx' | 'general' | 'quiz' | 'write' | 'translate' | 'memory';
export type TaskStatus = 'running' | 'completed' | 'failed';

export interface BackgroundTask {
  id: string;
  type: TaskType;
  label: string;
  status: TaskStatus;
  progress: number; // 0-100
  phase: string;
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: string;
  jobId?: string;
  resultRoute?: string;
  previewUrl?: string; // data URL of uploaded image (survives navigation)
  recognizedText?: string;
}

interface TaskStore {
  tasks: Record<string, BackgroundTask>;
  dismissedIds: Set<string>;
  /** The single active solve task ID — survives navigation */
  activeSolveTaskId: string | null;
  /** AbortControllers for in-flight tasks — survives navigation */
  abortControllers: Map<string, AbortController>;

  addTask: (task: BackgroundTask) => void;
  updateTask: (id: string, update: Partial<BackgroundTask>) => void;
  removeTask: (id: string) => void;
  dismissTask: (id: string) => void;
  setActiveSolveTask: (id: string | null) => void;
  getTask: (id: string) => BackgroundTask | undefined;
  registerAbortController: (id: string, controller: AbortController) => void;
  abortTask: (id: string) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: {},
  dismissedIds: new Set<string>(),
  activeSolveTaskId: null,
  abortControllers: new Map<string, AbortController>(),

  addTask: (task) => {
    console.log('[TaskStore] addTask:', { id: task.id, type: task.type, status: task.status });
    set((s) => ({
      tasks: { ...s.tasks, [task.id]: { ...task, updatedAt: Date.now() } },
    }));
  },

  updateTask: (id, update) =>
    set((s) => {
      const existing = s.tasks[id];
      if (!existing) return s;
      return {
        tasks: {
          ...s.tasks,
          [id]: { ...existing, ...update, updatedAt: Date.now() },
        },
      };
    }),

  removeTask: (id) => {
    console.log('[TaskStore] removeTask:', id);
    // Abort any in-flight request for this task
    const ctrl = get().abortControllers.get(id);
    if (ctrl) {
      ctrl.abort();
      get().abortControllers.delete(id);
    }
    set((s) => {
      const next = { ...s.tasks };
      delete next[id];
      const dismissed = new Set(s.dismissedIds);
      dismissed.delete(id);
      return { tasks: next, dismissedIds: dismissed };
    });
  },

  dismissTask: (id) =>
    set((s) => {
      const dismissed = new Set(s.dismissedIds);
      dismissed.add(id);
      return { dismissedIds: dismissed };
    }),

  setActiveSolveTask: (id) => set({ activeSolveTaskId: id }),

  getTask: (id) => get().tasks[id],

  registerAbortController: (id, controller) => {
    get().abortControllers.set(id, controller);
  },

  abortTask: (id) => {
    const ctrl = get().abortControllers.get(id);
    if (ctrl) {
      ctrl.abort();
      get().abortControllers.delete(id);
    }
  },
}));
