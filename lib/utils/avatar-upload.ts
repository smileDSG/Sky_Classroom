/**
 * Shared avatar upload utility.
 * Resizes images to 128x128 center-cropped JPEG at 85% quality.
 */

export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB

export function isCustomAvatar(avatar: string): boolean {
  return avatar.startsWith('data:');
}

export async function processAvatarUpload(file: File): Promise<string> {
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error('File too large (max 5MB)');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Invalid file type');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        const scale = Math.max(128 / img.width, 128 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
