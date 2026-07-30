/**
 * Retrieve knowledge chunks for planning projection.
 *
 * Scans data/crawled markdown files and scores them against the active domain,
 * target knowledge nodes and optional goal topic from the planning projection.
 */

import { promises as fs } from 'fs';
import path from 'path';

import type { PlanningProfileProjection } from '@/lib/adaptive-learning/contracts';
import type { KnowledgeChunk } from './learning-plan-service';

const DEFAULT_DATA_DIR = 'data/crawled';

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, ' ');
}

function parseFrontMatter(text: string): Record<string, unknown> {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};
  const meta: Record<string, unknown> = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value: unknown = line.slice(idx + 1).trim();
    if (typeof value === 'string') {
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      } else if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/^"|"$/g, ''))
          .filter(Boolean);
      } else if (!Number.isNaN(Number(value))) {
        value = Number(value);
      }
    }
    meta[key] = value;
  }
  return meta;
}

async function* walkMarkdown(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMarkdown(fullPath);
    } else if (entry.name.endsWith('.md')) {
      yield fullPath;
    }
  }
}

function computeScore(text: string, projection: PlanningProfileProjection, goalTopic?: string): number {
  const normalized = normalizeText(text);
  const tokens = new Set(normalized.split(' ').filter(Boolean));
  const { data } = projection;
  const domain = data.activeDomain;

  let score = 0;

  // Subject match
  const subjectVariants = [
    domain.subjectId,
    domain.subjectId.toLowerCase(),
    normalizeText(domain.subjectId),
  ];
  for (const v of subjectVariants) {
    if (normalized.includes(v)) score += 3;
  }

  // Target knowledge node match (high weight)
  for (const node of data.targetKnowledge) {
    const v = normalizeText(node.nodeId);
    if (v.length > 0 && normalized.includes(v)) score += 8;
  }

  // Target node ids match (mastery mode)
  if (domain.targetNodeIds) {
    for (const nodeId of domain.targetNodeIds) {
      const v = normalizeText(nodeId);
      if (v.length > 0 && normalized.includes(v)) score += 8;
    }
  }

  // Goal topic match
  if (goalTopic) {
    const v = normalizeText(goalTopic);
    if (v.length > 0 && normalized.includes(v)) score += 10;

    const goalTokens = normalizeText(goalTopic)
      .split(' ')
      .filter((t) => t.length > 1);
    for (const token of goalTokens) {
      if (tokens.has(token)) score += 2;
    }
  }

  return score;
}

export async function retrieveChunksForPlanning(
  projection: PlanningProfileProjection,
  topK: number,
  dataDir: string = DEFAULT_DATA_DIR,
): Promise<KnowledgeChunk[]> {
  const chunks: KnowledgeChunk[] = [];
  const root = path.resolve(dataDir);

  try {
    await fs.access(root);
  } catch {
    return [];
  }

  const goalTopic =
    projection.data.targetKnowledge.length > 0
      ? projection.data.targetKnowledge[0].nodeId
      : projection.data.activeDomain.targetNodeIds?.[0];

  for await (const filePath of walkMarkdown(root)) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const meta = parseFrontMatter(raw);
      const title = (meta.title as string) || path.basename(filePath, '.md');
      const course = (meta.course as string) || '';
      const tags = Array.isArray(meta.tags) ? (meta.tags as string[]) : [];
      const content = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
      const wordCount = content.replace(/\s+/g, '').length;

      if (wordCount < 50) continue;

      const searchableText = `${title} ${course} ${tags.join(' ')} ${content.slice(0, 3000)}`;
      const score = computeScore(searchableText, projection, goalTopic);
      if (score <= 0) continue;

      chunks.push({
        source: filePath,
        title,
        course,
        tags,
        content: content.slice(0, 2500),
        wordCount,
        score,
      });
    } catch {
      // ignore invalid file
    }
  }

  chunks.sort((a, b) => b.score - a.score);
  return chunks.slice(0, topK);
}
