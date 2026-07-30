import type { Subject } from '@/lib/solve/agents/analyze-types';
import { readUniversalOnboarding, type LegacyProfileSource } from './migration';
import { getLearnerSelfReport } from './selectors';
import { ONBOARDING_SUBJECT_IDS } from './types';

const SUPPORTED_SUBJECTS = new Set<string>(ONBOARDING_SUBJECT_IDS);

export function getLearnerSupportSubjectIds(source: LegacyProfileSource): Subject[] | undefined {
  const selfReport = getLearnerSelfReport(readUniversalOnboarding(source));
  if (!selfReport) return undefined;
  const subjects = selfReport.supportDomains.filter((id): id is Subject =>
    SUPPORTED_SUBJECTS.has(id),
  );
  return subjects.length > 0 ? subjects : undefined;
}
