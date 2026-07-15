# Course Studio Minimal Redesign Design

## Background

`/sky/cloud-mind/course-studio` currently tries to serve two jobs at once:
daily student use and competition demo proof. The page shows editable profile
fields, generation preferences, agent progress, safety review, resource cards,
P1 evidence, P2 long-term planning, learning path, and next actions in one
continuous surface.

That makes the page feel like a control room instead of a course resource
generator. The redesign keeps the multi-agent proof, but moves it behind a
secondary detail layer so the first screen is calm and action-oriented.

## Core Decision

Use a minimal task studio layout:

1. Before generation, show one intent input, one compact resource-type selector,
   one primary generate button, and two secondary text actions.
2. After generation, show the generated resources first.
3. Put profile details, agent progress, safety review, source evidence,
   P1 evidence, P2 long-term planning, and learning path behind expandable
   detail sections.

The page should answer one question before generation: "What do you want to
generate this time?"

## Non-Goals

- Do not remove existing resource generation APIs.
- Do not remove P1/P2 capabilities or learning-path data.
- Do not create a new route.
- Do not redesign the broader Sky navigation.
- Do not introduce a new design system or visual theme.

## Information Architecture

### Primary Surface

The initial view uses one centered work area with a constrained width.

It contains:

- Page title: course resource studio context.
- Short status chip: profile is ready, reading profile, or needs one hint.
- One input for the current need, backed by `supplement`.
- Compact resource-type pills. Show the common types first: lecture, PPT, quiz.
  Other types remain available through a "more" affordance or secondary row.
- Primary action: generate.
- Secondary actions: adjust profile basis and view generation flow.

Do not show full profile form fields, recommendation evidence lists, progress
cards, empty result cards, or long-term panels before generation.

### Generated Resources

After generation, replace the empty state with a result-first list:

- Summary row: number of resources, trust status, download-all or primary next
  action when available.
- Resource list items with type, title, short summary, confidence, and actions
  to view, copy, or download.
- Keep full content expansion inside each resource item.

Cards should not dominate the page. Prefer a vertical list so the result area
scans quickly and remains compact on mobile.

### Detail Layer

All technical and evidence content moves into collapsible sections below the
generated resources:

- `Why this fits you`: profile summary and recommendation evidence.
- `Generation process`: stage progress and agent trace.
- `Trust review`: safety result, source hits, resource quality checks.
- `Learning follow-up`: learning path, P1 evidence, P2 long-term planning, and
  next actions.

These sections are collapsed by default after generation, except a small trust
summary remains visible in the result header.

## Component Plan

Keep the implementation inside
`components/sky/course-studio/course-studio-page.tsx` for the first pass.

Recommended extracted subcomponents if the file becomes hard to read:

- `CourseStudioHero`
- `ResourceTypePills`
- `GeneratedResourceList`
- `CourseStudioDetails`
- `DetailSection`

Existing `CourseStudioP1EvidencePanel` and `CourseStudioP2LongTermPanel` can be
kept, but they should render inside the follow-up detail section instead of the
main result stream.

## State And Data Flow

Generation behavior stays the same:

1. Read personalization context on load.
2. Let personalization prefill the existing state values.
3. Build the student input with existing `buildStudentInput`.
4. Run content safety, profile extraction, knowledge search, generation, and
   stage updates in the current order.
5. Store `result`, `profile`, `hits`, and `safety` exactly as today.

The redesign changes presentation only. It should not change request payloads or
API response shapes.

## Empty, Loading, And Error States

Empty state:

- Show only the minimal generation studio.
- Use helper copy that says the system can generate from the existing profile or
  from one short hint.

Loading state:

- Keep the primary button disabled with spinner.
- Replace the visible stage-card grid with one compact progress row.
- Detailed stage cards can be shown only inside the generation-process section.

Error state:

- Keep the existing error banner near the studio input.
- Preserve the current validation rule that requires at least one meaningful
  input when profile signals are missing.

## Visual Constraints

- One primary call to action on the first screen.
- No large two-column form before generation.
- No always-visible P1/P2 panels in the main flow.
- Keep card radius and spacing consistent with existing Sky surfaces.
- Use icons in buttons where existing lucide icons already fit.
- Keep mobile layout single-column with the generate button easy to reach.

## Acceptance Criteria

- The first screen contains one main input, compact resource-type controls, and
  one generate action.
- Profile fields and recommendation evidence are not visible by default.
- Agent progress is summarized compactly while running.
- Generated resources appear before any technical evidence.
- P1 evidence and P2 long-term panels remain reachable after generation.
- Existing generation APIs and payloads continue to work unchanged.
- The page still supports answer-demo storytelling through expandable details.

## Verification

Run at least:

- `npx tsc --noEmit` if the local dependency state supports it.
- A targeted browser/manual check at `/sky/cloud-mind/course-studio`.

Manual check should cover:

- Empty profile or low-signal input validation.
- Generate button loading state.
- Generated resource list display.
- Detail sections expanding without layout crowding.
