import type {
  GeneratedResource,
  LearningPathNode,
  SoftwareCupStudentProfile,
} from '@/lib/software-cup/demo-service';

export interface VideoSceneHandoff {
  sceneId: string;
  title: string;
  narration: string;
  visualPrompt: string;
  durationSeconds: number;
}

export interface VideoGenerationHandoff {
  status: 'ready_for_generation';
  providerHint: 'script_to_video';
  sourceResourceId?: string;
  aspectRatio: '16:9';
  styleGuide: string;
  scenes: VideoSceneHandoff[];
}

export interface SpacedReviewItem {
  knowledgePoint: string;
  dueInDays: number;
  intervalDays: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

export interface WeeklyLearningPlan {
  weekIndex: number;
  theme: string;
  goals: string[];
  resourceIds: string[];
  reviewItems: string[];
  estimatedMinutes: number;
}

export interface MasteryEstimate {
  knowledgePoint: string;
  mastery: number;
  stability: number;
  nextReviewInDays: number;
  confidence: number;
  evidence: string[];
}

export interface ClassWeakPointTrend {
  knowledgePoint: string;
  affectedLearners: number;
  averageMastery: number;
}

export interface ClassTierRecommendation {
  tier: 'support' | 'core' | 'extension';
  learnerCount: number;
  focus: string;
  suggestedResources: string[];
}

export interface ClassGroupProfile {
  classId: string;
  learnerCount: number;
  weakPointTrends: ClassWeakPointTrend[];
  resourcePreferenceTrends: Array<{
    preference: string;
    learnerCount: number;
  }>;
  tierRecommendations: ClassTierRecommendation[];
  teacherActions: string[];
}

export interface P2Enhancements {
  videoHandoff: VideoGenerationHandoff;
  weeklyPlan: WeeklyLearningPlan[];
  spacedReviews: SpacedReviewItem[];
  masteryEstimates: MasteryEstimate[];
  classGroupProfile: ClassGroupProfile;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function topicList(profile: SoftwareCupStudentProfile): string[] {
  return unique([
    ...profile.dimensions.knowledgeBase.weakPoints,
    ...profile.dimensions.knowledgeBase.strongPoints,
  ]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resourceIdsByPreference(
  resources: GeneratedResource[],
  preferences: string[],
  fallbackCount = 2,
): string[] {
  const preferred = resources.filter((resource) => {
    const text =
      `${resource.type} ${resource.title} ${resource.personalizationReason ?? ''}`.toLowerCase();
    return preferences.some((preference) => text.includes(preference.toLowerCase()));
  });
  return (preferred.length > 0 ? preferred : resources)
    .slice(0, fallbackCount)
    .map((resource) => resource.id);
}

export function buildVideoGenerationHandoff(input: {
  profile: SoftwareCupStudentProfile;
  resources: GeneratedResource[];
}): VideoGenerationHandoff {
  const videoResource = input.resources.find((resource) => resource.type === 'video_script');
  const weakPoints = input.profile.dimensions.knowledgeBase.weakPoints.slice(0, 3);
  const topics = weakPoints.length > 0 ? weakPoints : topicList(input.profile).slice(0, 3);
  const scenes = topics.map((topic, index) => ({
    sceneId: `scene-${index + 1}`,
    title: `${topic} visual explanation`,
    narration: `Explain ${topic} with one concrete example, then connect it to the learner's current goal.`,
    visualPrompt: `Clean educational animation about ${topic}, with labeled steps, minimal text, and clear contrast.`,
    durationSeconds: index === 0 ? 18 : 15,
  }));

  while (scenes.length < 3) {
    scenes.push({
      sceneId: `scene-${scenes.length + 1}`,
      title: 'Practice transition',
      narration: 'Show how the concept turns into a short practice task.',
      visualPrompt:
        'Split screen with concept diagram on the left and practice checklist on the right.',
      durationSeconds: 12,
    });
  }

  return {
    status: 'ready_for_generation',
    providerHint: 'script_to_video',
    sourceResourceId: videoResource?.id,
    aspectRatio: '16:9',
    styleGuide: 'Bright classroom explainer, diagram first, no stock footage, concise labels.',
    scenes,
  };
}

export function buildSpacedReviews(profile: SoftwareCupStudentProfile): SpacedReviewItem[] {
  const weakPoints = profile.dimensions.knowledgeBase.weakPoints;
  const strongPoints = profile.dimensions.knowledgeBase.strongPoints;
  return [
    ...weakPoints.map((knowledgePoint, index) => ({
      knowledgePoint,
      dueInDays: index + 1,
      intervalDays: index === 0 ? 1 : 2,
      priority: 'high' as const,
      reason: 'Weak point from the current learning profile needs near-term retrieval practice.',
    })),
    ...strongPoints.slice(0, 2).map((knowledgePoint, index) => ({
      knowledgePoint,
      dueInDays: 5 + index * 2,
      intervalDays: 7,
      priority: 'low' as const,
      reason: 'Strong point should be refreshed at a lower cadence to prevent forgetting.',
    })),
  ];
}

export function buildWeeklyLearningPlan(input: {
  profile: SoftwareCupStudentProfile;
  resources: GeneratedResource[];
  learningPath: LearningPathNode[];
}): WeeklyLearningPlan[] {
  const weakPoints = input.profile.dimensions.knowledgeBase.weakPoints;
  const preferences = input.profile.dimensions.resourcePreference.value;
  const primaryResources = resourceIdsByPreference(input.resources, preferences, 3);
  const reviewItems = buildSpacedReviews(input.profile).map((item) => item.knowledgePoint);

  return [0, 1, 2, 3].map((weekIndex) => {
    const pathNode = input.learningPath[weekIndex % Math.max(input.learningPath.length, 1)];
    const topic =
      weakPoints[weekIndex % Math.max(weakPoints.length, 1)] ?? pathNode?.goal ?? 'course project';
    return {
      weekIndex: weekIndex + 1,
      theme: weekIndex < 2 ? `Stabilize ${topic}` : `Apply ${topic}`,
      goals: [
        pathNode?.goal ?? `Complete a focused task for ${topic}`,
        weekIndex < 2
          ? 'Finish targeted review and short quiz'
          : 'Build or explain one applied artifact',
      ],
      resourceIds: primaryResources,
      reviewItems: reviewItems.slice(0, Math.min(reviewItems.length, weekIndex + 2)),
      estimatedMinutes: 180 + weekIndex * 30,
    };
  });
}

export function buildMasteryEstimates(profile: SoftwareCupStudentProfile): MasteryEstimate[] {
  const weakPoints = profile.dimensions.knowledgeBase.weakPoints.map((knowledgePoint, index) => ({
    knowledgePoint,
    mastery: clamp(46 - index * 4, 24, 58),
    stability: clamp(0.35 - index * 0.04, 0.18, 0.45),
    nextReviewInDays: index + 1,
    confidence: 0.78,
    evidence: [
      'current profile weak point',
      ...profile.dimensions.knowledgeBase.evidence.slice(0, 2),
    ],
  }));
  const strongPoints = profile.dimensions.knowledgeBase.strongPoints.map(
    (knowledgePoint, index) => ({
      knowledgePoint,
      mastery: clamp(78 + index * 3, 70, 92),
      stability: clamp(0.68 + index * 0.04, 0.6, 0.88),
      nextReviewInDays: 7 + index * 3,
      confidence: 0.72,
      evidence: ['current profile strong point'],
    }),
  );

  return [...weakPoints, ...strongPoints];
}

function countByValue(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function buildClassGroupProfile(input: {
  classId: string;
  profiles: SoftwareCupStudentProfile[];
  resources: GeneratedResource[];
}): ClassGroupProfile {
  const weakCounts = countByValue(
    input.profiles.flatMap((profile) => profile.dimensions.knowledgeBase.weakPoints),
  );
  const preferenceCounts = countByValue(
    input.profiles.flatMap((profile) => profile.dimensions.resourcePreference.value),
  );
  const supportFocus = weakCounts[0]?.value ?? 'core concepts';
  const preferredResources = input.resources.slice(0, 3).map((resource) => resource.id);

  return {
    classId: input.classId,
    learnerCount: input.profiles.length,
    weakPointTrends: weakCounts.slice(0, 5).map((item) => ({
      knowledgePoint: item.value,
      affectedLearners: item.count,
      averageMastery: clamp(52 - item.count * 4, 30, 72),
    })),
    resourcePreferenceTrends: preferenceCounts.slice(0, 5).map((item) => ({
      preference: item.value,
      learnerCount: item.count,
    })),
    tierRecommendations: [
      {
        tier: 'support',
        learnerCount: Math.max(1, Math.ceil(input.profiles.length * 0.35)),
        focus: supportFocus,
        suggestedResources: preferredResources,
      },
      {
        tier: 'core',
        learnerCount: Math.max(1, Math.ceil(input.profiles.length * 0.45)),
        focus: 'complete the planned course path',
        suggestedResources: preferredResources.slice(0, 2),
      },
      {
        tier: 'extension',
        learnerCount: Math.max(1, input.profiles.length - 2),
        focus: 'project practice and peer explanation',
        suggestedResources: preferredResources.slice(1, 3),
      },
    ],
    teacherActions: [
      `Run a small-group review for ${supportFocus}.`,
      'Assign code or diagram resources based on the dominant class preference.',
      'Use weekly mastery estimates to regroup learners after the next quiz.',
    ],
  };
}

function buildSyntheticClassProfiles(
  profile: SoftwareCupStudentProfile,
): SoftwareCupStudentProfile[] {
  const weakPoints = profile.dimensions.knowledgeBase.weakPoints;
  const alternateWeakPoint = weakPoints[1] ?? weakPoints[0] ?? 'evaluation metrics';
  return [
    profile,
    {
      ...profile,
      userId: `${profile.userId}-support`,
      dimensions: {
        ...profile.dimensions,
        knowledgeBase: {
          ...profile.dimensions.knowledgeBase,
          weakPoints: unique([weakPoints[0] ?? 'vector retrieval', alternateWeakPoint]),
        },
      },
    },
    {
      ...profile,
      userId: `${profile.userId}-extension`,
      dimensions: {
        ...profile.dimensions,
        knowledgeBase: {
          ...profile.dimensions.knowledgeBase,
          strongPoints: unique([
            ...profile.dimensions.knowledgeBase.strongPoints,
            'project practice',
          ]),
          weakPoints: unique([alternateWeakPoint]),
        },
        resourcePreference: {
          ...profile.dimensions.resourcePreference,
          value: unique([...profile.dimensions.resourcePreference.value, 'project tasks']),
        },
      },
    },
  ];
}

export function buildP2Enhancements(input: {
  profile: SoftwareCupStudentProfile;
  resources: GeneratedResource[];
  learningPath: LearningPathNode[];
}): P2Enhancements {
  const profiles = buildSyntheticClassProfiles(input.profile);
  return {
    videoHandoff: buildVideoGenerationHandoff(input),
    weeklyPlan: buildWeeklyLearningPlan(input),
    spacedReviews: buildSpacedReviews(input.profile),
    masteryEstimates: buildMasteryEstimates(input.profile),
    classGroupProfile: buildClassGroupProfile({
      classId: 'ai-intro-demo-class',
      profiles,
      resources: input.resources,
    }),
  };
}
