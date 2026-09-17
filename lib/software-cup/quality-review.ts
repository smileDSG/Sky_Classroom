import type { GeneratedResource, SoftwareCupStudentProfile } from '@/lib/software-cup/demo-service';

export type QualityCheckStatus = 'pass' | 'warn' | 'fail';

export interface ResourceQualityCheck {
  resourceId: string;
  citationCoverage: QualityCheckStatus;
  difficultyFit: QualityCheckStatus;
  personalizationFit: QualityCheckStatus;
  confidence: number;
  issues: string[];
  suggestions: string[];
}

export interface ResourceQualityReviewResult {
  resources: Array<GeneratedResource & { qualityReview: ResourceQualityCheck }>;
  summary: {
    passed: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
    resourceChecks: ResourceQualityCheck[];
  };
}

function containsAny(text: string, values: string[]): boolean {
  const normalized = text.toLowerCase();
  return values.some((value) => normalized.includes(value.toLowerCase()));
}

function statusScore(status: QualityCheckStatus): number {
  if (status === 'pass') return 1;
  if (status === 'warn') return 0.62;
  return 0.25;
}

function reviewResource(
  resource: GeneratedResource,
  profile: SoftwareCupStudentProfile,
): ResourceQualityCheck {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const weakPoints = profile.dimensions.knowledgeBase.weakPoints;
  const preferences = profile.dimensions.resourcePreference.value;
  const searchable = [
    resource.title,
    resource.contentPreview,
    resource.content,
    resource.personalizationReason,
  ]
    .filter(Boolean)
    .join(' ');

  const citationCoverage: QualityCheckStatus =
    resource.sourceCitations.length >= 1 ? 'pass' : 'fail';
  if (citationCoverage !== 'pass') {
    issues.push(`${resource.id} has no course citation.`);
    suggestions.push('Add at least one course knowledge citation before showing the resource.');
  }

  const difficultyFit: QualityCheckStatus = containsAny(searchable, weakPoints) ? 'pass' : 'warn';
  if (difficultyFit !== 'pass') {
    issues.push(`${resource.id} does not visibly target current weak points.`);
    suggestions.push('Mention the target weak point in the title, preview, or practice task.');
  }

  const personalizationFit: QualityCheckStatus =
    containsAny(searchable, weakPoints) || containsAny(searchable, preferences) ? 'pass' : 'warn';
  if (personalizationFit !== 'pass') {
    issues.push(`${resource.id} lacks explicit profile-fit wording.`);
    suggestions.push('Keep profile-fit notes visible for each resource.');
  }

  const confidence = Number(
    (
      (statusScore(citationCoverage) +
        statusScore(difficultyFit) +
        statusScore(personalizationFit)) /
      3
    ).toFixed(2),
  );

  return {
    resourceId: resource.id,
    citationCoverage,
    difficultyFit,
    personalizationFit,
    confidence,
    issues,
    suggestions:
      suggestions.length > 0 ? suggestions : ['Keep profile-fit notes visible for each resource.'],
  };
}

export function reviewGeneratedResources(input: {
  resources: GeneratedResource[];
  profile: SoftwareCupStudentProfile;
}): ResourceQualityReviewResult {
  const resourceChecks = input.resources.map((resource) => reviewResource(resource, input.profile));
  const issues = resourceChecks.flatMap((check) => check.issues);
  const suggestions = Array.from(new Set(resourceChecks.flatMap((check) => check.suggestions)));
  const confidence =
    resourceChecks.length === 0
      ? 0
      : Number(
          (
            resourceChecks.reduce((sum, check) => sum + check.confidence, 0) / resourceChecks.length
          ).toFixed(2),
        );

  return {
    resources: input.resources.map((resource, index) => ({
      ...resource,
      qualityReview: resourceChecks[index],
    })),
    summary: {
      passed: issues.length === 0,
      confidence,
      issues,
      suggestions,
      resourceChecks,
    },
  };
}
