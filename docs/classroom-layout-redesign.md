# Classroom Sky Theater Mode

## Goal

The `/classroom` page now uses Sky Theater mode. The generated slide takes priority over classroom chrome: slide navigation and the learning assistant are folded by default, and the playback dock overlays the stage instead of reserving a large bottom base.

## Design Principles

- Make the slide feel like the main stage, not one panel inside a dashboard.
- Use a sky identity through light blue atmosphere, white glass surfaces, and soft cyan accents.
- Reduce crowding by folding slide navigation and notes into on-demand drawers.
- Let the slide occupy more of its stage by reducing canvas padding and removing the bottom toolbar from layout flow.
- Keep classroom overlays out of the slide's readable area by reserving desktop side safe areas for speech and assistant panels.
- Keep functional colors semantic: sky for primary actions, red only for errors or stop actions.

## Component Changes

### `components/stage.tsx`

- Reworked the classroom shell into Sky Theater mode.
- Kept `/classroom` state flow unchanged.
- Added small top-corner launchers for slide map and learning assistant.
- Moved the learning assistant launcher below the header controls so it does not overlap export/settings actions.
- The main stage now reserves right-side space when the learning assistant is open, so the drawer does not cover slide content.
- The main stage expands a left speech rail only during lecture/discussion activity, so avatar speech does not cover slide content.
- Changed playback controls to an absolute overlay dock.

### `components/stage/scene-sidebar.tsx`

- Changed the page map into a left drawer.
- The drawer opens over the stage instead of squeezing the slide.
- Added scene titles and type hints for faster navigation.
- Switched active and progress accents to sky blue.

### `components/canvas/canvas-area.tsx`

- Reduced canvas padding so the slide occupies more of the stage.
- Increased the slide max width and softened the slide shadow.
- Kept scene rendering, whiteboard, playback click behavior, loading, retry, and completion overlays.

### `components/chat/chat-area.tsx`

- Changed notes/Q&A into a right learning-assistant drawer.
- The drawer is collapsed by default through the settings migration.
- Kept lecture notes, Q&A, filters, session controls, streaming callbacks, and active bubble tracking.
- Updated tabs, drag affordance, and empty states to match the sky theme.
- Changed active tabs to bold text plus underline instead of white-on-blue fills, preventing selected labels from disappearing.

### `components/roundtable/index.tsx`

- Added a `compactDock` mode for `/classroom`.
- The teacher/student/user column is now a purpose-built class member dock instead of a clipped full roundtable.
- Participant avatars use consistent sizing, hover details, active/speaking indicators, and sky-themed surfaces.

### `components/ui/avatar-speech-popup.tsx`

- Added avatar-anchored speech popups for the classroom member dock.
- Teacher lecture and student discussion text now appears beside the active avatar instead of as a bottom subtitle.
- Avatar speech is constrained to the left speech rail and does not float over the slide.

### `components/header.tsx`

- Retained back, progress, theme, settings, and export controls.
- Updated the header to a translucent sky-white bar.
- Removed the duplicate slide-map button from the header; the top-left page capsule is the only slide-map entry.

### `components/ui/bottom-toolbar.tsx`

- Changed the toolbar into a lighter cloud-like overlay dock.
- Switched primary playback and ask-teacher actions to sky blue.
- Kept stop actions red for clear semantic meaning.

### `lib/store/settings/*`

- Updated layout defaults so slide map and learning assistant start folded.
- Bumped settings migration to apply Sky Theater defaults to existing local settings.

## Verification

Run:

```bash
pnpm exec prettier --write components/stage.tsx components/header.tsx components/stage/scene-sidebar.tsx components/canvas/canvas-area.tsx components/chat/chat-area.tsx components/ui/bottom-toolbar.tsx docs/classroom-layout-redesign.md
pnpm exec eslint components/stage.tsx components/header.tsx components/stage/scene-sidebar.tsx components/canvas/canvas-area.tsx components/chat/chat-area.tsx components/ui/bottom-toolbar.tsx
pnpm exec vitest run tests/slides/slide-polish.test.ts tests/classroom/classroom-job-client.test.ts tests/teaching/to-classroom.test.ts tests/server/classroom-agent-mode.test.ts tests/server/classroom-media-generation.test.ts tests/slides/sky-classroom-integration.test.ts
```
