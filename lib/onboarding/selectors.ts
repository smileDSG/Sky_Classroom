import type { LearnerNeed, UniversalIdentityProfile, UniversalOnboardingProfile } from './types';
import {
  IDENTITY_CONFIG,
  IDENTITY_LABELS,
  STAGE_LABELS,
  type CatalogOption,
  type ProfileStage,
} from './catalog';

export interface LearnerSelfReport {
  learningDomains: string[];
  supportDomains: string[];
  needs: LearnerNeed[];
}

export interface OnboardingRecommendation {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
}

function safeRedirect(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/sky';
  return value;
}

function domainValue(
  domain: { source: 'catalog'; id: string } | { source: 'custom'; name: string },
) {
  return domain.source === 'catalog' ? domain.id : domain.name;
}

export function getPrimaryIdentityProfile(
  profile: UniversalOnboardingProfile | null | undefined,
): UniversalIdentityProfile | null {
  if (!profile || profile.status !== 'completed') return null;
  return profile.profiles[profile.primaryIdentity] ?? null;
}

export function getLearnerSelfReport(
  profile: UniversalOnboardingProfile | null | undefined,
): LearnerSelfReport | null {
  const primary = getPrimaryIdentityProfile(profile);
  if (!primary || primary.identity !== 'learner') return null;
  return {
    learningDomains: primary.context.learningDomains.map((item) => domainValue(item.domain)),
    supportDomains: primary.context.supportDomains.map(domainValue),
    needs: primary.roleNeeds,
  };
}

function allProfileContexts(profile: UniversalIdentityProfile): Array<{
  stage: ProfileStage;
  domains: Array<
    { source: 'catalog'; id: string; name: string } | { source: 'custom'; name: string }
  >;
}> {
  switch (profile.identity) {
    case 'learner':
      return [
        {
          stage: profile.context.stage,
          domains: [
            ...profile.context.learningDomains.map((item) => item.domain),
            ...profile.context.supportDomains,
          ],
        },
      ];
    case 'educator':
      return profile.contexts.map((context) => ({
        stage: context.stage,
        domains: context.teachingDomains.map((item) => item.domain),
      }));
    case 'guardian':
      return profile.contexts.map((context) => ({
        stage: context.stage,
        domains: context.supportDomains.map((item) => item.domain),
      }));
    case 'education-manager':
      return profile.contexts.map((context) => ({
        stage: context.stage,
        domains: context.managedDomains.map((item) => item.domain),
      }));
    case 'other':
      return [
        {
          stage: profile.context.stage,
          domains: profile.context.domains.map((item) => item.domain),
        },
      ];
  }
}

export function buildIdentityProfileInstructions(
  profile: UniversalOnboardingProfile | null | undefined,
): string[] {
  const primary = getPrimaryIdentityProfile(profile);
  if (!primary) return [];
  const config = IDENTITY_CONFIG[primary.identity];
  const needs = config.needs as readonly CatalogOption[];
  const preferences = config.preferences as readonly CatalogOption[];
  const contexts = allProfileContexts(primary);
  const stages = [...new Set(contexts.map((context) => STAGE_LABELS[context.stage]))];
  const domains = [
    ...new Set(contexts.flatMap((context) => context.domains.map((item) => item.name))),
  ];
  const preferenceId =
    primary.identity === 'learner'
      ? primary.preferences.explanationStyle
      : primary.identity === 'educator'
        ? primary.preferences.primarySupport
        : primary.identity === 'guardian'
          ? primary.preferences.guidanceStyle
          : primary.identity === 'education-manager'
            ? primary.preferences.managementFocus
            : primary.preferences.collaborationStyle;
  const preference = preferences.find((item) => item.id === preferenceId)?.label;
  const preferencePrefix =
    primary.identity === 'learner'
      ? '讲解偏好'
      : primary.identity === 'educator'
        ? '优先支持'
        : primary.identity === 'guardian'
          ? '辅导偏好'
          : primary.identity === 'education-manager'
            ? '信息偏好'
            : '协作偏好';
  const lines = [`当前身份：${IDENTITY_LABELS[primary.identity]}`];
  if (stages.length > 0) lines.push(`相关阶段：${stages.join('、')}`);
  if (domains.length > 0) lines.push(`关注领域：${domains.join('、')}`);
  if (primary.goals.length > 0) {
    lines.push(`当前目标：${primary.goals.map((goal) => goal.label).join('、')}`);
  }
  const needLabels = primary.roleNeeds
    .map((id) => needs.find((item) => item.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  if (needLabels.length > 0) lines.push(`希望支持：${needLabels.join('、')}`);
  if (preference) lines.push(`${preferencePrefix}：${preference}`);
  return lines;
}

function recommendationContext(profile: UniversalIdentityProfile) {
  switch (profile.identity) {
    case 'learner':
      return {
        stage: profile.context.stage,
        domain: profile.context.supportDomains[0] ?? profile.context.learningDomains[0]?.domain,
      };
    case 'educator':
      return {
        stage: profile.contexts[0]?.stage,
        domain: profile.contexts[0]?.teachingDomains[0]?.domain,
      };
    case 'guardian':
      return {
        stage: profile.contexts[0]?.stage,
        domain: profile.contexts[0]?.supportDomains[0]?.domain,
      };
    case 'education-manager':
      return {
        stage: profile.contexts[0]?.stage,
        domain: profile.contexts[0]?.managedDomains[0]?.domain,
      };
    case 'other':
      return {
        stage: profile.context.stage,
        domain: profile.context.domains[0]?.domain,
      };
  }
}

function route(path: string, values: Array<[string, string | undefined]>): string {
  const params = new URLSearchParams();
  for (const [key, value] of values) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function resolveOnboardingRecommendation(
  profile: UniversalOnboardingProfile | null | undefined,
  redirect: string,
): OnboardingRecommendation {
  const secondaryHref = safeRedirect(redirect);
  const primary = getPrimaryIdentityProfile(profile);
  if (!primary) return { primaryHref: secondaryHref, primaryLabel: '继续使用', secondaryHref };

  const context = recommendationContext(primary);
  const domain = context.domain ? domainValue(context.domain) : undefined;
  const goal = primary.goals[0]?.source === 'catalog' ? primary.goals[0].id : undefined;

  switch (primary.identity) {
    case 'learner':
      return {
        primaryHref: route('/sky/cloud-mind/quiz', [
          ['subject', domain],
          ['stage', context.stage],
          ['goal', goal],
          ['mode', 'diagnostic'],
        ]),
        primaryLabel: '开始学习诊断',
        secondaryHref,
      };
    case 'educator':
      return {
        primaryHref: route('/sky/teaching', [
          ['stage', context.stage],
          ['domain', domain],
          ['goal', goal],
        ]),
        primaryLabel: goal === 'prepare-lessons' ? '开始备课' : '进入教学工作台',
        secondaryHref,
      };
    case 'guardian':
      return {
        primaryHref: route('/sky/assistant', [
          ['stage', context.stage],
          ['domain', domain],
          ['goal', goal],
        ]),
        primaryLabel: '生成辅导建议',
        secondaryHref,
      };
    case 'education-manager':
      return {
        primaryHref: route('/sky/learning', [
          ['stage', context.stage],
          ['domain', domain],
          ['goal', goal],
        ]),
        primaryLabel: '进入资源工作台',
        secondaryHref,
      };
    case 'other':
      return {
        primaryHref: route('/sky/assistant', [
          ['stage', context.stage],
          ['domain', domain],
          ['goal', goal],
        ]),
        primaryLabel: '开始使用',
        secondaryHref,
      };
  }
}
