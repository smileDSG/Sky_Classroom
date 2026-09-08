import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/sky/slides/suggest-cover/route';
import { NextRequest } from 'next/server';
import { renderCoverPptx } from '@/lib/slides/agent/cover-renderer';
import { convertPptxToPng } from '@/lib/slides/agent/png-converter';

// Mock dependencies
vi.mock('@/lib/server/resolve-model', () => ({
  resolveModelFromRequest: vi.fn().mockResolvedValue({
    model: { modelId: 'deepseek-v4-pro', provider: 'deepseek' },
    modelString: 'deepseek:deepseek-v4-pro',
  }),
}));

vi.mock('@/lib/slides/agent/suggest-cover-agent', () => ({
  suggestCoverStyle: vi.fn().mockResolvedValue({
    success: true,
    designDNA: {
      styleName: '科技深蓝',
      recommended: true,
      colors: {
        coverBg: '0F1D3D',
        contentBg: 'F8FAFE',
        accent: '00D4FF',
        accentSecondary: '3B82F6',
        accentLight: 'E8F4FF',
        textPrimary: '1E293B',
        textBody: '475569',
        textMuted: '94A3B8',
        textOnDark: 'FFFFFF',
      },
      fonts: {
        heading: 'Microsoft YaHei',
        body: 'Microsoft YaHei',
        en: 'Georgia',
        headingSize: 52,
        pageTitleSize: 34,
        bodySize: 13,
        captionSize: 10,
      },
      decoration: { motif: 'geometric-lines', density: 'moderate', cornerWeight: 'top-right' },
      components: {
        cardStyle: 'accent-left-bar',
        bulletStyle: 'dot',
        pageNumberStyle: 'number-slash-total',
      },
      layoutType: 'hero-left',
      mood: '科技冷静',
      bestFor: ['物理', '化学'],
    },
    alternatives: [
      {
        paletteId: 'forest-moss',
        fontId: 'georgia-calibri',
        layoutType: 'hero-left',
        density: 'moderate',
        mood: '自然清新',
        styleName: '森林绿',
      },
    ],
  }),
}));

vi.mock('@/lib/slides/agent/cover-renderer', () => ({
  renderCoverPptx: vi.fn().mockResolvedValue({
    success: true,
    pptxPath: '/tmp/test-cover.pptx',
  }),
}));

vi.mock('@/lib/slides/agent/png-converter', () => ({
  convertPptxToPng: vi.fn().mockResolvedValue({
    success: true,
    pngPath: '/tmp/test-cover.png',
  }),
}));

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
});

describe('POST /api/sky/slides/suggest-cover', () => {
  beforeEach(() => {
    vi.mocked(renderCoverPptx).mockResolvedValue({
      success: true,
      pptxPath: '/tmp/test-cover.pptx',
    });
    vi.mocked(convertPptxToPng).mockResolvedValue({
      success: true,
      pngPath: '/tmp/test-cover.png',
    });
  });

  function makeRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost/api/sky/slides/suggest-cover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 400 when topic is missing', async () => {
    const req = makeRequest({ difficulty: '高中' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('returns 400 when topic is empty', async () => {
    const req = makeRequest({ topic: '   ', difficulty: '高中' });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('returns cover + alternatives on success', async () => {
    const req = makeRequest({ topic: '光合作用', difficulty: '高中' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.cover).toBeDefined();
    expect(data.cover.designDNA).toBeDefined();
    expect(data.cover.designDNA.styleName).toBe('科技深蓝');
    expect(data.alternatives).toBeInstanceOf(Array);
    expect(data.alternatives.length).toBeGreaterThan(0);
  });

  it('returns the recommendation when LibreOffice preview conversion is unavailable', async () => {
    vi.mocked(convertPptxToPng).mockResolvedValueOnce({
      success: false,
      error: 'LibreOffice not found. Install it, then restart the app.',
    });

    const req = makeRequest({ topic: '光合作用', difficulty: '高中' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.cover.designDNA).toBeDefined();
    expect(data.cover.pngUrl).toBeNull();
    expect(data.cover.previewAvailable).toBe(false);
    expect(data.cover.previewError).toContain('LibreOffice not found');
  });

  it('uses default difficulty when not provided', async () => {
    const req = makeRequest({ topic: '光合作用' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
