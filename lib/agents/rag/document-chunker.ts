/**
 * RAG — 文档分块器
 *
 * 递归地将大段文本拆分为适合检索的小块，
 * 保持语义完整的同时控制每块大小。
 */

export interface DocumentChunk {
  /** 唯一标识 */
  id: string;
  /** 分块文本 */
  content: string;
  /** 元数据 */
  metadata: {
    /** 文档来源 ID */
    docId: string;
    /** 文档标题 */
    docTitle: string;
    /** 在文档中的位置索引 */
    chunkIndex: number;
    /** 总块数 */
    totalChunks: number;
    /** 文档主题/标签 */
    tags?: string[];
  };
}

interface ChunkOptions {
  /** 每块最大字符数 */
  chunkSize?: number;
  /** 块之间重叠字符数 */
  overlap?: number;
  /** 分隔符优先级 */
  separators?: string[];
}

const DEFAULT_SEPARATORS = ['\n\n', '\n', '。', '！', '？', '；', '. ', '! ', '? ', '; ', ' ', ''];

/**
 * 递归文本分块
 */
export function chunkDocument(
  docId: string,
  docTitle: string,
  text: string,
  options: ChunkOptions = {},
): DocumentChunk[] {
  const { chunkSize = 500, overlap = 50, separators = DEFAULT_SEPARATORS } = options;

  const chunks = splitRecursive(text, chunkSize, overlap, separators);
  const total = chunks.length;

  return chunks.map((content, i) => ({
    id: `${docId}-chunk-${i}`,
    content: content.trim(),
    metadata: {
      docId,
      docTitle,
      chunkIndex: i,
      totalChunks: total,
    },
  }));
}

function splitRecursive(
  text: string,
  chunkSize: number,
  overlap: number,
  separators: string[],
): string[] {
  if (!text.trim()) return [];
  if (text.length <= chunkSize) return [text];

  // 尝试用当前分隔符分割
  const sep = separators[0];
  if (!sep || sep === '') {
    // 最后的手段：按字符硬切
    return forceSplit(text, chunkSize, overlap);
  }

  const parts = text.split(sep).filter(Boolean);
  if (parts.length <= 1) {
    // 当前分隔符无法拆分，尝试下一个
    return splitRecursive(text, chunkSize, overlap, separators.slice(1));
  }

  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    if ((current + sep + part).length <= chunkSize) {
      current = current ? current + sep + part : part;
    } else {
      if (current) chunks.push(current);
      // 如果 part 本身超过 chunkSize，递归拆分
      if (part.length > chunkSize) {
        const sub = splitRecursive(part, chunkSize, overlap, separators.slice(1));
        // 将最后一个子块与下一个合并（为 overlap 做准备）
        const last = sub.pop()!;
        chunks.push(...sub);
        current = last;
      } else {
        current = part;
      }
    }
  }

  if (current) chunks.push(current);

  // 添加重叠
  return addOverlap(chunks, overlap, sep);
}

function forceSplit(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

function addOverlap(chunks: string[], overlap: number, sep: string): string[] {
  if (overlap <= 0 || chunks.length <= 1) return chunks;

  const result: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1];
    const overlapText = prev.length > overlap ? prev.slice(-overlap) : prev;
    result.push(overlapText + sep + chunks[i]);
  }
  return result;
}