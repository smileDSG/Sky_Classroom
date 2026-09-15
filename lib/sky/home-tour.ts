import type { TourStep } from '@/lib/sky/tour';

export const HOME_TOUR_SEEN_KEY = 'homeTourSeen';

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    id: 'hero-input',
    title: '生成互动课堂',
    description: '在这里输入一个知识点（或上传 PDF），AI 老师和同学会为你生成一堂互动课。',
  },
  {
    id: 'workspace-portals',
    title: '三大工作区',
    description: '学习、资源、备课三个工作区入口，按你的身份快速进入对应工具。',
  },
  {
    id: 'classroom-grid',
    title: '最近课堂',
    description: '你生成过的课堂会保存在这里，随时回来继续学习或复习。',
  },
];
