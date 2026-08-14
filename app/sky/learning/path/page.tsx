import { LearningPathPage } from '@/components/sky/learning/learning-path-page';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

export default function PersonalLearningPathRoute() {
  return (
    <SkyAppShell section="learning">
      <LearningPathPage />
    </SkyAppShell>
  );
}
