import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const llmState = vi.hoisted(() => ({
  shouldFail: false,
  responseText: '',
  responses: [] as string[],
  callCount: 0,
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockImplementation(async () => {
    if (llmState.shouldFail) throw new Error('LLM挂了');
    const sequencedResponse = llmState.responses[llmState.callCount++];
    return { text: sequencedResponse ?? (llmState.responseText || '解方程 $x^2+2x+1=0$') };
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue({ model: {}, modelId: 'test', provider: 'glm' }),
}));

import { POST } from '@/app/api/sky/solve/recognize/route';

function makeFile(type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size).fill(65)], { type });
  return new File([blob], 'test.' + (type.split('/')[1] || 'png'), { type });
}

function makeReq(file: File | null): Request {
  const fd = new FormData();
  if (file) fd.append('image', file, (file as any).name || 'test.png');
  const req = new Request('http://localhost/api/sky/solve/recognize', { method: 'POST' });
  vi.spyOn(req, 'formData').mockResolvedValue(fd);
  return req;
}

describe('Recognize API 端点', () => {
  beforeEach(() => {
    llmState.shouldFail = false;
    llmState.responseText = '';
    llmState.responses = [];
    llmState.callCount = 0;
    vi.stubEnv('GLM_API_KEY', 'test-glm-key');
    vi.stubEnv('QWEN_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test('无图片时返回 400', async () => {
    const req = makeReq(null);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Missing required field');
  });

  test('不支持格式返回 400', async () => {
    const req = makeReq(makeFile('image/gif', 1024));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('超大文件返回 400', async () => {
    const req = makeReq(makeFile('image/png', 11 * 1024 * 1024));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('正常识别返回 200', async () => {
    llmState.responseText = '解方程 $x^2 + 2x + 1 = 0$';
    const req = makeReq(makeFile('image/png', 1024));
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.text).toBeDefined();
    expect(body.problemCount).toBeGreaterThanOrEqual(1);
  });

  test('返回结构化 ProblemSpec 并保留旧字段', async () => {
    llmState.responseText = JSON.stringify({
      problems: [
        {
          id: '1',
          stage: '高中',
          subject: '物理',
          questionType: 'single_choice',
          stem: '已知 $F=ma$，求加速度。',
          options: [
            { key: 'A', content: '1 m/s²' },
            { key: 'B', content: '2 m/s²' },
          ],
          givens: [],
          asks: ['加速度'],
          formulas: ['F=ma'],
          ambiguities: [],
          confidence: 0.92,
        },
      ],
    });

    const req = makeReq(makeFile('image/png', 1024));
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.structuredProblems).toHaveLength(1);
    expect(body.structuredProblems[0]).toMatchObject({
      subject: '物理',
      stem: '已知 $F=ma$，求加速度。',
      options: [
        { key: 'A', content: '1 m/s²' },
        { key: 'B', content: '2 m/s²' },
      ],
      confidence: 0.92,
    });
    expect(body.text).toBe('已知 $F=ma$，求加速度。\nA. 1 m/s²\nB. 2 m/s²');
    expect(body.latex).toBe('F=ma');
    expect(body.problemCount).toBe(1);
    expect(body.problems).toHaveLength(1);
    expect(body.problems[0]).toMatchObject({
      text: '已知 $F=ma$，求加速度。',
      latex: 'F=ma',
    });
    expect(body.usedModel).toBe('glm/glm-5v-turbo');
  });

  test('旧纯文本响应回退为空 structuredProblems', async () => {
    llmState.responseText = '解方程 $x^2 + 2x + 1 = 0$';

    const req = makeReq(makeFile('image/png', 1024));
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.text).toBe('解方程 $x^2 + 2x + 1 = 0$');
    expect(body.latex).toBe('x^2 + 2x + 1 = 0');
    expect(body.structuredProblems).toEqual([]);
    expect(body.problemCount).toBe(1);
    expect(body.problems).toHaveLength(1);
    expect(body.problems[0]).toMatchObject({
      text: '解方程 $x^2 + 2x + 1 = 0$',
      latex: 'x^2 + 2x + 1 = 0',
    });
    expect(body.usedModel).toBe('glm/glm-5v-turbo');
  });

  test('首个模型返回畸形 ProblemSpec 时尝试下一视觉模型', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
    vi.stubEnv('GLM_API_KEY', 'test-glm-key');
    llmState.responses = [
      JSON.stringify({
        problems: [
          {
            id: 'broken',
            stage: '高中',
            subject: '物理',
            questionType: 'calculation',
          },
        ],
      }),
      JSON.stringify({
        problems: [
          {
            id: 'valid',
            stage: '高中',
            subject: '物理',
            questionType: 'calculation',
            stem: '质量为 2 kg 的物体受 4 N 合力，求加速度。',
            options: [],
            givens: [],
            asks: ['加速度'],
            formulas: ['F=ma'],
            ambiguities: [],
            confidence: 0.95,
          },
        ],
      }),
    ];

    const req = makeReq(makeFile('image/png', 1024));
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(llmState.callCount).toBe(2);
    expect(body.usedModel).toBe('glm/glm-5v-turbo');
    expect(body.text).toBe('质量为 2 kg 的物体受 4 N 合力，求加速度。');
    expect(body.text).not.toContain('"id":"broken"');
    expect(body.structuredProblems).toHaveLength(1);
    expect(body.structuredProblems[0]).toMatchObject({
      id: 'valid',
      subject: '物理',
      confidence: 0.95,
    });
  });

  test('首个模型返回空 problems 时尝试下一视觉模型', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
    vi.stubEnv('GLM_API_KEY', 'test-glm-key');
    llmState.responses = [
      JSON.stringify({ problems: [] }),
      JSON.stringify({
        problems: [
          {
            id: 'valid-after-empty',
            stage: '高中',
            subject: '数学',
            questionType: 'calculation',
            stem: '解方程 $x+1=2$。',
            options: [],
            givens: [],
            asks: ['x'],
            formulas: ['x+1=2'],
            ambiguities: [],
            confidence: 0.98,
          },
        ],
      }),
    ];

    const req = makeReq(makeFile('image/png', 1024));
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(llmState.callCount).toBe(2);
    expect(body.usedModel).toBe('glm/glm-5v-turbo');
    expect(body.text).toBe('解方程 $x+1=2$。');
    expect(body.text).not.toContain('"problems":[]');
    expect(body.structuredProblems).toHaveLength(1);
    expect(body.structuredProblems[0].id).toBe('valid-after-empty');
  });

  test('以 [?] 开头的旧纯文本仍按 legacy OCR 返回', async () => {
    llmState.responseText = '[?] 题目局部模糊，但可识别公式 $x+1=2$';

    const req = makeReq(makeFile('image/png', 1024));
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(llmState.callCount).toBe(1);
    expect(body.text).toBe('[?] 题目局部模糊，但可识别公式 $x+1=2$');
    expect(body.latex).toBe('x+1=2');
    expect(body.structuredProblems).toEqual([]);
    expect(body.usedModel).toBe('glm/glm-5v-turbo');
  });

  test('识别结果包含 LaTeX', async () => {
    llmState.responseText = '$\\frac{1}{2} + \\frac{1}{3}$';
    const req = makeReq(makeFile('image/png', 2048));
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.latex).toBeDefined();
  });

  test('无视觉提供商时返回 500', async () => {
    vi.stubEnv('GLM_API_KEY', '');
    vi.stubEnv('QWEN_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    const req = makeReq(makeFile('image/png', 1024));
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain('没有配置');
  });
});
