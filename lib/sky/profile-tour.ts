import type { TourStep } from '@/lib/sky/tour';

export const PROFILE_TOUR_SEEN_KEY = 'profileTourSeen';

export const PROFILE_TOUR_STEPS: TourStep[] = [
  {
    id: 'kpi-cards',
    title: '学习总览指标',
    description: '顶部六张卡片汇总了知识掌握、连续打卡、今日学习、做题正确率等关键数据。',
  },
  {
    id: 'mastery-overview',
    title: '整体掌握情况',
    description: '环形图展示你对知识的掌握程度，下方是累计正确数和薄弱知识点数。',
  },
  {
    id: 'weak-points',
    title: '薄弱知识点',
    description: '最需要巩固的知识点会列在这里，点「查看全部」进入错题复习。',
  },
  {
    id: 'learning-path',
    title: '学习路径',
    description: '系统为你规划的下一步学习顺序，按节点逐个完成即可。',
  },
];
