# Universal Identity Profile Onboarding Design

**Date:** 2026-07-29
**Status:** Ready for implementation planning
**Supersedes:** `2026-07-28-learning-profile-onboarding-design.md`

## Goal

Replace the middle/high-school-only learning questionnaire with a universal profile onboarding that supports multiple product identities and all education or professional stages.

The onboarding must remain skippable and completable in about one minute. It collects only the minimum information needed to personalize the first useful action. Deeper identity-, stage-, and domain-specific details are collected later in context.

Product identity is separate from account authorization. A system `user` may be a learner, educator, guardian, education manager, or several of these at once. An `admin` account may manually fill and test the same product profiles without being automatically redirected.

## Research Basis

The design uses patterns confirmed in public product documentation:

- Khan Academy uses the same account creation entry for teachers, parents, and students, then customizes the account around classes, students, and classwork for educators.
- Quizlet explicitly records whether an account is used by a teacher and then exposes teacher-specific class, content, and progress workflows.
- Duolingo treats self-reported starting level as a hypothesis and offers a short adaptive placement test to determine the actual starting point.
- LinkedIn Learning combines career goals, followed skills, profile data, and later activity to update recommendations over time.

智眸无界 therefore uses role-first branching, optional diagnostics, and progressive profiling. It does not attempt to collect a complete permanent profile during registration.

## Product Decisions

- A user may select multiple product identities.
- The user selects one current primary identity.
- The first onboarding only completes the primary identity profile.
- Other selected identities remain available but explicitly incomplete.
- Switching to an incomplete identity later opens a compact, skippable completion flow for that identity.
- Learners have one primary current stage.
- Educators, guardians, and education managers may have multiple stage contexts.
- Each stage context owns its own domains. Domains are never stored as an unscoped global list.
- Identity-level needs and domain-level challenges are separate.
- Domain-level challenges are optional during onboarding and normally collected later inside the relevant tool.
- Preferences are identity-specific. A global teaching preference is not reused across unrelated identities.
- Self-reported needs never become measured mastery or observed weak points.
- Automatic onboarding applies to authenticated ordinary accounts.
- Guests cannot persist a profile.
- System administrators are not automatically redirected, but may manually enter, save, edit, and repeatedly test the complete flow.
- Skip remains terminal for automatic prompting. The profile can always be completed later from account settings.

## Identity Taxonomy

```ts
export const PRODUCT_IDENTITIES = [
  'learner',
  'educator',
  'guardian',
  'education-manager',
  'other',
] as const;
```

Display labels:

- `learner`: 学习者
- `educator`: 教师 / 培训者
- `guardian`: 家长 / 辅导者
- `education-manager`: 教育管理 / 教研者
- `other`: 其他

These values describe how the person currently uses 智眸无界. They do not grant permissions and must not be mapped to the authorization `role` column.

## Stage Taxonomy

```ts
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
```

Display labels:

- 学前
- 小学
- 初中
- 高中
- 中职 / 高职
- 本科
- 研究生
- 职业发展 / 成人学习
- 其他

The question label depends on identity:

- Learner: current learning stage.
- Educator: stages taught.
- Guardian: stages supported.
- Education manager: stages served or managed.
- Other: most relevant context stage; select `other` when none of the named stages fit.

## Stage-Aware Domain Input

The stage determines how domain choices are presented.

### Curated curriculum stages

Preschool, primary, middle, and high school use these stage-specific catalogs:

| Stage | Catalog domains |
| --- | --- |
| `preschool` | `language-enlightenment`, `early-math`, `science-exploration`, `arts`, `movement-health` |
| `primary` | `chinese`, `math`, `english`, `science`, `ethics-law`, `information-technology`, `arts`, `physical-health` |
| `middle` | `chinese`, `math`, `english`, `physics`, `chemistry`, `biology`, `history`, `geography`, `ethics-law`, `information-technology`, `arts`, `physical-health` |
| `high` | `chinese`, `math`, `english`, `physics`, `chemistry`, `biology`, `history`, `geography`, `politics`, `information-technology`, `general-technology`, `arts`, `physical-health` |

The catalog is not one shared K-12 list. A domain appears only where it is meaningful.

### Open-domain stages

Vocational, undergraduate, postgraduate, professional, and `other` stages use:

1. common suggested domains for the selected stage;
2. search across the local domain catalog;
3. custom domain entry.

The initial implementation uses local typed configuration and does not introduce a new database-backed taxonomy service.

The first local suggestion sets are deliberately broad because custom entry is always available:

| Stage | Suggested domains |
| --- | --- |
| `vocational` | `professional-foundations`, `practical-training`, `vocational-skills`, `certification`, `communication`, `digital-literacy` |
| `undergraduate` | `major-core`, `general-education`, `languages`, `programming`, `math-statistics`, `research-methods`, `career-development` |
| `postgraduate` | `discipline-specialty`, `research-methods`, `academic-writing`, `data-analysis`, `literature-review`, `career-development` |
| `professional` | `workplace-skills`, `certification`, `languages`, `digital-tools`, `management`, `communication` |
| `other` | `languages`, `math`, `science`, `humanities`, `technology`, `arts`, `health` |

```ts
type DomainRef =
  | { id: string; name: string; source: 'catalog' }
  | { name: string; source: 'custom' };
```

Custom values are trimmed, length-limited, deduplicated case-insensitively, and stored with `source: 'custom'`. They are not coerced into the existing K-12 `Subject` union.

Catalog display labels live beside these IDs in typed configuration and are localized independently of persisted values.

## Version 2 Data Contract

The existing `learningOnboarding` JSON field remains the persistence boundary. No new profile tables are introduced.

```ts
type ProfileGoal =
  | { id: string; label: string; source: 'catalog' }
  | { label: string; source: 'custom' };

type DomainSelection = {
  domain: DomainRef;
  challenges?: string[];
};

type LearnerContext = {
  stage: ProfileStage;
  learningDomains: DomainSelection[];
  supportDomains: DomainRef[];
  legacyGrade?: string;
};

type EducatorContext = {
  stage: ProfileStage;
  teachingDomains: DomainSelection[];
};

type GuardianContext = {
  stage: ProfileStage;
  supportDomains: DomainSelection[];
};

type EducationManagerContext = {
  stage: ProfileStage;
  managedDomains: DomainSelection[];
};

type OtherContext = {
  stage: ProfileStage;
  domains: DomainSelection[];
};
```

Identity profiles form a discriminated union so consumers cannot accidentally read learner fields from an educator profile.

```ts
type LearnerProfile = {
  identity: 'learner';
  context: LearnerContext;
  goals: ProfileGoal[];
  roleNeeds: LearnerNeed[];
  preferences: LearnerPreferences;
  detail?: string;
  completedAt: number;
};

type EducatorProfile = {
  identity: 'educator';
  contexts: EducatorContext[];
  goals: ProfileGoal[];
  roleNeeds: EducatorNeed[];
  preferences: EducatorPreferences;
  detail?: string;
  completedAt: number;
};

type GuardianProfile = {
  identity: 'guardian';
  contexts: GuardianContext[];
  goals: ProfileGoal[];
  roleNeeds: GuardianNeed[];
  preferences: GuardianPreferences;
  detail?: string;
  completedAt: number;
};

type EducationManagerProfile = {
  identity: 'education-manager';
  contexts: EducationManagerContext[];
  goals: ProfileGoal[];
  roleNeeds: EducationManagerNeed[];
  preferences: EducationManagerPreferences;
  detail?: string;
  completedAt: number;
};

type OtherProfile = {
  identity: 'other';
  context: OtherContext;
  goals: ProfileGoal[];
  roleNeeds: OtherNeed[];
  preferences: OtherPreferences;
  detail?: string;
  completedAt: number;
};

type IdentityProfile =
  | LearnerProfile
  | EducatorProfile
  | GuardianProfile
  | EducationManagerProfile
  | OtherProfile;
```

The stored record is versioned:

```ts
type UniversalOnboardingProfile =
  | {
      version: 2;
      status: 'completed';
      identities: ProductIdentity[];
      primaryIdentity: ProductIdentity;
      profiles: Partial<Record<ProductIdentity, IdentityProfile>>;
      completedAt: number;
      migratedFromVersion?: 1;
    }
  | {
      version: 2;
      status: 'skipped';
      skippedAt: number;
    };
```

Validation requires the primary identity to be present in `identities` and to have a matching completed profile. Secondary identities may be absent from `profiles`.

Learner and other profiles have exactly one context. Educator, guardian, and education manager profiles have one to five contexts, and a stage may appear only once within one profile. Every `DomainSelection` is therefore owned by exactly one identity and one stage.

Validation limits are fixed for this version: one to five identities, one to twelve domains per context, one to three goals, zero to three role needs, custom domain and goal labels up to 40 characters, profile detail up to 120 characters, and zero to five progressive challenge strings of up to 80 characters each per domain.

## Identity-Specific Preferences

Preference schemas are separate even when some display choices overlap. To keep the first-run flow short, each identity answers one preference question:

```ts
type LearnerPreferences = {
  explanationStyle:
    | 'example-first'
    | 'visual-explanation'
    | 'step-by-step'
    | 'practice-first'
    | 'balanced';
};

type EducatorPreferences = {
  primarySupport:
    | 'lesson-plan-structure'
    | 'classroom-interaction'
    | 'difficulty-progression'
    | 'material-presentation'
    | 'balanced';
};

type GuardianPreferences = {
  guidanceStyle:
    | 'step-by-step-guidance'
    | 'hint-first'
    | 'encouraging-feedback'
    | 'short-session'
    | 'balanced';
};

type EducationManagerPreferences = {
  managementFocus:
    | 'overview-analysis'
    | 'detailed-reporting'
    | 'resource-organization'
    | 'cross-group-comparison'
    | 'balanced';
};

type OtherPreferences = {
  collaborationStyle:
    | 'structured-content'
    | 'visual-content'
    | 'interactive-practice'
    | 'conversational-guidance'
    | 'balanced';
};
```

All five preference objects are required for completed profiles and default to `balanced` in a new form. The UI may render the choice as optional by retaining that default. The implementation must not fall back to an unrestricted `Record<string, unknown>` contract.

## Identity-Specific Goals And Needs

Goals and needs are also validated against the active identity rather than one shared list. Users select one to three goals and zero to three optional needs. Each catalog includes an “other” control that stores a length-limited custom `ProfileGoal`; free-text needs are not collected during first onboarding.

| Identity | Goal catalog | Need catalog |
| --- | --- | --- |
| Learner | `improve-grades`; `exam-prep`; `build-foundations`; `explore-interest`; `career-skills` | `identify-gaps`; `learning-plan`; `clearer-explanations`; `practice-feedback`; `motivation` |
| Educator | `prepare-lessons`; `create-materials`; `classroom-interaction`; `design-assessment`; `professional-development` | `differentiated-instruction`; `question-design`; `resource-adaptation`; `feedback-support`; `reduce-repetitive-work` |
| Guardian | `homework-support`; `learning-habits`; `address-gaps`; `develop-interests`; `family-learning-communication` | `age-appropriate-guidance`; `hint-strategy`; `short-session-plan`; `understand-progress`; `resource-selection` |
| Education manager | `curriculum-planning`; `resource-governance`; `teaching-quality`; `learning-data-analysis`; `educator-development` | `standards-alignment`; `content-organization`; `cohort-comparison`; `report-generation`; `cross-team-collaboration` |
| Other | `acquire-knowledge`; `complete-project`; `certification-prep`; `career-skills`; `explore-interests` | `learning-path`; `material-selection`; `practice-feedback`; `ai-collaboration`; `time-planning` |

The need unions use stable IDs matching those catalog entries:

```ts
type LearnerNeed =
  | 'identify-gaps'
  | 'learning-plan'
  | 'clearer-explanations'
  | 'practice-feedback'
  | 'motivation';
type EducatorNeed =
  | 'differentiated-instruction'
  | 'question-design'
  | 'resource-adaptation'
  | 'feedback-support'
  | 'reduce-repetitive-work';
type GuardianNeed =
  | 'age-appropriate-guidance'
  | 'hint-strategy'
  | 'short-session-plan'
  | 'understand-progress'
  | 'resource-selection';
type EducationManagerNeed =
  | 'standards-alignment'
  | 'content-organization'
  | 'cohort-comparison'
  | 'report-generation'
  | 'cross-team-collaboration';
type OtherNeed =
  | 'learning-path'
  | 'material-selection'
  | 'practice-feedback'
  | 'ai-collaboration'
  | 'time-planning';
```

## Three-Step User Flow

### Step 1: Identity

- Select one or more product identities.
- Select the current primary identity.
- Explain that identities can be changed later and do not affect account permissions.

### Step 2: Stage and domains

The page renders the primary identity's context editor.

- Learner: one stage and its learning/focus domains.
- Educator: one stage context by default, with an optional “add another teaching stage” action.
- Guardian: one support stage by default, with an optional add action.
- Education manager: one service stage by default, with an optional add action.
- Other: one required stage and the domain editor dictated by that stage; open-domain stages include suggestions, search, and custom entry.

Changing a stage resets only the domains under that stage after confirmation when necessary. It never clears another stage or identity.

### Step 3: Goals, needs, and preferences

Render identity-specific catalogs and wording.

- Select one to three goals.
- Select optional identity-level needs.
- Select identity-specific preferences.
- Optionally enter one short “most important problem” detail.

The onboarding does not ask users to describe challenges for every domain. Those fields are supported by the contract but collected progressively.

## Progressive Profiling

After onboarding, tools may request missing details only when the context is relevant.

Examples:

- Creating a high-school mathematics class may ask an educator about function-teaching challenges.
- Starting undergraduate English practice may ask a learner for current level and target skill.
- Generating a primary-school support plan may ask a guardian for the specific topic and desired session length.

Every progressive answer must be written to the active identity, stage, and domain node. A tool must not write into a global weakness or preference field.

Progressive prompts are dismissible and should not repeatedly ask for a value that is already known.

## Completion Recommendations

Completion actions are resolved from:

```text
primary identity + selected stage + selected domain + selected goal
```

They are not resolved from identity alone.

Examples:

- High-school mathematics educator + lesson preparation -> create a mathematics lesson or teaching plan.
- Adult English learner + skill improvement -> start an English level diagnostic or speaking practice.
- Primary-school guardian + homework support -> generate a stage/domain-specific support plan.
- Education manager + curriculum construction -> open course planning or resource organization.

All completion actions are optional. A secondary action always returns to the sanitized original destination.

## Entry And Editing

`/api/auth/me` continues to expose a compact onboarding status.

Automatic gate behavior:

- unauthenticated/guest: no persisted onboarding;
- ordinary authenticated account with no completed/skipped profile: redirect once;
- completed/skipped ordinary account: continue normally;
- system administrator: never automatically redirected;
- auth routes and onboarding routes: always excluded from redirect loops.

Manual behavior:

- Any authenticated account, including administrators, may open the onboarding page directly.
- Account settings expose “填写/编辑用户画像”.
- Administrators can use the seeded admin account to complete, save, and edit every identity branch.
- Verifying the automatic first-login gate still requires an ordinary test account.

## API Design

Keep the existing route family:

- `GET /api/user/learning-onboarding`
- `PUT /api/user/learning-onboarding`
- `POST /api/user/learning-onboarding/skip`

GET returns the versioned profile and a server-derived status.

PUT accepts one complete version 2 payload, validates all identity/stage/domain ownership, and performs one user update. Edit mode may update the identity set, primary identity, or one completed subprofile without clearing other profiles.

Skip writes only the version 2 skipped record and does not clear legacy personalization fields.

All endpoints use the authenticated user ID. Administrator access uses the same self-profile API and does not permit editing another user's profile.

## Version 1 Compatibility

Existing version 1 completed records are interpreted through one central adapter that reads both the JSON record and the legacy user columns:

```ts
type LegacyProfileSource = {
  learningOnboarding: LearningOnboardingProfile | null;
  educationLevel: string | null;
  grade: string | null;
  favoriteSubjects: Array<{ id: string; name: string; enabled: boolean }> | null;
};

function readUniversalOnboarding(source: LegacyProfileSource): UniversalOnboardingProfile;
```

The adapter produces a completed learner profile using these exact rules:

- The returned view has `version: 2`, `status: 'completed'`, and `migratedFromVersion: 1`; reading it does not write it back.
- `identities` is `['learner']` and `primaryIdentity` is `'learner'`.
- Legacy `educationLevel` values `middle` and `high` become `context.stage`; any missing or unsupported value becomes `other`.
- Legacy `grade`, when non-empty, becomes `context.legacyGrade`.
- Enabled legacy `favoriteSubjects` become `context.learningDomains` with catalog IDs and labels from `SUBJECT_CONFIG`.
- Version 1 `weakSubjects` become `context.supportDomains` with catalog IDs and labels; they are self-report, never measured weak points.
- Version 1 `learningGoal` becomes one catalog `ProfileGoal` using the same ID and configured display label.
- Version 1 `goalDetail` becomes learner `detail`.
- Version 1 `teachingPreference` becomes `preferences.explanationStyle` without renaming its enum value.
- The version 1 `completedAt` is retained at both record and learner-profile level.

Version 1 completed users are not automatically interrupted again. The settings entry offers a non-blocking profile upgrade. On the first successful version 2 edit, the server persists the version 2 record with `migratedFromVersion: 1`.

Version 1 skipped users remain terminal for automatic prompting and may manually start version 2.

The legacy `educationLevel`, `grade`, and `favoriteSubjects` columns remain readable for compatibility but are not the source of truth for version 2. Central profile adapters expose the relevant learner context to older consumers during the transition.

## Personalization Consumption

Add centralized selectors:

- resolve current primary identity profile;
- resolve identity-specific contexts and domains;
- build identity-specific assistant instructions;
- resolve optional completion/tool recommendations;
- expose learner self-report separately from observed learning data.

Observed `StudentProfile` remains learner-only evidence from diagnostics, mistakes, and behavior. Educator, guardian, and manager needs must never be copied into learner mastery fields.

When observed learner data exists, it wins over learner self-report for mastery recommendations. Declared goals and presentation preferences may still influence format and sequencing.

## Configuration Boundaries

Use typed local configuration for:

- identity labels and descriptions;
- stage labels and cardinality rules;
- stage domain suggestions;
- identity-specific goals;
- identity-specific needs;
- identity-specific preference controls;
- completion recommendation rules.

The UI reads this configuration but the persisted payload remains validated independently by Zod. Configuration visibility is not considered validation.

This is not a generic questionnaire engine. The components remain specific to profile onboarding and use explicit typed fieldsets.

## Privacy And Safety

- Do not request a child name, school name, class identifier, address, or contact information.
- Guardian profiles describe support context, not a separately identifiable child profile.
- Custom domains and details are length-limited and treated as untrusted text.
- Identity choices do not change authorization.
- Recommendations must not infer protected or sensitive attributes from selected domains or goals.

## Error Handling

- Load failure: show retry; do not replace saved data with defaults.
- Save failure: preserve every selected identity, context, domain, goal, and preference.
- Duplicate custom domains: normalize and show one value.
- Invalid identity/profile discriminator: reject the payload.
- Invalid stage/domain catalog combination: reject catalog IDs; custom domains remain allowed for open-domain stages.
- Removing a selected identity with an existing profile: require explicit confirmation, then remove only that identity profile.
- Switching primary identity to an incomplete profile: offer the compact completion flow and allow cancellation.
- Skip failure: remain on the current step and permit retry.

## Accessibility And Responsive Behavior

- Use semantic `fieldset` and `legend` elements for identity, stage, domain, goal, and preference groups.
- All selectable controls expose pressed/checked state beyond color.
- Search and custom-domain entry have explicit labels and keyboard support.
- Added stage groups do not become nested decorative cards.
- At 390px, commands remain reachable and are not covered by global floating controls.
- Long custom domain names wrap without resizing the control grid.
- Error text is associated with the relevant group and announced appropriately.

## Testing Scope

### Contracts

- valid profile for every identity;
- primary identity/profile ownership;
- learner single-context rule;
- multi-context educator/guardian/manager rules;
- stage-specific catalog domain validation;
- custom domain normalization and limits;
- identity-specific preference schemas;
- version 1 compatibility conversion.

### API and persistence

- GET version 1 and version 2 records;
- complete, edit, and skip version 2;
- preserve unrelated secondary profiles during edit;
- administrator self-profile access;
- reject cross-user editing;
- memory, MySQL, and Supabase JSON round trips.

### Gate

- pending ordinary user redirect;
- completed/skipped pass-through;
- guest and administrator pass-through;
- manual administrator onboarding access;
- safe internal redirect handling.

### UI

- identity multi-select and primary identity;
- learner single-stage flow;
- educator/guardian/manager multi-stage flow;
- stage-specific domain catalogs;
- higher-education search/custom domains;
- role-specific goals and preferences;
- preserve answers after failure;
- edit an existing identity without clearing others;
- mobile controls remain unobstructed.

### Personalization regression

- educator needs do not enter learner mastery;
- guardian context does not create a child account/profile;
- version 1 learner behavior remains available;
- observed learner evidence outranks learner self-report;
- recommendation routing uses identity, stage, domain, and goal together.

## Non-Goals

- Do not change authentication roles or authorization checks.
- Do not build organization-level permissions or teacher/student account linking.
- Do not build a complete university major taxonomy service.
- Do not create identifiable child profiles for guardians.
- Do not require a diagnostic during onboarding.
- Do not collect detailed challenges for every domain on first login.
- Do not build a generic survey engine.
- Do not normalize the profile into multiple relational tables in this iteration.
- Do not refactor unrelated student profile, dashboard, or storage architecture.

## Acceptance Criteria

1. A user may select several product identities and one primary identity without changing account permissions.
2. The initial flow completes the primary identity in three steps and about one minute.
3. Learner context is single-stage; educator, guardian, and manager contexts may cover multiple stages.
4. Every domain is owned by a specific identity and stage context.
5. Middle/high school users receive curriculum subjects; university/professional users receive suggestions, search, and custom entry rather than K-12 subjects.
6. Goals, needs, and preferences use identity-specific schemas and wording.
7. Secondary identities remain intact and can be completed later.
8. Version 1 users retain their data and are not forced through onboarding again.
9. Administrators can manually test and save all branches but are not automatically redirected.
10. Self-reported learner needs remain separate from observed mastery and weak points.
11. Completion recommendations use identity, stage, domain, and goal together.
12. Save/skip failures preserve input and allow retry.
13. Desktop and 390px mobile layouts have no overlap, overflow, or blocked controls.
