/**
 * 清新教育风格 PPT 模板生成器
 * 基于用户提供的图片风格：天蓝配色、3D卡通、教育主题
 */

const PptxGenJS = require('../packages/pptxgenjs/dist/pptxgen.cjs.js');
const fs = require('fs');
const path = require('path');

const pptx = new PptxGenJS();

// ========== 主题配置 - 清新教育风 ==========
const THEME = {
  // 主色调 - 天蓝色系
  primary: '5DB8E8',      // 天空蓝
  primaryLight: '87CEEB', // 浅天蓝
  primaryDark: '3A9BD5',  // 深蓝
  
  // 辅助色
  secondary: '7ED321',    // 清新绿
  accent: 'F5A623',       // 活力橙
  purple: 'BD7AEA',       // 柔和紫
  
  // 背景色
  bg: 'FFFFFF',
  bgLight: 'F0F9FF',      // 极浅蓝
  bgGradientStart: '5DB8E8',
  bgGradientEnd: '87CEEB',
  
  // 文字色
  text: '2C3E50',
  textLight: '7F8C8D',
  textWhite: 'FFFFFF',
  
  // 装饰色
  cloud: 'FFFFFF',
  leaf: '7ED321',
};

// 设置PPT尺寸 (16:9)
pptx.layout = 'LAYOUT_16x9';

// 定义幻灯片母版
pptx.defineSlideMaster({
  title: 'MASTER_SLIDE',
  background: { color: THEME.bg },
  objects: [
    // 底部装饰条
    {
      rect: { x: 0, y: '95%', w: '100%', h: '0.8%' },
      fill: { color: THEME.primary },
    },
  ],
});

// ========== 辅助函数 ==========

function addSkyBackground(slide) {
  slide.background = {
    gradient: {
      type: 'linear',
      angle: 180,
      stops: [
        { position: 0, color: { rgb: '87CEEB' } },
        { position: 0.5, color: { rgb: '5DB8E8' } },
        { position: 1, color: { rgb: 'B8E0F7' } },
      ],
    },
  };
}

function addLightBackground(slide) {
  slide.background = { color: THEME.bgLight };
}

function addTitle(slide, text, x, y, w, h, options = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontSize: options.fontSize || 36,
    fontFace: 'Microsoft YaHei',
    color: options.color || THEME.text,
    bold: options.bold !== false,
    align: options.align || 'center',
    valign: options.valign || 'middle',
    shadow: options.shadow,
  });
}

function addSubtitle(slide, text, x, y, w, h, options = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontSize: options.fontSize || 16,
    fontFace: 'Microsoft YaHei',
    color: options.color || THEME.textLight,
    align: options.align || 'center',
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
    lineSpacing: options.lineSpacing || 24,
    bullet: options.bullet || false,
  });
}

function addCloud(slide, x, y, w, h, opacity = 0.8) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x, y, w, h,
    fill: { color: 'FFFFFF', transparency: (1 - opacity) * 100 },
  });
}

function addLeaf(slide, x, y, size, color = THEME.leaf) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x, y, w: size, h: size * 0.6,
    fill: { color },
    rotate: 45,
  });
}

// ========== 模板页面 ==========

// 1. 封面页 - 天空背景 + 居中标题
const coverSlide = pptx.addSlide();
addSkyBackground(coverSlide);

// 云朵装饰
addCloud(coverSlide, 0.5, 0.3, 1.5, 0.6, 0.6);
addCloud(coverSlide, 7.5, 0.2, 2, 0.8, 0.5);
addCloud(coverSlide, 2, 0.1, 1.8, 0.7, 0.4);
addCloud(coverSlide, 6, 0.4, 1.2, 0.5, 0.3);

// 标题
addTitle(coverSlide, '标题文字', 0, '35%', '100%', 1, {
  fontSize: 48,
  color: THEME.textWhite,
  bold: true,
  shadow: { type: 'outer', blur: 3, color: '000000', transparency: 30 },
});

// 副标题
addSubtitle(coverSlide, '副标题描述文字', 0, '48%', '100%', 0.6, {
  fontSize: 20,
  color: THEME.textWhite,
});

// 装饰圆
for (let i = 0; i < 5; i++) {
  coverSlide.addShape(pptx.ShapeType.ellipse, {
    x: 1 + i * 1.8, y: '75%', w: 0.3, h: 0.3,
    fill: { color: 'FFFFFF', transparency: 50 },
  });
}

// 2. 目录页
const tocSlide = pptx.addSlide();
addLightBackground(tocSlide);

addTitle(tocSlide, '目录', 0.5, 0.3, 9, 0.8, {
  fontSize: 36,
  color: THEME.primary,
  align: 'left',
});

// 目录项
const tocItems = [
  { num: '01', title: '章节标题一', color: THEME.primary },
  { num: '02', title: '章节标题二', color: THEME.secondary },
  { num: '03', title: '章节标题三', color: THEME.accent },
  { num: '04', title: '章节标题四', color: THEME.purple },
];

tocItems.forEach((item, index) => {
  const y = 1.5 + index * 1.2;
  
  // 序号背景
  tocSlide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8, y, w: 0.8, h: 0.8,
    fill: { color: item.color },
    rectRadius: 0.1,
  });
  tocSlide.addText(item.num, {
    x: 0.8, y, w: 0.8, h: 0.8,
    fontSize: 18,
    fontFace: 'Microsoft YaHei',
    color: 'FFFFFF',
    bold: true,
    align: 'center',
    valign: 'middle',
  });
  
  // 标题
  tocSlide.addText(item.title, {
    x: 1.8, y: y + 0.15, w: 6, h: 0.5,
    fontSize: 20,
    fontFace: 'Microsoft YaHei',
    color: THEME.text,
    align: 'left',
    valign: 'middle',
  });
  
  // 装饰线
  tocSlide.addShape(pptx.ShapeType.rect, {
    x: 1.8, y: y + 0.7, w: 7, h: 0.02,
    fill: { color: 'E0E0E0' },
  });
});

// 3. 章节过渡页
const chapterSlide = pptx.addSlide();
addSkyBackground(chapterSlide);

// 大号序号
chapterSlide.addShape(pptx.ShapeType.ellipse, {
  x: '40%', y: '25%', w: '20%', h: '35%',
  fill: { color: 'FFFFFF', transparency: 20 },
});

addTitle(chapterSlide, '01', 0, '28%', '100%', 1, {
  fontSize: 72,
  color: THEME.textWhite,
  bold: true,
});

addTitle(chapterSlide, '章节标题', 0, '55%', '100%', 0.8, {
  fontSize: 32,
  color: THEME.textWhite,
});

addSubtitle(chapterSlide, '章节描述文字', 0, '68%', '100%', 0.5, {
  fontSize: 16,
  color: THEME.textWhite,
});

// 4. 内容页 - 标题 + 正文
const contentSlide1 = pptx.addSlide();
addLightBackground(contentSlide1);

// 顶部装饰条
contentSlide1.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: 0.15,
  fill: { color: THEME.primary },
});

addTitle(contentSlide1, '页面标题', 0.5, 0.4, 9, 0.6, {
  fontSize: 28,
  color: THEME.primary,
  align: 'left',
});

addBodyText(contentSlide1, 
  '这里是正文内容区域，可以放置详细的文字说明。\n\n' +
  '• 要点一：详细描述内容\n' +
  '• 要点二：详细描述内容\n' +
  '• 要点三：详细描述内容\n\n' +
  '补充说明文字，用于进一步阐述观点。',
  0.5, 1.2, 9, 4,
  { fontSize: 14, lineSpacing: 28 }
);

// 5. 内容页 - 双栏布局
const contentSlide2 = pptx.addSlide();
addLightBackground(contentSlide2);

contentSlide2.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: 0.15,
  fill: { color: THEME.primary },
});

addTitle(contentSlide2, '双栏布局', 0.5, 0.4, 9, 0.6, {
  fontSize: 28,
  color: THEME.primary,
  align: 'left',
});

// 左栏
contentSlide2.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 1.2, w: 4.3, h: 4,
  fill: { color: 'FFFFFF' },
  line: { color: THEME.primary, width: 2 },
  rectRadius: 0.1,
});
addTitle(contentSlide2, '左侧标题', 0.5, 1.3, 4.3, 0.5, {
  fontSize: 18,
  color: THEME.primary,
});
addBodyText(contentSlide2, 
  '左侧内容区域\n\n• 要点说明\n• 要点说明\n• 要点说明',
  0.7, 1.9, 3.9, 3,
  { fontSize: 13 }
);

// 右栏
contentSlide2.addShape(pptx.ShapeType.roundRect, {
  x: 5.2, y: 1.2, w: 4.3, h: 4,
  fill: { color: 'FFFFFF' },
  line: { color: THEME.secondary, width: 2 },
  rectRadius: 0.1,
});
addTitle(contentSlide2, '右侧标题', 5.2, 1.3, 4.3, 0.5, {
  fontSize: 18,
  color: THEME.secondary,
});
addBodyText(contentSlide2, 
  '右侧内容区域\n\n• 要点说明\n• 要点说明\n• 要点说明',
  5.4, 1.9, 3.9, 3,
  { fontSize: 13 }
);

// 6. 内容页 - 三栏卡片
const contentSlide3 = pptx.addSlide();
addLightBackground(contentSlide3);

contentSlide3.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: 0.15,
  fill: { color: THEME.primary },
});

addTitle(contentSlide3, '三栏卡片', 0.5, 0.4, 9, 0.6, {
  fontSize: 28,
  color: THEME.primary,
  align: 'left',
});

const cards = [
  { title: '卡片一', color: THEME.primary },
  { title: '卡片二', color: THEME.secondary },
  { title: '卡片三', color: THEME.accent },
];

cards.forEach((card, index) => {
  const x = 0.5 + index * 3.1;
  
  contentSlide3.addShape(pptx.ShapeType.roundRect, {
    x, y: 1.3, w: 2.8, h: 4,
    fill: { color: 'FFFFFF' },
    line: { color: card.color, width: 2 },
    rectRadius: 0.1,
  });
  
  contentSlide3.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.9, y: 1.6, w: 1, h: 1,
    fill: { color: card.color },
  });
  
  addTitle(contentSlide3, card.title, x, 2.8, 2.8, 0.5, {
    fontSize: 18,
    color: card.color,
  });
  
  addBodyText(contentSlide3, 
    '卡片内容描述\n• 要点一\n• 要点二\n• 要点三',
    x + 0.2, 3.4, 2.4, 1.8,
    { fontSize: 12, align: 'center' }
  );
});

// 7. 内容页 - 时间线
const timelineSlide = pptx.addSlide();
addLightBackground(timelineSlide);

timelineSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: 0.15,
  fill: { color: THEME.primary },
});

addTitle(timelineSlide, '时间线', 0.5, 0.4, 9, 0.6, {
  fontSize: 28,
  color: THEME.primary,
  align: 'left',
});

// 时间线主线
timelineSlide.addShape(pptx.ShapeType.rect, {
  x: 0.5, y: 2.5, w: 9, h: 0.05,
  fill: { color: THEME.primary },
});

const timelineItems = [
  { time: '第一阶段', desc: '描述内容', color: THEME.primary },
  { time: '第二阶段', desc: '描述内容', color: THEME.secondary },
  { time: '第三阶段', desc: '描述内容', color: THEME.accent },
  { time: '第四阶段', desc: '描述内容', color: THEME.purple },
];

timelineItems.forEach((item, index) => {
  const x = 0.8 + index * 2.3;
  
  // 节点
  timelineSlide.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.7, y: 2.3, w: 0.5, h: 0.5,
    fill: { color: item.color },
  });
  
  // 时间
  addTitle(timelineSlide, item.time, x, 1.2, 2.1, 0.5, {
    fontSize: 14,
    color: item.color,
  });
  
  // 描述
  addBodyText(timelineSlide, item.desc, x, 3.1, 2.1, 1.5, {
    fontSize: 12,
    align: 'center',
  });
});

// 8. 内容页 - 数据展示
const dataSlide = pptx.addSlide();
addLightBackground(dataSlide);

dataSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: 0.15,
  fill: { color: THEME.primary },
});

addTitle(dataSlide, '数据展示', 0.5, 0.4, 9, 0.6, {
  fontSize: 28,
  color: THEME.primary,
  align: 'left',
});

// 数据卡片
const dataCards = [
  { num: '98%', label: '完成率', color: THEME.primary },
  { num: '1,200+', label: '用户数', color: THEME.secondary },
  { num: '50ms', label: '响应时间', color: THEME.accent },
  { num: '4.9', label: '用户评分', color: THEME.purple },
];

dataCards.forEach((card, index) => {
  const x = 0.5 + index * 2.3;
  
  dataSlide.addShape(pptx.ShapeType.roundRect, {
    x, y: 1.5, w: 2.1, h: 2.5,
    fill: { color: 'FFFFFF' },
    line: { color: card.color, width: 2 },
    rectRadius: 0.1,
  });
  
  addTitle(dataSlide, card.num, x, 1.8, 2.1, 0.8, {
    fontSize: 32,
    color: card.color,
  });
  
  addSubtitle(dataSlide, card.label, x, 2.7, 2.1, 0.5, {
    fontSize: 14,
    color: THEME.textLight,
  });
});

// 9. 内容页 - 图文混排
const mixedSlide = pptx.addSlide();
addLightBackground(mixedSlide);

mixedSlide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: 0.15,
  fill: { color: THEME.primary },
});

addTitle(mixedSlide, '图文混排', 0.5, 0.4, 9, 0.6, {
  fontSize: 28,
  color: THEME.primary,
  align: 'left',
});

// 图片占位区域
mixedSlide.addShape(pptx.ShapeType.roundRect, {
  x: 0.5, y: 1.3, w: 4, h: 4,
  fill: { color: 'E8F4FD' },
  line: { color: THEME.primaryLight, width: 1 },
  rectRadius: 0.1,
});
mixedSlide.addText('图片占位区\n(建议尺寸 4:3)', {
  x: 0.5, y: 2.8, w: 4, h: 1,
  fontSize: 14,
  fontFace: 'Microsoft YaHei',
  color: THEME.textLight,
  align: 'center',
  valign: 'middle',
});

// 文字区域
addBodyText(mixedSlide, 
  '文字内容区域\n\n' +
  '• 要点说明文字\n' +
  '• 要点说明文字\n' +
  '• 要点说明文字\n\n' +
  '补充描述内容，可以详细阐述观点。',
  4.8, 1.3, 4.7, 4,
  { fontSize: 14, lineSpacing: 26 }
);

// 10. 结束页
const endSlide = pptx.addSlide();
addSkyBackground(endSlide);

// 云朵装饰
addCloud(endSlide, 1, 0.3, 1.5, 0.6, 0.5);
addCloud(endSlide, 7, 0.2, 2, 0.8, 0.4);

addTitle(endSlide, '感谢观看', 0, '35%', '100%', 1, {
  fontSize: 48,
  color: THEME.textWhite,
  bold: true,
  shadow: { type: 'outer', blur: 3, color: '000000', transparency: 30 },
});

addSubtitle(endSlide, 'THANK YOU', 0, '50%', '100%', 0.6, {
  fontSize: 24,
  color: THEME.textWhite,
});

// 装饰圆
for (let i = 0; i < 5; i++) {
  endSlide.addShape(pptx.ShapeType.ellipse, {
    x: 1.5 + i * 1.6, y: '70%', w: 0.25, h: 0.25,
    fill: { color: 'FFFFFF', transparency: 50 },
  });
}

// ========== 保存PPT ==========
const outputDir = path.join(__dirname, '..', 'public', 'temp', 'pptx');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, '清新教育风格-PPT模板.pptx');
pptx.writeFile({ fileName: outputPath })
  .then(() => {
    console.log('✅ PPT模板生成成功！');
    console.log(`📁 文件路径: ${outputPath}`);
    console.log(`📊 共 ${pptx.slides.length} 页模板页面`);
    console.log('\n模板包含页面：');
    console.log('  1. 封面页 - 天空渐变背景');
    console.log('  2. 目录页 - 四章节导航');
    console.log('  3. 章节过渡页 - 大号序号');
    console.log('  4. 内容页 - 标题+正文');
    console.log('  5. 内容页 - 双栏布局');
    console.log('  6. 内容页 - 三栏卡片');
    console.log('  7. 时间线页');
    console.log('  8. 数据展示页');
    console.log('  9. 图文混排页');
    console.log('  10. 结束页');
  })
  .catch((err) => {
    console.error('❌ PPT生成失败:', err);
    process.exit(1);
  });
