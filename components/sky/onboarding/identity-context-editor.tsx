'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DomainPicker, ProfileChoice } from './domain-picker';
import {
  IDENTITY_CONFIG,
  PROFILE_STAGES,
  STAGE_LABELS,
  type ProductIdentity,
  type ProfileStage,
} from '@/lib/onboarding/catalog';
import {
  addContext,
  removeContext,
  setContextStage,
  updateIdentityDraft,
  type UniversalOnboardingFormState,
} from '@/lib/onboarding/form-state';
import type { DomainRef } from '@/lib/onboarding/types';

const CONTEXT_LABELS: Record<ProductIdentity, string> = {
  learner: '学习阶段',
  educator: '教学阶段',
  guardian: '支持阶段',
  'education-manager': '服务阶段',
  other: '场景阶段',
};

const ADD_LABELS: Record<ProductIdentity, string> = {
  learner: '',
  educator: '添加教学阶段',
  guardian: '添加支持阶段',
  'education-manager': '添加服务阶段',
  other: '',
};

const DOMAIN_LABELS: Record<ProductIdentity, string> = {
  learner: '学习领域（选填）',
  educator: '教学领域（选填）',
  guardian: '辅导领域（选填）',
  'education-manager': '管理领域（选填）',
  other: '关注领域（选填）',
};

export function IdentityContextEditor({
  state,
  onChange,
}: {
  state: UniversalOnboardingFormState;
  onChange: (state: UniversalOnboardingFormState) => void;
}) {
  const identity = state.primaryIdentity;
  if (!identity) return null;
  const activeIdentity: ProductIdentity = identity;
  const config = IDENTITY_CONFIG[activeIdentity];
  const draft = state.drafts[activeIdentity];

  function chooseStage(index: number, stage: ProfileStage) {
    const current = draft.contexts[index];
    const hasDomains = current.domains.length > 0 || current.supportDomains.length > 0;
    if (
      current.stage &&
      current.stage !== stage &&
      hasDomains &&
      !window.confirm('切换阶段会清空该阶段已选领域，是否继续？')
    ) {
      return;
    }
    onChange(setContextStage(state, index, stage));
  }

  function setDomains(index: number, domains: DomainRef[], support = false) {
    onChange(
      updateIdentityDraft(state, activeIdentity, (current) => ({
        ...current,
        contexts: current.contexts.map((context, contextIndex) =>
          contextIndex === index
            ? support
              ? { ...context, supportDomains: domains }
              : { ...context, domains }
            : context,
        ),
      })),
    );
  }

  return (
    <section aria-labelledby="context-heading">
      <h2 id="context-heading" className="text-lg font-semibold text-foreground">
        {config.stageQuestion}
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        领域会分别保存在对应阶段，不会混在一起。
      </p>

      <div className="mt-6 space-y-7">
        {draft.contexts.map((context, contextIndex) => {
          const selectedElsewhere = new Set(
            draft.contexts
              .filter((_, index) => index !== contextIndex)
              .map((item) => item.stage)
              .filter((stage): stage is ProfileStage => stage !== null),
          );
          const legend = config.multipleContexts
            ? `${CONTEXT_LABELS[activeIdentity]} ${contextIndex + 1}`
            : CONTEXT_LABELS[activeIdentity];
          return (
            <div
              key={`${activeIdentity}-${contextIndex}`}
              className={contextIndex > 0 ? 'border-t border-border pt-7' : undefined}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{legend}</span>
                {contextIndex > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="移除该阶段"
                    className="min-h-11 min-w-11 text-muted-foreground"
                    onClick={() => onChange(removeContext(state, contextIndex))}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <fieldset aria-label={legend} className="mt-2">
                <legend className="sr-only">{legend}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PROFILE_STAGES.map((stage) => (
                    <ProfileChoice
                      key={stage}
                      label={STAGE_LABELS[stage]}
                      selected={context.stage === stage}
                      disabled={selectedElsewhere.has(stage)}
                      onClick={() => chooseStage(contextIndex, stage)}
                    />
                  ))}
                </div>
              </fieldset>

              {context.stage && (
                <>
                  <DomainPicker
                    label={DOMAIN_LABELS[activeIdentity]}
                    stage={context.stage}
                    value={context.domains}
                    onChange={(domains) => setDomains(contextIndex, domains)}
                  />
                  {activeIdentity === 'learner' && (
                    <DomainPicker
                      label="需要重点支持的领域（选填）"
                      stage={context.stage}
                      value={context.supportDomains}
                      onChange={(domains) => setDomains(contextIndex, domains, true)}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {config.multipleContexts && draft.contexts.length < 5 && (
        <Button
          type="button"
          variant="outline"
          className="mt-6 min-h-11"
          onClick={() => onChange(addContext(state))}
        >
          <Plus />
          {ADD_LABELS[activeIdentity]}
        </Button>
      )}
    </section>
  );
}
