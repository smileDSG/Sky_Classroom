'use client';

import { useSearchParams } from 'next/navigation';
import { QuickOnboarding } from '@/components/sky/onboarding/quick-onboarding';
import { LearningProfileOnboarding } from '@/components/sky/onboarding/learning-profile-onboarding';

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';

  return (
    <main className="min-h-svh w-full bg-background text-foreground">
      {isEditMode ? <LearningProfileOnboarding /> : <QuickOnboarding />}
    </main>
  );
}
