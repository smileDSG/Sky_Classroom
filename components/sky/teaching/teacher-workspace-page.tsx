'use client';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { SkySectionNav } from '@/components/sky/layout/sky-section-nav';
import { TeachingPage } from '@/app/sky/teaching/teaching-page';
import { PageTour } from '@/components/sky/tour/page-tour';

interface TeacherWorkspacePageProps {
  initialTopic?: string;
  showHistoryInitially?: boolean;
}

export function TeacherWorkspacePage({
  initialTopic,
  showHistoryInitially = false,
}: TeacherWorkspacePageProps) {
  return (
    <SkyAppShell>
      <div className="space-y-5 pb-8">
        <SkySectionNav section="teaching" />
        <TeachingPage initialTopic={initialTopic} showHistoryInitially={showHistoryInitially} />
      </div>
      <PageTour id="teaching-overview" />
    </SkyAppShell>
  );
}
