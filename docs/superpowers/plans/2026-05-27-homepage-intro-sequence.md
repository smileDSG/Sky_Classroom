# Homepage Intro Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a ~5.5s cinematic opening animation (mountain silhouette → cloud rises → person enters glowing book → white flash) that plays before the homepage loads, with a skip button.

**Architecture:** A new `IntroSequence` component acts as a fullscreen overlay. It plays through 4 animated scenes using Framer Motion, then calls `onComplete()` to unmount itself and reveal the homepage. The `HomePage` component wraps this with a simple `introDone` state.

**Tech Stack:** React, motion/react (Framer Motion), SVG inline graphics, Tailwind CSS

---

### File Structure

| File | Responsibility |
|------|---------------|
| `components/sky/home/intro-sequence.tsx` | New — Main animation component with all 4 scenes |
| `app/page.tsx` | Modify — Add `introDone` state, wrap HomePage with IntroSequence |

The `intro-sequence.tsx` file is self-contained: SVG paths, animation logic, skip button, and scene orchestration. No split needed — it's one focused component ~200 lines.

---

### Task 1: Create IntroSequence Component

**Files:**
- Create: `components/sky/home/intro-sequence.tsx`

- [ ] **Step 1: Write the component with all scenes**

Create `components/sky/home/intro-sequence.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight } from 'lucide-react';

interface IntroSequenceProps {
  onComplete: () => void;
}

export function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [scene, setScene] = useState(0); // 0-3 for the 4 scenes
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  // Auto-advance scenes
  useEffect(() => {
    // Scene 0: Mountain (0-1.5s)
    const t0 = setTimeout(() => setScene(1), 1500);
    // Scene 1: Cloud rises (1.5-3s)
    const t1 = setTimeout(() => setScene(2), 3000);
    // Scene 2: Glowing book (3-4.5s)
    const t2 = setTimeout(() => setScene(3), 4500);
    // Scene 3: White flash (4.5-5.5s) → done
    const t3 = setTimeout(() => {
      onComplete();
    }, 5700);

    timerRef.current = [t0, t1, t2, t3];
    return () => {
      timerRef.current.forEach(clearTimeout);
    };
  }, [onComplete]);

  const handleSkip = () => {
    timerRef.current.forEach(clearTimeout);
    onComplete();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
    >
      <AnimatePresence>
        {/* ── Scene 0-1: Mountain silhouette ── */}
        {scene <= 1 && (
          <motion.div
            key="mountain-scene"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Mountains */}
            <svg
              className="absolute bottom-0 left-0 w-full h-full"
              viewBox="0 0 1000 600"
              preserveAspectRatio="xMidYMax slice"
              fill="none"
            >
              {/* Far mountain */}
              <path d="M0 600 L300 250 L600 600Z" fill="#1a1a2e" opacity="0.5" />
              {/* Main mountain (tallest, center-left) */}
              <path d="M100 600 L420 180 L750 600Z" fill="#0d0d1a" />
              {/* Right mountain */}
              <path d="M400 600 L680 300 L1000 600Z" fill="#141428" opacity="0.7" />
              {/* Small hill (right foreground) */}
              <path d="M600 600 L800 450 L1000 600Z" fill="#0a0a14" />
            </svg>

            {/* Person silhouette on mountain peak */}
            <motion.div
              className="absolute"
              style={{ left: '38%', bottom: `${400 / 600 * 100}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <svg viewBox="0 0 30 60" className="w-6 h-12" fill="#e8e8e8">
                {/* Head */}
                <circle cx="15" cy="8" r="6" />
                {/* Body */}
                <rect x="12" y="14" width="6" height="20" rx="2" />
                {/* Legs */}
                <rect x="11" y="34" width="3" height="16" rx="1" />
                <rect x="16" y="34" width="3" height="16" rx="1" />
                {/* Arms */}
                <rect x="5" y="16" width="8" height="3" rx="1" />
                <rect x="17" y="16" width="8" height="3" rx="1" />
              </svg>
            </motion.div>

            {/* Cloud silhouette near person */}
            <motion.div
              className="absolute"
              style={{ left: '32%', top: '30%' }}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 0.85 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              <svg viewBox="0 0 120 60" className="w-20 h-10" fill="white">
                <ellipse cx="30" cy="40" rx="22" ry="16" />
                <ellipse cx="60" cy="28" rx="30" ry="22" />
                <ellipse cx="95" cy="38" rx="20" ry="14" />
              </svg>
            </motion.div>
          </motion.div>
        )}

        {/* ── Scene 1-2: Cloud rises with person ── */}
        {scene >= 1 && scene <= 2 && (
          <motion.div
            key="cloud-rise"
            style={{
              position: 'absolute',
              left: '32%',
              top: '30%',
            }}
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -200, opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          >
            {/* Cloud */}
            <svg viewBox="0 0 120 60" className="w-20 h-10" fill="white" opacity="0.85">
              <ellipse cx="30" cy="40" rx="22" ry="16" />
              <ellipse cx="60" cy="28" rx="30" ry="22" />
              <ellipse cx="95" cy="38" rx="20" ry="14" />
            </svg>
            {/* Person riding cloud */}
            <motion.div
              style={{ position: 'absolute', top: '-30px', left: '30px' }}
              animate={{ scale: [1, 0.6], opacity: [1, 0.4] }}
              transition={{ duration: 1.5 }}
            >
              <svg viewBox="0 0 30 60" className="w-5 h-10" fill="#e8e8e8">
                <circle cx="15" cy="8" r="6" />
                <rect x="12" y="14" width="6" height="20" rx="2" />
                <rect x="11" y="34" width="3" height="16" rx="1" />
                <rect x="16" y="34" width="3" height="16" rx="1" />
              </svg>
            </motion.div>
          </motion.div>
        )}

        {/* Mountains fade during cloud rise */}
        {scene >= 1 && scene <= 2 && (
          <motion.div
            className="absolute bottom-0 left-0 w-full h-full"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0.3 }}
            transition={{ duration: 1.5 }}
          >
            <svg
              viewBox="0 0 1000 600"
              preserveAspectRatio="xMidYMax slice"
              fill="none"
            >
              <path d="M0 600 L300 250 L600 600Z" fill="#1a1a2e" opacity="0.5" />
              <path d="M100 600 L420 180 L750 600Z" fill="#0d0d1a" />
              <path d="M400 600 L680 300 L1000 600Z" fill="#141428" opacity="0.7" />
              <path d="M600 600 L800 450 L1000 600Z" fill="#0a0a14" />
            </svg>
          </motion.div>
        )}

        {/* ── Scene 2-3: Glowing book ── */}
        {scene >= 2 && scene <= 3 && (
          <motion.div
            key="book-scene"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            {/* Light rays behind book */}
            <motion.div
              className="absolute"
              style={{
                width: 300,
                height: 300,
                background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 40%, transparent 70%)',
                borderRadius: '50%',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 3, opacity: 1 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />

            {/* Book SVG */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6, type: 'spring', stiffness: 200 }}
            >
              <svg
                viewBox="0 0 200 140"
                className="w-40 h-28 md:w-56 md:h-40"
                fill="none"
                stroke="white"
                strokeWidth="2"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.8)) drop-shadow(0 0 40px rgba(255,255,255,0.4))',
                }}
              >
                {/* Left page */}
                <motion.path
                  d="M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z"
                  fill="rgba(255,255,255,0.15)"
                  animate={{ d: [
                    'M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z',
                    'M100 20 Q60 15 5 20 L5 105 Q60 100 100 120Z',
                    'M100 20 Q70 10 10 25 L10 110 Q70 95 100 120Z',
                  ]}}
                  transition={{ delay: 0.5, duration: 0.8, repeat: 1 }}
                />
                {/* Right page */}
                <motion.path
                  d="M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z"
                  fill="rgba(255,255,255,0.15)"
                  animate={{ d: [
                    'M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z',
                    'M100 20 Q140 15 195 20 L195 105 Q140 100 100 120Z',
                    'M100 20 Q130 10 190 25 L190 110 Q130 95 100 120Z',
                  ]}}
                  transition={{ delay: 0.7, duration: 0.8, repeat: 1 }}
                />
                {/* Spine */}
                <line x1="100" y1="20" x2="100" y2="120" strokeWidth="2.5" />
              </svg>
            </motion.div>

            {/* Person entering book (smaller, fading into center) */}
            <motion.div
              className="absolute"
              initial={{ opacity: 0.4, scale: 0.5, y: -100 }}
              animate={{ opacity: 0, scale: 0, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeIn' }}
            >
              <svg viewBox="0 0 30 60" className="w-4 h-8" fill="#e8e8e8">
                <circle cx="15" cy="8" r="6" />
                <rect x="12" y="14" width="6" height="20" rx="2" />
              </svg>
            </motion.div>
          </motion.div>
        )}

        {/* ── Scene 3: White flash overlay ── */}
        {scene >= 3 && (
          <motion.div
            key="white-flash"
            className="absolute inset-0 z-50"
            style={{
              background: 'white',
              clipPath: 'circle(0% at 50% 50%)',
            }}
            animate={{
              clipPath: 'circle(150% at 50% 50%)',
            }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Skip button — always visible */}
      <motion.button
        className="absolute bottom-6 right-6 z-[60] flex items-center gap-2 px-4 py-2 rounded-full text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all cursor-pointer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSkip}
      >
        跳过
        <ArrowRight className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `npx tsc --noEmit components/sky/home/intro-sequence.tsx`  (or check `npx tsc --noEmit` for the whole project)

Expected: No errors related to the new file.

---

### Task 2: Integrate IntroSequence into HomePage

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add import and state**

Add import near the other sky/home imports (after line 41):

```tsx
import { IntroSequence } from '@/components/sky/home/intro-sequence';
```

Inside `HomePage` function, add state before any effects:

```tsx
const [introDone, setIntroDone] = useState(false);
```

- [ ] **Step 2: Wrap return with conditional rendering**

Change the return from:

```tsx
return (
  <div className="min-h-screen w-full relative overflow-x-hidden">
```

to:

```tsx
if (!introDone) {
  return (
    <IntroSequence onComplete={() => setIntroDone(true)} />
  );
}

return (
  <div className="min-h-screen w-full relative overflow-x-hidden">
```

This means the entire existing return block stays exactly the same — we just add a conditional render guard before it.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | Select-String -Pattern "error"`

Expected: No errors.

---

### Task 3: Manual QA — Dev Server Test

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Open localhost and verify**

Open `http://localhost:3000` in browser. Verify:

1. **Scene 1 (0-1.5s):** Mountain silhouettes fade in, person appears on peak, cloud drifts in from left
2. **Scene 2 (1.5-3s):** Cloud + person float upward and fade out, mountains dim
3. **Scene 3 (3-4.5s):** Glowing book appears from center with light rays, pages flutter, person drops into book and vanishes
4. **Scene 4 (4.5-5.5s):** White circle expands from center, fills screen
5. **~5.7s:** Homepage renders
6. **Skip button:** Click it at any point — should immediately jump to homepage
7. **Revisit:** Navigate away and back to `/` — animation plays again (as designed)

- [ ] **Step 3: Test responsive behavior**

Resize browser to mobile width (375px) — verify SVGs scale correctly, skip button remains accessible.

---

### Task 4: Polish — Sky Color Transition Between Scenes

**Files:**
- Modify: `components/sky/home/intro-sequence.tsx`

- [ ] **Step 1: Add sky color state**

Add a `skyGradient` state that transitions across scenes:

```tsx
const skyGradients = [
  'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',     // Scene 0: deep night
  'linear-gradient(180deg, #1a1a2e 0%, #1e2a4a 50%, #1a3a6a 100%)',     // Scene 1: brightening
  'linear-gradient(180deg, #2a2a4e 0%, #3a3a6e 50%, #2a4a7a 100%)',     // Scene 2: lighter, book glow
  'linear-gradient(180deg, #f0f0f0 0%, #ffffff 100%)',                   // Scene 3: white transition
];
```

- [ ] **Step 2: Apply animated gradient**

Change the main div's style from static to:

```tsx
style={{
  background: skyGradients[Math.min(scene, skyGradients.length - 1)],
  transition: 'background 1.5s ease-in-out',
}}
```

- [ ] **Step 3: Re-verify in browser**

Reload and confirm sky gradually brightens as the story progresses.
