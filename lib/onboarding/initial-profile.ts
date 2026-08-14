import type { CloudMindToolTarget, PersonalizationDifficulty } from '@/lib/cloud-mind/types';
import {
  IDENTITY_LABELS,
  STAGE_LABELS,
  type LearnerFoundation,
  type LearnerWeeklyTime,
  type ProductIdentity,
  type ProfileStage,
} from '@/lib/onboarding/catalog';
import { getPrimaryIdentityProfile } from '@/lib/onboarding/selectors';
import type { DomainRef, UniversalOnboardingProfile } from '@/lib/onboarding/types';

export interface InitialToolSuggestion {
  tool: CloudMindToolTarget;
  title: string;
  reason: string;
  href: string;
}

export interface InitialProfileSnapshot {
  status: 'self-reported';
  identity: ProductIdentity;
  identityLabel: string;
  stage: ProfileStage;
  stageLabel: string;
  focusDomains: string[];
  supportDomains: string[];
  goals: string[];
  needs: string[];
  preference: string;
  foundation?: LearnerFoundation;
  weeklyTime?: LearnerWeeklyTime;
  recommendedDifficulty: PersonalizationDifficulty;
  completeness: number;
  summary: string;
  toolSuggestions: InitialToolSuggestion[];
}

function domainName(domain: DomainRef): string {
  return domain.name;
}

function query(path: string, values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function recommendedDifficulty(foundation?: LearnerFoundation): PersonalizationDifficulty {
  if (foundation === 'advanced') return 'hard';
  if (foundation === 'solid') return 'medium';
  return 'easy';
}

function buildRoleToolSuggestions(input: {
  identity: Exclude<ProductIdentity, 'learner'>;
  primaryTopic?: string;
  stage: ProfileStage;
}): InitialToolSuggestion[] {
  const topic = input.primaryTopic ?? '当前目标';
  const common = { topic: input.primaryTopic, stage: input.stage };

  if (input.identity === 'educator') {
    return [
      {
        tool: 'teaching',
        title: `生成${topic}教学方案`,
        reason: '按授课阶段和教学偏好组织课堂流程、讲解与互动。',
        href: query('/sky/teaching', common),
      },
      {
        tool: 'slides',
        title: `制作${topic}课堂课件`,
        reason: '将教学目标快速转成可编辑、可演示的结构化课件。',
        href: query('/sky/cloud-mind/slides', common),
      },
      {
        tool: 'quiz',
        title: `创建${topic}课堂测验`,
        reason: '用随堂诊断收集真实学习数据，辅助调整后续教学。',
        href: query('/sky/cloud-mind/quiz', { ...common, mode: 'diagnostic' }),
      },
    ];
  }

  if (input.identity === 'guardian') {
    return [
      {
        tool: 'quiz',
        title: `了解${topic}掌握情况`,
        reason: '先通过轻量诊断了解当前基础，避免只凭感觉安排辅导。',
        href: query('/sky/cloud-mind/quiz', { ...common, mode: 'diagnostic' }),
      },
      {
        tool: 'teaching',
        title: `生成${topic}辅导建议`,
        reason: '依据学习阶段生成清晰、可执行的家庭辅导步骤。',
        href: query('/sky/cloud-mind/teaching', common),
      },
      {
        tool: 'memory',
        title: `建立${topic}复习计划`,
        reason: '把重点内容转成分散复习任务，持续记录复习反馈。',
        href: query('/sky/cloud-mind/memory', common),
      },
    ];
  }

  return [
    {
      tool: 'slides',
      title: `整理${topic}内容`,
      reason: `按${IDENTITY_LABELS[input.identity]}的目标生成结构化内容与展示材料。`,
      href: query('/sky/cloud-mind/slides', common),
    },
    {
      tool: 'teaching',
      title: `生成${topic}学习方案`,
      reason: '结合所选阶段和使用偏好，形成可执行的学习或培训流程。',
      href: query('/sky/cloud-mind/teaching', common),
    },
    {
      tool: 'quiz',
      title: `收集${topic}诊断数据`,
      reason: '通过真实作答补充自评画像，为后续推荐提供依据。',
      href: query('/sky/cloud-mind/quiz', { ...common, mode: 'diagnostic' }),
    },
  ];
}

export function buildInitialProfileSnapshot(
  onboarding: UniversalOnboardingProfile | null | undefined,
): InitialProfileSnapshot | null {
  const profile = getPrimaryIdentityProfile(onboarding);
  if (!profile) return null;

  let stage: ProfileStage = 'other';
  let focusDomains: string[] = [];
  let supportDomains: string[] = [];
  let preference = 'balanced';
  let foundation: LearnerFoundation | undefined;
  let weeklyTime: LearnerWeeklyTime | undefined;

  switch (profile.identity) {
    case 'learner':
      stage = profile.context.stage;
      focusDomains = profile.context.learningDomains.map((item) => domainName(item.domain));
      supportDomains = profile.context.supportDomains.map(domainName);
      preference = profile.preferences.explanationStyle;
      foundation = profile.baseline?.foundation;
      weeklyTime = profile.baseline?.weeklyTime;
      break;
    case 'educator':
      stage = profile.contexts[0]?.stage ?? 'other';
      focusDomains = profile.contexts.flatMap((item) =>
        item.teachingDomains.map((selection) => domainName(selection.domain)),
      );
      preference = profile.preferences.primarySupport;
      break;
    case 'guardian':
      stage = profile.contexts[0]?.stage ?? 'other';
      focusDomains = profile.contexts.flatMap((item) =>
        item.supportDomains.map((selection) => domainName(selection.domain)),
      );
      preference = profile.preferences.guidanceStyle;
      break;
    case 'education-manager':
      stage = profile.contexts[0]?.stage ?? 'other';
      focusDomains = profile.contexts.flatMap((item) =>
        item.managedDomains.map((selection) => domainName(selection.domain)),
      );
      preference = profile.preferences.managementFocus;
      break;
    case 'other':
      stage = profile.context.stage;
      focusDomains = profile.context.domains.map((selection) => domainName(selection.domain));
      preference = profile.preferences.collaborationStyle;
      break;
  }

  focusDomains = [...new Set(focusDomains)];
  supportDomains = [...new Set(supportDomains)];
  const goals = profile.goals.map((goal) => goal.label);
  const needs = [...profile.roleNeeds];
  const difficulty = recommendedDifficulty(foundation);
  const primaryTopic = supportDomains[0] ?? focusDomains[0] ?? goals[0];
  const completenessParts = [
    true,
    stage !== 'other',
    focusDomains.length > 0,
    goals.length > 0,
    needs.length > 0,
    preference !== 'balanced',
    profile.identity !== 'learner' || Boolean(foundation),
    profile.identity !== 'learner' || Boolean(weeklyTime),
  ];
  const completeness = Math.round(
    (completenessParts.filter(Boolean).length / completenessParts.length) * 100,
  );

  const toolSuggestions: InitialToolSuggestion[] =
    profile.identity === 'learner'
      ? [
          {
            tool: 'quiz',
            title: `先诊断${primaryTopic ?? '当前基础'}`,
            reason: '根据自报薄弱领域先做短测，用真实作答校准初始画像。',
            href: query('/sky/cloud-mind/quiz', {
              topic: primaryTopic,
              stage,
              difficulty,
              mode: 'diagnostic',
            }),
          },
          {
            tool: 'teaching',
            title: `生成${primaryTopic ?? '目标领域'}个性化课堂`,
            reason: `按“${preference}”偏好组织讲解，并根据每周投入控制学习节奏。`,
            href: query('/sky/cloud-mind/teaching', { topic: primaryTopic, stage }),
          },
          {
            tool: 'slides',
            title: `制作${focusDomains[0] ?? primaryTopic ?? '学习主题'}学习课件`,
            reason: '把当前目标转成结构化课件，方便预习、复习和项目展示。',
            href: query('/sky/cloud-mind/slides', { topic: focusDomains[0] ?? primaryTopic }),
          },
        ]
      : buildRoleToolSuggestions({
          identity: profile.identity,
          primaryTopic,
          stage,
        });

  const focusText = focusDomains.length > 0 ? `关注${focusDomains.join('、')}` : '尚未选择领域';
  const supportText = supportDomains.length > 0 ? `，优先补强${supportDomains.join('、')}` : '';

  return {
    status: 'self-reported',
    identity: profile.identity,
    identityLabel: IDENTITY_LABELS[profile.identity],
    stage,
    stageLabel: STAGE_LABELS[stage],
    focusDomains,
    supportDomains,
    goals,
    needs,
    preference,
    foundation,
    weeklyTime,
    recommendedDifficulty: difficulty,
    completeness,
    summary: `${STAGE_LABELS[stage]}${IDENTITY_LABELS[profile.identity]}，${focusText}${supportText}。`,
    toolSuggestions,
  };
}
