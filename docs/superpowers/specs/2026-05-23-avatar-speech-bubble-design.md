# Avatar Speech Bubble Popup Design

**Date:** 2026-05-23
**Status:** Draft

## Overview

Add a speech bubble popup that emerges from the left sidebar avatars when any participant (user, teacher, or student) is speaking. The bubble appears briefly with animated entry/exit, then disappears. The central speech area remains unchanged — the side bubble is a supplementary visual effect.

## Architecture

### New Component: `AvatarSpeechPopup`

**File:** `components/ui/avatar-speech-popup.tsx`

A standalone React component that renders an animated speech bubble emerging from the corresponding avatar in the left sidebar.

**Props:**
```typescript
interface AvatarSpeechPopupProps {
  speakingAgentId: string | null;   // ID of currently speaking agent
  sourceText: string | null;         // Current speech text
  participants: Array<{              // Participant list for avatar/name lookup
    id: string;
    avatar: string;
    name: string;
    role: 'teacher' | 'student' | 'user';
    color?: string;
  }>;
  sidebarWidth?: number;             // Left sidebar width (default: 80)
  isPresenting?: boolean;            // Fullscreen presentation mode flag
}
```

**Behavior:**
1. Match `speakingAgentId` against `participants` to find avatar/name/role
2. Use `useRef` on the matching avatar DOM element to get its `getBoundingClientRect()`
3. Render bubble as `fixed` positioned element, offset to the right of the avatar
4. Wrap in `AnimatePresence mode="wait"` for smooth transitions between speakers
5. Bubble includes: avatar thumbnail, name, role badge, speech text (max 4 lines), speaking indicator bars, arrow pointing to avatar

**Role-based styling:**
- Teacher: violet theme (`#8b5cf6`)
- Student: sky blue theme (`#0ea5e9`)
- User: emerald theme (`#10b981`)

### Integration Points

#### Stage Page (`components/roundtable/index.tsx`)

Place `AvatarSpeechPopup` inside the left avatar sidebar container. Data is already available:
- `speakingAgentId` — passed from Stage parent
- `sourceText` — computed locally (line 193-200)
- `participants` — `stripParticipants` derived from `initialParticipants`
- `sidebarWidth` — fixed at 80px (w-20)

Also hide/remove the existing `shouldShowFloatingMessage` bubble (lines 1034-1117), as it duplicates the same functionality with less polish.

#### Slides Page (`components/sky/slides/slides-page.tsx`)

Replace the existing `SideAvatarDialog` component with `AvatarSpeechPopup`. The `useDiscussion` hook already provides:
- `currentMessage` — contains avatar config, text, duration, side
- `handleMessageComplete` — callback for auto-advancing the queue

Map `currentMessage.avatar` → participant format, pass to `AvatarSpeechPopup`. The auto-dismiss timer is already handled by the parent hook.

## Visual Design

### Bubble Appearance
- Background: `bg-white/95` with `backdrop-blur-xl`
- Border: role-colored border at 20% opacity
- Border radius: 18px (rounded-2xl)
- Max width: 300px
- Arrow: diamond-shaped triangle pointing left to avatar, matching role color

### Animations
- Entry: 0.35s `cubic-bezier(0.21, 1, 0.36, 1)` — slide in from avatar side + scale up
- Exit: 0.25s same easing — slide back + fade out
- Speaker switch: `AnimatePresence mode="wait"` — old exits before new enters
- Avatar glow: pulse animation on the speaking avatar ring (existing, preserved)
- Speaking indicator: 3 animated bars bouncing (existing pattern, preserved)

### Positioning
- `fixed` positioning computed from avatar DOM `getBoundingClientRect()`
- Offset: `left: sidebarWidth + 4px`
- Vertical: aligned with avatar center (`top: avatarTop`)
- Fallback: if DOM ref unavailable, use `left: [sidebarWidth + 4px]`

## Edge Cases

1. **No speaker** — component returns `null`
2. **Avatar ref unavailable** — fallback to fixed positioning at sidebar edge
3. **Long text** — `line-clamp-4` with ellipsis
4. **Presentation fullscreen** — `fixed` positioning bypasses container overflow clipping
5. **Sidebar collapse/expand** — positioning recomputes on each render
6. **Rapid speaker changes** — `mode="wait"` prevents bubble overlap
7. **Student vs teacher detection** — derived from participant role, not agentId pattern matching

## Testing

- Verify bubble appears on correct avatar for teacher/student/user
- Verify entry/exit animations are smooth
- Verify bubble disappears when speaker changes
- Verify presentation mode positioning
- Verify long text truncation
- Verify no rendering when `speakingAgentId` is null
