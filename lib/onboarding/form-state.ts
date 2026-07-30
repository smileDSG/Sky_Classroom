import { IDENTITY_CONFIG, type ProductIdentity, type ProfileStage } from './catalog';
import type {
  CompleteUniversalOnboardingInput,
  DomainRef,
  UniversalIdentityProfile,
  UniversalIdentityProfileInput,
  UniversalOnboardingProfile,
} from './types';

export interface ContextDraft {
  stage: ProfileStage | null;
  domains: DomainRef[];
  supportDomains: DomainRef[];
}

export interface IdentityDraft {
  contexts: ContextDraft[];
  goals: CompleteUniversalOnboardingInput['profiles']['learner'] extends infer _Profile
    ? Array<{ source: 'catalog'; id: string; label: string } | { source: 'custom'; label: string }>
    : never;
  needs: string[];
  preference: string;
  detail: string;
}

export interface UniversalOnboardingFormState {
  identities: ProductIdentity[];
  primaryIdentity: ProductIdentity | null;
  drafts: Record<ProductIdentity, IdentityDraft>;
  completedProfiles: Partial<Record<ProductIdentity, UniversalIdentityProfile>>;
}

const EMPTY_CONTEXT: ContextDraft = { stage: null, domains: [], supportDomains: [] };

function createDraft(identity: ProductIdentity): IdentityDraft {
  return {
    contexts: [{ ...EMPTY_CONTEXT }],
    goals: [],
    needs: [],
    preference: 'balanced',
    detail: '',
    ...(identity === 'learner' ? { preference: 'balanced' } : {}),
  };
}

function draftFromProfile(profile: UniversalIdentityProfile): IdentityDraft {
  const common = {
    goals: profile.goals,
    needs: [...profile.roleNeeds],
    detail: profile.detail ?? '',
  };

  switch (profile.identity) {
    case 'learner':
      return {
        ...common,
        contexts: [
          {
            stage: profile.context.stage,
            domains: profile.context.learningDomains.map((item) => item.domain),
            supportDomains: profile.context.supportDomains,
          },
        ],
        preference: profile.preferences.explanationStyle,
      };
    case 'educator':
      return {
        ...common,
        contexts: profile.contexts.map((context) => ({
          stage: context.stage,
          domains: context.teachingDomains.map((item) => item.domain),
          supportDomains: [],
        })),
        preference: profile.preferences.primarySupport,
      };
    case 'guardian':
      return {
        ...common,
        contexts: profile.contexts.map((context) => ({
          stage: context.stage,
          domains: context.supportDomains.map((item) => item.domain),
          supportDomains: [],
        })),
        preference: profile.preferences.guidanceStyle,
      };
    case 'education-manager':
      return {
        ...common,
        contexts: profile.contexts.map((context) => ({
          stage: context.stage,
          domains: context.managedDomains.map((item) => item.domain),
          supportDomains: [],
        })),
        preference: profile.preferences.managementFocus,
      };
    case 'other':
      return {
        ...common,
        contexts: [
          {
            stage: profile.context.stage,
            domains: profile.context.domains.map((item) => item.domain),
            supportDomains: [],
          },
        ],
        preference: profile.preferences.collaborationStyle,
      };
  }
}

export function createInitialFormState(
  profile?: UniversalOnboardingProfile | null,
): UniversalOnboardingFormState {
  const drafts = {
    learner: createDraft('learner'),
    educator: createDraft('educator'),
    guardian: createDraft('guardian'),
    'education-manager': createDraft('education-manager'),
    other: createDraft('other'),
  };
  if (!profile || profile.status !== 'completed') {
    return { identities: [], primaryIdentity: null, drafts, completedProfiles: {} };
  }

  for (const identity of profile.identities) {
    const completed = profile.profiles[identity];
    if (completed) drafts[identity] = draftFromProfile(completed);
  }
  return {
    identities: [...profile.identities],
    primaryIdentity: profile.primaryIdentity,
    drafts,
    completedProfiles: { ...profile.profiles },
  };
}

export function toggleIdentity(
  state: UniversalOnboardingFormState,
  identity: ProductIdentity,
): UniversalOnboardingFormState {
  if (state.identities.includes(identity)) {
    const identities = state.identities.filter((item) => item !== identity);
    const completedProfiles = { ...state.completedProfiles };
    delete completedProfiles[identity];
    return {
      ...state,
      identities,
      primaryIdentity:
        state.primaryIdentity === identity ? (identities[0] ?? null) : state.primaryIdentity,
      completedProfiles,
    };
  }
  return {
    ...state,
    identities: [...state.identities, identity],
    primaryIdentity: state.primaryIdentity ?? identity,
  };
}

export function setPrimaryIdentity(
  state: UniversalOnboardingFormState,
  identity: ProductIdentity,
): UniversalOnboardingFormState {
  if (!state.identities.includes(identity)) return state;
  return { ...state, primaryIdentity: identity };
}

export function updateIdentityDraft(
  state: UniversalOnboardingFormState,
  identity: ProductIdentity,
  update: (draft: IdentityDraft) => IdentityDraft,
): UniversalOnboardingFormState {
  return { ...state, drafts: { ...state.drafts, [identity]: update(state.drafts[identity]) } };
}

export function addContext(state: UniversalOnboardingFormState): UniversalOnboardingFormState {
  const identity = state.primaryIdentity;
  if (!identity || !IDENTITY_CONFIG[identity].multipleContexts) return state;
  return updateIdentityDraft(state, identity, (draft) =>
    draft.contexts.length >= 5
      ? draft
      : { ...draft, contexts: [...draft.contexts, { ...EMPTY_CONTEXT }] },
  );
}

export function removeContext(
  state: UniversalOnboardingFormState,
  contextIndex: number,
): UniversalOnboardingFormState {
  const identity = state.primaryIdentity;
  if (!identity) return state;
  return updateIdentityDraft(state, identity, (draft) => ({
    ...draft,
    contexts:
      draft.contexts.length <= 1
        ? draft.contexts
        : draft.contexts.filter((_, index) => index !== contextIndex),
  }));
}

export function setContextStage(
  state: UniversalOnboardingFormState,
  contextIndex: number,
  stage: ProfileStage,
): UniversalOnboardingFormState {
  const identity = state.primaryIdentity;
  if (!identity) return state;
  return updateIdentityDraft(state, identity, (draft) => ({
    ...draft,
    contexts: draft.contexts.map((context, index) =>
      index === contextIndex && context.stage !== stage
        ? { stage, domains: [], supportDomains: [] }
        : context,
    ),
  }));
}

export function normalizeCustomDomain(value: string, existing: DomainRef[]): DomainRef | null {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 40) return null;
  const normalized = name.toLocaleLowerCase();
  if (
    existing.some(
      (domain) => domain.source === 'custom' && domain.name.toLocaleLowerCase() === normalized,
    )
  ) {
    return null;
  }
  return { source: 'custom', name };
}

function withoutTimestamp(profile: UniversalIdentityProfile): UniversalIdentityProfileInput {
  const { completedAt: _completedAt, ...input } = profile;
  return input as UniversalIdentityProfileInput;
}

function selections(domains: DomainRef[]) {
  return domains.map((domain) => ({ domain }));
}

function primaryProfile(
  identity: ProductIdentity,
  draft: IdentityDraft,
): UniversalIdentityProfileInput {
  const contexts = draft.contexts.map((context) => {
    if (!context.stage) throw new Error('请选择学习阶段');
    return { ...context, stage: context.stage };
  });
  const common = { goals: draft.goals, roleNeeds: draft.needs, detail: draft.detail || undefined };

  switch (identity) {
    case 'learner':
      return {
        identity,
        context: {
          stage: contexts[0].stage,
          learningDomains: selections(contexts[0].domains),
          supportDomains: contexts[0].supportDomains,
        },
        ...common,
        roleNeeds: draft.needs as never,
        preferences: { explanationStyle: draft.preference as never },
      };
    case 'educator':
      return {
        identity,
        contexts: contexts.map((context) => ({
          stage: context.stage,
          teachingDomains: selections(context.domains),
        })),
        ...common,
        roleNeeds: draft.needs as never,
        preferences: { primarySupport: draft.preference as never },
      };
    case 'guardian':
      return {
        identity,
        contexts: contexts.map((context) => ({
          stage: context.stage,
          supportDomains: selections(context.domains),
        })),
        ...common,
        roleNeeds: draft.needs as never,
        preferences: { guidanceStyle: draft.preference as never },
      };
    case 'education-manager':
      return {
        identity,
        contexts: contexts.map((context) => ({
          stage: context.stage,
          managedDomains: selections(context.domains),
        })),
        ...common,
        roleNeeds: draft.needs as never,
        preferences: { managementFocus: draft.preference as never },
      };
    case 'other':
      return {
        identity,
        context: { stage: contexts[0].stage, domains: selections(contexts[0].domains) },
        ...common,
        roleNeeds: draft.needs as never,
        preferences: { collaborationStyle: draft.preference as never },
      };
  }
}

export function toCompletionInput(
  state: UniversalOnboardingFormState,
): CompleteUniversalOnboardingInput {
  if (!state.primaryIdentity || !state.identities.includes(state.primaryIdentity)) {
    throw new Error('请选择当前主要身份');
  }
  const profiles: CompleteUniversalOnboardingInput['profiles'] = {};
  for (const identity of state.identities) {
    const completed = state.completedProfiles[identity];
    if (completed) profiles[identity] = withoutTimestamp(completed) as never;
  }
  profiles[state.primaryIdentity] = primaryProfile(
    state.primaryIdentity,
    state.drafts[state.primaryIdentity],
  ) as never;

  return {
    version: 2,
    identities: state.identities,
    primaryIdentity: state.primaryIdentity,
    profiles,
  };
}
