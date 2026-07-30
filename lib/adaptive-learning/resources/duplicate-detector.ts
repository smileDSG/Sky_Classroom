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

function findRoot(parents: number[], index: number): number {
  if (parents[index] !== index) parents[index] = findRoot(parents, parents[index]);
  return parents[index];
}

function union(parents: number[], left: number, right: number): void {
  const leftRoot = findRoot(parents, left);
  const rightRoot = findRoot(parents, right);
  if (leftRoot === rightRoot) return;

  const first = Math.min(leftRoot, rightRoot);
  const second = Math.max(leftRoot, rightRoot);
  parents[second] = first;
}

function duplicateComponents(documents: readonly CrawledMathDocument[]): CrawledMathDocument[][] {
  const sorted = [...documents].sort((left, right) =>
    compareText(left.sourcePath, right.sourcePath),
  );
  const parents = sorted.map((_, index) => index);

  for (const keyFor of [
    (document: CrawledMathDocument) => document.canonicalUrl,
    (document: CrawledMathDocument) => document.contentHash,
  ]) {
    const firstIndexByKey = new Map<string, number>();
    sorted.forEach((document, index) => {
      const key = keyFor(document);
      const firstIndex = firstIndexByKey.get(key);
      if (firstIndex === undefined) {
        firstIndexByKey.set(key, index);
      } else {
        union(parents, firstIndex, index);
      }
    });
  }

  const components = new Map<number, CrawledMathDocument[]>();
  sorted.forEach((document, index) => {
    const root = findRoot(parents, index);
    const component = components.get(root);
    if (component) component.push(document);
    else components.set(root, [document]);
  });

  return [...components.values()].filter((component) => component.length > 1);
}

function duplicateReason(
  document: CrawledMathDocument,
  keeper: CrawledMathDocument,
  component: readonly CrawledMathDocument[],
): HardDuplicateReason {
  if (document.canonicalUrl === keeper.canonicalUrl) return 'duplicate_canonical_url';
  if (document.contentHash === keeper.contentHash) return 'duplicate_content_hash';

  const hasUrlEdge = component.some(
    (peer) => peer !== document && peer.canonicalUrl === document.canonicalUrl,
  );
  return hasUrlEdge ? 'duplicate_canonical_url' : 'duplicate_content_hash';
}

function findHardDuplicates(
  documents: readonly CrawledMathDocument[],
): Map<string, HardDuplicateDecision> {
  const pending: Array<[string, HardDuplicateDecision]> = [];

  for (const component of duplicateComponents(documents)) {
    const keeper = selectKeeper(component);
    for (const document of component) {
      if (document === keeper) continue;
      pending.push([
        document.sourcePath,
        {
          keeperSourcePath: keeper.sourcePath,
          reason: duplicateReason(document, keeper, component),
        },
      ]);
    }
  }

  pending.sort(([left], [right]) => compareText(left, right));
  return new Map(pending);
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
  return {
    hardDuplicates: findHardDuplicates(documents),
    titleCollisions: findTitleCollisions(documents),
  };
}
