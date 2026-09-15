'use client';
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuickOnboarding } from '@/components/sky/onboarding/quick-onboarding';
import { LearningProfileOnboarding } from '@/components/sky/onboarding/learning-profile-onboarding';

function OnboardingContent() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';

  return (
    <main className="min-h-svh w-full bg-background text-foreground">
      {isEditMode ? <LearningProfileOnboarding /> : <QuickOnboarding />}
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh w-full items-center justify-center bg-background">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
