# OpenMAIC-first Classroom Slide Generation Design

## Context

The current project is an OpenMAIC-derived classroom system with extra Sky Classroom features:
learning diagnostics, Cloud Mind context, generated agents, progress tracking, media generation,
TTS, caching, quality scoring, and persistence.

The user wants only the classroom / teaching flow slide scenes to look like `E:/01_Work/OpenMAIC-main/`.
The independent `app/sky/slides` PPT workspace is out of scope.

Earlier partial migration did not solve the visual problem because the current classroom slide path still
lets local theme/template/polish logic influence the final page. The new design makes the
OpenMAIC-main element-level slide generator the visual source of truth first, then reconnects existing
features around it.

## Goal

Generate classroom slide scenes that visually match OpenMAIC-main:

- white or very light canvas
- clear title and thin divider
- one dominant visual anchor
- image/text, formula/text, chart/text, or diagram/text balance
- restrained colors and few filled panels
- concise slide text, with spoken explanation left to actions/TTS

## Non-Goals

- Do not replace `app/sky/slides` or `lib/slides` independent PPT generation.
- Do not rewrite quiz, interactive, PBL, or action generation.
- Do not remove Sky Classroom product features permanently.
- Do not introduce template-driven classroom slides as the primary path.

## Selected Approach

Use an OpenMAIC-first core with feature reattachment:

1. Restore the classroom slide content generator to OpenMAIC-main's native element-level approach.
2. Keep the current modular file boundary, especially `lib/generation/scene-content/slide-generator.ts`,
   so the rest of Sky Classroom keeps compiling with minimal changes.
3. Bypass or remove visual modifiers that fight the OpenMAIC look.
4. Reattach existing project features as non-invasive context, validation, or post-parse safety steps.

This is intentionally different from "add more prompt rules." OpenMAIC-main should own the slide
structure; Sky Classroom features should feed content or verify output without taking over layout.

## Architecture

### Source of Truth

`E:/01_Work/OpenMAIC-main/lib/generation/scene-generator.ts` contains the reference
`generateSlideContent` behavior. The implementation should port that behavior into:

- `lib/generation/scene-content/slide-generator.ts`
- `lib/prompts/templates/slide-content/system.md`
- `lib/prompts/templates/slide-content/user.md`

The port should preserve the current project's modular dispatcher:

- `lib/generation/scene-generator.ts` still dispatches slide scenes to `generateSlideContent`.
- `generateFullScenes`, progress reporting, caching, and scene persistence remain in the current project.

### Visual Ownership

The classroom slide branch must return normal element-level `GeneratedSlideContent`:

- `elements`
- `background`
- `remark`

It must not return or depend on `templateData` for classroom slides. If `templateData` support remains in
shared types for older data, it should be treated as compatibility only, not used by new classroom slide
generation.

### Feature Reattachment

Keep these as inputs or safety checks:

- `assignedImages`, `imageMapping`, and vision image slicing
- generated image/video references from `outline.mediaGenerations`
- agent/teacher persona context, with the existing rule that teacher identity must not appear on slides
- language directive
- LaTeX rendering and image reference resolution
- video `mediaRef` normalization
- cache, progress, persistence, and media/TTS generation after scenes are created

Reattach cautiously:

- learning/diagnostic/Cloud Mind context may shape outline text and key points, but must not inject layout
  templates or style directives into the slide generator
- quality scoring may warn, fail, or trigger a controlled retry, but must not rewrite slides back into the
  old Sky Classroom style
- post-processing may only do structural repairs such as IDs, missing defaults, image ratios, LaTeX HTML,
  off-canvas correction, and media reference normalization

Disable or bypass for new classroom slide generation:

- `courseTemplate` as a layout driver
- `themeSelection` as a dominant visual style driver
- `classroom-template-layout-agent` output for new classroom slides
- heavy `slide-polish` layout rebuilding
- decorative richness overlays that add strips, side cards, badges, or extra panels

## Data Flow

1. User generates a classroom from Sky Classroom.
2. Current outline generation and Sky-specific context continue to produce `SceneOutline[]`.
3. Slide outlines enter the OpenMAIC-first `generateSlideContent`.
4. The model outputs element-level JSON using OpenMAIC-main prompt/schema behavior.
5. Compatibility post-processing runs:
   image IDs, video refs, LaTeX, element defaults, IDs, and safe bounds.
6. `createSceneWithActions` builds a normal classroom slide scene.
7. Existing media generation, TTS, persistence, playback, and classroom UI continue unchanged.

## Testing

Focused tests should prove that the old visual path no longer dominates classroom slide scenes:

- prompt contract test: classroom slide prompts match OpenMAIC-first requirements and do not require
  `themeDirective`
- generator test: `generateSlideContent` returns element-level content with no `templateData`
- regression test: Sky-specific inputs such as media references and teacher context still pass through
- quality test: a slide with large colored cards/strips is flagged, but post-processing does not introduce
  those elements
- build/typecheck smoke: run targeted Vitest files first, then `pnpm lint` or `npx tsc --noEmit` if time allows

## Risks

- Full visual restoration can temporarily reduce Sky-specific theme variety. This is acceptable because the
  goal is to match OpenMAIC-main first.
- Some existing tests may expect current theme/polish behavior and need updates.
- Current worktree is heavily dirty; implementation must avoid reverting unrelated user changes.
- Generated slides may become plainer before feature reattachment is tuned. The acceptance criterion is
  OpenMAIC-like cleanliness, not maximum decoration.

## Acceptance Criteria

- Classroom-generated slide scenes visually follow OpenMAIC-main rather than the current Sky template/card
  style.
- New classroom slides do not depend on `templateData`.
- Existing classroom generation still supports agents, media references, TTS/actions, progress, caching,
  and persistence.
- Independent `app/sky/slides` remains untouched.
- No unrelated dirty worktree changes are reverted.
