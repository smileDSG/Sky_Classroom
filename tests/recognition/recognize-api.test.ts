import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

const llmState = vi.hoisted(() => ({ shouldFail: false, responseText: '' }));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockImplementation(async () => {
    if (llmState.shouldFail) throw new Error('LLM挂了');
    return { text: llmState.responseText || '解方程 $x^2+2x+1=0$' };
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  test('识别结果包含 LaTeX', async () => {
    llmState.responseText = '$\\frac{1}{2} + \\frac{1}{3}$';
    const req = makeReq(makeFile('image/png', 2048));
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.latex).toBeDefined();
  });

  test('无视觉提供商时返回 500', async () => {
    const saveGlm = process.env.GLM_API_KEY;
    const saveQwen = process.env.QWEN_API_KEY;
    const saveAnthro = process.env.ANTHROPIC_API_KEY;
    delete (process.env as any).GLM_API_KEY;
    delete (process.env as any).QWEN_API_KEY;
    delete (process.env as any).ANTHROPIC_API_KEY;

    const req = makeReq(makeFile('image/png', 1024));
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain('没有配置');

    if (saveGlm) process.env.GLM_API_KEY = saveGlm;
    if (saveQwen) process.env.QWEN_API_KEY = saveQwen;
    if (saveAnthro) process.env.ANTHROPIC_API_KEY = saveAnthro;
  });
});
