export const TOUR_SEEN_KEY = 'skyTourSeen';

export interface TourStep {
  id: string;
  title: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'today-focus',
    title: '今天优先完成',
    description: '每天最重要的一件事会出现在这里，点「开始行动」直接进入。',
  },
  {
    id: 'learning-plan',
    title: '学习计划',
    description: '系统根据你的学习记录排好的今日计划，按顺序完成即可。',
  },
  {
    id: 'profile-link',
    title: '完整学习记录',
    description: '想看更详细的学习数据、进度和薄弱点，点这里进入。',
  },
];

export function isTourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
  } catch {
    /* ignore */
  }
}
