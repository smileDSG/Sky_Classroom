import { Metadata } from 'next';
import { LearnerProfileDashboard } from '@/components/sky/learning/learner-profile-dashboard';

export const metadata: Metadata = {
  title: '学习者画像数据大屏 | Sky Classroom',
  description: '实时查看学习者画像、学习进度与知识掌握情况的数据大屏',
};

export default function ProfileDashboardPage() {
  return <LearnerProfileDashboard />;
}
