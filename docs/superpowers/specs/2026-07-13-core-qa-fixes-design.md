# Core QA Fixes Design

## Scope

Fix the two reproducible user-facing defects found by the 2026-07-13 QA run and keep the main repository's quality tools from scanning the nested `software-cup-A3` repository.

## Design

1. Make the question-bank schema compatible with MySQL by removing defaults from `TEXT` and `JSON` columns. The DAO already supplies empty strings and arrays for every insert, so database defaults are unnecessary.
2. Add an `/about` page because the account page intentionally links to product and license information.
3. Exclude `software-cup-A3/**` and QA artifacts from the root formatter, linter, TypeScript, and Vitest scopes where each tool supports exclusions.

## Non-goals

- Do not change the intentionally public routes in `proxy.ts` or `AuthProvider`.
- Do not repair all historical tests in this change.
- Do not change AI generation behavior or provider configuration.

## Verification

- A DAO regression test proves the generated table schema has no invalid `TEXT`/`JSON` defaults.
- An About page test proves the route content exists.
- Targeted tests pass, the question-bank API returns 200, `/about` returns 200, and production build succeeds.
