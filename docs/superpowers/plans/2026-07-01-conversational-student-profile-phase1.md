# Conversational Student Profile Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable conversational student profile slice: deterministic profile extraction, a structured API response, and an onboarding chat panel on the student profile page.

**Architecture:** Keep the extraction logic in a small pure TypeScript module so it can be tested without Next.js runtime or LLM credentials. The API route calls that module and preserves the existing demo response fields. The React chat panel calls the API and shows the extracted profile summary and next question.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Tailwind CSS, existing shadcn-style UI components.

---

## File Structure

- Create `lib/student/conversation-profile.ts`
  - Pure types and deterministic extraction helpers for phase 1.
- Create `tests/teaching/conversation-profile.test.ts`
  - Unit tests for profile extraction, next-question selection, and confirmation behavior.
- Modify `app/api/sky/student/profile/conversation/route.ts`
  - Return `nextQuestion`, `profilePatch`, `evidence`, `needsConfirmation`, and legacy `profile/patch` fields.
- Create `components/sky/student/profile-onboarding-chat.tsx`
  - Client-side chat panel for 3-5 round profile onboarding.
- Modify `app/sky/student/student-profile-page.tsx`
  - Render the chat panel above the existing behavior-based profile display.

## Task 1: Conversation Profile Extractor

**Files:**
- Create: `tests/teaching/conversation-profile.test.ts`
- Create: `lib/student/conversation-profile.ts`

- [ ] **Step 1: Write failing tests**
  - Test that a message with goal, weak points, resource preference, and time pressure returns a profile patch with evidence.
  - Test that sparse input returns a follow-up question and does not require confirmation.
  - Test that broad input covering the core fields asks for confirmation.

- [ ] **Step 2: Run the test and verify RED**
  - Run `E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/teaching/conversation-profile.test.ts`.
  - Expected: fail because `lib/student/conversation-profile.ts` does not exist yet.

- [ ] **Step 3: Implement the extractor**
  - Add exported types:
    - `ConversationalProfileDimension<T>`
    - `ConversationalProfilePatch`
    - `ConversationProfileStage`
    - `ConversationProfileExtractionResult`
  - Add `extractConversationProfile(input)` with deterministic Chinese/English keyword matching.

- [ ] **Step 4: Run the test and verify GREEN**
  - Run the same Vitest command.
  - Expected: all tests pass.

## Task 2: API Route Structured Response

**Files:**
- Modify: `app/api/sky/student/profile/conversation/route.ts`
- Extend: `tests/teaching/conversation-profile.test.ts` if route-independent behavior needs coverage.

- [ ] **Step 1: Update API route**
  - Call `extractConversationProfile`.
  - Return `profilePatch`, `nextQuestion`, `needsConfirmation`, `stage`, and flattened `evidence`.
  - Preserve existing `profile`, `patch`, and `evidence` response shape for demo callers.

- [ ] **Step 2: Run extractor tests**
  - Run `E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/teaching/conversation-profile.test.ts`.

## Task 3: Student Profile Onboarding Chat UI

**Files:**
- Create: `components/sky/student/profile-onboarding-chat.tsx`
- Modify: `app/sky/student/student-profile-page.tsx`

- [ ] **Step 1: Add chat component**
  - Use existing `Button`, `Card`, `CardContent`, and Tailwind conventions.
  - Keep the interaction lightweight: starter prompt, textarea, send button, extracted summary, next question, confirmation hint.

- [ ] **Step 2: Mount component**
  - Render it above the existing profile data card.
  - Do not remove the behavior-based `StudentProfileDisplay`.

- [ ] **Step 3: Run targeted checks**
  - Run extractor tests.
  - Run TypeScript check if time allows: `npx tsc --noEmit`.

## Self-Review

- This phase intentionally does not add persistent profile signals yet.
- This phase intentionally does not call an LLM; deterministic extraction keeps the demo usable without provider keys.
- The next phase should add storage for confirmed profile signals and merge them into `personalization-context`.
