import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const taskState = vi.hoisted(() => ({
  activeSolveTaskId: null as string | null,
  tasks: {} as Record<string, unknown>,
  setActiveSolveTask: vi.fn(),
  updateTask: vi.fn(),
  addTask: vi.fn(),
}));

vi.mock('@/lib/store/use-task-store', () => {
  const useTaskStore = Object.assign(
    (selector: (state: typeof taskState) => unknown) => selector(taskState),
    { getState: () => taskState },
  );
  return { useTaskStore };
});

vi.mock('@/lib/store/use-sky-classroom-store', () => ({
  useSkyClassroomStore: (selector: (state: { addMistake: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ addMistake: vi.fn() }),
}));

vi.mock('@/components/sky/solve/multimodal-input', () => ({
  MultimodalInput: ({ onSubmit }: { onSubmit: (input: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({
          type: 'image',
          content: new File([new Uint8Array(1024)], 'handwriting.png', {
            type: 'image/png',
          }),
          previewUrl: 'data:image/png;base64,dGVzdA==',
        })
      }
    >
      上传手写题
    </button>
  ),
}));

vi.mock('@/components/sky/solve/grade-result', () => ({ GradeResultCard: () => null }));
vi.mock('@/components/sky/solve/solution-panel', () => ({ SolutionPanel: () => null }));
vi.mock('@/components/sky/solve/similar-problems', () => ({ SimilarProblems: () => null }));
vi.mock('@/components/sky/solve/history-panel', () => ({ HistoryPanel: () => null }));
vi.mock('@/components/sky/solve/solution-skeleton', () => ({ SolutionSkeleton: () => null }));
vi.mock('@/components/sky/solve/math-renderer', () => ({
  MathRenderer: ({ content }: { content: string }) => <span>{content}</span>,
}));

import { SolvePage } from '@/components/sky/solve/solve-page';

describe('handwriting recognition confirmation in the existing solve page', () => {
  beforeEach(() => {
    taskState.activeSolveTaskId = null;
    taskState.tasks = {};
    taskState.setActiveSolveTask.mockReset();
    taskState.updateTask.mockReset();
    taskState.addTask.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          text: '解方程 $x+1=2$',
          latex: ['x+1=2'],
          confidence: 0.62,
          ambiguities: [
            { field: 'stem', candidates: ['1', 'l'], reason: '手写字符不清晰' },
          ],
          needsConfirmation: true,
        }),
      }),
    );
  });

  test('pauses low-confidence handwriting before creating a solve task', async () => {
    render(<SolvePage />);

    fireEvent.click(screen.getByRole('button', { name: '上传手写题' }));

    expect(await screen.findByText('请核对识别结果')).toBeInTheDocument();
    expect(screen.getByDisplayValue('解方程 $x+1=2$')).toBeInTheDocument();
    await waitFor(() => expect(taskState.addTask).not.toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
