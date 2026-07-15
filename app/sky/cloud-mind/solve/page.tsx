'use client';

import { SolvePage } from '@/components/sky/solve/solve-page';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { useEffect, useState } from 'react';
import type { PersonalizationContext, PersonalizationDifficulty } from '@/lib/cloud-mind/types';

export default function CloudMindSolvePage() {
  const [weakPointNames, setWeakPointNames] = useState<string[]>([]);
  const [preferredDifficulty, setPreferredDifficulty] =
    useState<PersonalizationDifficulty>('medium');
  const [personalizationNotice, setPersonalizationNotice] = useState<string | null>(null);

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
    <div className="relative min-h-screen bg-[var(--probe-void)]">
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
          data-sky-desktop-top-actions
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
