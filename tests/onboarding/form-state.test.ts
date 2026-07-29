import { describe, expect, it } from 'vitest';
import {
  addContext,
  createInitialFormState,
  normalizeCustomDomain,
  setContextStage,
  setPrimaryIdentity,
  toggleIdentity,
  toCompletionInput,
  updateIdentityDraft,
} from '@/lib/onboarding/form-state';
import type { UniversalOnboardingProfile } from '@/lib/onboarding/types';

describe('universal onboarding form state', () => {
  it('keeps selected identity drafts when the primary identity changes', () => {
    let state = createInitialFormState();
    state = toggleIdentity(state, 'learner');
    state = updateIdentityDraft(state, 'learner', (draft) => ({
      ...draft,
      detail: '学习者草稿',
    }));
    state = toggleIdentity(state, 'educator');
    state = setPrimaryIdentity(state, 'educator');

    expect(state.identities).toEqual(['learner', 'educator']);
    expect(state.primaryIdentity).toBe('educator');
    expect(state.drafts.learner.detail).toBe('学习者草稿');
  });

  it('clears domains only in the changed primary context', () => {
    let state = createInitialFormState();
    state = toggleIdentity(state, 'educator');
    state = addContext(state);
    state = updateIdentityDraft(state, 'educator', (draft) => ({
      ...draft,
      contexts: [
        {
          stage: 'middle',
          domains: [{ source: 'catalog', id: 'math', name: '数学' }],
          supportDomains: [],
        },
        {
          stage: 'high',
          domains: [{ source: 'catalog', id: 'physics', name: '物理' }],
          supportDomains: [],
        },
      ],
    }));

    const changed = setContextStage(state, 1, 'undergraduate');

    expect(changed.drafts.educator.contexts[0]).toEqual(state.drafts.educator.contexts[0]);
    expect(changed.drafts.educator.contexts[1]).toEqual({
      stage: 'undergraduate',
      domains: [],
      supportDomains: [],
    });
  });

  it('normalizes and deduplicates custom domains case-insensitively', () => {
    expect(normalizeCustomDomain('  Product Design  ', [])).toEqual({
      source: 'custom',
      name: 'Product Design',
    });
    expect(
      normalizeCustomDomain('product design', [{ source: 'custom', name: 'Product Design' }]),
    ).toBeNull();
    expect(normalizeCustomDomain('x'.repeat(41), [])).toBeNull();
  });

  it('hydrates completed identities and preserves secondary profiles on serialization', () => {
    const profile: UniversalOnboardingProfile = {
      version: 2,
      status: 'completed',
      identities: ['learner', 'educator'],
      primaryIdentity: 'educator',
      profiles: {
        learner: {
          identity: 'learner',
          context: { stage: 'middle', learningDomains: [], supportDomains: [] },
          goals: [{ source: 'catalog', id: 'exam-prep', label: '准备考试' }],
          roleNeeds: [],
          preferences: { explanationStyle: 'balanced' },
          completedAt: 10,
        },
        educator: {
          identity: 'educator',
          contexts: [{ stage: 'high', teachingDomains: [] }],
          goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
          roleNeeds: [],
          preferences: { primarySupport: 'balanced' },
          completedAt: 20,
        },
      },
      completedAt: 20,
    };
    const state = createInitialFormState(profile);
    const input = toCompletionInput(state);

    expect(state.drafts.learner.goals[0]).toMatchObject({ id: 'exam-prep' });
    expect(input.profiles.learner).toMatchObject({ identity: 'learner' });
    expect(input.profiles.educator).toMatchObject({ identity: 'educator' });
    expect(input.profiles.learner).not.toHaveProperty('completedAt');
  });

  it('serializes only selected identities and the current primary draft', () => {
    let state = createInitialFormState();
    state = toggleIdentity(state, 'learner');
    state = toggleIdentity(state, 'educator');
    state = setPrimaryIdentity(state, 'educator');
    state = updateIdentityDraft(state, 'educator', (draft) => ({
      ...draft,
      contexts: [
        {
          stage: 'high',
          domains: [{ source: 'catalog', id: 'math', name: '数学' }],
          supportDomains: [],
        },
      ],
      goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
      needs: ['question-design'],
      preference: 'lesson-plan-structure',
    }));

    expect(toCompletionInput(state)).toEqual({
      version: 2,
      identities: ['learner', 'educator'],
      primaryIdentity: 'educator',
      profiles: {
        educator: {
          identity: 'educator',
          contexts: [
            {
              stage: 'high',
              teachingDomains: [{ domain: { source: 'catalog', id: 'math', name: '数学' } }],
            },
          ],
          goals: [{ source: 'catalog', id: 'prepare-lessons', label: '备课' }],
          roleNeeds: ['question-design'],
          preferences: { primarySupport: 'lesson-plan-structure' },
        },
      },
    });
  });
});
