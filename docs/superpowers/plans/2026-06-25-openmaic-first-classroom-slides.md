# 智眸无界-first Classroom Slides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make classroom / teaching-flow slide scenes use 智眸无界-main's element-level slide generation as the visual source of truth, then reattach Sky Classroom features without letting them drive layout.

**Architecture:** Keep the current modular dispatcher, but make `lib/generation/scene-content/slide-generator.ts` behave like the 智眸无界-main classroom slide generator. Remove `themeDirective`, `templateData`, and heavy `slide-polish` influence from new classroom slide generation; keep media refs, LaTeX, IDs, action/TTS pipeline, caching, progress, and persistence.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest, file-based prompt templates, 智眸无界 element-level slide schema.

---

## File Structure

- Modify `tests/prompts/slide-richness-contract.test.ts`
  - Replace the current "richness contract" assertion with an 智眸无界-first classroom slide prompt contract.
- Create `tests/generation/classroom-slide-sky_classroom-first.test.ts`
  - Unit-test `generateSlideContent` with a mock LLM response.
  - Prove that new classroom slide content stays element-level, does not return `templateData`, and does not add `polish_` elements.
- Modify `lib/prompts/templates/slide-content/system.md`
  - Restore the 智眸无界-main style schema prompt by removing Sky-specific theme/richness/layout recipe requirements.
- Modify `lib/prompts/templates/slide-content/user.md`
  - Restore the 智眸无界-main user prompt by removing `Course Theme`, `themeDirective`, and richness contract requirements.
- Modify `lib/generation/scene-content/slide-generator.ts`
  - Remove theme-driven prompt variables and heavy slide-polish.
  - Keep image/video refs, LaTeX processing, defaults, ID assignment, and background conversion.
- Modify `lib/generation/scene-generator.ts`
  - Stop selecting a slide theme for `generateSlideContent`.
  - Build classroom slide scenes with the 智眸无界-main default slide theme and without `templateData/layoutVersion`.

## Task 1: Lock Prompt Contract

**Files:**
- Modify: `tests/prompts/slide-richness-contract.test.ts`
- Test: `tests/prompts/slide-richness-contract.test.ts`

- [ ] **Step 1: Replace prompt contract test**

Use this assertion for classroom slide prompts:

```ts
it('keeps classroom slide prompts 智眸无界-first instead of theme-driven', () => {
  const system = readTemplate('slide-content', 'system.md');
  const user = readTemplate('slide-content', 'user.md');
  const combined = `${system}\n${user}`;

  expect(combined).toContain('Slide Content Generator');
  expect(combined).toContain('Generate well-structured slide components');
  expect(combined).toContain('TextElement');
  expect(combined).toContain('ShapeElement');
  expect(combined).toContain('LineElement');
  expect(combined).toContain('LatexElement');
  expect(combined).toContain('TableElement');
  expect(combined).toContain('All TextElement `height` values');
  expect(combined).not.toContain('Course Theme');
  expect(combined).not.toContain('{{themeDirective}}');
  expect(combined).not.toContain('Slide Richness Contract');
  expect(combined).not.toContain('layout recipe');
  expect(combined).not.toContain('minimal colored background boxes');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm vitest run tests/prompts/slide-richness-contract.test.ts
```

Expected: fail because current prompt still contains `Course Theme`, `{{themeDirective}}`, `Slide Richness Contract`, and layout recipe text.

## Task 2: Lock Generator Behavior

**Files:**
- Create: `tests/generation/classroom-slide-sky_classroom-first.test.ts`
- Test: `tests/generation/classroom-slide-sky_classroom-first.test.ts`

- [ ] **Step 1: Add generator regression test**

Create this test file:

```ts
import { describe, expect, it } from 'vitest';

import { generateSlideContent } from '@/lib/generation/scene-content/slide-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { SceneOutline } from '@/lib/types/generation';

function makeOutline(): SceneOutline {
  return {
    id: 'outline_1',
    type: 'slide',
    title: 'Gradient Descent',
    description: 'Introduce the basic update rule and intuition.',
    keyPoints: ['Loss surface', 'Gradient direction', 'Step size'],
    order: 1,
  };
}

function makeAiCall(response: string): {
  aiCall: AICallFn;
  lastSystem: () => string;
  lastUser: () => string;
} {
  let lastSystem = '';
  let lastUser = '';
  const aiCall: AICallFn = async (system, user) => {
    lastSystem = system;
    lastUser = user;
    return response;
  };
  return {
    aiCall,
    lastSystem: () => lastSystem,
    lastUser: () => lastUser,
  };
}

describe('智眸无界-first classroom slide generation', () => {
  it('does not inject theme directives, template data, or polish-generated layout elements', async () => {
    const aiResponse = JSON.stringify({
      background: { type: 'solid', color: '#ffffff' },
      elements: [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 50,
          width: 880,
          height: 76,
          content: '<p style="font-size:32px;"><strong>Gradient Descent</strong></p>',
          defaultFontName: '',
          defaultColor: '#333333',
        },
        {
          id: 'body',
          type: 'text',
          left: 60,
          top: 150,
          width: 880,
          height: 130,
          content:
            '<p style="font-size:18px;">- Loss surface</p><p style="font-size:18px;">- Gradient direction</p>',
          defaultFontName: '',
          defaultColor: '#333333',
        },
      ],
      remark: 'Explain gradient descent intuition.',
    });
    const { aiCall, lastSystem, lastUser } = makeAiCall(aiResponse);

    const result = await generateSlideContent(makeOutline(), aiCall);

    expect(result).not.toBeNull();
    expect(result?.templateData).toBeUndefined();
    expect(result?.elements).toHaveLength(2);
    expect(result?.elements.some((element) => element.id.startsWith('polish_'))).toBe(false);
    expect(lastUser()).not.toContain('Course Theme');
    expect(lastUser()).not.toContain('themeDirective');
    expect(lastSystem()).not.toContain('Slide Richness Contract');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm vitest run tests/generation/classroom-slide-sky_classroom-first.test.ts
```

Expected: fail because current generator prompt includes theme content and `slide-polish` adds extra elements to weak slides.

## Task 3: Restore 智眸无界-main Prompt Templates

**Files:**
- Modify: `lib/prompts/templates/slide-content/system.md`
- Modify: `lib/prompts/templates/slide-content/user.md`
- Reference: `E:/01_Work/智眸无界-main/lib/prompts/templates/slide-content/system.md`
- Reference: `E:/01_Work/智眸无界-main/lib/prompts/templates/slide-content/user.md`

- [ ] **Step 1: Replace prompt templates with 智眸无界-main versions**

Mechanically copy the two reference files from `E:/01_Work/智眸无界-main/lib/prompts/templates/slide-content/`.

The resulting `user.md` must not contain:

```md
## Course Theme
{{themeDirective}}
Slide Richness Contract
```

The resulting `system.md` must not contain:

```md
Clean 智眸无界 Visual Standard
Slide Richness Contract
智眸无界 Classroom Visual Target
Recipe A
Recipe B
Recipe C
Recipe D
```

- [ ] **Step 2: Run prompt contract test**

Run:

```powershell
pnpm vitest run tests/prompts/slide-richness-contract.test.ts
```

Expected: pass.

## Task 4: Make Slide Generator 智眸无界-first

**Files:**
- Modify: `lib/generation/scene-content/slide-generator.ts`
- Test: `tests/generation/classroom-slide-sky_classroom-first.test.ts`

- [ ] **Step 1: Remove visual ownership imports**

Remove these imports:

```ts
import { polishGeneratedSlideData, polishSlideElements } from './slide-polish';
```

Keep the `ClassroomThemeSelection` type only for backward-compatible function signature:

```ts
import type { ClassroomThemeSelection } from '../classroom-design-dna';
```

- [ ] **Step 2: Delete `formatThemeDirective`**

Remove the whole `formatThemeDirective(themeSelection?: ClassroomThemeSelection)` function.

- [ ] **Step 3: Keep signature but ignore theme**

Keep the last parameter so existing callers compile, but make it non-visual:

```ts
  _themeSelection?: ClassroomThemeSelection,
): Promise<GeneratedSlideContent | null> {
```

- [ ] **Step 4: Stop passing theme variables into prompts**

In the `buildPrompt(PROMPT_IDS.SLIDE_CONTENT, { ... })` call, remove:

```ts
themeDirective: formatThemeDirective(themeSelection),
```

- [ ] **Step 5: Use generated data directly**

Replace the post-parse polish block with this flow:

```ts
  const fixedElements = fixElementDefaults(generatedData.elements, assignedImages);
  const latexProcessedElements = processLatexElements(fixedElements);
  const resolvedElements = resolveImageIds(
    latexProcessedElements,
    imageMapping,
    generatedMediaMapping,
  );
  const videoNormalizedElements = normalizeGeneratedVideoRefs(
    resolvedElements,
    outline.mediaGenerations,
  );

  const processedElements = videoNormalizedElements.map((el) => ({
    ...el,
    id: `${el.type}_${nanoid(8)}`,
    rotate: 0,
  })) as PPTElement[];

  return {
    elements: processedElements,
    background: toSlideBackground(generatedData.background),
    remark: generatedData.remark || outline.description,
  };
```

- [ ] **Step 6: Run generator regression test**

Run:

```powershell
pnpm vitest run tests/generation/classroom-slide-sky_classroom-first.test.ts
```

Expected: pass.

## Task 5: Stop Theme/Template From Driving Classroom Slide Scenes

**Files:**
- Modify: `lib/generation/scene-generator.ts`
- Test: `tests/generation/classroom-slide-sky_classroom-first.test.ts`

- [ ] **Step 1: Change imports**

Replace:

```ts
import {
  selectThemeForOutline,
  selectThemeForTemplate,
  type ClassroomThemeSelection,
} from './classroom-design-dna';
```

with:

```ts
import type { ClassroomThemeSelection } from './classroom-design-dna';
```

- [ ] **Step 2: Stop selecting theme in slide dispatch**

Replace the `case 'slide'` branch with:

```ts
    case 'slide':
      return generateSlideContent(
        outline,
        aiCall,
        assignedImages,
        imageMapping,
        visionEnabled,
        generatedMediaMapping,
        agents,
        languageDirective,
      );
```

- [ ] **Step 3: Use 智眸无界 default slide theme in scene creation**

Inside `createSceneWithActions`, replace the theme/template block with:

```ts
    const defaultTheme: SlideTheme = {
      backgroundColor: '#ffffff',
      themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
      outline: { color: '#d14424', width: 2, style: 'solid' },
      shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
    };

    log.info(
      `[SceneCreate] Creating 智眸无界-first slide for "${outline.title}": elements=${slideContent.elements.length}`,
    );
```

Build the slide without `templateData` or `layoutVersion`:

```ts
    const slide: Slide = {
      id: nanoid(),
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: defaultTheme,
      elements: slideContent.elements,
      background: slideContent.background,
    };
```

- [ ] **Step 4: Rename unused parameter**

Change the function parameter to:

```ts
  _themeSelection?: import('./classroom-design-dna').ClassroomThemeSelection,
```

- [ ] **Step 5: Run targeted tests**

Run:

```powershell
pnpm vitest run tests/generation/classroom-slide-sky_classroom-first.test.ts tests/prompts/slide-richness-contract.test.ts
```

Expected: pass.

## Task 6: Verification

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Run slide/generation focused tests**

Run:

```powershell
pnpm vitest run tests/generation/classroom-slide-sky_classroom-first.test.ts tests/prompts/slide-richness-contract.test.ts tests/generation/quality-scorer.test.ts
```

Expected: pass.

- [ ] **Step 2: Run type/lint smoke if focused tests pass**

Run:

```powershell
pnpm lint
```

Expected: no new lint errors in modified files.

- [ ] **Step 3: Check staged diff scope**

Run:

```powershell
git diff -- tests/prompts/slide-richness-contract.test.ts tests/generation/classroom-slide-sky_classroom-first.test.ts lib/prompts/templates/slide-content/system.md lib/prompts/templates/slide-content/user.md lib/generation/scene-content/slide-generator.ts lib/generation/scene-generator.ts
```

Expected: diff only covers the 智眸无界-first classroom slide path and tests.
