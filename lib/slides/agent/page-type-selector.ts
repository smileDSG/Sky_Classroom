/**
 * Page Type Selector — infers the academic subject from a topic string
 * and returns the relevant page type whitelist + preference rule.
 *
 * Used by Planning Agent to build a lean, subject-targeted system prompt
 * instead of injecting all 14 page types and all discipline rules.
 *
 * 0 LLM calls — pure regex + lookup table, <1ms.
 */

// ── Subject inference patterns ──────────────────────────────────────

interface SubjectPattern {
  subject: string;
  pattern: RegExp;
}

const SUBJECT_PATTERNS: SubjectPattern[] = [
  {
    subject: 'math',
    pattern: /数学|代数|几何|三角|勾股|函数|方程|微积分|概率|统计|数列|向量|拓扑|数论|math|algebra|calculus|geometry/i,
  },
  {
    subject: 'physics',
    pattern: /物理|力学|电[路磁荷场]|光[学电]|热[学力]|量子|相对论|牛顿|欧姆|安培|法拉第|physics|force|energy|wave|quantum/i,
  },
  {
    subject: 'chemistry',
    pattern: /化学|元素|反应|分子|原子|离子|化合|分解|酸碱|化学键|chemistry|reaction|molecule|bond|element/i,
  },
  {
    subject: 'biology',
    pattern: /生物|细胞|基因|DNA|RNA|遗传|生态|进化|光合|蒸腾|呼吸作用|免疫|神经|biology|cell|gene|evolution|photosynthesis/i,
  },
  {
    subject: 'history',
    pattern: /历史|朝代|战争|革命|文明|古代|近代|现代|中世纪|帝国|history|war|revolution|civilization|dynasty/i,
  },
  {
    subject: 'literature',
    pattern: /语文|文学|诗歌|散文|小说|诗词|古文|论语|诗经|唐诗|宋词|元曲|轩志|归有光|朱自清|literature|poem|poetry|novel|prose/i,
  },
  {
    subject: 'geography',
    pattern: /地理|气候|地形|人口|经济|地理信息|GIS|geography|climate|population|terrain/i,
  },
  {
    subject: 'cs',
    pattern: /编程|代码|算法|数据结构|操作系统|网络|数据库|Python|Java|C\+\+|JavaScript|计算机|软件|AI|机器学习|Spring|微服务|消息队列|programming|algorithm|software/i,
  },
];

// ── Subject → Recommended Page Types ────────────────────────────────

const SUBJECT_PAGE_TYPES: Record<string, string[]> = {
  math:       ['cover', 'toc', 'chapter', 'formula', 'concept', 'case', 'process', 'summary', 'end'],
  physics:    ['cover', 'toc', 'chapter', 'formula', 'concept', 'case', 'compare', 'process', 'summary', 'end'],
  chemistry:  ['cover', 'toc', 'chapter', 'formula', 'concept', 'case', 'table', 'process', 'summary', 'end'],
  biology:    ['cover', 'toc', 'chapter', 'concept', 'compare', 'process', 'case', 'table', 'summary', 'end'],
  history:    ['cover', 'toc', 'chapter', 'timeline', 'concept', 'compare', 'case', 'summary', 'end'],
  literature: ['cover', 'toc', 'chapter', 'concept', 'compare', 'case', 'timeline', 'summary', 'end'],
  geography:  ['cover', 'toc', 'chapter', 'concept', 'compare', 'table', 'process', 'summary', 'end'],
  cs:         ['cover', 'toc', 'chapter', 'process', 'case', 'table', 'concept', 'compare', 'summary', 'end'],
  general:    ['cover', 'toc', 'chapter', 'concept', 'case', 'compare', 'process', 'table', 'summary', 'end'],
};

// ── Subject → Preference Rule ────────────────────────────────────────

const SUBJECT_PREFERENCE: Record<string, string> = {
  math:       '数学：多用 formula > case > concept，每章必有推导和例题，强调逻辑严谨',
  physics:    '物理：多用 formula > case > concept，每章必有公式和实验应用，强调理论与实践结合',
  chemistry:  '化学：多用 formula > case > table，每章必有化学方程式和反应机理',
  biology:    '生物：多用 concept > compare > process，强调结构与功能的关系，少用纯公式推导',
  history:    '历史：多用 timeline > compare > concept，强调时空脉络和因果分析，少用公式',
  literature: '文学：多用 concept > compare > case，重文本细读和情感分析，少用公式和表格',
  geography:  '地理：多用 concept > compare > table，强调空间分布和数据分析，少用公式推导',
  cs:         '计算机：多用 process > case > table，强调算法流程和技术架构，少用数学公式',
  general:    '通用：concept/case/compare 均衡使用，按内容自然递进',
};

// ── Public API ──────────────────────────────────────────────────────

export interface SubjectContext {
  subject: string;
  pageTypes: string[];
  preference: string;
}

export function getSubjectContext(topic: string): SubjectContext {
  for (const { subject, pattern } of SUBJECT_PATTERNS) {
    if (pattern.test(topic)) {
      return {
        subject,
        pageTypes: SUBJECT_PAGE_TYPES[subject] || SUBJECT_PAGE_TYPES.general,
        preference: SUBJECT_PREFERENCE[subject] || SUBJECT_PREFERENCE.general,
      };
    }
  }
  return {
    subject: 'general',
    pageTypes: SUBJECT_PAGE_TYPES.general,
    preference: SUBJECT_PREFERENCE.general,
  };
}

/** Build a compact page type list for prompt injection. */
export function buildPageTypeList(pageTypes: string[]): string {
  return pageTypes.map((t) => {
    const label = PAGE_TYPE_LABELS[t] || t;
    return `- ${t}: ${label}`;
  }).join('\n');
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  cover: '封面',
  toc: '目录',
  end: '结束页',
  chapter: '章节过渡页',
  concept: '概念讲解（多卡片并列）',
  case: '案例/例题',
  compare: '对比分析（两栏对比）',
  process: '步骤/流程',
  table: '数据对比表',
  formula: '公式推导',
  timeline: '时间线',
  summary: '章末总结',
  quiz: '课堂练习',
};
