import { randomUUID } from 'crypto';

import type {
  DomainLearnerProfile,
  LearnerPreferences,
  PlanningProfileProjection,
  TeachingProfileProjection,
} from '@/lib/adaptive-learning/contracts';

export interface TeachingProjectionInput {
  userId: string;
  snapshotId: string;
  profileVersion: number;
  eventWatermark: number;
  preferences: LearnerPreferences;
  knowledgeStatus?: 'ready' | 'no-evidence';
  strengths?: TeachingProfileProjection['data']['strengths'];
  growthAreas?: TeachingProfileProjection['data']['growthAreas'];
}

export interface PlanningProjectionInput {
  userId: string;
  snapshotId: string;
  profileVersion: number;
  eventWatermark: number;
  preferences: LearnerPreferences;
  domainProfile: DomainLearnerProfile;
  planningMode?: 'exam' | 'mastery';
  knowledgeStatus?: 'ready' | 'no-evidence';
  targetKnowledge?: PlanningProfileProjection['data']['targetKnowledge'];
  engagementSummary?: PlanningProfileProjection['data']['engagementSummary'];
}

export function buildTeachingProjection(input: TeachingProjectionInput): TeachingProfileProjection {
  const { userId, snapshotId, profileVersion, eventWatermark, preferences } = input;
  const knowledgeStatus = input.knowledgeStatus ?? 'no-evidence';
  const strengths = input.strengths ?? [];
  const growthAreas = input.growthAreas ?? [];

  return {
    projectionId: randomUUID(),
    kind: 'teaching',
    userId,
    snapshotId,
    profileVersion,
    eventWatermark,
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    data: {
      preferredLanguage: preferences.preferredLanguage,
      contentFormatPreferences: preferences.contentFormatPreferences,
      explanationDepth: preferences.explanationDepth,
      learningPace: preferences.learningPace,
      stepByStepMode: preferences.stepByStepMode,
      interactionTone: preferences.interactionTone,
      assistantName: preferences.assistantName,
      activeDomain: {
        domainProfileId: 'default',
        subjectId: 'math',
        educationStage: 'senior-high',
        gradeLevel: 'grade-12',
        curriculumPackId: 'gaokao-math-2026.1',
        curriculumPackVersion: '2026-07-28.1',
      },
      knowledgeStatus,
      strengths,
      growthAreas,
    },
  };
}

export function buildPlanningProjection(input: PlanningProjectionInput): PlanningProfileProjection {
  const {
    userId,
    snapshotId,
    profileVersion,
    eventWatermark,
    preferences,
    domainProfile,
  } = input;
  const planningMode = input.planningMode ?? 'exam';
  const knowledgeStatus = input.knowledgeStatus ?? 'no-evidence';
  const targetKnowledge = input.targetKnowledge ?? [];
  const engagementSummary = input.engagementSummary ?? { studyMinutes7d: 0, activeDays7d: 0 };

  return {
    projectionId: randomUUID(),
    kind: 'planning',
    userId,
    snapshotId,
    profileVersion,
    eventWatermark,
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    data: {
      planningMode,
      activeDomain: {
        domainProfileId: domainProfile.id,
        subjectId: domainProfile.subjectId,
        educationStage: domainProfile.educationStage,
        gradeLevel: domainProfile.gradeLevel,
        curriculumPackId: domainProfile.curriculumPackId,
        curriculumPackVersion: domainProfile.curriculumPackVersion,
        examSystem: domainProfile.examSystem,
        examDate: domainProfile.examDate,
        targetScore: domainProfile.targetScore,
        scoreScaleMax: domainProfile.scoreScaleMax,
        latestVerifiedScore: domainProfile.latestVerifiedScore,
        targetNodeIds: domainProfile.targetNodeIds,
        horizonDays: domainProfile.horizonDays,
      },
      availability: {
        weeklyAvailableMinutes: domainProfile.weeklyAvailableMinutes,
        dailyAvailability: domainProfile.dailyAvailability,
        preferredSessionMinutes: domainProfile.preferredSessionMinutes,
        restDays: domainProfile.constraints.restDays,
        maxDailyMinutes: domainProfile.constraints.maxDailyMinutes,
      },
      teacherLockedNodeIds: domainProfile.constraints.teacherLockedNodeIds,
      knowledgeStatus,
      targetKnowledge,
      engagementSummary,
      contentFormatPreferences: preferences.contentFormatPreferences,
    },
  };
}
