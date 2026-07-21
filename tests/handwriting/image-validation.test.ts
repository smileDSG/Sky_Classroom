import { describe, expect, it } from 'vitest';
import { HANDWRITING_IMAGE_MAX_BYTES, validateHandwritingImage } from '@/lib/handwriting';

describe('handwriting image validation', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s files', (type) => {
    const file = new File([new Uint8Array([1, 2, 3])], 'answer', { type });

    expect(validateHandwritingImage(file)).toEqual({ valid: true });
  });

  it('rejects empty files', () => {
    const file = new File([], 'empty.png', { type: 'image/png' });

    expect(validateHandwritingImage(file)).toEqual({
      valid: false,
      code: 'empty_file',
      message: '图片内容为空',
    });
  });

  it('rejects unsupported file types', () => {
    const file = new File(['pdf'], 'answer.pdf', { type: 'application/pdf' });

    expect(validateHandwritingImage(file)).toMatchObject({
      valid: false,
      code: 'invalid_type',
    });
  });

  it('rejects files larger than 15 MB', () => {
    const file = new File([new Uint8Array(HANDWRITING_IMAGE_MAX_BYTES + 1)], 'large.png', {
      type: 'image/png',
    });

    expect(validateHandwritingImage(file)).toMatchObject({
      valid: false,
      code: 'file_too_large',
    });
  });
});
