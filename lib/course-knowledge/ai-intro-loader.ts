import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';

export type AiIntroDocumentKind =
  | 'syllabus'
  | 'chapter'
  | 'case'
  | 'media_script'
  | 'reading'
  | 'rubric'
  | 'structured_data';

export interface AiIntroDocument {
  id: string;
  courseId: string;
  title: string;
  kind: AiIntroDocumentKind;
  file: string;
  content: string;
  tags: string[];
}

export interface AiIntroSearchHit {
  document: Omit<AiIntroDocument, 'content'>;
  score: number;
  snippet: string;
}

export interface AiIntroCourseIndex {
  courseId: string;
  title: string;
  documents: AiIntroDocument[];
  stats: {
    documents: number;
    chapters: number;
    cases: number;
    mediaScripts: number;
  };
}

const COURSE_ROOT = path.join(process.cwd(), 'data', 'course-knowledge', 'ai-intro');
const COURSE_ID = 'ai-intro-2026';

let cachedIndex: AiIntroCourseIndex | null = null;

function toRepoPath(absPath: string): string {
  return path.relative(process.cwd(), absPath).replace(/\\/g, '/');
}

async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

function titleFromMarkdown(content: string, fallback: string): string {
  const firstHeading = content.match(/^#\s+(.+)$/m);
  return firstHeading?.[1]?.trim() || fallback;
}

function tagsFromMarkdown(content: string): string[] {
  const tagLine = content.match(/##\s+知识点标签\s+([\s\S]+?)$/m);
  if (!tagLine) return [];
  return Array.from(tagLine[1].matchAll(/`([^`]+)`/g), (m) => m[1]);
}

async function loadMarkdownDirectory(
  dir: string,
  kind: AiIntroDocumentKind,
): Promise<AiIntroDocument[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  const docs: AiIntroDocument[] = [];
  for (const filePath of files) {
    const content = await readText(filePath);
    const file = toRepoPath(filePath);
    docs.push({
      id: file.replace(/[/.]/g, '-'),
      courseId: COURSE_ID,
      title: titleFromMarkdown(content, path.basename(filePath, '.md')),
      kind,
      file,
      content,
      tags: tagsFromMarkdown(content),
    });
  }
  return docs;
}

async function loadJsonDocument(filePath: string, title: string): Promise<AiIntroDocument> {
  const content = await readText(filePath);
  const file = toRepoPath(filePath);
  return {
    id: file.replace(/[/.]/g, '-'),
    courseId: COURSE_ID,
    title,
    kind: 'structured_data',
    file,
    content,
    tags: [],
  };
}

export async function loadAiIntroCourseIndex(force = false): Promise<AiIntroCourseIndex> {
  if (cachedIndex && !force) return cachedIndex;

  const metaPath = path.join(COURSE_ROOT, 'course-meta.json');
  const meta = JSON.parse(await readText(metaPath)) as { courseId?: string; title?: string };
  const courseId = meta.courseId || COURSE_ID;

  const syllabusPath = path.join(COURSE_ROOT, 'syllabus.md');
  const syllabusContent = await readText(syllabusPath);
  const syllabus: AiIntroDocument = {
    id: 'ai-intro-syllabus',
    courseId,
    title: titleFromMarkdown(syllabusContent, '《人工智能导论》课程大纲'),
    kind: 'syllabus',
    file: toRepoPath(syllabusPath),
    content: syllabusContent,
    tags: [],
  };

  const [chapters, cases, mediaScripts, readings, rubric, graph, questionBank] = await Promise.all([
    loadMarkdownDirectory(path.join(COURSE_ROOT, 'chapters'), 'chapter'),
    loadMarkdownDirectory(path.join(COURSE_ROOT, 'cases'), 'case'),
    loadMarkdownDirectory(path.join(COURSE_ROOT, 'media-scripts'), 'media_script'),
    readText(path.join(COURSE_ROOT, 'readings.md')).then((content) => ({
      id: 'ai-intro-readings',
      courseId,
      title: titleFromMarkdown(content, '拓展阅读材料'),
      kind: 'reading' as const,
      file: 'data/course-knowledge/ai-intro/readings.md',
      content,
      tags: [],
    })),
    readText(path.join(COURSE_ROOT, 'assessment-rubric.md')).then((content) => ({
      id: 'ai-intro-assessment-rubric',
      courseId,
      title: titleFromMarkdown(content, '学习效果评估与项目评分 Rubric'),
      kind: 'rubric' as const,
      file: 'data/course-knowledge/ai-intro/assessment-rubric.md',
      content,
      tags: [],
    })),
    loadJsonDocument(path.join(COURSE_ROOT, 'knowledge-graph.json'), '知识点图谱'),
    loadJsonDocument(path.join(COURSE_ROOT, 'question-bank.json'), '初始题库'),
  ]);

  const documents = [
    syllabus,
    ...chapters,
    ...cases,
    ...mediaScripts,
    readings,
    rubric,
    graph,
    questionBank,
  ];
  cachedIndex = {
    courseId,
    title: meta.title || '人工智能导论',
    documents,
    stats: {
      documents: documents.length,
      chapters: chapters.length,
      cases: cases.length,
      mediaScripts: mediaScripts.length,
    },
  };
  return cachedIndex;
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase();
  const rawTokens = normalized.match(/[a-z0-9+#.]+|[\u4e00-\u9fff]/gu) ?? [];
  const tokens = new Set(rawTokens);

  for (let i = 0; i < rawTokens.length - 1; i += 1) {
    if (/^[\u4e00-\u9fff]$/u.test(rawTokens[i]) && /^[\u4e00-\u9fff]$/u.test(rawTokens[i + 1])) {
      tokens.add(`${rawTokens[i]}${rawTokens[i + 1]}`);
    }
  }

  return Array.from(tokens).filter((token) => token.length > 0);
}

function scoreDocument(document: AiIntroDocument, query: string, tokens: string[]): number {
  const q = query.toLowerCase().trim();
  const title = document.title.toLowerCase();
  const content = document.content.toLowerCase();
  const tags = document.tags.map((tag) => tag.toLowerCase());
  let score = 0;

  if (q && title.includes(q)) score += 12;
  if (q && content.includes(q)) score += 6;

  for (const token of tokens) {
    if (title.includes(token)) score += 4;
    if (tags.some((tag) => tag.includes(token))) score += 3;
    if (content.includes(token)) score += 1;
  }

  if (document.kind === 'chapter') score += 0.2;
  return score;
}

function makeSnippet(content: string, query: string, tokens: string[]): string {
  const normalized = content.toLowerCase();
  const needle = query.trim().toLowerCase();
  let index = needle ? normalized.indexOf(needle) : -1;

  if (index < 0) {
    for (const token of tokens) {
      index = normalized.indexOf(token.toLowerCase());
      if (index >= 0) break;
    }
  }

  const start = Math.max(0, index >= 0 ? index - 80 : 0);
  const end = Math.min(content.length, start + 220);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

export async function searchAiIntroCourse(query: string, limit = 8): Promise<AiIntroSearchHit[]> {
  const index = await loadAiIntroCourseIndex();
  const tokens = tokenize(query);
  const maxResults = Math.min(Math.max(limit, 1), 30);

  return index.documents
    .map((document) => ({
      document,
      score: scoreDocument(document, query, tokens),
      snippet: makeSnippet(document.content, query, tokens),
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((hit) => {
      const { content: _content, ...publicDocument } = hit.document;
      return {
        document: publicDocument,
        score: Number(hit.score.toFixed(3)),
        snippet: hit.snippet,
      };
    });
}
