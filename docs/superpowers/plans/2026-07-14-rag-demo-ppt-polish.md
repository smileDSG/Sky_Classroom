# RAG Demo PPT Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从现有 19 页 RAG 演示稿中制作一份 6 页、适合比赛演示视频快速展示的深蓝科技风美化版 PPT，并导出可直接用于剪辑的逐页图片。

**Architecture:** 使用源 PPT 作为唯一模板来源，复制源页 1、2、4、6、7、19 形成 6 页 starter deck；通过 `@oai/artifact-tool` 修改继承的页面背景、文本和图形对象，不覆盖原文件。最终对 PPTX、逐页渲染、模板继承和页面溢出进行检查。

**Tech Stack:** PowerPoint PPTX、JavaScript ES Modules、`@oai/artifact-tool`、Presentations skill template-following scripts、LibreOffice/Poppler rendering helpers

---

## File Map

- Source: `C:/Users/lenovo/Documents/Downloads/RAG检索增强生成与多智能体协作_sky-blue_1784000569882.pptx`
- Design spec: `docs/superpowers/specs/2026-07-14-rag-demo-ppt-polish-design.md`
- Create: `C:/Users/lenovo/AppData/Local/Temp/codex-presentations/019f5e5e-b1ce-7f22-8fcb-9c06f5af6435/rag-ppt-polish/tmp/template-audit.txt`
- Create: `C:/Users/lenovo/AppData/Local/Temp/codex-presentations/019f5e5e-b1ce-7f22-8fcb-9c06f5af6435/rag-ppt-polish/tmp/template-frame-map.json`
- Create: `C:/Users/lenovo/AppData/Local/Temp/codex-presentations/019f5e5e-b1ce-7f22-8fcb-9c06f5af6435/rag-ppt-polish/tmp/deviation-log.txt`
- Create: `C:/Users/lenovo/AppData/Local/Temp/codex-presentations/019f5e5e-b1ce-7f22-8fcb-9c06f5af6435/rag-ppt-polish/tmp/source-notes.txt`
- Create: `C:/Users/lenovo/AppData/Local/Temp/codex-presentations/019f5e5e-b1ce-7f22-8fcb-9c06f5af6435/rag-ppt-polish/tmp/template-starter.pptx`
- Create: `C:/Users/lenovo/AppData/Local/Temp/codex-presentations/019f5e5e-b1ce-7f22-8fcb-9c06f5af6435/rag-ppt-polish/tmp/build-polished-deck.mjs`
- Create: `E:/01_Work/sky-classroom/outputs/RAG检索增强生成与多智能体协作-美化版.pptx`
- Create: `E:/01_Work/sky-classroom/outputs/RAG演示PPT-视频素材/slide-1.png` through `slide-6.png`

### Task 1: Audit and map the six source frames

- [ ] **Step 1: Inspect all source pages and the six selected pages at full size**

Review the existing 19-slide contact sheet, then open source slides 1, 2, 4, 6, 7, and 19 individually. Confirm that they respectively support the roles cover, RAG workflow, multi-agent architecture, resource generation, comparison, and closing.

- [ ] **Step 2: Record the template audit**

Write `template-audit.txt` with these conclusions:

```text
Source deck: 19 slides, 16:9.
Reusable dark frames: slides 1 and 19.
Reusable content frames: slides 2, 4, 6, and 7.
Typography: Microsoft YaHei/等线 family; current body copy is too small for video.
Palette: navy cover, white content pages, pale sky-blue blocks, blue accent text.
Requested restyle: convert selected pages to a coherent navy/cyan presentation while preserving inherited page structures.
Insertion contract: edit inherited slide background, text boxes, and existing shapes only; do not add unsupported charts, screenshots, logos, metrics, or evidence.
```

- [ ] **Step 3: Create the frame map**

Create `template-frame-map.json` with six output slides mapped to source slides `1, 2, 4, 6, 7, 19`. Each slide must list the inherited text and shape IDs from `template-inspect.ndjson` as `editTargets`; every omitted source slide must have a reason of `not required for the 10–15 second video highlight narrative`.

- [ ] **Step 4: Validate the frame map**

Run:

```powershell
node "$env:SKILL_DIR/template_following_scripts/validate_template_plan.mjs" `
  --workspace "$env:TMP_DIR" `
  --map "$env:TMP_DIR/template-frame-map.json"
```

Expected: validation succeeds with six mapped output slides and no unresolved edit target.

### Task 2: Prepare the inherited starter deck

- [ ] **Step 1: Build the starter PPTX**

Run:

```powershell
node "$env:SKILL_DIR/template_following_scripts/prepare_template_starter_deck.mjs" `
  --workspace "$env:TMP_DIR" `
  --pptx "$env:TEMPLATE_PPTX" `
  --map "$env:TMP_DIR/template-frame-map.json" `
  --out "$env:TMP_DIR/template-starter.pptx" `
  --preview-dir "$env:TMP_DIR/template-starter-preview" `
  --layout-dir "$env:TMP_DIR/template-starter-layout" `
  --contact-sheet "$env:TMP_DIR/template-starter-contact-sheet.png"
```

Expected: a six-slide starter deck appears, in the order `1, 2, 4, 6, 7, 19`.

- [ ] **Step 2: Inspect the starter deck**

Open all six starter renders and verify that titles, page markers, inherited shapes, and source content are present before editing.

### Task 3: Implement the deep-blue technology restyle

- [ ] **Step 1: Initialize the artifact-tool workspace and read its API docs**

Run:

```powershell
node "$env:SKILL_DIR/container_tools/setup_artifact_tool_workspace.mjs" --workspace "$env:TMP_DIR"
```

Read `artifact_tool/API_QUICK_START.md` and `artifact_tool/api/API_DOCS.md` completely before authoring the module.

- [ ] **Step 2: Create `build-polished-deck.mjs`**

The module must:

```javascript
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const source = process.env.STARTER_PPTX;
const output = process.env.FINAL_PPTX;
const presentation = await PresentationFile.importPptx(await FileBlob.load(source));

// For each of the six inherited slides:
// 1. Set the slide background to #081426 or #0B1B32.
// 2. Rewrite only mapped inherited text objects with approved audience-facing copy.
// 3. Restyle inherited text: white titles, #67E8F9 highlights, #C7D2FE body copy.
// 4. Restyle inherited pale-blue shapes as translucent cyan/blue support areas.
// 5. Preserve or intentionally delete inherited page numbers/placeholders according to the frame map.

const blob = await PresentationFile.exportPptx(presentation);
await blob.save(output);
```

Use the exact object accessors and mutation methods documented by the local artifact-tool API. Do not create a parallel slide deck, use Python PPTX, or mutate OOXML directly.

- [ ] **Step 3: Apply final page copy**

Use this six-page narrative:

```text
1. RAG 检索增强生成与多智能体协作
   让课程生成既有知识依据，也有专业分工

2. RAG 让生成内容可检索、可追溯、可校验
   课程需求 → 知识检索 → 内容生成 → 质量校验

3. 多智能体把复杂课程拆成可协同的专业任务
   主协调器 / 内容规划 / 教学设计 / 资源生成 / 质量检查

4. 一次课程生成，形成多种可直接使用的教学资源
   课件、教案、练习、互动场景与多模态素材

5. 从单次回答升级为有依据、有协作、有反馈的教学系统
   无增强生成 / RAG / 多智能体 RAG

6. 生成—教学—练习—反馈
   多智能体驱动的智能教学闭环
```

- [ ] **Step 4: Export the edited PPTX**

Run:

```powershell
$env:STARTER_PPTX="$env:TMP_DIR/template-starter.pptx"
$env:FINAL_PPTX="E:/01_Work/sky-classroom/outputs/RAG检索增强生成与多智能体协作-美化版.pptx"
node "$env:TMP_DIR/build-polished-deck.mjs"
```

Expected: the output PPTX exists and contains exactly six slides.

### Task 4: Render and fix every slide

- [ ] **Step 1: Render all final slides and layout data**

Use the artifact-tool export/render workflow to generate `preview/final`, `layout/final`, and a montage under the scratch directory.

- [ ] **Step 2: Inspect all slides individually**

Check title wrapping, body readability, spacing, alignment, inherited page markers, and visual consistency at full size. The primary title must remain one line where intended; body text must remain readable in 1080p video.

- [ ] **Step 3: Fix all unintended overlaps and placeholder issues**

Repeat authoring and rendering until there are no clipped text boxes, unintended overlaps, unresolved structural placeholders, or inconsistent title margins.

- [ ] **Step 4: Run overflow and fidelity QA**

Run:

```powershell
python "$env:SKILL_DIR/container_tools/slides_test.py" `
  "E:/01_Work/sky-classroom/outputs/RAG检索增强生成与多智能体协作-美化版.pptx"

node "$env:SKILL_DIR/template_following_scripts/check_template_fidelity.mjs" `
  --workspace "$env:TMP_DIR" `
  --starter-pptx "$env:TMP_DIR/template-starter.pptx" `
  --final-pptx "E:/01_Work/sky-classroom/outputs/RAG检索增强生成与多智能体协作-美化版.pptx" `
  --map "$env:TMP_DIR/template-frame-map.json" `
  --starter-layout-dir "$env:TMP_DIR/template-starter-layout" `
  --final-layout-dir "$env:TMP_DIR/layout/final" `
  --edit-dir "$env:TMP_DIR"
```

Expected: no overflow errors and template fidelity passes for all declared edits.

### Task 5: Export video-ready assets

- [ ] **Step 1: Copy the six verified slide renders**

Create `outputs/RAG演示PPT-视频素材/` and copy only the final verified `slide-1.png` through `slide-6.png` into it.

- [ ] **Step 2: Record the splice prescription**

Create `outputs/RAG演示PPT-视频素材/剪辑说明.txt` containing:

```text
总时长：10–15 秒
每页：1.5–2 秒
转场：0.2–0.4 秒淡化
画面：103%–108% 缓慢推近
插入点：Web 端课程资源生成结果之后
顺序：封面 → RAG → 多智能体 → 多模态资源 → 对比 → 教学闭环
```

- [ ] **Step 3: Final verification**

Confirm that the source PPTX remains unchanged, the final deck opens, the slide count is six, and the PNG folder contains six images plus the editing note.

