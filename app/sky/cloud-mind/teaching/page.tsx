'use client';

import { TeachingPage } from '@/app/sky/teaching/teaching-page';
import { CelestialCanvas } from '@/components/sky/slides/design-system/celestial-canvas';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useTheme } from '@/lib/hooks/use-theme';

export default function CloudMindTeachingRoute() {
  const { setForceDark } = useTheme();

  useEffect(() => {
    setForceDark(true);
    return () => setForceDark(false);
  }, [setForceDark]);

  return (
    <div
      className="relative min-h-screen dark"
      style={{ background: 'linear-gradient(180deg, #070E0C 0%, #0D1A17 50%, #070E0C 100%)' }}
    >
      {/* Deep space starfield */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <CelestialCanvas starCount={100} parallax={false} nebula grid={false} />
      </div>
      {/* Aurora ambient glow overlays */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-0 left-1/3 h-[500px] w-[500px] rounded-full bg-[var(--teaching-primary)]/4 blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[var(--teaching-accent)]/3 blur-[120px]" />
        <div className="absolute top-1/2 left-0 h-[300px] w-[300px] rounded-full bg-[var(--teaching-primary)]/3 blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 pt-6 pb-12">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Link
            href="/sky/cloud-mind"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--teaching-muted)] transition-all hover:text-[var(--teaching-primary-bright)] hover:bg-[var(--teaching-primary)]/10"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
        </motion.div>

        <TeachingPage />
      </div>
    </div>
  );
}
