# Task Plan
> Generated at: 2026-06-29
> Task: Improve classroom slide generation toward the OpenMAIC gif style.

## Goal

Reduce repeated templates and large blank areas across generated slide decks, while keeping readable text, stable alignment, and overlap prevention.

## Selected Approach

Use a deck-level generation loop: merge sparse adjacent slide outlines first, then apply safer layout variation, density optimization, and card ownership repair during slide polish.

## Steps

1. Add a sparse slide outline merger before scene generation.
2. Keep quiz, interactive, pbl, and media-bound slides as hard boundaries.
3. Apply the same sparse merge to the teaching-job-to-classroom adapter.
4. Add page-order visual signatures to canonical layouts so repeated content types still look different.
5. Add tests for sparse merging, order reassignment, media boundaries, adapter behavior, and visual signatures.
6. Run formatting, focused tests, and type/whitespace checks.

## Risks

- Over-merging could make a page too dense, so only adjacent low-content slide scenes are merged.
- Strong visual variation could destabilize layout, so all new variation stays inside fixed safe-grid decoration zones.
- Old generated classroom caches may still show old slides; verification should use a newly generated classroom.

## Expected Output

- Fewer sparse pages and less blank space.
- Adjacent slides should no longer look like the same shell with a different title.
- Generated decks should preserve safer text placement and reduce overlap risk.
- Regression tests should lock the new behavior.
