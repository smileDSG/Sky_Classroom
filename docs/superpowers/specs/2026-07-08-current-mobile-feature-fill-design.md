# Current Mobile Feature Fill Design

Date: 2026-07-08

## Goal

Bring the newer web-side learning features into the existing mobile experience without replacing
the current mobile shell, visual language, or route structure.

The mobile app already has a recognizable direction: dark cards, `/m/sky/*` routes, quick entrance
navigation, and student-centered learning pages. This design extends that work instead of starting
over.

## Current Context

Native or mostly native mobile pages already exist:

- `/m/sky`
- `/m/sky/cloud-mind`
- `/m/sky/study-lab`
- `/m/sky/learning/profile`
- `/m/sky/learning/review`
- `/m/sky/profile`
- `/m/sky/assistant` entry view

Several task pages still fall back to `MobileSkyFrame`:

- `/m/sky/cloud-mind/solve`
- `/m/sky/cloud-mind/quiz`
- `/m/sky/cloud-mind/slides`
- `/m/sky/cloud-mind/teaching`
- `/m/sky/learning/mistakes`
- `/m/sky/learning/stats`
- `/m/sky/learning/graph`
- `/m/sky/question-bank`
- `/m/sky/learning/review/plan`

Some newer web features do not yet have a mobile route or mobile entry:

- `/sky/cloud-mind/memory`
- `/sky/cloud-mind/course-studio`
- `/sky/software-cup`
- selected question-bank detail/share/import flows

## Product Direction

Use the existing mobile app as the source of truth.

Keep:

- `components/mobile/mobile-sky-shell.tsx`
- `components/mobile/mobile-quick-entrance-nav.tsx`
- Current `/m/sky/*` URL structure
- Current dark card visual style
- Current home, cloud mind, study lab, assistant, and profile grouping

Do not switch this effort to the newer `components/mobile/shell/*` system. That can be a separate
foundation refactor later.

## Design Approach

The mobile app should prioritize the daily student learning loop:

1. Capture or enter a problem.
2. Get explanation and knowledge-point diagnosis.
3. Generate targeted practice.
4. Save weak points into memory cards or review tasks.
5. Return to the study lab to see the next action.

Teacher/editor-heavy tools should be present, but not allowed to dominate the first mobile pass.
For complex editors, mobile gets an entry/summary/start page first, while the full editor can remain
behind a framed fallback.

## Navigation Model

Keep the current quick entrance model and add missing destinations where useful:

- Home: `/m/sky`
- AI tools: `/m/sky/cloud-mind`
- Study lab: `/m/sky/study-lab`
- AI assistant: `/m/sky/assistant`
- Profile: `/m/sky/profile`

The cloud mind page becomes the main mobile tool shelf. It should include:

- Photo solve: `/m/sky/cloud-mind/solve`
- Smart quiz: `/m/sky/cloud-mind/quiz`
- Memory cards: `/m/sky/cloud-mind/memory`
- Courseware/slides: `/m/sky/cloud-mind/slides`
- Teaching plan: `/m/sky/cloud-mind/teaching`
- Course studio: `/m/sky/cloud-mind/course-studio`

The study lab remains the learning loop controller. It should link into quiz, memory, review plan,
teaching, and profile based on the current `/api/sky/workshop` signals.

## Feature Design

### 1. Memory Cards

Route: `/m/sky/cloud-mind/memory`

Mobile behavior:

- If no deck exists, show a compact generator form.
- Pre-fill topic/content from URL params when coming from weak points, mistakes, quiz, or review.
- Offer quick chips from personalization context, such as weak points and due review topics.
- When a deck exists, show one card per screen.
- Tap card to flip between prompt and answer.
- Bottom actions: `还不会`, `模糊`, `掌握了`.
- Record review status using the existing spaced-repetition helpers.

Fallback:

- Advanced export/download actions can remain in the web page or be hidden on mobile initially.

### 2. Review Plan

Route: `/m/sky/learning/review/plan`

Mobile behavior:

- Replace the iframe with a native daily-task list.
- Use `/api/sky/workshop` data when available.
- Show 3 to 5 tasks, not the full review universe.
- Each task has one clear action:
  - Review wrong question.
  - Generate similar quiz.
  - Create memory cards.
  - Ask assistant.
- Empty state directs the user to photo solve or quiz to create learning signals.

### 3. Photo Solve

Route: `/m/sky/cloud-mind/solve`

Mobile behavior:

- First screen is a mobile capture/input page, not the desktop solve UI.
- Entry methods:
  - Upload/photo button.
  - Text input.
  - Optional recent question shortcut.
- Result view uses vertical cards:
  - Recognized problem.
  - Short answer.
  - Step explanation.
  - Knowledge points.
  - Mistake-risk hints.
  - Similar-practice entry.
- Bottom actions:
  - Generate quiz.
  - Make memory cards.
  - Ask assistant.

Fallback:

- Deep diagnostic and math-test pages can remain framed until a later pass.

### 4. Smart Quiz

Route: `/m/sky/cloud-mind/quiz`

Mobile behavior:

- Use a compact setup flow:
  - Knowledge point.
  - Difficulty.
  - Question count.
- During practice, show one question per screen.
- Keep the answer area and submit button within thumb reach.
- After submission, show correctness, explanation, weak point, and next action.
- After the quiz, offer:
  - Retry weak points.
  - Make memory cards.
  - Go to review plan.

Fallback:

- Complex desktop preview panels and large configuration blocks stay out of the first mobile pass.

### 5. Assistant Chat

Route: `/m/sky/assistant?view=chat`

Mobile behavior:

- Keep the existing assistant landing page.
- Replace the framed chat view with a mobile chat shell:
  - Message list.
  - Quick prompt chips.
  - Sticky input bar.
  - Subject/style/difficulty summary chips.
- History and settings can still frame the desktop assistant until later.

### 6. Course Studio

Route: `/m/sky/cloud-mind/course-studio`

Mobile behavior:

- Add a native entry page rather than a full mobile editor.
- Explain the current student-resource generation goal in product language.
- Provide:
  - A short learning-goal input.
  - Resource type chips.
  - Start generation button.
  - Recent generated resources or empty state.
- Full trace, review, and multi-panel resource inspection can remain framed behind an advanced link.

### 7. Question Bank and Teacher Tools

Routes:

- `/m/sky/question-bank`
- `/m/sky/cloud-mind/slides`
- `/m/sky/cloud-mind/teaching`

Mobile behavior:

- Keep framed fallback for full editing.
- Add mobile-friendly entry/summary pages later:
  - Question bank: search, filter chips, recent questions.
  - Slides: topic input and generation status.
  - Teaching: topic input and generated plan summary.

These are second-pass items after the student learning loop is usable.

## UI Rules

Continue the current mobile visual language, with small corrections:

- Keep dark cards and compact mobile sections.
- Use existing lucide icons.
- Minimum tappable target: 44px.
- Body text should be at least 12px, preferably 14px for primary content.
- Avoid adding more glow blobs or oversized gradients.
- Keep cards readable with strong foreground/background contrast.
- Use bottom fixed actions only for primary task screens.
- Leave bottom padding for the quick entrance nav and safe area.

## Data Flow

Primary data sources:

- `/api/sky/workshop` for study lab, review signals, weak points, and learning stats.
- `/api/sky/cloud-mind/personalization-context` for weak-point recommendations.
- Existing solve, quiz, memory, assistant, and task-store APIs for feature-specific behavior.

Cross-feature handoffs should use URL params first:

- `topic`
- `content`
- `source`
- `difficulty`
- `count`

Example:

- Solve result to quiz: `/m/sky/cloud-mind/quiz?topic=<knowledge-point>`
- Quiz wrong point to memory: `/m/sky/cloud-mind/memory?topic=<knowledge-point>&content=<wrong-question-summary>`
- Study lab weak point to teaching: `/m/sky/cloud-mind/teaching?topic=<knowledge-point>`

## Error and Empty States

Every native mobile task page should have:

- Loading state with short copy.
- Empty state with a next action.
- Error state with retry and a fallback action.
- Safe fallback to the framed web page only for advanced flows.

## Implementation Phases

### Phase 1: Current Mobile Completion

- Add `/m/sky/cloud-mind/memory`.
- Add `/m/sky/cloud-mind/course-studio` entry page.
- Replace `/m/sky/learning/review/plan` iframe with a native task list.
- Update `/m/sky/cloud-mind` cards to include missing current tools.

### Phase 2: High-Frequency Task Screens

- Add native first screen for `/m/sky/cloud-mind/solve`.
- Add native first screen for `/m/sky/cloud-mind/quiz`.
- Replace `/m/sky/assistant?view=chat` iframe with mobile chat shell.

### Phase 3: Supporting Learning Pages

- Native mistake list.
- Native stats summary.
- Native knowledge graph summary.

### Phase 4: Teacher and Editor Tools

- Mobile summary/start pages for slides, teaching, question bank, and course studio advanced views.
- Keep full desktop editors framed until there is a dedicated mobile editing design.

## Testing

Add focused tests around:

- Mobile cloud mind tool cards include new destinations.
- Memory mobile page renders generator and study modes.
- Review plan mobile page renders tasks and empty state.
- Study lab links continue to point to `/m/*` routes.
- Assistant chat route does not fall back to iframe for `view=chat`.

Manual QA:

- 375px viewport.
- Tall phone viewport.
- Dark mode.
- No horizontal scroll.
- Bottom nav and sticky actions do not overlap content.

## Non-Goals

- Replacing the current mobile shell.
- Fully mobile-optimizing every desktop editor in one pass.
- Removing all `MobileSkyFrame` usages.
- Redesigning the desktop web pages.
