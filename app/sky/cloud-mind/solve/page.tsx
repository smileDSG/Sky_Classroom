'use client';

import { SolvePage } from '@/components/sky/solve/solve-page';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/hooks/use-theme';
import type { PersonalizationContext, PersonalizationDifficulty } from '@/lib/cloud-mind/types';

export default function CloudMindSolvePage() {
  const { setForceDark } = useTheme();
  const [weakPointNames, setWeakPointNames] = useState<string[]>([]);
  const [preferredDifficulty, setPreferredDifficulty] =
    useState<PersonalizationDifficulty>('medium');
  const [personalizationNotice, setPersonalizationNotice] = useState<string | null>(null);

  useEffect(() => {
    setForceDark(true);
    return () => setForceDark(false);
  }, [setForceDark]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/sky/cloud-mind/personalization-context')
      .then((res) => res.json())
      .then((json: { success?: boolean; data?: PersonalizationContext }) => {
        if (cancelled || !json.success || !json.data) return;

        const context = json.data;
        const weakPoints = context.weakPoints.map((item) => item.knowledgePoint);
        const primaryTopic =
          context.tutoringPolicy?.targetTopic ?? weakPoints[0] ?? context.learningPath?.next;
        const personalizedWeakPoints =
          primaryTopic && !weakPoints.includes(primaryTopic)
            ? [primaryTopic, ...weakPoints]
            : weakPoints;
        const personalizedDifficulty =
          context.tutoringPolicy?.difficulty ?? context.preferredDifficulty;

        setWeakPointNames(personalizedWeakPoints);
        setPreferredDifficulty(personalizedDifficulty);

        if (primaryTopic) {
          setPersonalizationNotice(
            `已根据天梯工坊为你准备：关注「${primaryTopic}」的解题讲解和后续练习`,
          );
        }
      })
      .catch(() => {
        /* personalization is optional */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="relative min-h-screen dark"
      style={{
        background: 'linear-gradient(180deg, #0B0D1A 0%, #0E1126 50%, #0B0D1A 100%)',
        // Force dark mode CSS variables regardless of global theme
        ['--background' as string]: '#070914',
        ['--foreground' as string]: '#F5F0FF',
        ['--card' as string]: 'rgba(15, 18, 40, 0.95)',
        ['--card-foreground' as string]: '#F5F0FF',
        ['--popover' as string]: 'rgba(15, 18, 40, 0.97)',
        ['--popover-foreground' as string]: '#F5F0FF',
        ['--muted' as string]: 'oklch(0.269 0 0)',
        ['--muted-foreground' as string]: 'oklch(0.708 0 0)',
        ['--border' as string]: 'rgba(167, 139, 250, 0.3)',
        ['--input' as string]: 'rgba(167, 139, 250, 0.2)',
        ['--ring' as string]: 'oklch(0.556 0 0)',
        // Force dark probe variables
        ['--probe-void' as string]: '#070914',
        ['--probe-surface' as string]: 'rgba(15, 18, 40, 0.95)',
        ['--probe-surface-elevated' as string]: 'rgba(22, 26, 55, 0.97)',
        ['--probe-border' as string]: 'rgba(167, 139, 250, 0.3)',
        ['--probe-border-strong' as string]: 'rgba(167, 139, 250, 0.5)',
        ['--probe-primary' as string]: '#C4B5FD',
        ['--probe-primary-bright' as string]: '#DDD6FE',
        ['--probe-glow' as string]: 'rgba(196, 181, 253, 0.45)',
        ['--probe-glow-strong' as string]: 'rgba(196, 181, 253, 0.65)',
        ['--probe-text' as string]: '#F5F0FF',
        ['--probe-muted' as string]: 'rgba(196, 181, 253, 0.6)',
        ['--probe-success' as string]: '#34D399',
        ['--probe-error' as string]: '#F87171',
        ['--probe-accent' as string]: '#38BDF8',
        ['--probe-accent-glow' as string]: 'rgba(56, 189, 248, 0.3)',
        ['--probe-warm' as string]: '#FB923C',
      }}
    >
      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <CelestialCanvas starCount={120} parallax={false} nebula grid={false} horizonGlow />
      </div>
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-[var(--probe-primary)]/4 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[var(--probe-accent)]/3 blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-6 pb-12">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-4"
        >
          <Link
            href="/sky/cloud-mind"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--probe-muted)] transition-all hover:text-[var(--probe-primary-bright)] hover:bg-[var(--probe-primary)]/10"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
        </motion.div>

        <SolvePage
          personalizationNotice={personalizationNotice}
          weakPointNames={weakPointNames}
          preferredDifficulty={preferredDifficulty}
        />
      </div>
    </div>
  );
}
