# Slide Quality Agent

This document describes the slide quality guard used by the classroom generation pipeline.

## Goal

The agent prevents generated classroom slides from becoming thin, hard to read, or visually weak. It is designed for the problems seen in generated decks:

- text outside its background card
- text too small for classroom playback
- low contrast text
- excessive colored background panels
- unlabeled abstract visual placeholders
- foreground callout strips covering earlier content
- pages with no visual anchor
- pages with too few meaningful learning blocks
- flat typography with no clear title/body hierarchy

## What We Learned From OpenMAIC-main

`E:/01_Work/OpenMAIC-main/` does not rely on a single "make it beautiful" prompt. Its stronger pattern is a pipeline:

1. The outline stage decides what every scene should teach.
2. Slide prompts constrain the element schema and layout rules.
3. Post-generation code normalizes elements and repairs common model drift.
4. Tests protect prompt contracts and quality gates.
5. Regeneration tools read the current scene before editing it.

This project now follows the same idea for classroom slides: prompts plan richer pages, deterministic checks catch drift, and tests keep the contract from being removed later.

## Clean OpenMAIC GIF Style

The `deepseek.gif` and `avalon.gif` references are closer to an editorial course deck than a dashboard. The target style is:

- white or very light background
- one dominant image, formula, chart, or diagram
- title plus a thin divider
- plain right/left text column with clear hierarchy
- dark readable text
- one accent color used as a line, small marker, or connector
- minimal colored background boxes

The previous prompt contract over-emphasized "10-16 elements", right panels, mini-cards, and bottom strips. `slide-polish` also added `polish_rich_strip` and `polish_rich_side_card` automatically. That made slides look busy and increased the chance of text being covered. The generator now prefers 8-12 purposeful elements, at most one pale panel, and plain text takeaways separated by thin dividers.

## Runtime Flow

1. `requirements-to-outlines` asks each slide outline to include five role cues:
   `[Visual]`, `[Focus]`, `[Explain]`, `[Detail]`, and `[Apply]`.
2. `slide-content` turns those cues into a full page with a visual anchor, text hierarchy, learning blocks, and a takeaway/application cue.
3. `slide-polish` repairs generated elements and calls `repairSlideLayout`.
4. `layout-guard-agent` audits readability and optional richness checks.
5. `quality-scorer` enables richness checks and lowers scores for thin slides.

## Checks

Readability checks always run when `auditSlideLayout(elements)` is called:

- `text_outside_background`: text is attached to a background shape but exceeds the padded bounds.
- `text_too_small`: text uses a font size below 18px.
- `low_text_contrast`: text contrast against its card background is below 4:1.
- `foreground_overlay_collision`: a wide late-rendered callout/takeaway strip overlaps earlier slide content.

Richness checks run when `auditSlideLayout(elements, { includeRichness: true })` is called:

- `missing_visual_anchor`: no dominant image, chart, table, formula block, video, or shape/arrow diagram.
- `low_content_richness`: fewer than 8 elements or fewer than 4 meaningful learning text blocks.
- `weak_visual_hierarchy`: typography does not clearly separate title and body levels.
- `excessive_colored_panels`: more than one large colored background box, or a saturated large panel, appears on a clean classroom slide.
- `unlabeled_visual_placeholder`: a shape/line diagram has no label inside the visual area, which usually means the slide is showing an abstract blank placeholder instead of teaching content.

## Root Cause: Bottom Callout Overlap

The classroom renderer draws slide elements as absolutely positioned layers. Text elements are intentionally rendered above shapes, and later text has a slightly higher layer than earlier text. That is useful for labels, but it means a generated full-width bottom callout such as "适用领域" or "💡 项目骨架" can cover earlier body text or panels when the model does not reserve enough vertical space.

The fix is defense in depth:

- prompts now require a clean reserved bottom band before using a bottom strip
- `layout-guard-agent` reports `foreground_overlay_collision`
- `quality-scorer` penalizes slides with foreground overlay collisions
- `slide-polish` reserves bottom callout space at render/generation time and shrinks or lifts earlier content out of the callout zone

## Thresholds

The current thresholds live in `lib/slides/agent/layout-guard-agent.ts`:

- minimum body font size: `18`
- minimum contrast ratio: `4`
- minimum rich element count: `8`
- minimum learning text blocks: `4`
- visual anchor area ratio: `0.12` of the slide canvas
- minimum font hierarchy gap: `6`
- large colored panel area threshold: `0.018` of the slide canvas

Tune these conservatively. Raising them too far can reject valid minimalist pages such as quotes or reading slides.

## Tests

Run the focused suite after changing slide generation, polish, guard, or prompt contracts:

```bash
pnpm vitest run tests/slides/agent/layout-guard-agent.test.ts tests/generation/quality-scorer.test.ts tests/prompts/slide-richness-contract.test.ts
```

Run ESLint on touched TypeScript files:

```bash
pnpm exec eslint lib/slides/agent/layout-guard-agent.ts lib/generation/quality-scorer.ts tests/slides/agent/layout-guard-agent.test.ts tests/generation/quality-scorer.test.ts tests/prompts/slide-richness-contract.test.ts
```
