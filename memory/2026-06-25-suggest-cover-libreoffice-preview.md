# Suggest Cover LibreOffice Preview Failure

## Symptom

The smart cover recommendation flow failed with:

`推荐失败: LibreOffice 未安装或路径不正确，请安装 LibreOffice 后重试。`

The UI could remain at the suggesting stage text `提取学科关键词与风格倾向`.

## Root Cause

`POST /api/sky/slides/suggest-cover` successfully generated `designDNA`, then rendered a PPTX and attempted to convert it to PNG with LibreOffice. The PNG preview was treated as mandatory, so a missing `soffice` path returned HTTP 500 even though the smart cover UI renders the preview from `designDNA` via `CoverSVGRenderer`.

## Fix

Made PPTX/PNG preview generation best-effort in `app/api/sky/slides/suggest-cover/route.ts`.

When PPTX rendering or LibreOffice PNG conversion fails, the API now returns success with:

- `cover.pngUrl: null`
- `cover.previewAvailable: false`
- `cover.previewError`
- `cover.designDNA`

## Evidence

Regression test added in `tests/slides/suggest-cover-api.test.ts` for the LibreOffice-missing case.

Verified with:

- `pnpm vitest run tests/slides/suggest-cover-api.test.ts`
- `pnpm exec eslint app/api/sky/slides/suggest-cover/route.ts tests/slides/suggest-cover-api.test.ts`

## Follow-up: Non-standard Windows Install

The user's LibreOffice install was registered at `E:\06_Temp\`, not under `C:\Program Files`. Start Menu shortcuts pointed to `E:\06_Temp\program\soffice.exe`.

Updated LibreOffice discovery to read Windows uninstall registry `InstallLocation` values, so both runtime PNG conversion and `pnpm setup:lo` can find non-standard installs.

Additional verification:

- `pnpm setup:lo` found `E:\06_Temp\program\soffice.exe`
- A temporary cover PPTX rendered and converted to PNG through `convertPptxToPng`
- Focused ESLint passed for the changed files

Status: DONE
