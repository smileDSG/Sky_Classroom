import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const responseState = vi.hoisted(() => ({ text: '' }));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockImplementation(async () => ({ text: responseState.text })),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue({ model: {}, modelId: 'test', provider: 'glm' }),
}));

import { POST } from '@/app/api/sky/solve/recognize/route';

function makeRequest(): Request {
  const file = new File([new Uint8Array(1024)], 'handwriting.png', { type: 'image/png' });
  const formData = new FormData();
  formData.append('image', file);
  const request = new Request('http://localhost/api/sky/solve/recognize', { method: 'POST' });
  vi.spyOn(request, 'formData').mockResolvedValue(formData);
  return request;
}

describe('handwriting recognition quality response', () => {
  beforeEach(() => {
    vi.stubEnv('GLM_API_KEY', 'test-key');
    vi.stubEnv('QWEN_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test('requires confirmation when handwriting confidence is low or ambiguous', async () => {
    responseState.text = JSON.stringify({
      problems: [
        {
          id: '1',
          stage: '高中',
          subject: '数学',
          questionType: 'calculation',
          stem: '解方程 $x+1=2$',
          options: [],
          givens: [],
          asks: ['x'],
          formulas: ['x+1=2'],
          ambiguities: [{ field: 'stem', candidates: ['1', 'l'], reason: '手写字符不清晰' }],
          confidence: 0.62,
        },
      ],
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.confidence).toBe(0.62);
    expect(body.ambiguities).toHaveLength(1);
    expect(body.needsConfirmation).toBe(true);
  });

  test('allows clear high-confidence handwriting to continue automatically', async () => {
    responseState.text = JSON.stringify({
      problems: [
        {
          id: '1',
          stage: '高中',
          subject: '物理',
          questionType: 'calculation',
          stem: '已知 $F=ma$，求加速度',
          options: [],
          givens: [],
          asks: ['加速度'],
          formulas: ['F=ma'],
          ambiguities: [],
          confidence: 0.94,
        },
      ],
    });

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(body.confidence).toBe(0.94);
    expect(body.ambiguities).toEqual([]);
    expect(body.needsConfirmation).toBe(false);
  });
});
