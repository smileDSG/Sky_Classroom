import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface PutHandwritingObjectInput {
  userId: string;
  submissionId: string;
  pageId: string;
  mimeType: string;
  buffer: Buffer;
}

export interface HandwritingObjectStore {
  put(input: PutHandwritingObjectInput): Promise<string>;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function sanitizePathSegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  return sanitized || 'unknown';
}

export class LocalHandwritingObjectStore implements HandwritingObjectStore {
  private readonly root: string;

  constructor(root = path.join(process.cwd(), 'data', 'handwriting', 'uploads')) {
    this.root = path.resolve(root);
  }

  async put(input: PutHandwritingObjectInput): Promise<string> {
    const extension = EXTENSIONS[input.mimeType];
    if (!extension) throw new Error(`Unsupported handwriting image MIME type: ${input.mimeType}`);

    const segments = [
      sanitizePathSegment(input.userId),
      sanitizePathSegment(input.submissionId),
      `${sanitizePathSegment(input.pageId)}.${extension}`,
    ];
    const target = path.resolve(this.root, ...segments);
    const relative = path.relative(this.root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Handwriting object key escapes the configured storage root');
    }

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.buffer);
    return segments.join('/');
  }
}

let defaultObjectStore: HandwritingObjectStore | null = null;

export function getHandwritingObjectStore(): HandwritingObjectStore {
  if (!defaultObjectStore) defaultObjectStore = new LocalHandwritingObjectStore();
  return defaultObjectStore;
}
