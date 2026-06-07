/**
 * 天空课堂项目汇报PPT生成脚本
 * 使用 pptxgenjs 生成清新风格的汇报PPT
 */

const PptxGenJS = require('../packages/pptxgenjs/dist/pptxgen.cjs.js');
const fs = require('fs');
const path = require('path');

// 创建PPT实例
const pptx = new PptxGenJS();

// ========== 主题配置 ==========
const THEME = {
  // 清新配色方案
  primary: '4A90D9',      // 天空蓝
  secondary: '5FB878',    // 清新绿
  accent: 'F5A623',       // 活力橙
  text: '2C3E50',         // 深灰文字
  textLight: '7F8C8D',    // 浅灰文字
  bg: 'FFFFFF',           // 白色背景
  bgLight: 'F0F7FF',      // 浅蓝背景
  bgGreen: 'F0FFF4',      // 浅绿背景
  gradientStart: '667EEA', // 渐变起始
  gradientEnd: '764BA2',   // 渐变结束
};

// 设置PPT元数据
pptx.author = 'Sky Classroom Team';
pptx.company = 'Sky Classroom';
pptx.subject = '项目汇报';
pptx.title = '天空课堂 - AI智能教学平台项目汇报';

// 设置默认字体
pptx.defineSlideMaster({
  title: 'MASTER_SLIDE',
  background: { color: THEME.bg },
  objects: [
    // 底部装饰线
    {
      rect: { x: 0, y: '95%', w: '100%', h: '5%' },
      fill: { color: THEME.primary },
    },
  ],
});

// ========== 辅助函数 ==========

function addGradientBackground(slide, startColor, endColor) {
  slide.background = {
    gradient: {
      type: 'linear',
      angle: 135,
      stops: [
        { position: 0, color: { rgb: startColor } },
        { position: 1, color: { rgb: endColor } },
      ],
    },
  };
}

function addTitle(slide, text, x, y, w, h, options = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontSize: options.fontSize || 32,
    fontFace: 'Microsoft YaHei',
    color: options.color || THEME.text,
    bold: options.bold !== false,
    align: options.align || 'left',
    valign: options.valign || 'middle',
  });
}

function addBodyText(slide, text, x, y, w, h, options = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontSize: options.fontSize || 14,
    fontFace: 'Microsoft YaHei',
    color: options.color || THEME.text,
    align: options.align || 'left',
    valign: options.valign || 'top',
    bullet: options.bullet || false,
    lineSpacing: options.lineSpacing || 24,
  });
}

function addCard(slide, x, y, w, h, title, content, color) {
  // 卡片背景
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: 'FFFFFF' },
    line: { color: color, width: 2 },
    rectRadius: 0.1,
  });
  
  // 标题
  slide.addText(title, {
    x: x + 0.1, y: y + 0.1, w: w - 0.2, h: 0.4,
    fontSize: 16,
    fontFace: 'Microsoft YaHei',
    color: color,
    bold: true,
    align: 'center',
    valign: 'middle',
  });
  
  // 内容
  slide.addText(content, {
    x: x + 0.1, y: y + 0.5, w: w - 0.2, h: h - 0.6,
    fontSize: 12,
    fontFace: 'Microsoft YaHei',
    color: THEME.text,
    align: 'center',
    valign: 'middle',
  });
}

// ========== 幻灯片内容 ==========

// 1. 封面页
const slide1 = pptx.addSlide();
addGradientBackground(slide1, THEME.gradientStart, THEME.gradientEnd);
slide1.addText('天空课堂', {
  x: 0, y: '30%', w: '100%', h: 1,
  fontSize: 54,
  fontFace: 'Microsoft YaHei',
  color: 'FFFFFF',
  bold: true,
  align: 'center',
  valign: 'middle',
});
slide1.addText('AI驱动的智能教学平台', {
  x: 0, y: '45%', w: '100%', h: 0.8,
  fontSize: 28,
  fontFace: 'Microsoft YaHei',
  color: 'FFFFFF',
  align: 'center',
  valign: 'middle',
});
slide1.addText('项目汇报 | 2026年5月', {
  x: 0, y: '60%', w: '100%', h: 0.5,
  fontSize: 16,
  fontFace: 'Microsoft YaHei',
  color: 'FFFFFF',
  align: 'center',
  valign: 'middle',
});

// 2. 目录页
const slide2 = pptx.addSlide();
slide2.background = { color: THEME.bgLight };
addTitle(slide2, '汇报目录', 0.5, 0.5, 9, 0.8, { fontSize: 36, color: THEME.primary });

const tocItems = [
  { num: '01', title: '项目概述', desc: '天空课堂产品介绍与技术架构' },
  { num: '02', title: '智能体框架', desc: '多Agent协同解题与教学系统' },
  { num: '03', title: '核心功能', desc: '搜题批改、幻灯片讲解、学习数据' },
  { num: '04', title: '项目历程', desc: 'Phase 1-4 搭建日志与里程碑' },
  { num: '05', title: '技术亮点', desc: 'RAG检索、ReAct推理、个性化设置' },
  { num: '06', title: '未来规划', desc: 'Phase 3计划与持续优化方向' },
];

tocItems.forEach((item, index) => {
  const row = Math.floor(index / 2);
  const col = index % 2;
  const x = 0.8 + col * 4.5;
  const y = 1.8 + row * 1.5;
  
  // 序号
  slide2.addText(item.num, {
    x, y, w: 0.8, h: 0.6,
    fontSize: 28,
    fontFace: 'Microsoft YaHei',
    color: THEME.primary,
    bold: true,
    align: 'left',
    valign: 'middle',
  });
  
  // 标题
  slide2.addText(item.title, {
    x: x + 0.9, y, w: 3, h: 0.4,
    fontSize: 20,
    fontFace: 'Microsoft YaHei',
    color: THEME.text,
    bold: true,
    align: 'left',
    valign: 'middle',
  });
  
  // 描述
  slide2.addText(item.desc, {
    x: x + 0.9, y: y + 0.4, w: 3, h: 0.3,
    fontSize: 12,
    fontFace: 'Microsoft YaHei',
    color: THEME.textLight,
    align: 'left',
    valign: 'middle',
  });
});

// 3. 项目概述
const slide3 = pptx.addSlide();
addTitle(slide3, '项目概述', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

addBodyText(slide3, 
  '天空课堂是一款基于AI技术的智能教学平台，集成解题、幻灯片生成、虚拟形象讲解、学习数据管理于一体。\n\n' +
  '平台采用Next.js + TypeScript构建，结合LangGraph状态机、多模态LLM、RAG检索增强等前沿技术，为教育场景提供智能化解决方案。',
  0.5, 1.2, 4.5, 3,
  { fontSize: 14, lineSpacing: 28 }
);

// 技术栈卡片
const techStack = [
  { name: '前端框架', items: 'Next.js 15\nReact 19\nTypeScript\nTailwind CSS' },
  { name: '状态管理', items: 'Zustand\nIndexedDB\nDexie.js' },
  { name: 'AI能力', items: 'LangGraph\nDeepSeek\nGLM-4\nQwen-Max' },
  { name: '基础设施', items: 'PPTX生成\nTTS语音\nOCR识别\nRAG检索' },
];

techStack.forEach((tech, index) => {
  const x = 5.2 + (index % 2) * 2.3;
  const y = 1.2 + Math.floor(index / 2) * 1.8;
  addCard(slide3, x, y, 2.1, 1.5, tech.name, tech.items, index < 2 ? THEME.primary : THEME.secondary);
});

// 4. 智能体框架 - 架构图
const slide4 = pptx.addSlide();
slide4.background = { color: THEME.bgLight };
addTitle(slide4, '智能体框架架构', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

// 架构层级
const layers = [
  { name: '应用层', color: THEME.primary, items: '搜题批改 | 幻灯片讲解 | 学习数据 | AI助手' },
  { name: 'Agent层', color: THEME.secondary, items: 'Solver Agent | Slide Agent | Memory Agent | ReAct Agent' },
  { name: '能力层', color: THEME.accent, items: 'LLM调用 | RAG检索 | TTS语音 | OCR识别' },
  { name: '数据层', color: '9B59B6', items: '向量存储 | 知识库 | 用户配置 | 学习记录' },
];

layers.forEach((layer, index) => {
  const y = 1.2 + index * 1.3;
  
  // 层级标签
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 0.5, y, w: 1.5, h: 0.8,
    fill: { color: layer.color },
    rectRadius: 0.1,
  });
  slide4.addText(layer.name, {
    x: 0.5, y, w: 1.5, h: 0.8,
    fontSize: 14,
    fontFace: 'Microsoft YaHei',
    color: 'FFFFFF',
    bold: true,
    align: 'center',
    valign: 'middle',
  });
  
  // 内容
  slide4.addShape(pptx.ShapeType.roundRect, {
    x: 2.2, y, w: 7, h: 0.8,
    fill: { color: 'FFFFFF' },
    line: { color: layer.color, width: 1.5 },
    rectRadius: 0.1,
  });
  slide4.addText(layer.items, {
    x: 2.2, y, w: 7, h: 0.8,
    fontSize: 13,
    fontFace: 'Microsoft YaHei',
    color: THEME.text,
    align: 'center',
    valign: 'middle',
  });
});

// 5. 智能体框架 - Agent详解
const slide5 = pptx.addSlide();
addTitle(slide5, '核心Agent详解', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

const agents = [
  { 
    name: 'Solver Agent', 
    color: THEME.primary,
    desc: '智能解题Agent',
    features: '• 多Agent混合策略（universal/science/humanities）\n• 题目类型自动路由\n• 置信度验证与降级fallback\n• 四段式结构化输出'
  },
  { 
    name: 'Slide Agent', 
    color: THEME.secondary,
    desc: '幻灯片讲解Agent',
    features: '• 教学主题分析\n• 课件结构生成\n• 讲解脚本编写\n• 互动环节设计'
  },
  { 
    name: 'ReAct Agent', 
    color: THEME.accent,
    desc: '深度分析Agent',
    features: '• 思考-行动-观察循环\n• 知识库检索工具\n• 计算与总结工具\n• 多步推理能力'
  },
  { 
    name: 'Memory Agent', 
    color: '9B59B6',
    desc: '记忆卡片Agent',
    features: '• 知识点提取\n• 记忆卡片生成\n• 遗忘曲线复习\n• 个性化推荐'
  },
];

agents.forEach((agent, index) => {
  const col = index % 2;
  const row = Math.floor(index / 2);
  const x = 0.5 + col * 4.7;
  const y = 1.2 + row * 2.2;
  
  // Agent卡片
  slide5.addShape(pptx.ShapeType.roundRect, {
    x, y, w: 4.4, h: 1.9,
    fill: { color: 'FFFFFF' },
    line: { color: agent.color, width: 2 },
    rectRadius: 0.1,
  });
  
  // Agent名称
  slide5.addText(agent.name, {
    x: x + 0.15, y: y + 0.1, w: 2, h: 0.35,
    fontSize: 16,
    fontFace: 'Microsoft YaHei',
    color: agent.color,
    bold: true,
    align: 'left',
    valign: 'middle',
  });
  
  // Agent描述
  slide5.addText(agent.desc, {
    x: x + 2.2, y: y + 0.1, w: 2, h: 0.35,
    fontSize: 12,
    fontFace: 'Microsoft YaHei',
    color: THEME.textLight,
    align: 'right',
    valign: 'middle',
  });
  
  // 特性列表
  slide5.addText(agent.features, {
    x: x + 0.15, y: y + 0.5, w: 4.1, h: 1.3,
    fontSize: 11,
    fontFace: 'Microsoft YaHei',
    color: THEME.text,
    align: 'left',
    valign: 'top',
    lineSpacing: 20,
  });
});

// 6. 核心功能 - 搜题批改
const slide6 = pptx.addSlide();
slide6.background = { color: THEME.bgLight };
addTitle(slide6, '核心功能 · 搜题批改', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

// 流程图
const flowSteps = [
  { name: '输入', desc: '拍照/语音/文字', color: THEME.primary },
  { name: '识别', desc: 'OCR+公式识别', color: THEME.secondary },
  { name: '解题', desc: 'LLM推理生成', color: THEME.accent },
  { name: '批改', desc: '答案对比分析', color: '9B59B6' },
  { name: '输出', desc: '四段式结果', color: THEME.primary },
];

flowSteps.forEach((step, index) => {
  const x = 0.5 + index * 1.8;
  const y = 1.5;
  
  // 步骤圆
  slide6.addShape(pptx.ShapeType.ellipse, {
    x, y, w: 1.4, h: 1.4,
    fill: { color: step.color },
  });
  slide6.addText(step.name, {
    x, y: y + 0.2, w: 1.4, h: 0.5,
    fontSize: 14,
    fontFace: 'Microsoft YaHei',
    color: 'FFFFFF',
    bold: true,
    align: 'center',
    valign: 'middle',
  });
  slide6.addText(step.desc, {
    x, y: y + 0.7, w: 1.4, h: 0.5,
    fontSize: 10,
    fontFace: 'Microsoft YaHei',
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  });
  
  // 箭头
  if (index < flowSteps.length - 1) {
    slide6.addShape(pptx.ShapeType.rightArrow, {
      x: x + 1.5, y: y + 0.5, w: 0.4, h: 0.3,
      fill: { color: THEME.textLight },
    });
  }
});

// 输出格式
addBodyText(slide6, 
  '四段式输出格式：\n\n' +
  '1. 题目解析 - 理解题意，提取关键信息\n' +
  '2. 解题步骤 - 详细推导过程，每步说明\n' +
  '3. 知识点 - 相关概念、公式、易错点\n' +
  '4. 答案 - 最终结果，简洁明了',
  0.5, 3.2, 9, 2,
  { fontSize: 13, lineSpacing: 26 }
);

// 7. 核心功能 - 幻灯片讲解
const slide7 = pptx.addSlide();
addTitle(slide7, '核心功能 · 幻灯片讲解', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

addBodyText(slide7,
  '输入教学主题 → AI生成完整课件 → 虚拟形象语音讲解 → PPTX导出\n\n' +
  '支持12套专业模板：',
  0.5, 1.2, 9, 0.8,
  { fontSize: 14, lineSpacing: 26 }
);

const templates = [
  '现代几何风', '明快卡通风', '古典书香风', '简约北欧风',
  '商务专业风', '活力运动风', '海洋探索风', '清新水彩风',
  '清新自然风', '温暖人文风', '田园复古风', '科技未来风',
];

templates.forEach((tmpl, index) => {
  const col = index % 4;
  const row = Math.floor(index / 4);
  const x = 0.5 + col * 2.3;
  const y = 2.2 + row * 0.7;
  
  slide7.addShape(pptx.ShapeType.roundRect, {
    x, y, w: 2.1, h: 0.5,
    fill: { color: index < 4 ? THEME.primary : (index < 8 ? THEME.secondary : THEME.accent) },
    rectRadius: 0.05,
  });
  slide7.addText(tmpl, {
    x, y, w: 2.1, h: 0.5,
    fontSize: 11,
    fontFace: 'Microsoft YaHei',
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
  });
});

// 8. 核心功能 - 学习数据
const slide8 = pptx.addSlide();
slide8.background = { color: THEME.bgLight };
addTitle(slide8, '核心功能 · 学习数据管理', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

const features = [
  { name: '错题本', desc: '自动收集错题\n分类整理\n复习提醒', color: THEME.primary },
  { name: '知识图谱', desc: '知识点关联\n薄弱点分析\n学习路径', color: THEME.secondary },
  { name: 'AI助手', desc: '24小时答疑\n个性化讲解\n学习建议', color: THEME.accent },
  { name: '学习统计', desc: '学习时长\n题目数量\n掌握程度', color: '9B59B6' },
];

features.forEach((feat, index) => {
  const x = 0.5 + index * 2.3;
  const y = 1.5;
  
  // 图标背景
  slide8.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.65, y, w: 0.8, h: 0.8,
    fill: { color: feat.color },
  });
  
  // 名称
  slide8.addText(feat.name, {
    x, y: y + 1, w: 2.1, h: 0.4,
    fontSize: 16,
    fontFace: 'Microsoft YaHei',
    color: feat.color,
    bold: true,
    align: 'center',
    valign: 'middle',
  });
  
  // 描述
  slide8.addText(feat.desc, {
    x, y: y + 1.4, w: 2.1, h: 1,
    fontSize: 11,
    fontFace: 'Microsoft YaHei',
    color: THEME.text,
    align: 'center',
    valign: 'top',
    lineSpacing: 18,
  });
});

// 9. 技术亮点 - RAG + ReAct
const slide9 = pptx.addSlide();
addTitle(slide9, '技术亮点 · RAG检索增强 + ReAct推理', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

// RAG部分
slide9.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 1.2, w: 4.3, h: 3.2,
  fill: { color: 'FFFFFF' },
  line: { color: THEME.primary, width: 2 },
  rectRadius: 0.1,
});
slide9.addText('RAG 检索增强', {
  x: 0.5, y: 1.3, w: 4.3, h: 0.4,
  fontSize: 18,
  fontFace: 'Microsoft YaHei',
  color: THEME.primary,
  bold: true,
  align: 'center',
  valign: 'middle',
});
slide9.addText(
  '• 文档上传与分块处理\n' +
  '• TF-IDF向量存储\n' +
  '• 余弦相似度检索\n' +
  '• 上下文注入Prompt\n' +
  '• 知识库动态更新',
  { x: 0.7, y: 1.8, w: 3.9, h: 2.4, fontSize: 12, fontFace: 'Microsoft YaHei', color: THEME.text, lineSpacing: 22 }
);

// ReAct部分
slide9.addShape(pptx.ShapeType.roundRect, {
  x: 5.1, y: 1.2, w: 4.3, h: 3.2,
  fill: { color: 'FFFFFF' },
  line: { color: THEME.secondary, width: 2 },
  rectRadius: 0.1,
});
slide9.addText('ReAct 推理框架', {
  x: 5.1, y: 1.3, w: 4.3, h: 0.4,
  fontSize: 18,
  fontFace: 'Microsoft YaHei',
  color: THEME.secondary,
  bold: true,
  align: 'center',
  valign: 'middle',
});
slide9.addText(
  '• Thought 思考分析\n' +
  '• Action 工具调用\n' +
  '• Observation 结果观察\n' +
  '• Final Answer 最终回答\n' +
  '• 多轮迭代推理',
  { x: 5.3, y: 1.8, w: 3.9, h: 2.4, fontSize: 12, fontFace: 'Microsoft YaHei', color: THEME.text, lineSpacing: 22 }
);

// 10. 个性化设置
const slide10 = pptx.addSlide();
slide10.background = { color: THEME.bgLight };
addTitle(slide10, '技术亮点 · 个性化AI设置', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

addBodyText(slide10,
  '用户可自定义AI行为，让教学更贴合个人需求：\n\n' +
  '• 教育阶段：小学/初中/高中/大学/研究生\n' +
  '• 学习风格：视觉型/听觉型/阅读型/实践型/平衡型\n' +
  '• 回答详细程度：简洁/标准/详细/全面\n' +
  '• AI性格：友善亲切/专业严谨/鼓励引导/严格要求/幽默风趣\n' +
  '• 自定义AI助手名称和特殊指令\n' +
  '• 功能开关：自动出题/分步解答/记忆功能/RAG增强',
  0.5, 1.2, 9, 3,
  { fontSize: 14, lineSpacing: 28 }
);

// 11. Phase 1 搭建日志
const slide11 = pptx.addSlide();
addTitle(slide11, '项目搭建日志 · Phase 1', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

slide11.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 1.2, w: 9, h: 3.2,
  fill: { color: 'FFFFFF' },
  line: { color: THEME.primary, width: 2 },
  rectRadius: 0.1,
});

addBodyText(slide11,
  '核心引擎验证：JSON内容 → 模板填充 → PPTX输出\n\n' +
  '✅ 现代几何风模板：41字段，100%填充成功\n' +
  '✅ 明快卡通风模板：29字段，100%填充成功\n' +
  '✅ 验证核心链路可行性\n' +
  '✅ 建立统一JSON Schema规范\n\n' +
  '关键成果：确认模板填充引擎技术路线可行',
  0.7, 1.4, 8.6, 2.8,
  { fontSize: 14, lineSpacing: 26 }
);

// 12. Phase 2 搭建日志
const slide12 = pptx.addSlide();
slide12.background = { color: THEME.bgLight };
addTitle(slide12, '项目搭建日志 · Phase 2', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

slide12.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 1.2, w: 9, h: 3.2,
  fill: { color: 'FFFFFF' },
  line: { color: THEME.secondary, width: 2 },
  rectRadius: 0.1,
});

addBodyText(slide12,
  '引擎完善 + 扩展模板映射\n\n' +
  '✅ 多段落bullet列表替换\n' +
  '✅ 表格填充功能\n' +
  '✅ 多run段落安全替换\n' +
  '✅ 数字格式转换\n' +
  '✅ TemplateFiller类封装\n' +
  '✅ 4套模板批量验证通过\n\n' +
  '关键成果：引擎功能完善，支持4套模板',
  0.7, 1.4, 8.6, 2.8,
  { fontSize: 14, lineSpacing: 26 }
);

// 13. Phase 3 搭建日志
const slide13 = pptx.addSlide();
addTitle(slide13, '项目搭建日志 · Phase 3', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

slide13.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 1.2, w: 9, h: 3.2,
  fill: { color: 'FFFFFF' },
  line: { color: THEME.accent, width: 2 },
  rectRadius: 0.1,
});

addBodyText(slide13,
  '前后端集成 + 完整用户流程\n\n' +
  '✅ Python CLI封装\n' +
  '✅ API路由改造（templateId参数）\n' +
  '✅ Prompt动态构建\n' +
  '✅ JSON校验与Fallback逻辑\n' +
  '✅ TemplateGallery组件（12宫格）\n' +
  '✅ 学科推断与模板推荐\n\n' +
  '关键成果：完成端到端用户流程',
  0.7, 1.4, 8.6, 2.8,
  { fontSize: 14, lineSpacing: 26 }
);

// 14. Phase 4 搭建日志
const slide14 = pptx.addSlide();
slide14.background = { color: THEME.bgLight };
addTitle(slide14, '项目搭建日志 · Phase 4', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

slide14.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 1.2, w: 9, h: 3.2,
  fill: { color: 'FFFFFF' },
  line: { color: '9B59B6', width: 2 },
  rectRadius: 0.1,
});

addBodyText(slide14,
  '完整映射 + 全面测试 + 上线准备\n\n' +
  '✅ 12/12套模板映射全部完成\n' +
  '✅ 批量验证通过率95%-100%\n' +
  '✅ 边界测试通过（超长文本/特殊字符/空内容）\n' +
  '✅ 性能测试：单次填充0.02s\n' +
  '✅ 代码清理与文档更新\n\n' +
  '关键成果：12套模板全部可用，系统稳定',
  0.7, 1.4, 8.6, 2.8,
  { fontSize: 14, lineSpacing: 26 }
);

// 15. Phase 3 规划
const slide15 = pptx.addSlide();
addTitle(slide15, '未来规划 · Phase 3计划', 0.5, 0.3, 9, 0.6, { fontSize: 32, color: THEME.primary });

const plans = [
  { category: 'AI能力增强', items: '多模态交互 | 智能追问链 | 个性化推荐 | AI助教记忆' },
  { category: '学习体验', items: '解题进度保存 | 错题复习计划 | 课堂模板库' },
  { category: '平台运营', items: 'PPT导出质量 | 虚拟形象 | AI全局可用 | 样式优化' },
  { category: '技术架构', items: '语义缓存 | PWA离线 | 性能监控' },
];

plans.forEach((plan, index) => {
  const y = 1.2 + index * 1.1;
  
  slide15.addShape(pptx.ShapeType.roundRect, {
    x: 0.5, y, w: 2, h: 0.8,
    fill: { color: [THEME.primary, THEME.secondary, THEME.accent, '9B59B6'][index] },
    rectRadius: 0.05,
  });
  slide15.addText(plan.category, {
    x: 0.5, y, w: 2, h: 0.8,
    fontSize: 13,
    fontFace: 'Microsoft YaHei',
    color: 'FFFFFF',
    bold: true,
    align: 'center',
    valign: 'middle',
  });
  
  slide15.addText(plan.items, {
    x: 2.7, y: y + 0.1, w: 6.8, h: 0.6,
    fontSize: 12,
    fontFace: 'Microsoft YaHei',
    color: THEME.text,
    align: 'left',
    valign: 'middle',
  });
});

// 16. 总结页
const slide16 = pptx.addSlide();
addGradientBackground(slide16, THEME.gradientStart, THEME.gradientEnd);
slide16.addText('谢谢观看', {
  x: 0, y: '35%', w: '100%', h: 1,
  fontSize: 48,
  fontFace: 'Microsoft YaHei',
  color: 'FFFFFF',
  bold: true,
  align: 'center',
  valign: 'middle',
});
slide16.addText('天空课堂 · AI智能教学平台', {
  x: 0, y: '50%', w: '100%', h: 0.6,
  fontSize: 20,
  fontFace: 'Microsoft YaHei',
  color: 'FFFFFF',
  align: 'center',
  valign: 'middle',
});
slide16.addText('让AI赋能教育，让学习更高效', {
  x: 0, y: '58%', w: '100%', h: 0.5,
  fontSize: 14,
  fontFace: 'Microsoft YaHei',
  color: 'FFFFFF',
  align: 'center',
  valign: 'middle',
});

// ========== 保存PPT ==========
const outputDir = path.join(__dirname, '..', 'public', 'temp', 'pptx');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, '天空课堂-项目汇报.pptx');
pptx.writeFile({ fileName: outputPath })
  .then(() => {
    console.log('✅ PPT生成成功！');
    console.log(`📁 文件路径: ${outputPath}`);
    console.log(`📊 共 ${pptx.slides.length} 页幻灯片`);
  })
  .catch((err) => {
    console.error('❌ PPT生成失败:', err);
    process.exit(1);
  });
