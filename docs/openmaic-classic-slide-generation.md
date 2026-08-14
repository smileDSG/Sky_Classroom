# 智眸无界 Original Slide Generation

## Purpose

Homepage and classroom slide scenes use the original 智眸无界 element-level slide generator. The
model returns Canvas/PPT elements directly, and the classroom renderer displays those elements
without converting them through local template data.

This is intentionally not the previous local `sky_classroom-agent-slide-adapter.ts` path.

## Runtime Path

1. `lib/generation/sky_classroom-main-scene-generator.ts`
   routes normal slide scenes to `generateSlideContent`.
2. `lib/generation/scene-content/slide-generator.ts`
   builds the original `slide-content` prompt and asks the model for:
   - `background`
   - `elements`
   - optional `remark`
3. The post-processor only normalizes element defaults, renders `latex` elements with KaTeX,
   resolves media IDs, normalizes generated video refs, and assigns runtime IDs.
4. `createSceneWithActions`
   persists the resulting elements on the classroom slide canvas and strips `templateData`.

## Non-Goals

- No `themeDirective` injection.
- No course theme recoloring of slide backgrounds.
- No custom `智眸无界 Classroom Slide Directive`.
- No local formula/process/summary template IDs such as `formula_list_*`, `process_flow_*`, or
  `summary_grid_*`.
- No fallback that converts plan-shaped JSON into local slide templates.

## Validation

Targeted check:

```bash
.\node_modules\.bin\vitest.cmd run tests/generation/classroom-slide-sky_classroom-first.test.ts --reporter=dot
```

Current regression coverage locks these failure modes:

- classroom slide generation uses the original 智眸无界 element prompt;
- AI `elements` are kept directly, with only 智眸无界-compatible post-processing;
- theme selection cannot force red/custom backgrounds into the prompt or result;
- 智眸无界-main scene generation routes through the same element generator;
- plan-shaped custom adapter responses are rejected instead of silently rendered by local templates.
