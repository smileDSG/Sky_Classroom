import type { CurriculumPack } from '@/lib/adaptive-learning/contracts/curriculum';
import type { CrawledMathDocument } from '@/lib/adaptive-learning/resources/crawled-document';
import { normalizeComparableText } from '@/lib/adaptive-learning/resources/crawled-document';

export interface CurriculumMappingCandidate {
  nodeId: string;
  score: number;
  matchedAliases: string[];
}

export interface CurriculumMappingResult {
  candidates: CurriculumMappingCandidate[];
  ambiguous: boolean;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueNormalizedAliases(values: readonly string[]): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const value of values) {
    const normalized = normalizeComparableText(value);
    if (!normalized) continue;

    const current = aliases.get(normalized);
    if (current === undefined || compareText(value, current) < 0) {
      aliases.set(normalized, value);
    }
  }

  return aliases;
}

export function mapDocumentToCurriculum(
  document: CrawledMathDocument,
  pack: CurriculumPack,
): CurriculumMappingResult {
  const candidates = pack.nodes
    .map((node): CurriculumMappingCandidate => {
      let score = 0;
      const matchedAliases: string[] = [];

      for (const [normalizedAlias, alias] of uniqueNormalizedAliases([
        node.name,
        ...node.aliases,
      ])) {
        if (document.normalizedTitle.includes(normalizedAlias)) {
          score += 5;
          matchedAliases.push(alias);
        } else if (document.normalizedBody.includes(normalizedAlias)) {
          score += 2;
          matchedAliases.push(alias);
        }
      }

      matchedAliases.sort(compareText);
      return { nodeId: node.id, score, matchedAliases };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || compareText(left.nodeId, right.nodeId));

  const top = candidates[0];
  const second = candidates[1];
  const ambiguous =
    top === undefined || top.score < 5 || (second !== undefined && top.score - second.score < 2);

  return {
    ambiguous,
    candidates: ambiguous ? candidates.filter((candidate) => candidate.score >= 5) : candidates,
  };
}
