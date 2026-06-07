import { describe, expect, it } from 'vitest';
import {
  isImageIdReference,
  isGeneratedImageId,
  resolveImageIds,
  normalizeGeneratedVideoRefs,
} from '@/lib/generation/media-resolver';

/* eslint-disable @typescript-eslint/no-explicit-any */
type El = Record<string, any>;

function makeImageEl(id: string, src: string): El {
  return { type: 'image', id, src, left: 0, top: 0, width: 100, height: 100 };
}

function makeVideoEl(id: string, src: string, mediaRef?: string): El {
  const el: El = { type: 'video', id, src, left: 0, top: 0, width: 320, height: 240 };
  if (mediaRef) el.mediaRef = mediaRef;
  return el;
}

describe('isImageIdReference', () => {
  it('detects standard image ID references', () => {
    expect(isImageIdReference('img_1')).toBe(true);
    expect(isImageIdReference('img_42')).toBe(true);
    expect(isImageIdReference('IMG_1')).toBe(true);
  });

  it('returns false for data URIs', () => {
    expect(isImageIdReference('data:image/png;base64,abc123')).toBe(false);
  });

  it('returns false for HTTP URLs', () => {
    expect(isImageIdReference('http://example.com/img.png')).toBe(false);
    expect(isImageIdReference('https://example.com/img.png')).toBe(false);
  });

  it('returns false for path-like values', () => {
    expect(isImageIdReference('/images/cat.png')).toBe(false);
  });

  it('returns false for empty or falsy values', () => {
    expect(isImageIdReference('')).toBe(false);
  });
});

describe('isGeneratedImageId', () => {
  it('detects generated image IDs', () => {
    expect(isGeneratedImageId('gen_img_abc123')).toBe(true);
    expect(isGeneratedImageId('gen_img_slide1-figure')).toBe(true);
  });

  it('detects generated video IDs', () => {
    expect(isGeneratedImageId('gen_vid_xyz')).toBe(true);
    expect(isGeneratedImageId('gen_vid_demo-1')).toBe(true);
  });

  it('returns false for non-generated IDs', () => {
    expect(isGeneratedImageId('img_1')).toBe(false);
    expect(isGeneratedImageId('https://example.com/img.png')).toBe(false);
    expect(isGeneratedImageId('')).toBe(false);
  });
});

describe('resolveImageIds', () => {
  it('resolves img_id references to base64 URLs', () => {
    const elements = [makeImageEl('e1', 'img_1')];
    const mapping = { img_1: 'data:image/png;base64,AAAA' };

    const resolved = resolveImageIds(elements as any, mapping);
    expect(resolved[0].src).toBe('data:image/png;base64,AAAA');
  });

  it('removes element with unmapped image ID', () => {
    const elements = [makeImageEl('e1', 'img_99')];
    const resolved = resolveImageIds(elements as any, {});

    expect(resolved).toHaveLength(0);
  });

  it('resolves generated image IDs via generatedMediaMapping', () => {
    const elements = [makeImageEl('e1', 'gen_img_slide1')];
    const genMapping = { gen_img_slide1: 'https://cdn.example.com/img.png' };

    const resolved = resolveImageIds(elements as any, undefined, genMapping);
    expect(resolved[0].src).toBe('https://cdn.example.com/img.png');
  });

  it('keeps generated image placeholder if no mapping available', () => {
    const elements = [makeImageEl('e1', 'gen_img_slide1')];

    const resolved = resolveImageIds(elements as any, {}, {});
    expect(resolved).toHaveLength(1);
    expect(resolved[0].src).toBe('gen_img_slide1');
  });

  it('removes image element with missing src', () => {
    const elements = [{ type: 'image', id: 'bad', left: 0, top: 0 }];
    const resolved = resolveImageIds(elements as any, {});

    expect(resolved).toHaveLength(0);
  });

  it('passes through non-image elements unchanged', () => {
    const elements = [
      { type: 'text', id: 't1', content: 'hello', left: 10, top: 10 },
      { type: 'shape', id: 's1', fill: '#000', left: 20, top: 20 },
    ];

    const resolved = resolveImageIds(elements as any, {});
    expect(resolved).toHaveLength(2);
    expect(resolved[0].type).toBe('text');
    expect(resolved[1].type).toBe('shape');
  });
});

describe('normalizeGeneratedVideoRefs', () => {
  it('keeps video with direct non-generated src', () => {
    const elements = [makeVideoEl('v1', 'https://cdn.example.com/video.mp4')];

    const normalized = normalizeGeneratedVideoRefs(elements as any, []);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].src).toBe('https://cdn.example.com/video.mp4');
  });

  it('removes mediaRef from video with direct src', () => {
    const elements = [makeVideoEl('v1', 'https://cdn.example.com/video.mp4', 'gen_vid_x')];

    const normalized = normalizeGeneratedVideoRefs(elements as any, []);
    expect(normalized).toHaveLength(1);
    expect('mediaRef' in normalized[0]).toBe(false);
  });

  it('keeps video with valid mediaRef in outline', () => {
    const elements = [makeVideoEl('v1', 'gen_vid_a', 'gen_vid_a')];
    const videoEntries = [{ type: 'video' as const, prompt: '', elementId: 'gen_vid_a' }];

    const normalized = normalizeGeneratedVideoRefs(elements as any, videoEntries);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].mediaRef).toBe('gen_vid_a');
  });

  it('corrects single ref when only one video entry exists', () => {
    const elements = [makeVideoEl('v1', 'gen_vid_wrong')];
    const videoEntries = [{ type: 'video' as const, prompt: '', elementId: 'gen_vid_correct' }];

    const normalized = normalizeGeneratedVideoRefs(elements as any, videoEntries);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].mediaRef).toBe('gen_vid_correct');
  });

  it('corrects invalid generated video ref to the only valid ref', () => {
    const elements = [makeVideoEl('v1', 'gen_vid_bad', 'gen_vid_bad')];
    const videoEntries = [{ type: 'video' as const, prompt: '', elementId: 'gen_vid_good' }];

    const normalized = normalizeGeneratedVideoRefs(elements as any, videoEntries);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].mediaRef).toBe('gen_vid_good');
  });

  it('removes element with invalid ref when multiple valid refs exist', () => {
    const elements = [makeVideoEl('v1', 'gen_vid_bad', 'gen_vid_bad')];
    const videoEntries = [
      { type: 'video' as const, prompt: '', elementId: 'gen_vid_a' },
      { type: 'video' as const, prompt: '', elementId: 'gen_vid_b' },
    ];

    const normalized = normalizeGeneratedVideoRefs(elements as any, videoEntries);
    expect(normalized).toHaveLength(0);
  });

  it('passes through non-video elements unchanged', () => {
    const elements = [{ type: 'text', id: 't1', content: 'notes' }];

    const normalized = normalizeGeneratedVideoRefs(elements as any, []);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].type).toBe('text');
  });
});
