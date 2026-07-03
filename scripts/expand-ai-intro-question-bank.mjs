import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const bankPath = path.join(root, 'data', 'course-knowledge', 'ai-intro', 'question-bank.json');
const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));

const chapters = [
  {
    no: '01',
    file: '01-ai-overview',
    topic: '人工智能概述',
    points: ['人工智能定义', 'AI/ML/DL/LLM/Agent 关系', '可信 AI'],
    misconception: '把人工智能等同于单一大模型',
  },
  {
    no: '02',
    file: '02-search-and-problem-solving',
    topic: '搜索与问题求解',
    points: ['状态空间', 'BFS 与 DFS', 'A* 搜索'],
    misconception: '忽略启发函数对最优性的条件限制',
  },
  {
    no: '03',
    file: '03-knowledge-representation',
    topic: '知识表示与推理',
    points: ['命题逻辑', '产生式规则', '知识图谱'],
    misconception: '认为知识图谱只是展示用图片',
  },
  {
    no: '04',
    file: '04-machine-learning-basics',
    topic: '机器学习基础',
    points: ['训练集/验证集/测试集', '过拟合', '评价指标'],
    misconception: '只看训练集准确率判断模型好坏',
  },
  {
    no: '05',
    file: '05-supervised-learning',
    topic: '监督学习',
    points: ['分类与回归', 'KNN', '决策树'],
    misconception: '认为复杂模型一定优于简单基线',
  },
  {
    no: '06',
    file: '06-neural-networks',
    topic: '神经网络与深度学习',
    points: ['激活函数', '损失函数', '反向传播', 'CNN'],
    misconception: '把反向传播理解为反向运行网络',
  },
  {
    no: '07',
    file: '07-natural-language-processing',
    topic: '自然语言处理',
    points: ['文本表示', '注意力机制', 'Transformer', '幻觉'],
    misconception: '认为文本生成流畅就一定正确',
  },
  {
    no: '08',
    file: '08-computer-vision',
    topic: '计算机视觉',
    points: ['图像分类', '目标检测', '数据增强', '迁移学习'],
    misconception: '把所有视觉任务都当作分类任务',
  },
  {
    no: '09',
    file: '09-reinforcement-learning',
    topic: '强化学习',
    points: ['智能体与环境', 'MDP', 'Q-learning', '探索与利用'],
    misconception: '只关注即时奖励而忽略长期收益',
  },
  {
    no: '10',
    file: '10-large-models-and-agents',
    topic: '大模型与智能体',
    points: ['Prompt', 'RAG', '工具调用', '多智能体编排'],
    misconception: '认为接入大模型 API 就等于智能体系统',
  },
  {
    no: '11',
    file: '11-ai-safety-and-ethics',
    topic: 'AI 安全与伦理',
    points: ['幻觉控制', '偏见与公平', '隐私保护', '学术诚信'],
    misconception: '认为安全过滤只等于敏感词过滤',
  },
  {
    no: '12',
    file: '12-course-project',
    topic: '综合课程项目',
    points: ['问题定义', '知识来源', '项目评估', '演示答辩'],
    misconception: '只展示模型输出而不展示来源和评估',
  },
];

function questionsForChapter(chapter) {
  const [p1, p2, p3, p4 = p1] = chapter.points;
  return [
    {
      type: 'single_choice',
      difficulty: 'easy',
      stem: `学习“${chapter.topic}”时，最应该优先掌握的是哪一项？`,
      options: [p1, '页面配色数量', '文件压缩格式', '浏览器缓存策略'],
      answer: p1,
      explanation: `${p1} 是理解“${chapter.topic}”的基础知识点。`,
      errorTags: ['基础概念薄弱'],
    },
    {
      type: 'multiple_choice',
      difficulty: 'medium',
      stem: `关于“${chapter.topic}”，哪些知识点属于本章重点？`,
      options: [p1, p2, p3, '随机选择按钮颜色'],
      answer: [p1, p2, p3],
      explanation: `本章重点围绕 ${chapter.points.slice(0, 3).join('、')} 展开。`,
      errorTags: ['重点识别不清'],
    },
    {
      type: 'true_false',
      difficulty: 'medium',
      stem: `在“${chapter.topic}”中，${chapter.misconception} 是合理理解。`,
      answer: 'false',
      explanation: `该说法属于常见误区。学习时应结合定义、流程、例子和评价边界分析。`,
      errorTags: ['常见误区'],
    },
    {
      type: 'short_answer',
      difficulty: 'medium',
      stem: `请用 2-3 句话解释“${p2}”在“${chapter.topic}”中的作用。`,
      answer: `${p2} 是本章的重要概念，需要说明它解决的问题、输入输出或适用边界，并能结合一个学习场景例子解释。`,
      explanation: '简答题重点考查概念解释和场景化表达能力。',
      errorTags: ['表达不完整'],
    },
    {
      type: 'case_analysis',
      difficulty: 'medium',
      stem: `学生在学习“${chapter.topic}”时反复混淆“${p2}”和“${p3}”。系统应如何推荐学习资源？`,
      answer: `应先推送概念对比讲义和思维导图，再安排分层练习题；如果学生偏好实践，可补充与 ${p4} 相关的案例任务。`,
      explanation: '个性化推荐需要结合薄弱点、资源偏好和前置知识关系。',
      errorTags: ['个性化推荐理由不足'],
    },
    {
      type: 'project_task',
      difficulty: 'hard',
      stem: `围绕“${chapter.topic}”设计一个可放入课程项目的小任务，要求包含输入、处理过程、输出和评价方式。`,
      answer: `示例任务：输入学生关于 ${p1} 的问题，系统检索课程知识库中相关片段，生成带来源的解释和 3 道练习题；评价方式包括来源命中、回答准确性和练习正确率。`,
      explanation: '项目题考查把章节知识转化为系统闭环的能力。',
      errorTags: ['项目闭环不足'],
    },
  ];
}

const existingIds = new Set(bank.questions.map((question) => question.id));
const byChapter = new Map();
for (const question of bank.questions) {
  const key = String(question.chapter || '').slice(0, 2);
  byChapter.set(key, (byChapter.get(key) || 0) + 1);
}

for (const chapter of chapters) {
  const current = byChapter.get(chapter.no) || 0;
  const needed = Math.max(0, 10 - current);
  const templates = questionsForChapter(chapter);

  for (let i = 0; i < needed; i += 1) {
    const template = templates[i % templates.length];
    const sequence = current + i + 1;
    const id = `ai-${chapter.no}-${String(sequence).padStart(3, '0')}`;
    if (existingIds.has(id)) continue;
    bank.questions.push({
      id,
      chapter: chapter.file,
      knowledgePoints: chapter.points,
      ...template,
    });
    existingIds.add(id);
  }
}

bank.questions.sort((a, b) => a.id.localeCompare(b.id));
bank.total = bank.questions.length;
bank.coverage = {
  chapters: 12,
  questionsPerChapter: 10,
  types: Array.from(new Set(bank.questions.map((question) => question.type))),
};

fs.writeFileSync(bankPath, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
console.log(`question-bank expanded to ${bank.questions.length} questions`);
