import { PersonalizationLab } from '@/components/sky/learning/personalization-lab';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

export const metadata = {
  title: '学习情况实验室 | 天空课堂',
  description: '观察个性化学习决策如何随学习事件变化。',
};

export default function PersonalizationLabPage() {
  return (
    <SkyAppShell section="learning">
      <PersonalizationLab />
    </SkyAppShell>
  );
}
