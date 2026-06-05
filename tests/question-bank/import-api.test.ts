import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/sky/question-bank/import/route';

function mockRequestWithFile(file: File): NextRequest {
  const formData = new FormData();
  formData.append('file', file);
  return {
    formData: async () => formData,
  } as unknown as NextRequest;
}

describe('Import API (format detection)', () => {
  it('rejects request without file', async () => {
    const req = {
      formData: async () => new FormData(),
    } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('file');
  });

  it('rejects oversized file', async () => {
    const largeFile = new File([new ArrayBuffer(51 * 1024 * 1024)], 'big.json');
    const req = mockRequestWithFile(largeFile);
    const res = await POST(req);
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('大小超过限制');
  });

  it('rejects unknown format', async () => {
    const file = new File(['hello world'], 'unknown.txt');
    const req = mockRequestWithFile(file);
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('无法识别文件格式');
  });
});
