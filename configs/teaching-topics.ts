/**
 * Teaching Topics Configuration
 *
 * Hot topics for cold-start recommendations when user has no profile data.
 */

export interface TopicCategory {
  subject: string;
  label: string;
  topics: string[];
}

export const HOT_TOPICS: TopicCategory[] = [
  {
    subject: 'math',
    label: '数学',
    topics: [
      '二次函数',
      '不等式',
      '三角函数',
      '数列',
      '导数',
      '概率统计',
      '立体几何',
      '解析几何',
    ],
  },
  {
    subject: 'physics',
    label: '物理',
    topics: [
      '牛顿运动定律',
      '动量守恒',
      '电磁感应',
      '光学',
      '热力学',
      '原子物理',
      '机械能守恒',
      '电路分析',
    ],
  },
  {
    subject: 'chemistry',
    label: '化学',
    topics: [
      '化学平衡',
      '氧化还原反应',
      '有机化学',
      '电化学',
      '元素周期律',
      '化学键',
      '溶液',
      '化学反应速率',
    ],
  },
  {
    subject: 'biology',
    label: '生物',
    topics: [
      '细胞代谢',
      '遗传规律',
      '生态学',
      '基因工程',
      '免疫调节',
      '神经调节',
      '光合作用',
      '呼吸作用',
    ],
  },
  {
    subject: 'chinese',
    label: '语文',
    topics: [
      '文言文阅读',
      '古诗词鉴赏',
      '现代文阅读',
      '作文写作',
      '修辞手法',
      '标点符号',
      '病句修改',
      '文学常识',
    ],
  },
  {
    subject: 'english',
    label: '英语',
    topics: [
      '时态语态',
      '定语从句',
      '虚拟语气',
      '阅读理解',
      '完形填空',
      '写作技巧',
      '词汇辨析',
      '语法填空',
    ],
  },
];

/**
 * Get topics for a specific subject.
 */
export function getTopicsBySubject(subject: string): string[] {
  const category = HOT_TOPICS.find((c) => c.subject === subject);
  return category?.topics ?? [];
}

/**
 * Get all topics as a flat list.
 */
export function getAllTopics(): string[] {
  return HOT_TOPICS.flatMap((c) => c.topics);
}

/**
 * Search topics by keyword.
 */
export function searchTopics(keyword: string): string[] {
  const lower = keyword.toLowerCase();
  return getAllTopics().filter((t) => t.toLowerCase().includes(lower));
}
