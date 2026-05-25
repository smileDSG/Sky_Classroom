/**
 * 12套教学PPT模板元数据注册表
 */

export interface TemplatePackMeta {
  id: string;
  name: string;
  subjectTags: string[]; // 用于学科推断
  available: boolean; // 是否有完整的 mapping.json，false 时前端不显示
  capacity: {
    contentACards: number;
    contentBCards: number;
    tableCols: number;
    tableRows: number;
  };
  features: {
    hasEnTag: boolean;
    hasChapterEn: boolean;
    hasEndEn: boolean;
    hasTable: boolean;
    numberStyle: 'arabic' | 'chinese' | 'chinese-capital';
  };
}

export const TEMPLATE_PACKS: TemplatePackMeta[] = [
  {
    id: 'modern-geometric',
    name: '现代几何风',
    subjectTags: ['数学', '几何', '物理', '逻辑', '编程'],
    available: true,
    capacity: { contentACards: 6, contentBCards: 4, tableCols: 4, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: true, numberStyle: 'arabic' },
  },
  {
    id: 'classical',
    name: '古典书香风',
    subjectTags: ['语文', '历史', '传统文化', '书法'],
    available: true,
    capacity: { contentACards: 5, contentBCards: 5, tableCols: 4, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: false, hasTable: true, numberStyle: 'chinese-capital' },
  },
  {
    id: 'cartoon',
    name: '明快卡通风',
    subjectTags: ['小学', '科学', '品德', '生物启蒙'],
    available: true,
    capacity: { contentACards: 3, contentBCards: 0, tableCols: 3, tableRows: 4 },
    features: { hasEnTag: false, hasChapterEn: false, hasEndEn: false, hasTable: false, numberStyle: 'arabic' },
  },
  {
    id: 'nordic',
    name: '简约北欧风',
    subjectTags: ['学习方法', '通识', '心理学', '英语'],
    available: true,
    capacity: { contentACards: 0, contentBCards: 3, tableCols: 3, tableRows: 4 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: false, numberStyle: 'arabic' },
  },
  {
    id: 'business',
    name: '商务专业风',
    subjectTags: ['商科', '职业培训', '管理'],
    available: true,
    capacity: { contentACards: 5, contentBCards: 6, tableCols: 5, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: true, numberStyle: 'arabic' },
  },
  {
    id: 'sports',
    name: '活力运动风',
    subjectTags: ['体育', '健康', '生物'],
    available: true,
    capacity: { contentACards: 4, contentBCards: 3, tableCols: 4, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: true, numberStyle: 'arabic' },
  },
  {
    id: 'ocean',
    name: '海洋探索风',
    subjectTags: ['地理', '海洋科学', '环境'],
    available: true,
    capacity: { contentACards: 4, contentBCards: 4, tableCols: 4, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: true, numberStyle: 'arabic' },
  },
  {
    id: 'watercolor',
    name: '清新水彩风',
    subjectTags: ['美术', '艺术', '色彩'],
    available: true,
    capacity: { contentACards: 3, contentBCards: 3, tableCols: 4, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: true, numberStyle: 'arabic' },
  },
  {
    id: 'nature',
    name: '清新自然风',
    subjectTags: ['生物', '生态', '环保', '地理'],
    available: true,
    capacity: { contentACards: 5, contentBCards: 0, tableCols: 4, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: true, numberStyle: 'arabic' },
  },
  {
    id: 'humanistic',
    name: '温暖人文风',
    subjectTags: ['语文', '文学', '哲学'],
    available: true,
    capacity: { contentACards: 2, contentBCards: 4, tableCols: 4, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: true, numberStyle: 'chinese' },
  },
  {
    id: 'vintage',
    name: '田园复古风',
    subjectTags: ['农业', '历史', '传统文化'],
    available: true,
    capacity: { contentACards: 4, contentBCards: 3, tableCols: 4, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: true, hasTable: true, numberStyle: 'chinese' },
  },
  {
    id: 'tech',
    name: '科技未来风',
    subjectTags: ['信息技术', '编程', '物理', 'AI'],
    available: true,
    capacity: { contentACards: 3, contentBCards: 0, tableCols: 6, tableRows: 5 },
    features: { hasEnTag: true, hasChapterEn: true, hasEndEn: false, hasTable: true, numberStyle: 'arabic' },
  },
];

export function getTemplatePackById(id: string): TemplatePackMeta | undefined {
  return TEMPLATE_PACKS.find((t) => t.id === id);
}

export function inferTemplateByTopic(topic: string): string {
  const lower = topic.toLowerCase();
  const available = TEMPLATE_PACKS.filter((t) => t.available);
  for (const template of available) {
    for (const tag of template.subjectTags) {
      if (lower.includes(tag.toLowerCase())) {
        return template.id;
      }
    }
  }
  const fallback = available.find((t) => t.id === 'modern-geometric');
  return fallback ? fallback.id : (available[0]?.id ?? '');
}
