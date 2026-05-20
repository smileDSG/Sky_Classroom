const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** 校验图片格式和大小 */
export function validateImage(file: File): ValidationResult {
  if (!file) {
    return { valid: false, error: '未上传图片' };
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `不支持的图片格式: ${file.type || '未知'}。支持: JPEG, PNG, WebP`,
    };
  }

  if (file.size > MAX_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `图片大小 ${sizeMB}MB 超过限制（最大 10MB）` };
  }

  if (file.size === 0) {
    return { valid: false, error: '图片文件为空' };
  }

  return { valid: true };
}
