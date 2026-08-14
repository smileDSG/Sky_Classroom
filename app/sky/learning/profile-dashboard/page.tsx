import { Metadata } from 'next';
import { LearnerProfileDashboard } from '@/components/sky/learning/learner-profile-dashboard';
import { SkyAppShell } from '@/components/sky/layout/app-shell';

export const metadata: Metadata = {
  title: '学习情况总览 | Sky Classroom',
  description: '实时查看学习情况、学习进度与知识掌握情况',
};

export default function ProfileDashboardPage() {
  return (
    <SkyAppShell section="learning">
      <LearnerProfileDashboard />
    </SkyAppShell>
  );
}
