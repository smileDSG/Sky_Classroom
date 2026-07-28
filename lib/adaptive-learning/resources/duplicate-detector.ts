import type { CrawledMathDocument } from '@/lib/adaptive-learning/resources/crawled-document';

export type HardDuplicateReason = 'duplicate_canonical_url' | 'duplicate_content_hash';

export interface HardDuplicateDecision {
  keeperSourcePath: string;
  reason: HardDuplicateReason;
}

export interface DuplicateDecisions {
  hardDuplicates: Map<string, HardDuplicateDecision>;
  titleCollisions: Map<string, string[]>;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function groupDocuments(
  documents: readonly CrawledMathDocument[],
  keyFor: (document: CrawledMathDocument) => string,
): Map<string, CrawledMathDocument[]> {
  const groups = new Map<string, CrawledMathDocument[]>();

  for (const document of [...documents].sort((left, right) =>
    compareText(left.sourcePath, right.sourcePath),
  )) {
    const key = keyFor(document);
    const group = groups.get(key);
    if (group) {
      group.push(document);
    } else {
      groups.set(key, [document]);
    }
  }

  return groups;
}

function selectKeeper(documents: readonly CrawledMathDocument[]): CrawledMathDocument {
  return [...documents].sort(
    (left, right) =>
      right.declaredWordCount - left.declaredWordCount ||
      compareText(left.sourcePath, right.sourcePath),
  )[0];
}

function recordHardDuplicates(
  groups: Map<string, CrawledMathDocument[]>,
  reason: HardDuplicateReason,
  decisions: Map<string, HardDuplicateDecision>,
): void {
  for (const key of [...groups.keys()].sort(compareText)) {
    const group = groups.get(key);
    if (!group || group.length < 2) continue;

    const keeper = selectKeeper(group);
    for (const document of group) {
      if (document.sourcePath === keeper.sourcePath || decisions.has(document.sourcePath)) continue;

      decisions.set(document.sourcePath, {
        keeperSourcePath: keeper.sourcePath,
        reason,
      });
    }
  }
}

function findTitleCollisions(documents: readonly CrawledMathDocument[]): Map<string, string[]> {
  const collisions = new Map<string, string[]>();
  const groups = groupDocuments(documents, (document) => document.normalizedTitle);

  for (const key of [...groups.keys()].sort(compareText)) {
    const group = groups.get(key);
    if (!group || group.length < 2) continue;

    const paths = group.map((document) => document.sourcePath).sort(compareText);
    for (const sourcePath of paths) {
      collisions.set(
        sourcePath,
        paths.filter((peerPath) => peerPath !== sourcePath),
      );
    }
  }

  return collisions;
}

export function detectDuplicateDecisions(
  documents: readonly CrawledMathDocument[],
): DuplicateDecisions {
  const hardDuplicates = new Map<string, HardDuplicateDecision>();

  recordHardDuplicates(
    groupDocuments(documents, (document) => document.canonicalUrl),
    'duplicate_canonical_url',
    hardDuplicates,
  );
  recordHardDuplicates(
    groupDocuments(documents, (document) => document.contentHash),
    'duplicate_content_hash',
    hardDuplicates,
  );

  return {
    hardDuplicates,
    titleCollisions: findTitleCollisions(documents),
  };
}
