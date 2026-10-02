export const TOUR_SEEN_KEY = 'skyTourSeen';

export interface TourStep {
  id: string;
  title: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'generate-classroom',
    title: '从这里生成新课',
    description:
      '想做一堂课？点「生成互动课堂」，输入知识点就能让 AI 老师开讲，这是整个平台的起点。',
  },
  {
    id: 'today-focus',
    title: '先做今天最重要的事',
    description: '这里会显示系统建议你优先做的事，点右侧「开始行动」按钮即可直接进入对应任务。',
  },
  {
    id: 'mistakes',
    title: '订正你的错题',
    description: '做错的题会自动汇总到「错题复习」，点卡片里的题目重做一遍，避免同样错误再犯。',
  },
  {
    id: 'learning-plan',
    title: '按今天的学习计划走',
    description: '「学习计划」根据你的记录排好今日任务，逐项点开卡片完成即可，做完会自动更新进度。',
  },
  {
    id: 'profile-link',
    title: '查看完整学习记录',
    description:
      '想看详细数据、掌握情况和薄弱点，点右上角「查看完整学习记录」，会进入你的学习档案。',
  },
];

export function isTourSeen(key: string = TOUR_SEEN_KEY): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return true;
  }
}

export function markTourSeen(key: string = TOUR_SEEN_KEY): void {
  try {
    localStorage.setItem(key, 'true');
  } catch {
    /* ignore */
  }
}
