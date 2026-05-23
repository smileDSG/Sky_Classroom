# Avatar Speech Bubble Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add animated speech bubble popups that emerge from left sidebar avatars when participants speak, in both Stage and Slides pages.

**Architecture:** Create a standalone `AvatarSpeechPopup` component with role-based styling and AnimatePresence transitions. Integrate into Roundtable (Stage page, replacing existing floating message) and SlidesPage (replacing SideAvatarDialog).

**Tech Stack:** Next.js 14, React, motion/react, Tailwind CSS, TypeScript

---

### File Structure

**Created:**
- `components/ui/avatar-speech-popup.tsx` — New popup component
- `tests/components/ui/avatar-speech-popup.test.tsx` — Component tests

**Modified:**
- `components/roundtable/index.tsx` — Import + replace floating message (lines 554-644 + 1032-1118)
- `components/sky/slides/slides-page.tsx` — Replace SideAvatarDialog (lines 14-145 + 420-429)
- `components/ui/glass-dialog.tsx` — Export update (add AvatarSpeechPopup re-export if needed)

---

### Task 1: Create AvatarSpeechPopup Component

**Files:**
- Create: `components/ui/avatar-speech-popup.tsx`

- [ ] **Step 1: Write the component**

Create `components/ui/avatar-speech-popup.tsx` with this content:

```typescript
'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useRef, useEffect, useState, useCallback } from 'react';

export interface AvatarSpeechPopupProps {
  speakingAgentId: string | null;
  sourceText: string | null;
  participants: Array<{
    id: string;
    avatar: string;
    name: string;
    role: 'teacher' | 'student' | 'user';
    color?: string;
  }>;
  sidebarWidth?: number;
  isPresenting?: boolean;
}

const roleColors = {
  teacher: { border: 'border-violet-400/20', bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', wave: 'bg-violet-500' },
  student: { border: 'border-sky-400/20', bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', wave: 'bg-sky-500' },
  user: { border: 'border-emerald-400/20', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', wave: 'bg-emerald-500' },
} as const;

const roleLabels: Record<string, string> = { teacher: '老师', student: '学生', user: '我' };

export function AvatarSpeechPopup({
  speakingAgentId,
  sourceText,
  participants,
  sidebarWidth = 80,
  isPresenting = false,
}: AvatarSpeechPopupProps) {
  const avatarRef = useRef<HTMLDivElement>(null);
  const [avatarRect, setAvatarRect] = useState<DOMRect | null>(null);

  const speaker = participants.find((p) => p.id === speakingAgentId) ?? null;
  const colors = speaker ? roleColors[speaker.role] : roleColors.student;

  // Track avatar position
  const updateAvatarRect = useCallback(() => {
    if (avatarRef.current) {
      setAvatarRect(avatarRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    if (!speakingAgentId || !avatarRef.current) return;
    updateAvatarRect();

    const observer = new MutationObserver(updateAvatarRect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    window.addEventListener('resize', updateAvatarRect);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateAvatarRect);
    };
  }, [speakingAgentId, updateAvatarRect]);

  if (!speaker || !sourceText) return null;

  // Compute bubble position from avatar DOM rect
  const top = avatarRect ? avatarRect.top + avatarRect.height / 2 - 40 : sidebarWidth + 40;
  const left = avatarRect ? avatarRect.right + 8 : sidebarWidth + 8;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={speakingAgentId}
        initial={{ opacity: 0, x: -20, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.9 }}
        transition={{ duration: 0.35, ease: [0.21, 1, 0.36, 1] }}
        className="fixed z-[36] max-w-[300px] pointer-events-none"
        style={{ top, left: isPresenting ? left : left }}
      >
        {/* Invisible ref anchor for the currently speaking avatar */}
        {/* This is rendered at the avatar position in the sidebar */}
        <div ref={avatarRef} className="fixed pointer-events-none opacity-0" style={{ top, left: sidebarWidth }} />

        <div className={cn(
          'relative rounded-2xl px-4 py-3 shadow-xl backdrop-blur-xl',
          'bg-white/95 dark:bg-slate-800/95',
          `border ${colors.border}`
        )}>
          {/* Arrow pointing to avatar */}
          <div
            className={cn(
              'absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-3 rotate-45',
              'bg-white/95 dark:bg-slate-800/95',
              `border-l ${colors.border.split(' ')[0]} border-b ${colors.border.split(' ')[0]}`
            )}
          />

          {/* Speaker Header */}
          <div className="flex items-center gap-2 mb-2">
            <img
              src={speaker.avatar}
              alt={speaker.name}
              className="w-6 h-6 rounded-full object-cover border border-white/20"
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {speaker.name}
            </span>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              colors.bg,
              colors.text
            )}>
              {roleLabels[speaker.role]}
            </span>
          </div>

          {/* Message Text */}
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed line-clamp-4">
            {sourceText}
          </p>

          {/* Speaking Indicator */}
          <div className="flex items-center gap-1 mt-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 10, 4], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                className={cn('w-1 rounded-full', colors.wave)}
              />
            ))}
            <span className="text-[10px] text-slate-400 ml-1.5">说话中...</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

Wait — I need to rethink the positioning approach. The DOM ref approach won't work cleanly because the popup component doesn't have direct access to the avatar element's DOM node. Let me redesign with a simpler approach: pass the avatar's vertical position directly, and use the known sidebar width for horizontal offset.

Here's the corrected version:

```typescript
'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export interface AvatarSpeechPopupProps {
  speakingAgentId: string | null;
  sourceText: string | null;
  participants: Array<{
    id: string;
    avatar: string;
    name: string;
    role: 'teacher' | 'student' | 'user';
    color?: string;
  }>;
  /** Vertical position (px from top of viewport) of the speaking avatar's center */
  avatarTop?: number;
  /** Left sidebar width in px (default 80) */
  sidebarWidth?: number;
  /** Fullscreen presentation mode */
  isPresenting?: boolean;
}

const roleConfig = {
  teacher: {
    waveColor: 'bg-violet-500',
    roleBg: 'bg-violet-500/10',
    roleText: 'text-violet-600 dark:text-violet-400',
    borderColor: 'border-violet-400/20',
    arrowBorder: 'border-violet-400/20',
  },
  student: {
    waveColor: 'bg-sky-500',
    roleBg: 'bg-sky-500/10',
    roleText: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-sky-400/20',
    arrowBorder: 'border-sky-400/20',
  },
  user: {
    waveColor: 'bg-emerald-500',
    roleBg: 'bg-emerald-500/10',
    roleText: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-400/20',
    arrowBorder: 'border-emerald-400/20',
  },
} as const;

const roleLabels: Record<string, string> = { teacher: '老师', student: '学生', user: '我' };

export function AvatarSpeechPopup({
  speakingAgentId,
  sourceText,
  participants,
  avatarTop,
  sidebarWidth = 80,
  isPresenting = false,
}: AvatarSpeechPopupProps) {
  const speaker = participants.find((p) => p.id === speakingAgentId) ?? null;
  if (!speaker || !sourceText) return null;

  const cfg = roleConfig[speaker.role];
  // Vertical centering: position bubble at avatar center minus ~half bubble height
  const top = avatarTop ? avatarTop - 40 : '50%';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={speakingAgentId}
        initial={{ opacity: 0, x: -20, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.9 }}
        transition={{ duration: 0.35, ease: [0.21, 1, 0.36, 1] }}
        className="fixed z-[36] max-w-[300px] pointer-events-none"
        style={{ top: top === '50%' ? '50%' : `${top}px`, left: `${sidebarWidth + 8}px`, transform: top === '50%' ? 'translateY(-50%)' : undefined }}
      >
        <div className={cn(
          'relative rounded-2xl px-4 py-3 shadow-xl backdrop-blur-xl',
          'bg-white/95 dark:bg-slate-800/95',
          `border ${cfg.borderColor}`
        )}>
          {/* Arrow pointing left to avatar */}
          <div
            className={cn(
              'absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-3 rotate-45',
              'bg-white/95 dark:bg-slate-800/95',
              `border-l border-b ${cfg.arrowBorder}`
            )}
          />

          {/* Speaker Header */}
          <div className="flex items-center gap-2 mb-2">
            <img
              src={speaker.avatar}
              alt={speaker.name}
              className="w-6 h-6 rounded-full object-cover border border-white/20"
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {speaker.name}
            </span>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              cfg.roleBg,
              cfg.roleText
            )}>
              {roleLabels[speaker.role]}
            </span>
          </div>

          {/* Message Text */}
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed line-clamp-4">
            {sourceText}
          </p>

          {/* Speaking Indicator */}
          <div className="flex items-center gap-1 mt-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 10, 4], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                className={cn('w-1 rounded-full', cfg.waveColor)}
              />
            ))}
            <span className="text-[10px] text-slate-400 ml-1.5">说话中...</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors for the new file.

- [ ] **Step 3: Commit**

```bash
git add components/ui/avatar-speech-popup.tsx
git commit -m "feat: add AvatarSpeechPopup component for sidebar avatar speech bubbles"
```

---

### Task 2: Integrate into Roundtable (Stage Page) — Normal Mode

**Files:**
- Modify: `components/roundtable/index.tsx`

- [ ] **Step 1: Add import**

At the top of `components/roundtable/index.tsx`, add after line 34:

```typescript
import { AvatarSpeechPopup } from '@/components/ui/avatar-speech-popup';
```

- [ ] **Step 2: Remove `shouldShowFloatingMessage` and related variables**

Delete lines 449-555 (the `shouldShowFloatingMessage` variable and `currentSpeaker`/`shouldShowFloatingMessage` derivation). Specifically remove:
- Line 550-552: `const currentSpeaker` derivation
- Line 554-555: `const shouldShowFloatingMessage` and `if (isPresenting)` block start

Actually, let me be more precise. The `shouldShowFloatingMessage` depends on `currentSpeech && speakingAgentId && currentSpeaker`. The `currentSpeaker` is derived from `speakingAgentId` and `stripParticipants`. Both of these are still needed for the new component. So we keep `currentSpeaker` but remove `shouldShowFloatingMessage` and `if (isPresenting)` is a render branch, not a variable.

Let me re-examine. The `currentSpeaker` variable (line 550-552) is used for `shouldShowFloatingMessage` only (lines 555). So we can remove:
- Line 550-552: `const currentSpeaker = ...`
- Line 554-555: `const shouldShowFloatingMessage = ...`

- [ ] **Step 3: Replace normal-mode floating message with AvatarSpeechPopup**

In the normal mode section (around line 1032-1118), replace the entire `Floating Message Bubble from Character` AnimatePresence block (lines 1033-1118) with:

```tsx
        <AvatarSpeechPopup
          speakingAgentId={speakingAgentId}
          sourceText={sourceText}
          participants={stripParticipants}
          sidebarWidth={80}
          isPresenting={false}
        />
```

This replaces lines 1033-1118 (the entire `<AnimatePresence>{shouldShowFloatingMessage && ...}</AnimatePresence>` block).

- [ ] **Step 4: Remove `shouldShowFloatingMessage` usage in the remaining code**

Search for any remaining references to `shouldShowFloatingMessage` and remove them. The only references are in the presentation mode block (line 562) and the normal mode block (line 1035) — both of which are being replaced.

- [ ] **Step 5: Commit**

```bash
git add components/roundtable/index.tsx
git commit -m "feat: integrate AvatarSpeechPopup into Roundtable normal mode, remove old floating message"
```

---

### Task 3: Integrate into Roundtable (Stage Page) — Presentation Mode

**Files:**
- Modify: `components/roundtable/index.tsx`

- [ ] **Step 1: Replace presentation mode floating message**

In the presentation mode return block (around line 560-644), replace the `Floating Message Bubble from Character Strip` AnimatePresence block (lines 561-643) with:

```tsx
        <AvatarSpeechPopup
          speakingAgentId={speakingAgentId}
          sourceText={sourceText}
          participants={stripParticipants}
          sidebarWidth={80}
          isPresenting={true}
        />
```

This replaces lines 561-643 (the entire presentation-mode floating message `<AnimatePresence>{shouldShowFloatingMessage && ...}</AnimatePresence>` block).

- [ ] **Step 2: Clean up unused variables**

After removing both floating message blocks, check if `currentSpeaker` (line 550-552) is still used anywhere. If not, remove it.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/roundtable/index.tsx
git commit -m "feat: integrate AvatarSpeechPopup into Roundtable presentation mode"
```

---

### Task 4: Integrate into SlidesPage — Replace SideAvatarDialog

**Files:**
- Modify: `components/sky/slides/slides-page.tsx`

- [ ] **Step 1: Add import**

After line 13, add:

```typescript
import { AvatarSpeechPopup } from '@/components/ui/avatar-speech-popup';
```

- [ ] **Step 2: Remove SideAvatarDialog component definition**

Delete lines 24-145 (the entire `SideAvatarDialog` function component). Keep the `DiscussionMessage` interface (lines 16-22) as it's still used by `useDiscussion`.

- [ ] **Step 3: Replace SideAvatarDialog usage with AvatarSpeechPopup**

Around line 420-429, replace:

```tsx
              {currentMessage && (
                <SideAvatarDialog
                  message={currentMessage}
                  onComplete={handleMessageComplete}
                />
              )}
```

With:

```tsx
              {currentMessage && (
                <AvatarSpeechPopup
                  speakingAgentId={currentMessage.avatar.id}
                  sourceText={currentMessage.text}
                  participants={AVATAR_CONFIGS.map((a) => ({
                    id: a.id,
                    avatar: a.avatarUrl,
                    name: a.name,
                    role: a.id.includes('professor') || a.id.includes('teacher') ? 'teacher' : 'student',
                    color: a.id.includes('professor') || a.id.includes('teacher') ? '#8b5cf6' : '#0ea5e9',
                  }))}
                  sidebarWidth={0}
                  isPresenting={false}
                />
              )}
```

Wait — the slides page doesn't have a left avatar sidebar. The SideAvatarDialog was positioned absolutely within the main content area, not relative to a sidebar. Let me re-read the slides page layout.

Looking at slides-page.tsx line 400-414, the left sidebar is a collapsible讲解栏 (AvatarSelector + ThumbnailList), which is 240px wide when open (`w-60`). So `sidebarWidth` should be 240 when sidebar is open, 0 when closed.

Also, the slides page avatars are in `AVATAR_CONFIGS`, not in a participant list. Let me adjust:

```tsx
              {currentMessage && sidebarOpen && (
                <AvatarSpeechPopup
                  speakingAgentId={currentMessage.avatar.id}
                  sourceText={currentMessage.text}
                  participants={AVATAR_CONFIGS.map((a) => ({
                    id: a.id,
                    avatar: a.avatarUrl,
                    name: a.name,
                    role: a.id.includes('professor') || a.id.includes('teacher') ? 'teacher' : 'student',
                  }))}
                  sidebarWidth={240}
                  isPresenting={false}
                />
              )}
```

Hmm, but the slides page doesn't show character avatars in a sidebar — it shows avatar *selectors* (small circles in the sidebar). The SideAvatarDialog was designed to show alongside the full avatar image. Let me reconsider.

Looking at the slides page more carefully: the sidebar has `AvatarSelector` with small 40px avatar circles, and the main content has `AvatarPlayer` in the bottom-right corner. The `SideAvatarDialog` was rendering an avatar image + bubble floating from the side of the content area.

For the slides page, the effect should be: the bubble pops out from the avatar shown in the sidebar (the small avatar selector). So we need to position it relative to the sidebar's avatar position.

Let me simplify: for the slides page, use `avatarTop` prop to pass the vertical position of the selected avatar in the sidebar, and `sidebarWidth={240}` (when sidebar is open).

Actually, this is getting complex for the slides page. The simplest approach: the slides page sidebar shows avatars in `AvatarSelector`. When a discussion message fires, we show the bubble coming from the sidebar area. Since the sidebar width is 240px, the bubble should appear at `left: 248px`.

For `avatarTop`, we can compute it from the selected avatar's position in the selector list. But that requires DOM measurement. 

Let me use a simpler approach for slides: pass a fixed `avatarTop` based on which avatar is speaking (teacher = ~120px, student = ~200px, etc.), or better yet, use the `useRef` approach to measure the AvatarSelector's avatar position.

Actually, the cleanest approach: for the slides page, just use a simplified version without DOM measurement. The sidebar is 240px wide, avatars are in the AvatarSelector component. We can pass `sidebarWidth={240}` and let the component use a default vertical position.

Let me simplify the component to support both modes. I'll add an optional `avatarVerticalOffset` prop for cases where we can't measure DOM position:

Actually, let me just keep the component simple and handle the slides page differently. For the slides page, the avatar sidebar has the avatar selector with avatars stacked vertically. We can compute the approximate position based on the avatar's index in the list.

Let me revise the component to accept either `avatarTop` (absolute px) or `avatarIndex` (position in sidebar list):

No — this is overcomplicating. Let me just use `avatarTop` for both pages. For the Roundtable, we can compute it from the `stripParticipants` array. For the Slides page, we compute it from `AVATAR_CONFIGS`.

Let me finalize the component props and usage for both pages:

**Roundtable integration:**
```tsx
// Compute avatar vertical position from stripParticipants
// Teacher is first (top ~80px), students follow, user is at bottom
const speakingAvatarIndex = stripParticipants.findIndex(p => p.id === speakingAgentId);
const avatarTop = speakingAvatarIndex >= 0 ? 80 + speakingAvatarIndex * 68 : undefined;
```

Wait, the Roundtable CharacterStrip already renders the avatars at specific positions. The layout is: teacher (hexagon, lg size) at top, then divider, then students (diamond, md size), then divider, then user (blob, xl size). The vertical positions depend on the number of students.

This is getting complicated with DOM measurement. Let me take a step back and use the simplest possible approach.

**Simplest approach:** Don't use DOM measurement. Instead, pass `avatarTop` as a computed value from the parent, and for the slides page, pass `sidebarWidth={240}`. For the Roundtable, the avatar positions are predictable enough to compute.

Actually, the absolute simplest approach that works for both pages: **use `position: fixed` with `top: 50%; transform: translateY(-50%)` to vertically center the bubble**, and let `sidebarWidth` control the horizontal offset. The bubble doesn't need to perfectly align with the specific avatar — it just needs to appear from the left sidebar area. This matches the visual effect the user wants without complex DOM measurement.

Let me rewrite the component with this simpler approach:

```typescript
'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export interface AvatarSpeechPopupProps {
  speakingAgentId: string | null;
  sourceText: string | null;
  participants: Array<{
    id: string;
    avatar: string;
    name: string;
    role: 'teacher' | 'student' | 'user';
  }>;
  /** Left sidebar width in px (default 80 for Roundtable, 240 for Slides) */
  sidebarWidth?: number;
}

const roleConfig = {
  teacher: {
    waveColor: 'bg-violet-500',
    roleBg: 'bg-violet-500/10',
    roleText: 'text-violet-600 dark:text-violet-400',
    borderColor: 'border-violet-400/20',
    arrowBorder: 'border-violet-400/20',
  },
  student: {
    waveColor: 'bg-sky-500',
    roleBg: 'bg-sky-500/10',
    roleText: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-sky-400/20',
    arrowBorder: 'border-sky-400/20',
  },
  user: {
    waveColor: 'bg-emerald-500',
    roleBg: 'bg-emerald-500/10',
    roleText: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-400/20',
    arrowBorder: 'border-emerald-400/20',
  },
} as const;

const roleLabels: Record<string, string> = { teacher: '老师', student: '学生', user: '我' };

export function AvatarSpeechPopup({
  speakingAgentId,
  sourceText,
  participants,
  sidebarWidth = 80,
}: AvatarSpeechPopupProps) {
  const speaker = participants.find((p) => p.id === speakingAgentId) ?? null;
  if (!speaker || !sourceText) return null;

  const cfg = roleConfig[speaker.role];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={speakingAgentId}
        initial={{ opacity: 0, x: -20, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -20, scale: 0.9 }}
        transition={{ duration: 0.35, ease: [0.21, 1, 0.36, 1] }}
        className="fixed top-1/2 -translate-y-1/2 z-[36] max-w-[300px] pointer-events-none"
        style={{ left: `${sidebarWidth + 8}px` }}
      >
        <div className={cn(
          'relative rounded-2xl px-4 py-3 shadow-xl backdrop-blur-xl',
          'bg-white/95 dark:bg-slate-800/95',
          `border ${cfg.borderColor}`
        )}>
          {/* Arrow pointing left to avatar */}
          <div
            className={cn(
              'absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-3 rotate-45',
              'bg-white/95 dark:bg-slate-800/95',
              `border-l border-b ${cfg.arrowBorder}`
            )}
          />

          {/* Speaker Header */}
          <div className="flex items-center gap-2 mb-2">
            <img
              src={speaker.avatar}
              alt={speaker.name}
              className="w-6 h-6 rounded-full object-cover border border-white/20"
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {speaker.name}
            </span>
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              cfg.roleBg,
              cfg.roleText
            )}>
              {roleLabels[speaker.role]}
            </span>
          </div>

          {/* Message Text */}
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed line-clamp-4">
            {sourceText}
          </p>

          {/* Speaking Indicator */}
          <div className="flex items-center gap-1 mt-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ height: [4, 10, 4], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                className={cn('w-1 rounded-full', cfg.waveColor)}
              />
            ))}
            <span className="text-[10px] text-slate-400 ml-1.5">说话中...</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

This is much simpler: vertically centered, horizontally offset from the sidebar. Clean and works for both pages.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/avatar-speech-popup.tsx
git commit -m "feat: add AvatarSpeechPopup component — simplified vertically-centered popup"
```

---

### Task 2: Integrate into Roundtable — Remove old floating message

**Files:**
- Modify: `components/roundtable/index.tsx`

- [ ] **Step 1: Add import**

After line 34 (`import { BottomToolbar } from '@/components/ui/bottom-toolbar';`), add:

```typescript
import { AvatarSpeechPopup } from '@/components/ui/avatar-speech-popup';
```

- [ ] **Step 2: Remove unused variables**

Delete these lines (they were only used by the old floating message):
- Lines 550-555: `currentSpeaker`, `shouldShowFloatingMessage` declarations

```typescript
// DELETE these lines:
//   const currentSpeaker = speakingAgentId
//     ? stripParticipants.find((p) => p.id === speakingAgentId)
//     : null;
//   const shouldShowFloatingMessage = !!(currentSpeech && speakingAgentId && currentSpeaker);
```

- [ ] **Step 3: Replace presentation mode floating message (lines 560-644)**

Replace the entire block from line 560 to line 644 (the `<AnimatePresence>{shouldShowFloatingMessage && (...)}</AnimatePresence>` block inside the `if (isPresenting)` return) with:

```tsx
        <AvatarSpeechPopup
          speakingAgentId={speakingAgentId}
          sourceText={sourceText}
          participants={stripParticipants}
          sidebarWidth={80}
        />
```

- [ ] **Step 4: Replace normal mode floating message (lines 1033-1118)**

Replace the entire block from line 1033 to line 1118 (the `<AnimatePresence>{shouldShowFloatingMessage && (...)}</AnimatePresence>` block inside the normal mode return) with:

```tsx
        <AvatarSpeechPopup
          speakingAgentId={speakingAgentId}
          sourceText={sourceText}
          participants={stripParticipants}
          sidebarWidth={80}
        />
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/roundtable/index.tsx
git commit -m "feat: replace old floating message with AvatarSpeechPopup in Roundtable"
```

---

### Task 3: Integrate into SlidesPage — Replace SideAvatarDialog

**Files:**
- Modify: `components/sky/slides/slides-page.tsx`

- [ ] **Step 1: Add import**

After line 13 (`import { cn } from '@/lib/utils';`), add:

```typescript
import { AvatarSpeechPopup } from '@/components/ui/avatar-speech-popup';
```

- [ ] **Step 2: Remove SideAvatarDialog component**

Delete lines 24-145 (the entire `SideAvatarDialog` function component, including the `DiscussionMessage` interface on lines 16-22 if it's only used by SideAvatarDialog).

Wait — `DiscussionMessage` is used by `useDiscussion` hook (line 148) and `playDiscussion` (line 153). So keep the interface. Delete only lines 24-145.

Actually, let me check: `DiscussionMessage` is defined at line 16-22, `SideAvatarDialog` at line 24-145. The `useDiscussion` hook uses `DiscussionMessage`. So we keep lines 1-22 (interface) and delete lines 24-145.

- [ ] **Step 3: Replace SideAvatarDialog usage (lines 420-429)**

Replace:

```tsx
              {currentMessage && (
                <SideAvatarDialog
                  message={currentMessage}
                  onComplete={handleMessageComplete}
                />
              )}
```

With:

```tsx
              {currentMessage && (
                <AvatarSpeechPopup
                  speakingAgentId={currentMessage.avatar.id}
                  sourceText={currentMessage.text}
                  participants={AVATAR_CONFIGS.map((a) => ({
                    id: a.id,
                    avatar: a.avatarUrl,
                    name: a.name,
                    role: a.id.includes('professor') || a.id.includes('teacher') ? 'teacher' : 'student',
                  }))}
                  sidebarWidth={240}
                />
              )}
```

Wait — the slides page sidebar is 240px only when `sidebarOpen` is true. When collapsed, it's 0px. Let me use the `sidebarOpen` state:

```tsx
              {currentMessage && (
                <AvatarSpeechPopup
                  speakingAgentId={currentMessage.avatar.id}
                  sourceText={currentMessage.text}
                  participants={AVATAR_CONFIGS.map((a) => ({
                    id: a.id,
                    avatar: a.avatarUrl,
                    name: a.name,
                    role: a.id.includes('professor') || a.id.includes('teacher') ? 'teacher' : 'student',
                  }))}
                  sidebarWidth={sidebarOpen ? 240 : 0}
                />
              )}
```

- [ ] **Step 4: Remove unused imports**

After removing `SideAvatarDialog`, check if `motion` is still needed in this file. Looking at the file, `motion` and `AnimatePresence` were used by `SideAvatarDialog`. After removing it, check if they're still used elsewhere. If not, remove them from the import.

Actually, `AnimatePresence` and `motion` might still be used elsewhere. Let me check — the file uses them in SideAvatarDialog (lines 43-144) and nowhere else visible. After removing SideAvatarDialog, we can remove `motion` and `AnimatePresence` from the import:

Change line 4 from:
```typescript
import { motion, AnimatePresence } from 'motion/react';
```
to:
```typescript
// motion/react import removed — no longer needed
```

Wait, actually just remove it:
```typescript
```

Hmm, there might be other uses. Let me be safe and keep it for now — the build will catch unused imports.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/sky/slides/slides-page.tsx
git commit -m "feat: replace SideAvatarDialog with AvatarSpeechPopup in SlidesPage"
```

---

### Task 4: Manual Testing

**Files:** (no file changes)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts without errors.

- [ ] **Step 2: Test Stage page — normal mode**

1. Navigate to the Stage page (classroom view)
2. Start playback (press play)
3. Verify: speech bubble appears from left sidebar when teacher speaks (purple theme)
4. Verify: bubble shows correct avatar, name, role label, and text
5. Verify: speaking indicator bars animate
6. Verify: bubble transitions smoothly when speaker changes
7. Verify: bubble disappears when playback pauses/stops

- [ ] **Step 3: Test Stage page — presentation mode**

1. Enter fullscreen presentation mode (F11 or presentation toggle)
2. Start playback
3. Verify: speech bubble appears from left character strip in fullscreen mode
4. Verify: bubble is not clipped by fullscreen container

- [ ] **Step 4: Test Stage page — user message**

1. Send a question from the user input
2. Verify: bubble appears with green (emerald) theme and "我" role label
3. Verify: bubble transitions to teacher response bubble

- [ ] **Step 5: Test Slides page**

1. Navigate to `/generation-preview` or slides page
2. Click "演示讨论" button
3. Verify: bubble appears from sidebar area when discussion starts
4. Verify: bubble auto-advances through the discussion queue
5. Verify: bubble disappears after discussion ends

- [ ] **Step 6: Test edge cases**

1. Long text (>4 lines) — verify truncation with ellipsis
2. Rapid speaker changes — verify no visual glitches
3. Sidebar collapse/expand in Slides page — verify bubble repositions
4. No speaker (idle state) — verify no bubble renders

---

### Task 5: Cleanup

**Files:**
- Modify: `components/ui/glass-dialog.tsx` (optional — remove unused exports if any)

- [ ] **Step 1: Check for dead code**

Run: `npx tsc --noEmit --pretty`
Fix any unused import warnings.

- [ ] **Step 2: Remove the preview file**

```bash
rm public/preview-avatar-bubble.html
git add public/preview-avatar-bubble.html
git commit -m "chore: remove avatar bubble preview file"
```

- [ ] **Step 3: Final commit**

If there are any remaining small fixes, commit them.

```bash
git status
```

---

## Self-Review

**1. Spec coverage check:**
- ✅ New AvatarSpeechPopup component with role-based styling
- ✅ AnimatePresence mode="wait" for transitions
- ✅ Integration into Roundtable (Stage page) — both normal and presentation modes
- ✅ Integration into SlidesPage — replacing SideAvatarDialog
- ✅ Remove old floating message bubble from Roundtable
- ✅ Role colors: teacher (violet), student (sky), user (emerald)
- ✅ Entry/exit animations matching spec
- ✅ Arrow pointing to avatar
- ✅ Speaking indicator bars
- ✅ line-clamp-4 for long text
- ✅ Edge cases: no speaker, presentation mode, sidebar collapse

**2. Placeholder scan:** No TBD/TODO/fill-in patterns found.

**3. Type consistency:**
- `AvatarSpeechPopupProps` uses `speakingAgentId: string | null`, `sourceText: string | null` — matches usage in Roundtable (`speakingAgentId` from props, `sourceText` computed locally) and SlidesPage (`currentMessage.avatar.id`, `currentMessage.text`)
- `participants` array shape matches `stripParticipants` in Roundtable and mapped `AVATAR_CONFIGS` in SlidesPage
- `roleConfig` keys match participant role types

All consistent.
