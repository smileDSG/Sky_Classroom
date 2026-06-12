/**
 * Subject inference from knowledge point names.
 *
 * Shared between LearningStats (client) and profile-builder ( server).
 * Uses regex matching on knowledge point strings.
 */

import type { Subject } from '@/lib/solve/agents/analyze-types';
export type { Subject } from '@/lib/solve/agents/analyze-types';

export function inferSubject(knowledgePoint: string): Subject {
  if (/方程|函数|代数|几何|三角|概率|统计|微积分|数列|向量|集合|不等式/.test(knowledgePoint)) return 'math';
  if (/力|电|磁|光|热|原子|牛顿|能量|动量|速度|加速度|欧姆|安培|洛伦兹/.test(knowledgePoint)) return 'physics';
  if (/元素|反应|化学键|摩尔|氧化还原|离子|溶液|有机|电解质|化学平衡/.test(knowledgePoint)) return 'chemistry';
  if (/细胞|基因|生态|遗传|酶|蛋白质|DNA|进化/.test(knowledgePoint)) return 'biology';
  if (/诗|词|文言|修辞|作文|标点|病句/.test(knowledgePoint)) return 'chinese';
  if (/语法|时态|从句|单词|阅读.*英/.test(knowledgePoint)) return 'english';
  if (/朝代|事件|人物|革命|战争|条约/.test(knowledgePoint)) return 'history';
  if (/地形|气候|洋流|人口|城市|资源/.test(knowledgePoint)) return 'geography';
  if (/政治|经济|哲学|法律|文化|社会/.test(knowledgePoint)) return 'politics';
  return 'unknown';
}

const SUBJECT_LABELS: Record<Subject, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  chinese: '语文',
  english: '英语',
  history: '历史',
  geography: '地理',
  politics: '政治',
  unknown: '其他',
};

export function getSubjectLabel(subject: Subject): string {
  return SUBJECT_LABELS[subject] ?? '其他';
}
