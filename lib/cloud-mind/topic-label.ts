import {
  canonicalizeKnowledgePoint,
  resolveKnowledgePoint,
} from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';

export function isInternalKnowledgePoint(value: string | null | undefined): boolean {
  return Boolean(value && /^kp-[a-z0-9-]+$/i.test(value.trim()));
}

export function resolveTopicLabel(
  value: string | null | undefined,
  fallbackValues: Iterable<string> = [],
): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  const known = resolveKnowledgePoint(raw);
  if (known) return known.name;
  if (!isInternalKnowledgePoint(raw)) return raw;

  const rawId = raw.toLocaleLowerCase();
  for (const fallback of fallbackValues) {
    const candidate = fallback.trim();
    if (!candidate || isInternalKnowledgePoint(candidate)) continue;
    if (canonicalizeKnowledgePoint(candidate).id !== rawId) continue;
    return resolveKnowledgePoint(candidate)?.name ?? candidate;
  }

  return undefined;
}
