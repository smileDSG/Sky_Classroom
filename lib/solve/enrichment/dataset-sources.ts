/**
 * Dataset sources — known open-source Chinese education question datasets.
 *
 * Each entry describes a downloadable dataset with its URL, format,
 * and field mapping for normalization.
 */

export interface DatasetSource {
  id: string;
  name: string;
  description: string;
  /** Direct download URL (preferably raw.githubusercontent.com) */
  url: string;
  format: 'json' | 'csv';
  /** Approximate question count */
  estimatedCount: number;
  /** Subjects covered */
  subjects: string[];
  /** Grade levels */
  gradeLevels: string[];
  /** Field mapping: our field → dataset field name(s) */
  fieldMap: {
    problemText: string[];
    answer?: string[];
    solution?: string[];
    subject?: string[];
    gradeLevel?: string[];
    questionType?: string[];
    difficulty?: string[];
    knowledgePoints?: string[];
  };
  /** Optional: JSON path to questions array (e.g., "data.questions") */
  dataPath?: string;
}

/**
 * Prioritized list of datasets to use for Phase 1 cold start.
 * Ordered by relevance: math first, then physics, etc.
 */
export const DATASET_SOURCES: DatasetSource[] = [
  // ── Math datasets ──────────────────────────────────────────────────

  {
    id: 'tal-scq5k-cn',
    name: 'TAL-SCQ5K-CN',
    description: '好未来 5K 中文数学竞赛题，含详细解题步骤和 LaTeX',
    url: 'https://raw.githubusercontent.com/math-eval/TAL-SCQ5K/main/data/SCQ5K-CN.json',
    format: 'json',
    estimatedCount: 5000,
    subjects: ['math'],
    gradeLevels: ['junior', 'senior'],
    fieldMap: {
      problemText: ['question', 'problem', '题目'],
      answer: ['answer', '答案'],
      solution: ['solution', 'analysis', '解析', 'solution_zh'],
      subject: ['subject', '学科'],
      gradeLevel: ['grade', '年级', 'level'],
      questionType: ['type', '题型', 'question_type'],
      difficulty: ['difficulty', '难度'],
      knowledgePoints: ['knowledge_points', 'knowledgePoints', '知识点'],
    },
  },

  {
    id: 'mm-math',
    name: 'MM-Math',
    description: '清华大学 KEG 实验室中学数学题，含知识图谱标注',
    url: 'https://huggingface.co/datasets/THU-KEG/MM_Math/resolve/main/data/train.json',
    format: 'json',
    estimatedCount: 5900,
    subjects: ['math'],
    gradeLevels: ['junior', 'senior'],
    fieldMap: {
      problemText: ['question', 'problem', 'text'],
      answer: ['answer', '答案', 'final_answer'],
      solution: ['solution', 'analysis', '解析'],
      subject: ['subject', '学科'],
      gradeLevel: ['grade', '年级'],
      questionType: ['type', '题型'],
      difficulty: ['difficulty', '难度'],
      knowledgePoints: ['knowledge_points', 'topics'],
    },
  },

  {
    id: 'agieval-gaokao-math',
    name: 'AGIEval Gaokao Math',
    description: 'AGIEval 高考数学真题（含物理/化学/生物）',
    url: 'https://raw.githubusercontent.com/ruixiangcui/AGIEval/main/data/gaokao-mathcloze.jsonl',
    format: 'json',
    estimatedCount: 2000,
    subjects: ['math'],
    gradeLevels: ['senior'],
    fieldMap: {
      problemText: ['question', 'passage', 'text'],
      answer: ['answer', 'label', 'target'],
      solution: ['explanation', '解析'],
      subject: ['subject', '学科'],
      gradeLevel: ['grade', '年级'],
      questionType: ['type', '题型'],
      difficulty: ['difficulty', '难度'],
    },
  },

  // ── Physics datasets ───────────────────────────────────────────────

  {
    id: 'gaokao-physics',
    name: 'QZDH Gaokao Physics',
    description: '高考物理真题（2010-2022），含官方答案',
    url: 'https://raw.githubusercontent.com/gdshjzm/QZDH_Gaokao-data/main/Gaokao_R.json',
    format: 'json',
    estimatedCount: 675,
    subjects: ['math', 'physics'],
    gradeLevels: ['senior'],
    fieldMap: {
      problemText: ['question', 'problem', '题干'],
      answer: ['answer', '答案', 'official_answer'],
      solution: ['solution', '解析', 'analysis'],
      subject: ['subject', '学科'],
      gradeLevel: ['grade', '年级'],
      questionType: ['type', '题型'],
      difficulty: ['difficulty', '难度'],
    },
  },

  // ── Multi-subject datasets ─────────────────────────────────────────

  {
    id: 'olympiadbench-cn',
    name: 'OlympiadBench CN',
    description: '11K 中文竞赛/高考题（数学+物理），Kaggle 开源',
    url: 'https://raw.githubusercontent.com/kaggle/datasets/kishanvavdara/aimo-olympiadbench-math-dataset/main/olympiadbench-external-df-chinese.csv',
    format: 'csv',
    estimatedCount: 11000,
    subjects: ['math', 'physics'],
    gradeLevels: ['senior', 'college'],
    fieldMap: {
      problemText: ['question', 'problem', '题干', 'Question'],
      answer: ['answer', '答案', 'Answer', 'final_answer'],
      solution: ['solution', '解析', 'analysis', 'Solution'],
      subject: ['subject', '学科', 'discipline'],
      gradeLevel: ['grade', '年级', 'level'],
      questionType: ['type', '题型', 'question_type'],
      difficulty: ['difficulty', '难度'],
      knowledgePoints: ['knowledge_points', 'subfield', 'topic'],
    },
  },
];
