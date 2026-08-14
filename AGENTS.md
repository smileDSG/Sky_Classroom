# 智眸无界 — Agent Guide

Next.js 16 + React 19 + TypeScript 5 monorepo. AI multi-agent interactive classroom platform.

## Quick Reference

```
pnpm install          # install all deps + builds workspace packages (mathml2omml, pptxgenjs)
pnpm dev              # localhost:3000
pnpm build            # production build (standalone output unless VERCEL env)
pnpm lint             # eslint
pnpm check            # prettier --check
pnpm format           # prettier --write
pnpm test             # vitest unit tests
pnpm test:e2e         # playwright e2e (needs dev server on :3002)
```

## Recommended Local Check Order

1. `pnpm check` (prettier)
2. `pnpm lint` (eslint)
3. `npx tsc --noEmit` (typecheck)
4. `pnpm test` (vitest unit)

Run locally before pushing.

## Project Structure

```
app/                    # Next.js App Router (pages + API routes)
lib/                    # Core business logic (47 modules)
  ai/                   #   LLM provider abstraction, key pool, cost tracking
  generation/           #   Two-stage lesson pipeline (outline → scenes)
  orchestration/        #   LangGraph multi-agent director graph
  playback/             #   Playback state machine
  slides/               #   Slide generation agents + template packs
    agent/              #     Planning/Section/PageDesign/QA agents
    template-packs/     #     Layout mappings for slide templates
  export/               #   PPTX & HTML export
  store/                #   Zustand state stores
  prompts/              #   File-based markdown prompt templates
components/             # React UI (shadcn/ui + Radix primitives)
packages/               # Workspace packages
  pptxgenjs/            #   Customized PowerPoint generation (built via rollup)
  mathml2omml/          #   MathML → Office Math conversion (built via rollup)
configs/                # Shared constants (shapes, fonts, hotkeys, themes)
tests/                  # Unit tests (mirrors lib/ structure, jsdom env)
e2e/                    # Playwright e2e tests (chromium, port 3002)
scripts/                # Build/eval/setup utilities
migrations/             # SQL migrations (SQLite local, MySQL prod)
```

## Workspace Packages

`packages/pptxgenjs` and `packages/mathml2omml` are built by `postinstall` via rollup. They are transpiled by Next.js (`transpilePackages` in next.config.ts). If a build fails, `pnpm install` fails — fix the package source first.

## Environment Setup

```bash
cp .env.example .env.local   # fill at least one LLM provider key
```

Provider config also accepted via `server-providers.yml` (see `server-providers.yml.example`). Env vars take precedence. Multi-key rotation supported: `DEEPSEEK_API_KEY=sk-aaa,sk-bbb,sk-ccc` or `apiKeys` array in YAML.

Key env categories: LLM, TTS, ASR, PDF, Image, Video, Web Search. See `.env.example` for full list. All optional — only configure what you use.

`DEFAULT_MODEL=provider:model-id` sets server-side default (e.g., `google:gemini-3-flash-preview`).

## Testing

**Unit tests** (`vitest`):
- Location: `tests/**/*.test.{ts,tsx}`
- Exclude: `tests/**/*.e2e.test.ts`, `tests/**/e2e-*.test.ts`
- Setup: `tests/setup-env.ts`, `tests/setup-vitest.ts`
- Run: `pnpm test` (single run) or `pnpm vitest` (watch)
- Run specific file: `pnpm vitest run tests/generation/outline.test.ts`

**Eval tests** (`vitest`, separate config):
- Location: `tests/**/*.eval.test.ts`
- Run: `pnpm vitest --config vitest.eval.config.ts`

**E2E tests** (`playwright`):
- Location: `e2e/tests/`
- Browser: chromium only
- Base URL: `http://localhost:3002` (auto-starts dev server)
- Run: `pnpm test:e2e`
- Run with UI: `pnpm test:e2e:ui`

## Code Style

- **TypeScript strict mode** enabled
- **Path alias**: `@/*` maps to repo root (use `@/lib/...`, `@/components/...`)
- **Prettier**: 100 char width, single quotes, trailing commas, LF line endings
- **ESLint**: next core-web-vitals + typescript rules. `@img-element` disabled (AI-generated images). Unused vars prefixed with `_` are warnings, not errors
- **Components**: shadcn/ui (radix-vega style) + Tailwind CSS 4. Use `cn()` from `@/lib/utils` for class merging
- **State**: Zustand stores in `lib/store/`
- **Schemas**: Zod for runtime validation

## Architecture Notes

**Generation pipeline** (`lib/generation/`): Outline generation → per-scene content generation. Prompts are markdown files in `lib/prompts/` loaded at runtime.

**Multi-agent orchestration** (`lib/orchestration/`): LangGraph state machine managing AI teacher/classmate turns, discussions, and roundtable debates.

**Slide agent pipeline** (`lib/slides/agent/`): Planning → Section → Page Design → QA. Each agent has Zod input/output schemas. Retries 3x with exponential backoff. No fallback — retry or fail hard.

**API Key Pool** (`lib/ai/key-pool.ts`): Least-inflight + round-robin load balancing across multiple keys per provider. 3 consecutive failures → unhealthy, 1-min auto-recovery.

**Action engine** (`lib/action/`): 28+ action types (speech, whiteboard draw/text/shape/chart, spotlight, laser, etc.).

**Exports**: PPTX via `packages/pptxgenjs`, HTML via `lib/export/`, classroom ZIP backup.

**Docker**: `docker compose up --build`. LibreOffice bundled in image for PPTX rendering. Data persisted in `sky_classroom-data` volume.

## Commit Convention

```
feat: add new feature
fix: bug fix
refactor: code change that neither fixes a bug nor adds a feature
test: adding or updating tests
docs: documentation changes
```
