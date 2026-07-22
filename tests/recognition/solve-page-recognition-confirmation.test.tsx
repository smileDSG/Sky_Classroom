import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const taskState = vi.hoisted(() => ({
  activeSolveTaskId: null as string | null,
  tasks: {} as Record<string, unknown>,
  setActiveSolveTask: vi.fn(),
  updateTask: vi.fn(),
  addTask: vi.fn(),
  registerAbortController: vi.fn(),
  abortTask: vi.fn(),
  abortControllers: new Map<string, AbortController>(),
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

vi.mock('@/lib/store/search-history', () => ({
  useSearchHistoryStore: {
    getState: () => ({ addRecord: vi.fn(), updateRecord: vi.fn() }),
  },
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

import { SolvePage, confirmRecognition } from '@/components/sky/solve/solve-page';

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
          ambiguities: [{ field: 'stem', candidates: ['1', 'l'], reason: '手写字符不清晰' }],
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

  test('submits edited text, image and confirmed ProblemSpec after confirmation', async () => {
    const problemSpec = {
      id: '1',
      stage: '高中',
      subject: '数学',
      questionType: 'calculation',
      stem: '解方程 $x+l=2$',
      options: [],
      givens: [],
      asks: ['x'],
      formulas: ['x+l=2'],
      ambiguities: [{ field: 'stem', candidates: ['1', 'l'], reason: '手写字符不清晰' }],
      materials: [],
      subQuestions: [],
      diagram: null,
      confidence: 0.62,
    };
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/recognize')) {
        return {
          ok: true,
          json: async () => ({
            text: problemSpec.stem,
            latex: ['x+l=2'],
            confidence: 0.62,
            ambiguities: problemSpec.ambiguities,
            needsConfirmation: true,
            problems: [
              {
                image: 'data:image/png;base64,b3JpZ2luYWw=',
                text: problemSpec.stem,
                latex: 'x+l=2',
              },
            ],
            structuredProblems: [problemSpec],
          }),
        } as Response;
      }
      if (url.endsWith('/api/sky/solve/jobs') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ data: { jobId: 'job-1' } }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            phase: 'done',
            done: true,
            status: 'completed',
            result: {
              solution: '',
              answer: '1',
              steps: [],
              knowledgePoints: [],
              similarQuestions: [],
              fromQuestionBank: false,
              solvingTime: 1,
            },
          },
        }),
      } as Response;
    });

    render(<SolvePage />);
    fireEvent.click(screen.getByRole('button', { name: '上传手写题' }));

    const editor = await screen.findByRole('textbox', { name: '识别结果' });
    fireEvent.change(editor, { target: { value: '解方程 $x+1=2$' } });
    fireEvent.click(screen.getByRole('button', { name: '确认并搜题' }));

    await waitFor(() => {
      const jobCall = vi
        .mocked(fetch)
        .mock.calls.find(
          ([url, init]) => String(url).endsWith('/api/sky/solve/jobs') && init?.method === 'POST',
        );
      expect(jobCall).toBeDefined();
      const payload = JSON.parse(String(jobCall?.[1]?.body));
      expect(payload).toMatchObject({
        problem: '解方程 $x+1=2$',
        problemImage: 'data:image/png;base64,b3JpZ2luYWw=',
        problemSpec: {
          stem: '解方程 $x+1=2$',
          confidence: 1,
          ambiguities: [],
        },
      });
    });
  });

  test('does not fabricate confirmation for ambiguities outside the editable text', () => {
    const problemSpec = {
      id: 'diagram-1',
      stage: '高中' as const,
      subject: '物理',
      questionType: 'calculation',
      stem: '求斜面上的加速度',
      options: [],
      givens: [],
      asks: ['加速度'],
      formulas: ['a=g\\sin\\theta'],
      ambiguities: [
        { field: 'diagram', candidates: ['θ=30°', 'θ=45°'], reason: '图形标注模糊' },
      ],
      materials: [],
      subQuestions: [],
      diagram: {
        type: 'incline',
        description: '斜面',
        labels: ['θ'],
        relations: [],
      },
      confidence: 0.62,
    };

    const confirmed = confirmRecognition(problemSpec, '求斜面上的加速度');
    expect(confirmed.ambiguities).toEqual(problemSpec.ambiguities);
    expect(confirmed.confidence).toBe(0.62);
  });
});
