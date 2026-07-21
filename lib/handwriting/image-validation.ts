export const HANDWRITING_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ImageValidationErrorCode = 'empty_file' | 'invalid_type' | 'file_too_large';

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; code: ImageValidationErrorCode; message: string };

export function validateHandwritingImage(file: File): ImageValidationResult {
  if (file.size === 0) {
    return { valid: false, code: 'empty_file', message: '图片内容为空' };
  }
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return {
      valid: false,
      code: 'invalid_type',
      message: '仅支持 JPEG、PNG 和 WebP 图片',
    };
  }
  if (file.size > HANDWRITING_IMAGE_MAX_BYTES) {
    return {
      valid: false,
      code: 'file_too_large',
      message: '单张图片不能超过 15 MB',
    };
  }
  return { valid: true };
}
