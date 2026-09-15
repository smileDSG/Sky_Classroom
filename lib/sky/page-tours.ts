import type { TourStep } from '@/lib/sky/tour';

export interface PageTourConfig {
  seenKey: string;
  steps: TourStep[];
}

const step = (id: string, title: string, description: string): TourStep => ({
  id,
  title,
  description,
});

export const PAGE_TOURS: Record<string, PageTourConfig> = {
  'learning-today': {
    seenKey: 'tour:learning-today',
    steps: [
      step('page-header', '今日计划', '系统根据你的学习记录，为你排好今天要完成的任务。'),
      step('page-primary', '开始学习', '按计划逐项完成，点击任务卡片进入对应的练习或复习。'),
    ],
  },
  'learning-path': {
    seenKey: 'tour:learning-path',
    steps: [
      step('page-header', '学习路径', '系统为你规划的完整学习顺序，按节点从易到难推进。'),
      step('page-primary', '路径节点', '每个节点代表一个知识点，完成一个再进入下一个。'),
    ],
  },
  'learning-review': {
    seenKey: 'tour:learning-review',
    steps: [
      step('feature-header', '复习计划', '需要巩固的知识点会在这里排成复习计划。'),
      step('feature-content', '按计划复习', '及时复习避免遗忘，完成卡片里的复习任务即可。'),
    ],
  },
  'learning-mistakes': {
    seenKey: 'tour:learning-mistakes',
    steps: [
      step('feature-header', '错题本', '做错的题都汇总在这里，方便集中订正和重做。'),
      step('feature-content', '订正错题', '逐题回顾做错的原因，重做一遍加深印象。'),
    ],
  },
  'learning-graph': {
    seenKey: 'tour:learning-graph',
    steps: [
      step('feature-header', '知识地图', '以图谱展示知识点之间的关联和你的掌握情况。'),
      step('feature-content', '定位薄弱点', '颜色越红说明掌握越弱，优先针对这些点复习。'),
    ],
  },
  'learning-profile': {
    seenKey: 'tour:learning-profile',
    steps: [
      step('page-header', '学习分析', '补全学习情况后，系统会生成更有针对性的学习建议。'),
      step('page-primary', '完善档案', '填写目标和薄弱点，建议才会更贴近你的实际情况。'),
    ],
  },
  'learning-stats': {
    seenKey: 'tour:learning-stats',
    steps: [
      step('feature-header', '学习统计', '可视化展示学习时长、正确率等关键数据。'),
      step('feature-content', '查看趋势', '通过图表了解自己的学习节奏和进步情况。'),
    ],
  },
  'resources-overview': {
    seenKey: 'tour:resources-overview',
    steps: [
      step('page-header', '云端智囊', '学习资源的统一入口，按任务选择合适的工具。'),
      step('page-primary', '选择工具', '拍题、出题、PPT、记忆卡片……从这里一键进入。'),
    ],
  },
  'resources-solve': {
    seenKey: 'tour:resources-solve',
    steps: [
      step('page-header', '拍题解析', '拍照或输入题目，AI 给出思路清晰的分步解答。'),
      step('page-primary', '开始解题', '上传题目图片或输入文字，提交后查看解析过程。'),
    ],
  },
  'resources-quiz': {
    seenKey: 'tour:resources-quiz',
    steps: [
      step('page-header', '题目生成', '选择学科和难度，AI 为你量身生成练习题。'),
      step('page-primary', '生成题目', '设置好主题与难度后，一键生成练习并开始作答。'),
    ],
  },
  'resources-memory': {
    seenKey: 'tour:resources-memory',
    steps: [
      step('page-header', '记忆卡片', '配合艾宾浩斯遗忘曲线，在合适的时间复习记忆卡片。'),
      step('page-primary', '开始复习', '按安排逐张回顾卡片，系统会自动安排下次复习时间。'),
    ],
  },
  'resources-assistant': {
    seenKey: 'tour:resources-assistant',
    steps: [
      step('page-header', '云翼助手', '学习中的疑问随时来问，AI 助手即时解答。'),
      step('page-primary', '发起提问', '在输入框输入问题，助手会给出详细的解答。'),
    ],
  },
  'resources-course-studio': {
    seenKey: 'tour:resources-course-studio',
    steps: [
      step('page-header', '课程资源', '集中管理你的课程材料和学习资源。'),
      step('page-primary', '管理资源', '查看、整理或新建课程资源，随时取用。'),
    ],
  },
  'resources-slides': {
    seenKey: 'tour:resources-slides',
    steps: [
      step('page-header', 'PPT 课件', '输入主题，AI 一键生成结构完整的 PPT 课件。'),
      step('page-primary', '生成课件', '填写主题和要点，提交后即可生成并下载课件。'),
    ],
  },
  'teaching-overview': {
    seenKey: 'tour:teaching-overview',
    steps: [
      step('page-header', '备课总览', '备课工作区的总入口，从这里开始准备课程。'),
      step('page-primary', '开始备课', '进入授课设计或课件设计，逐步完成课程准备。'),
    ],
  },
  'teaching-ai': {
    seenKey: 'tour:teaching-ai',
    steps: [
      step('page-header', 'AI 授课', '用 AI 辅助完成课堂讲解。'),
      step('page-primary', '开始授课', '选择课堂主题，AI 老师和同学配合完成讲解。'),
    ],
  },
  'classroom-new': {
    seenKey: 'tour:classroom-new',
    steps: [
      step('page-header', '生成互动课堂', '输入一个知识点，AI 老师和同学为你生成一堂互动课。'),
      step('page-primary', '输入知识点', '填写知识点或上传 PDF，点击开始讲解即可生成课堂。'),
    ],
  },
};
