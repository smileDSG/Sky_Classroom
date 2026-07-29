# Universal Identity Profile Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the middle/high-school-only onboarding with a three-step, versioned profile flow for learners, educators, guardians, education managers, and other users across all learning stages.

**Architecture:** Keep `users.learningOnboarding` as the only persistence boundary and retain the existing API route family, auth gate, and account entry. Add typed stage/identity catalogs, a discriminated v2 Zod contract, a read-only v1 adapter, focused form-state helpers, and centralized selectors so learner self-report never enters observed mastery data.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5 strict mode, Zod, Tailwind CSS 4, Vitest, Testing Library, Playwright.

## Global Constraints

- Product identity never changes the authorization `role`.
- Use versioned JSON in `learningOnboarding`; do not add profile tables or migrations.
- Initial onboarding has exactly three steps and completes only the primary identity.
- Learner and other identities have one stage context; educator, guardian, and education manager identities have one to five.
- Every domain belongs to exactly one identity and one stage.
- K-12 catalog IDs are stage-validated; vocational, higher education, professional, and other stages allow custom domains.
- Keep self-reported learner needs separate from observed `StudentProfile` mastery and weak points.
- Admins can manually save and edit every branch but are never automatically redirected.
- Do not refactor unrelated dashboard, storage, auth, or student-profile architecture.

---

### Task 1: Typed Catalogs, V2 Contract, And Legacy Adapter

**Files:**
- Create: `lib/onboarding/catalog.ts`
- Create: `lib/onboarding/migration.ts`
- Modify: `lib/onboarding/types.ts`
- Modify: `tests/onboarding/types.test.ts`

**Interfaces:**
- Produces: `PRODUCT_IDENTITIES`, `PROFILE_STAGES`, `getDomainsForStage(stage)`, `getIdentityConfig(identity)`.
- Produces: `completeUniversalOnboardingSchema`, `LearningOnboardingProfile`, `UniversalOnboardingProfile`, `readUniversalOnboarding(source)`.
- Preserves: `LearningOnboardingStatus` and `getLearningOnboardingStatus(profile)` for auth consumers.

- [ ] **Step 1: Replace v1-only contract tests with failing v2 matrix tests**

Add fixtures for one valid profile per identity, and assert:

```ts
expect(completeUniversalOnboardingSchema.parse(learnerPayload)).toEqual(learnerPayload);
expect(() =>
  completeUniversalOnboardingSchema.parse({
    ...learnerPayload,
    profiles: { learner: { ...learnerPayload.profiles.learner, identity: 'educator' } },
  }),
).toThrow();
expect(() => completeUniversalOnboardingSchema.parse(highSchoolCustomDomain)).toThrow();
expect(completeUniversalOnboardingSchema.parse(undergraduateCustomDomain)).toBeTruthy();
```

Add v1 conversion assertions using legacy columns:

```ts
expect(readUniversalOnboarding(legacySource)).toMatchObject({
  version: 2,
  status: 'completed',
  identities: ['learner'],
  primaryIdentity: 'learner',
  migratedFromVersion: 1,
  profiles: {
    learner: {
      identity: 'learner',
      context: { stage: 'middle', legacyGrade: '初二' },
      preferences: { explanationStyle: 'step-by-step' },
    },
  },
});
```

- [ ] **Step 2: Run contract tests and verify the v2 exports are missing**

Run: `pnpm vitest run tests/onboarding/types.test.ts`

Expected: FAIL because `completeUniversalOnboardingSchema` and `readUniversalOnboarding` do not exist.

- [ ] **Step 3: Add typed identity, stage, domain, goal, need, and preference catalogs**

In `lib/onboarding/catalog.ts`, encode the exact IDs from the approved design. Use a typed identity config instead of a generic survey model:

```ts
export const PRODUCT_IDENTITIES = [
  'learner',
  'educator',
  'guardian',
  'education-manager',
  'other',
] as const;

export const PROFILE_STAGES = [
  'preschool',
  'primary',
  'middle',
  'high',
  'vocational',
  'undergraduate',
  'postgraduate',
  'professional',
  'other',
] as const;

export type ProductIdentity = (typeof PRODUCT_IDENTITIES)[number];
export type ProfileStage = (typeof PROFILE_STAGES)[number];

export function isOpenDomainStage(stage: ProfileStage): boolean {
  return ['vocational', 'undergraduate', 'postgraduate', 'professional', 'other'].includes(stage);
}
```

Each catalog entry is `{ id, label }`; identity configs expose `label`, `stageQuestion`, `domainQuestion`, `goals`, `needs`, and `preferences` with identity-specific labels.

- [ ] **Step 4: Implement the discriminated v2 schemas**

In `lib/onboarding/types.ts`, retain the v1 type as `LegacyLearningOnboardingProfile` and define:

```ts
export const CURRENT_ONBOARDING_VERSION = 2 as const;

const domainRefSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('catalog'), id: z.string().min(1).max(80), name: z.string().min(1).max(40) }),
  z.object({ source: z.literal('custom'), name: z.string().trim().min(1).max(40) }),
]);

export const completeUniversalOnboardingSchema = z
  .object({
    version: z.literal(2),
    identities: z.array(z.enum(PRODUCT_IDENTITIES)).min(1).max(5),
    primaryIdentity: z.enum(PRODUCT_IDENTITIES),
    profiles: identityProfileMapSchema,
  })
  .superRefine(validateIdentityOwnershipAndStageDomains);
```

The schema adds `status: 'completed'` and timestamps on the server; client completion input does not accept client timestamps. `LearningOnboardingProfile` is the union of legacy v1 and stored v2 completed/skipped records so existing database JSON remains readable.

- [ ] **Step 5: Implement read-only v1 conversion**

In `lib/onboarding/migration.ts`, implement:

```ts
export function readUniversalOnboarding(
  source: LegacyProfileSource,
): UniversalOnboardingProfile | null {
  if (!source.learningOnboarding) return null;
  if (source.learningOnboarding.version === 2) return source.learningOnboarding;
  if (source.learningOnboarding.status === 'skipped') {
    return { version: 2, status: 'skipped', skippedAt: source.learningOnboarding.skippedAt };
  }
  return convertCompletedV1(source);
}
```

Use `SUBJECT_CONFIG` for known v1 labels, retain `completedAt`, map `goalDetail` to `detail`, and mark the in-memory completed view with `migratedFromVersion: 1`. Do not write from the adapter.

- [ ] **Step 6: Run and pass contract tests**

Run: `pnpm vitest run tests/onboarding/types.test.ts`

Expected: PASS for all five identities, stage ownership, limits, and v1 conversion.

- [ ] **Step 7: Commit the contract boundary**

```bash
git add lib/onboarding/catalog.ts lib/onboarding/types.ts lib/onboarding/migration.ts tests/onboarding/types.test.ts
git commit -m "feat: add universal onboarding profile contract"
```

### Task 2: V2 API Persistence And Compatibility Reads

**Files:**
- Modify: `app/api/user/learning-onboarding/route.ts`
- Modify: `app/api/user/learning-onboarding/skip/route.ts`
- Modify: `tests/onboarding/learning-onboarding-api.test.ts`
- Modify: `tests/storage/memory-provider.test.ts`

**Interfaces:**
- Consumes: `completeUniversalOnboardingSchema`, `readUniversalOnboarding`.
- Produces GET body: `{ success, status, onboarding }`, where `onboarding` is a normalized v2 view or `null`.
- Produces PUT behavior: one authenticated `dao.update(userId, { learningOnboarding })` call.

- [ ] **Step 1: Write failing GET, PUT, edit-preservation, skip, and admin tests**

Use a completed learner payload and one educator payload. Assert GET converts v1 without calling update, PUT stores v2 once, repeated PUT is idempotent, edit payload retains secondary profiles included in the request, admin self-save succeeds, and invalid discriminator/stage-domain pairs return 400.

```ts
expect(update).toHaveBeenCalledWith('user-1', {
  learningOnboarding: expect.objectContaining({
    version: 2,
    status: 'completed',
    primaryIdentity: 'educator',
  }),
});
expect(update.mock.calls[0][1]).not.toHaveProperty('educationLevel');
expect(update.mock.calls[0][1]).not.toHaveProperty('favoriteSubjects');
```

- [ ] **Step 2: Run API tests and verify v1 behavior fails the assertions**

Run: `pnpm vitest run tests/onboarding/learning-onboarding-api.test.ts`

Expected: FAIL because PUT still expects `educationLevel`, `grade`, and v1 fields.

- [ ] **Step 3: Update GET and PUT around the normalized v2 boundary**

GET calls `readUniversalOnboarding(user)` and derives status from the original stored record. PUT parses one complete input, assigns `status`, `completedAt`, and each submitted primary profile's `completedAt` on the server, then updates only `learningOnboarding`.

When an edit request contains `migratedFromVersion: 1`, allow the marker only when the authenticated user's stored record is v1 completed. Do not allow callers to forge the marker for a native v2 profile.

- [ ] **Step 4: Update skip to version 2 without clearing legacy fields**

```ts
const skipped: LearningOnboardingProfile = {
  version: CURRENT_ONBOARDING_VERSION,
  status: 'skipped',
  skippedAt: Date.now(),
};
await dao.update(auth.user.id, { learningOnboarding: skipped });
```

- [ ] **Step 5: Add a memory-provider v2 JSON round-trip assertion**

Store a profile with two identities and a custom undergraduate domain, reload it, and compare deep equality. No provider implementation changes are expected because the field is already JSON.

- [ ] **Step 6: Run API and storage tests**

Run: `pnpm vitest run tests/onboarding/learning-onboarding-api.test.ts tests/storage/memory-provider.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the API boundary**

```bash
git add app/api/user/learning-onboarding/route.ts app/api/user/learning-onboarding/skip/route.ts tests/onboarding/learning-onboarding-api.test.ts tests/storage/memory-provider.test.ts
git commit -m "feat: persist universal onboarding profiles"
```

### Task 3: Focused Form State And Recommendation Selectors

**Files:**
- Create: `lib/onboarding/form-state.ts`
- Create: `lib/onboarding/selectors.ts`
- Create: `tests/onboarding/form-state.test.ts`
- Create: `tests/onboarding/selectors.test.ts`

**Interfaces:**
- Produces: `createInitialFormState()`, `setPrimaryIdentity(state, identity)`, `setContextStage(state, contextIndex, stage)`, `toCompletionInput(state)`.
- Produces: `getPrimaryIdentityProfile(profile)`, `getLearnerSelfReport(profile)`, `resolveOnboardingRecommendation(profile, redirect)`.

- [ ] **Step 1: Write failing state-preservation and recommendation tests**

Cover multi-select identity changes, switching primary identity without deleting secondary drafts, stage changes clearing only that context's domains, custom-domain normalization, v2 edit hydration, learner diagnostic recommendation, educator plan recommendation, and sanitized fallback redirect.

```ts
const changed = setContextStage(state, 1, 'undergraduate');
expect(changed.drafts.educator.contexts[0]).toEqual(state.drafts.educator.contexts[0]);
expect(changed.drafts.educator.contexts[1].domains).toEqual([]);
```

- [ ] **Step 2: Run helper tests and verify exports are missing**

Run: `pnpm vitest run tests/onboarding/form-state.test.ts tests/onboarding/selectors.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement minimal immutable form helpers**

Keep UI-only drafts separate per identity. New primary drafts receive identity-specific balanced preferences and one empty context. Serialize only selected identities and only the completed primary identity; preserve already completed secondary profiles loaded from edit mode.

- [ ] **Step 4: Implement centralized selectors**

`getLearnerSelfReport` returns declared domains/needs only for a learner profile. `resolveOnboardingRecommendation` matches identity, stage, first domain, and first goal, returning `{ primaryHref, primaryLabel, secondaryHref }`; unknown combinations return the sanitized redirect as both safe fallback and secondary action.

- [ ] **Step 5: Run helper tests**

Run: `pnpm vitest run tests/onboarding/form-state.test.ts tests/onboarding/selectors.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit state and selectors**

```bash
git add lib/onboarding/form-state.ts lib/onboarding/selectors.ts tests/onboarding/form-state.test.ts tests/onboarding/selectors.test.ts
git commit -m "feat: add universal profile form helpers"
```

### Task 4: Three-Step Universal Identity UI

**Files:**
- Create: `components/sky/onboarding/domain-picker.tsx`
- Create: `components/sky/onboarding/identity-context-editor.tsx`
- Modify: `components/sky/onboarding/learning-profile-onboarding.tsx`
- Modify: `tests/onboarding/learning-profile-onboarding.test.tsx`

**Interfaces:**
- Consumes: catalog, form-state, and selector APIs from Tasks 1 and 3.
- Preserves: `LearningProfileOnboarding` export and `/sky/onboarding` route.

- [ ] **Step 1: Replace v1 UI tests with failing identity/stage branch tests**

Test learner single-stage, educator multi-stage, guardian wording, manager wording, other identity, K-12 catalog restriction, undergraduate search/custom entry, multi-identity primary choice, one-minute defaults, load retry, save retry preserving all answers, skip, and edit hydration.

Assert the submitted payload is version 2 and secondary identities remain selected but incomplete:

```ts
expect(payload).toMatchObject({
  version: 2,
  identities: ['learner', 'educator'],
  primaryIdentity: 'educator',
  profiles: { educator: { identity: 'educator' } },
});
expect(payload.profiles.learner).toBeUndefined();
```

- [ ] **Step 2: Run UI tests and verify the old learner-only flow fails**

Run: `pnpm vitest run tests/onboarding/learning-profile-onboarding.test.tsx`

Expected: FAIL on the missing identity step and stage branches.

- [ ] **Step 3: Implement Step 1 identity selection**

Render a semantic fieldset with five identity choices, a compact primary-identity segmented choice when more than one is selected, and copy stating that identity does not change permissions. Require at least one identity and one primary identity.

- [ ] **Step 4: Implement Step 2 stage-owned domain editors**

`identity-context-editor.tsx` uses the primary identity's labels and context cardinality. K-12 stages render catalog choice buttons; open stages render suggestions, a labeled search input, and a custom-domain input. Educator/guardian/manager can add up to five stage groups and remove extras; learner/other render exactly one.

Changing a populated stage requests confirmation, then clears only that context. Domain choice grids use stable dimensions and long labels wrap.

- [ ] **Step 5: Implement Step 3 goals, needs, preferences, and detail**

Render one to three identity-specific goals, zero to three needs, one defaulted preference, and a 120-character detail input. Keep fieldsets and legends accessible and associate errors with the failing group.

- [ ] **Step 6: Implement edit/load/save/completion behavior**

GET hydrates normalized v2 data. Save serializes one payload and keeps state on failure. Completion uses `resolveOnboardingRecommendation`; primary and fallback actions are optional. Skip and safe redirect behavior remain unchanged.

- [ ] **Step 7: Run UI tests**

Run: `pnpm vitest run tests/onboarding/learning-profile-onboarding.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit the universal UI**

```bash
git add components/sky/onboarding/domain-picker.tsx components/sky/onboarding/identity-context-editor.tsx components/sky/onboarding/learning-profile-onboarding.tsx tests/onboarding/learning-profile-onboarding.test.tsx
git commit -m "feat: add universal identity onboarding flow"
```

### Task 5: Identity-Aware Personalization Without Mastery Pollution

**Files:**
- Modify: `lib/assistant/personalization.ts`
- Modify: `app/api/sky/cloud-mind/personalization-context/route.ts`
- Modify: `tests/assistant/personalization.test.ts`
- Create: `tests/onboarding/profile-consumption.test.ts`

**Interfaces:**
- Consumes: `readUniversalOnboarding`, `getPrimaryIdentityProfile`, `getLearnerSelfReport`.
- Produces: identity-specific assistant context while retaining `teachingPreference` compatibility for migrated/current learners.

- [ ] **Step 1: Write failing consumption regression tests**

Assert learner `explanationStyle` reaches assistant personalization, educator support preference yields educator-specific prompt copy, guardian and manager needs do not populate `selfReportedWeakSubjects`, and observed `StudentProfile` remains the only mastery evidence.

- [ ] **Step 2: Run tests and verify direct v1 field reads fail**

Run: `pnpm vitest run tests/assistant/personalization.test.ts tests/onboarding/profile-consumption.test.ts`

Expected: FAIL because consumers still read `learningOnboarding.weakSubjects` and `.teachingPreference`.

- [ ] **Step 3: Route assistant personalization through selectors**

Extend `AssistantPersonalization` with a compact product identity context while keeping learner `teachingPreference` compatibility. Build role-specific prompt lines from the primary profile's goals, needs, and preference; never map non-learner fields into mastery-related input.

- [ ] **Step 4: Restrict Cloud Mind self-report to learner support domains**

Replace the direct `weakSubjects` read with `getLearnerSelfReport(readUniversalOnboarding(user))`. Pass only learner support-domain names/IDs as self-reported context. Observed profile inputs and their precedence remain unchanged.

- [ ] **Step 5: Run consumption tests**

Run: `pnpm vitest run tests/assistant/personalization.test.ts tests/onboarding/profile-consumption.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit personalization consumption**

```bash
git add lib/assistant/personalization.ts app/api/sky/cloud-mind/personalization-context/route.ts tests/assistant/personalization.test.ts tests/onboarding/profile-consumption.test.ts
git commit -m "feat: personalize assistants by product identity"
```

### Task 6: Entry Copy, Focused Regression, And Browser Verification

**Files:**
- Modify: `components/account/personalization-form.tsx`
- Modify: `components/sky/dashboard/learning-profile-prompt.tsx`
- Modify: `tests/onboarding/learning-profile-prompt.test.tsx`
- Modify only if needed: `components/auth/onboarding-gate.tsx`
- Modify only if needed: `tests/onboarding/onboarding-gate.test.tsx`

**Interfaces:**
- Preserves: ordinary pending-user gate and admin pass-through.
- Updates: visible copy from learner-only “学习画像” to role-neutral “用户画像”.

- [ ] **Step 1: Write failing role-neutral entry-copy assertions**

Assert the account link is named `填写/编辑用户画像`, skipped dashboard entry is `完善用户画像`, and both retain their current safe URLs. Keep the existing admin non-redirect and manual-route tests.

- [ ] **Step 2: Run entry/gate tests**

Run: `pnpm vitest run tests/onboarding/learning-profile-prompt.test.tsx tests/onboarding/onboarding-gate.test.tsx`

Expected: entry-copy test FAIL; gate tests PASS without production changes.

- [ ] **Step 3: Update only role-neutral visible copy**

Change the two links and supporting descriptions. Do not alter account tabs, auth roles, or dashboard layout.

- [ ] **Step 4: Run the focused onboarding suite**

Run:

```bash
pnpm vitest run \
  tests/onboarding/types.test.ts \
  tests/onboarding/learning-onboarding-api.test.ts \
  tests/onboarding/form-state.test.ts \
  tests/onboarding/selectors.test.ts \
  tests/onboarding/learning-profile-onboarding.test.tsx \
  tests/onboarding/learning-profile-prompt.test.tsx \
  tests/onboarding/onboarding-gate.test.tsx \
  tests/onboarding/profile-consumption.test.ts \
  tests/assistant/personalization.test.ts \
  tests/storage/memory-provider.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run repository checks in the prescribed order**

Run: `pnpm check`

Run: `pnpm lint`

Run: `npx tsc --noEmit`

Run: `pnpm test`

Expected: no new failures in touched files. Record the known repository-wide baseline failures separately rather than changing unrelated files.

- [ ] **Step 6: Verify desktop and mobile with the local app**

Start: `pnpm dev -- --port 3004`

Use Playwright at `1440x900` and `390x844` to verify all five identity branches, educator multi-stage add/remove, undergraduate custom domain, admin manual edit access, error preservation, and that sticky commands are not covered by global floating controls. Check console errors and confirm the page is nonblank.

- [ ] **Step 7: Commit entry copy and any verification-only fixes**

```bash
git add components/account/personalization-form.tsx components/sky/dashboard/learning-profile-prompt.tsx tests/onboarding/learning-profile-prompt.test.tsx
git commit -m "feat: expose universal user profile entry"
```

Do not add `data/student-profiles/admin-default.json`; it is runtime data outside this feature's source changes.
