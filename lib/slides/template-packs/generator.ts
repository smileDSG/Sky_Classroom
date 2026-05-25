/**
 * 模板填充模式生成器 — 分步生成版（Split-Generation）
 *
 * 核心链路：
 * Step 1: LLM生成大纲（cover + toc + end）
 *   → 校验大纲质量（完整性 + 主题相关性）
 *   → 不合格则重试（最多2次）
 *
 * Step 2: LLM根据大纲生成正文（chapter + content_a + content_b + table）
 *   → 校验正文质量（主题相关性 + 目录一致性）
 *   → 不合格则重试（最多2次）
 *
 * Step 3: 合并JSON → Python填充引擎 → 返回PPTX
 *
 * 分步生成的优势：
 * - Step 2的LLM明确收到大纲JSON，不会偏离主题
 * - 每步输出量减少（Step1:~500 tokens, Step2:~1500 tokens），注意力更集中
 * - 约束紧挨着生成位置，不会被长输出稀释
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { ModelInfo } from '@/lib/types/provider';
import { getTemplatePackById } from './index';

const log = createLogger('TemplatePackGenerator');

/* ─── 学段难度指导语 ─── */
const DIFFICULTY_GUIDANCE: Record<string, string> = {
  '初中': `## 教学要求（初中）
- 侧重直观理解和生活实例，避免复杂公式推导
- 多用比喻和类比帮助学生建立直觉
- 每个核心概念必须配一个生活中的例子
- 公式只需记住结论，不要求推导过程
- 语言风格活泼、亲切，避免过于学术化`,

  '高中': `## 教学要求（高中）
- 侧重公式应用和典型例题
- 需要展示完整的解题步骤和思路
- 适度引入数学推导，但不要过于抽象
- 强调知识点的考试重点和常见题型
- 语言风格严谨但不失可读性`,

  '大学': `## 教学要求（大学）
- 侧重理论深度和数学建模
- 需要展示严谨的推导过程和证明
- 可以引入前沿应用和研究背景
- 强调知识体系的完整性和内在逻辑
- 语言风格学术化、专业化`,
};

/* ─── 主题黑名单 ─── */
const TOPIC_BLACKLIST: Record<string, string[]> = {
  '电路': ['Python', 'JavaScript', 'Fortran', '编程语言', '代码', '算法', 'Django', 'Flask', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch', 'Stack Overflow', 'TIOBE', '面向对象', '函数式编程', '机器语言', '汇编语言', '高级语言'],
  '数学': ['Python', 'JavaScript', '编程', '代码', 'Fortran', 'Django', 'Flask'],
  '语文': ['Python', 'JavaScript', '编程', '代码', '算法', 'Fortran', 'Django', 'Flask', 'Pandas'],
  '历史': ['Python', 'JavaScript', '编程', '代码', '算法', 'Fortran', 'Django', 'Flask'],
  '物理': ['Python', 'JavaScript', '编程', '代码', '算法', 'Fortran', 'Django', 'Flask', 'Pandas'],
  '化学': ['Python', 'JavaScript', '编程', '代码', '算法', 'Fortran', 'Django', 'Flask'],
  '生物': ['Python', 'JavaScript', '编程', '代码', '算法', 'Fortran', 'Django', 'Flask'],
  '英语': ['Python', 'JavaScript', '编程', '代码', '算法', 'Fortran', 'Django', 'Flask'],
  '地理': ['Python', 'JavaScript', '编程', '代码', '算法', 'Fortran', 'Django', 'Flask'],
  '政治': ['Python', 'JavaScript', '编程', '代码', '算法', 'Fortran', 'Django', 'Flask'],
};

function getBlacklist(topic: string): string[] {
  const lower = topic.toLowerCase();
  for (const [key, list] of Object.entries(TOPIC_BLACKLIST)) {
    if (lower.includes(key)) return list;
  }
  return ['Python', 'JavaScript', 'Fortran', '编程语言', 'Django', 'Flask', 'Pandas', 'NumPy'];
}

/* ─── 接口 ─── */
interface GenerateOptions {
  topic: string;
  difficulty?: string;
  templateId: string;
  languageModel: LanguageModel;
  modelInfo: ModelInfo | null | undefined;
}

interface GenerateResult {
  success: boolean;
  pptxUrl?: string;
  fileName?: string;
  error?: string;
  filledCount?: number;
  totalFields?: number;
}

interface OutlineResult {
  cover: Record<string, string>;
  toc: { title: string; items: Array<Record<string, string>> };
  end: Record<string, string>;
}

/* ─── 工具函数 ─── */
function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
}

/**
 * 尝试修复常见的 LLM JSON 格式错误
 */
function fixJsonText(text: string): string {
  let fixed = text.trim();
  // 移除尾部逗号
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  // 移除注释
  fixed = fixed.replace(/\/\/.*$/gm, '');
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
  // 修复单引号（简单替换，可能有误但不影响常见情况）
  fixed = fixed.replace(/'([^']*)':/g, '"$1":');
  fixed = fixed.replace(/: '([^']*)'/g, ': "$1"');
  // 移除控制字符
  fixed = fixed.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  return fixed;
}

/**
 * 从 topic 中提取核心关键词（英文/数字序列 + 中文序列）
 */
function extractTopicKeywords(topic: string): string[] {
  const keywords: string[] = [];
  // 提取连续的英文字母/数字序列（如 java, python3, C++ → java, python3, C）
  const englishMatches = topic.match(/[a-zA-Z0-9]+/g);
  if (englishMatches) {
    keywords.push(...englishMatches.map(m => m.toLowerCase()));
  }
  // 提取纯中文字符序列
  const chineseMatches = topic.match(/[\u4e00-\u9fa5]+/g);
  if (chineseMatches) {
    // 过滤掉太短的词（如"给我"、"一下"）和常见虚词
    const stopWords = new Set(['给我', '给我讲', '讲一下', '一下', '请问', '什么是', '什么是', '关于', '介绍', '讲解', '说明', '简述', '概述']);
    for (const m of chineseMatches) {
      if (m.length >= 2 && !stopWords.has(m)) {
        keywords.push(m);
      }
    }
  }
  return keywords.length > 0 ? keywords : [topic.toLowerCase()];
}

/* ─── Step 1: 生成大纲 ─── */
function buildOutlinePrompt(topic: string, difficulty: string): { system: string; user: string } {
  const difficultyGuide = DIFFICULTY_GUIDANCE[difficulty] ?? DIFFICULTY_GUIDANCE['高中'];

  const system = `你是一位资深教学内容设计师。请为以下主题设计一份教学课件的大纲。

## 核心约束（必须严格遵守，违反会导致内容不合格）
1. 你正在为一节关于"${topic}"的课程设计课件。
2. 所有内容必须 STRICTLY 围绕"${topic}"展开，绝对不允许偏离主题。
3. 严禁引入与"${topic}"无关的学科知识或概念。
4. 目录必须包含3个不同方面的章节，内容不要重叠。
5. 每个 toc item 必须有完整的 title（≤6字）和 desc（≤15字），严禁只写数字。
6. 每个 toc item 的 title 和 desc 中必须至少包含1个与"${topic}"直接相关的核心关键词（如主题词本身或该领域典型术语），严禁使用泛泛通用词。
7. 【反例警示】如果主题是"电路"，绝对不能写"编程语言、Python、Fortran、代码、算法"等计算机内容；应该写"电流、电压、电阻、欧姆定律、基尔霍夫定律、串联、并联"等电学内容。
8. 【反例警示】如果主题是"数学"，绝对不能写"Python编程、Web开发、数据分析"等内容；应该写"公式、定理、推导、例题、几何、函数"等数学内容。

## 输出格式
请 STRICTLY 只输出纯JSON，不要添加任何其他内容（不要markdown代码块，不要注释，不要有尾部逗号）：
{
  "cover": {
    "en_tag": "英文小标签，2-4个单词全大写（≤18个字母）",
    "title": "中文大标题，4-8个字（≤10个中文字）",
    "subtitle": "副标题，8-12个字（≤10个中文字，必须精炼）"
  },
  "toc": {
    "title": "目录",
    "items": [
      { "num": "01", "title": "章节标题≤6字", "desc": "描述≤15字" },
      { "num": "02", "title": "章节标题≤6字", "desc": "描述≤15字" },
      { "num": "03", "title": "章节标题≤6字", "desc": "描述≤15字" }
    ]
  },
  "end": {
    "end_en": "英文标语，2-4个单词全大写",
    "slogan": "结束大标语6-10字",
    "subtitle": "副标语15-25字"
  }
}`;

  const user = `主题：${topic}
学段：${difficulty}

${difficultyGuide}

请设计3个章节，覆盖"${topic}"的3个不同方面。确保每个章节都有明确的 title 和 desc，不要只写数字。`;

  return { system, user };
}

async function generateOutline(
  topic: string,
  difficulty: string,
  languageModel: LanguageModel,
  modelInfo: ModelInfo | null | undefined,
): Promise<OutlineResult> {
  const { system, user } = buildOutlinePrompt(topic, difficulty);

  const llmResult = await callLLM(
    { model: languageModel, system, prompt: user, maxOutputTokens: 1024 },
    'sky-slides-outline',
    { retries: 1, validate: (text) => text.trim().length > 100 && text.includes('{') },
  );

  // 调试日志：记录LLM原始输出
  try {
    const debugPath = path.resolve(process.cwd(), 'logs', `llm-debug-${Date.now()}-outline-raw.txt`);
    await fs.mkdir(path.dirname(debugPath), { recursive: true });
    await fs.writeFile(debugPath, `TOPIC: ${topic}\nDIFFICULTY: ${difficulty}\nLENGTH: ${llmResult.text.length}\n\n--- RAW OUTPUT ---\n${llmResult.text}\n\n--- END ---`, 'utf-8');
  } catch { /* ignore debug write errors */ }

  const jsonText = cleanJsonText(llmResult.text);

  // 尝试解析 JSON，失败则自动修复常见格式错误
  try {
    return JSON.parse(jsonText) as OutlineResult;
  } catch (parseErr) {
    log.warn(`Outline JSON parse failed, attempting auto-fix: ${parseErr}`);
    const fixedText = fixJsonText(jsonText);
    try {
      return JSON.parse(fixedText) as OutlineResult;
    } catch {
      log.error(`Outline JSON auto-fix also failed, falling back to manual extraction`);
      // 降级：从自由文本中提取关键字段手动构造 outline
      return extractOutlineFromText(llmResult.text, topic);
    }
  }
}

/**
 * 从 LLM 自由文本输出中提取 outline 结构（降级处理）
 */
function extractOutlineFromText(text: string, topic: string): OutlineResult {
  const t = text.toLowerCase();

  // 尝试提取 cover 信息
  const titleMatch = text.match(/["']?title["']?\s*[:：]\s*["']?([^"'\n]{2,20})["']?/i);
  const subtitleMatch = text.match(/["']?subtitle["']?\s*[:：]\s*["']?([^"'\n]{2,30})["']?/i);
  const enTagMatch = text.match(/["']?en_tag["']?\s*[:：]\s*["']?([A-Z\s]{2,18})["']?/i);

  // 尝试提取 toc items
  const items: { num: string; title: string; desc: string }[] = [];
  const itemMatches = text.matchAll(/(?:\{|\n)\s*["']?num["']?\s*[:：]\s*["']?(\d{2})["']?[^}]*?["']?title["']?\s*[:：]\s*["']?([^"'\n,]{2,12})["']?[^}]*?["']?desc["']?\s*[:：]\s*["']?([^"'\n,]{2,20})["']?/gi);
  for (const m of itemMatches) {
    items.push({ num: m[1], title: m[2].trim(), desc: m[3].trim() });
  }

  // 如果正则提取不到，尝试更宽松的模式
  if (items.length < 3) {
    // 过滤掉 cover/end 的字段名，避免被误识别为目录项
    const reservedFields = new Set(['en_tag', 'title', 'subtitle', 'slogan', 'end_en', 'cover', 'end', 'toc', 'items']);
    const looseMatches = text.matchAll(/(?:第?\s*(\d)[\.、\s:]*)?\s*["']?([^"'\n,]{2,12})["']?\s*[-—:]\s*["']?([^"'\n,]{2,20})["']?/gi);
    for (const m of looseMatches) {
      if (items.length >= 3) break;
      const title = m[2].trim();
      const desc = m[3].trim();
      // 必须包含至少1个中文字符（真正的章节标题都是中文），且不能是保留字段名
      const hasChinese = /[\u4e00-\u9fa5]/.test(title);
      if (title.length >= 2 && desc.length >= 2 && hasChinese && !reservedFields.has(title.toLowerCase()) && !items.some(i => i.title === title)) {
        items.push({ num: String(items.length + 1).padStart(2, '0'), title, desc });
      }
    }
  }

  // 确保有3个 items
  while (items.length < 3) {
    const idx = items.length + 1;
    items.push({
      num: String(idx).padStart(2, '0'),
      title: `${topic}基础${idx}`,
      desc: `第${idx}部分学习内容`,
    });
  }

  // 提取 end 信息
  const endSloganMatch = text.match(/["']?slogan["']?\s*[:：]\s*["']?([^"'\n]{2,15})["']?/i);
  const endSubMatch = text.match(/["']?subtitle["']?\s*[:：]\s*["']?([^"'\n]{5,30})["']?/gi);
  const endEnMatch = text.match(/["']?end_en["']?\s*[:：]\s*["']?([A-Z\s]{2,18})["']?/i);

  return {
    cover: {
      title: (titleMatch?.[1] ?? `${topic}教学`).trim().substring(0, 10),
      subtitle: (subtitleMatch?.[1] ?? `掌握${topic}核心知识`).trim().substring(0, 12),
      en_tag: (enTagMatch?.[1] ?? 'LEARNING').trim().substring(0, 18),
    },
    toc: {
      title: '目录',
      items: items.slice(0, 3),
    },
    end: {
      slogan: (endSloganMatch?.[1] ?? '学以致用').trim().substring(0, 12),
      subtitle: (endSubMatch?.[1] ?? `探索${topic}的奥秘`).trim().substring(0, 25),
      end_en: (endEnMatch?.[1] ?? 'KEEP LEARNING').trim().substring(0, 18),
    },
  };
}

/* ─── Step 2: 根据大纲生成正文 ─── */
function buildContentPrompt(
  topic: string,
  difficulty: string,
  templateId: string,
  outline: OutlineResult,
  previousError?: string,
): { system: string; user: string } {
  const difficultyGuide = DIFFICULTY_GUIDANCE[difficulty] ?? DIFFICULTY_GUIDANCE['高中'];
  const tocTitles = outline.toc.items.map(i => i.title).filter(Boolean);

  // 获取模板容量信息，动态调整cards数量和表格行列
  const templateMeta = getTemplatePackById(templateId);
  const contentACardCount = templateMeta?.capacity.contentACards ?? 3;
  const contentBCardCount = templateMeta?.capacity.contentBCards ?? 2;
  const tableCols = templateMeta?.capacity.tableCols ?? 4;
  const tableRows = templateMeta?.capacity.tableRows ?? 4;

  // 完全自由的prompt —— 不给任何结构化模板，让LLM无法套用固定内容
  const system = `你是一位${difficulty}学科教师，正在备课。你善于将抽象的学科知识转化为学生容易理解的教学内容。`;

  let user = `请为"${topic}"（${difficulty}）这节课设计3页课件内容。

## 教学大纲
${outline.toc.items.map((item, i) => `${i + 1}. ${item.title} — ${item.desc}`).join('\n')}

${difficultyGuide}

## 设计要求
请为以下3个页面分别写出具体的教学内容。每个页面都要紧扣"${topic}"主题，写出真实的学科知识。
【强制约束】每个页面的标题、概念名称、案例名称、表格表头中必须至少出现1次"${topic}"的核心关键词（如主题词本身或该领域专有术语）。严禁使用泛泛的通用词汇（如"存储单元""运算规则""执行流程"）来替代具体的学科内容。

### 第1页：概念讲解页（${tocTitles[0]}）
- 页面标题必须包含"${tocTitles[0]}"的关键词，如"${tocTitles[0]}核心概念"或"${tocTitles[0]}基础"
- 请写出${contentACardCount}个核心概念，格式如下：
${Array.from({ length: contentACardCount }, (_, i) => `  概念${i + 1}名称：（8字以内，必须是${topic}相关的具体术语，如"电流定义""电压概念"等，禁止写"定义""分类""发展历程"）  解释：（80字以内）`).join('\n')}
- 本页总结：（100字以内，不要重复上述概念的标题和解释内容，从宏观联系、实际意义或启发思考的角度提炼）

### 第2页：例题/应用页（${tocTitles[1]}）
- 页面标题必须包含"${tocTitles[1]}"的关键词，如"${tocTitles[1]}典型例题"或"${tocTitles[1]}应用"
- 请写出${contentBCardCount}个典型案例或例题：
${Array.from({ length: contentBCardCount }, (_, i) => `  案例${i + 1}名称：（必须是${topic}相关案例，如"串联计算""并联分流"等，禁止写"简洁优雅""应用广泛""生态丰富""社区活跃"）  详细描述：（80字以内）`).join('\n')}
- 重点分析段落：（200字以内）
- 关键句提炼：（30字以内）
- 本页总结：（80字以内）

### 第3页：数据对比页（${tocTitles[2]}）
- 页面标题必须包含"${tocTitles[2]}"的关键词，如"${tocTitles[2]}对比"或"${tocTitles[2]}数据"
- 请设计一个对比表格：
  表格标题：（15字以内）
  ${Array.from({ length: tableCols }, (_, i) => `表头${i + 1}`).join('、')}（共${tableCols}列，必须是${topic}相关参数，如"电阻值""电压"等，禁止写泛泛的通用词如"语言""流行度""易学度""薪资水平"）
  ${Array.from({ length: tableRows }, (_, i) => `行${i + 1}数据`).join(' | ')}（用竖线"|"分隔各列，即使单元格内有逗号也不要用逗号分隔列）
- 表格总结：（80字以内）

## 章节过渡页
章节编号：01
章节英文：CHAPTER ONE
章节标题：（15字以内，与第1页主题相关）
章节副标题：（20字以内）

## 重要规则
- 第1、2、3页的标题必须互不相同
- 每个标题必须包含对应章节的关键词
- 禁止出现任何编程语言名称
- 禁止出现"编程""代码""开发""软件"等计算机术语
- 输出中禁止出现markdown格式符号（如**、*、- 等），直接输出纯文本

## 输出格式（必须严格遵循）
- 每个概念必须写成：概念N\n名称：XXX\n解释：XXX
- 每个案例必须写成：案例N\n名称：XXX\n详细描述：XXX
- 表格必须写成：表头：A、B、C、D\n行1：a1、b1、c1、d1
- 禁止使用"- "列表、"**"加粗、"###"标题等markdown符号
- 直接输出纯文本，不要用代码块包裹

## 重要规则
- 第1、2、3页的标题必须互不相同
- 每个标题必须包含对应章节的关键词
- 禁止出现任何编程语言名称
- 禁止出现"编程""代码""开发""软件"等计算机术语`;

  if (previousError) {
    user += `\n\n## 上次的问题（本次必须避免）\n${previousError}`;
  }

  return { system, user };
}

/**
 * 从自由文本中解析教学内容
 */
function parseFreeTextOutput(text: string, templateId: string): Record<string, unknown> {
  // 清理markdown符号
  const cleanMd = (s: string): string => s
    .replace(/\*\*/g, '')
    .replace(/(?<!\*)\*(?!\*)/g, '')
    .replace(/^\s*[-•]\s*/gm, '')
    .trim();

  const t = cleanMd(text);

  // 获取模板容量
  const templateMeta = getTemplatePackById(templateId);
  const maxACards = templateMeta?.capacity.contentACards ?? 3;
  const maxBCards = templateMeta?.capacity.contentBCards ?? 2;

  // 辅助函数：在指定文本中提取标签后的内容
  const extractIn = (source: string, label: string, fallback = ''): string => {
    const patterns = [
      new RegExp(`${label}[:：]\\s*(.+?)(?=\\n[##\\s]|\\n(?:概念|案例|章节|表格|重点|关键|总结|名称|行\\d|表头)|$)`, 'i'),
      new RegExp(`${label}[:：]\\s*(.+?)(?=\\n|$)`, 'im'),
    ];
    for (const p of patterns) {
      const m = source.match(p);
      if (m) return cleanMd(m[1]);
    }
    return fallback;
  };

  // 辅助函数：在整个文本中提取
  const extract = (label: string, fallback = ''): string => extractIn(t, label, fallback);

  // 提取章节
  const chapter = {
    num: '01',
    en: 'CHAPTER ONE',
    title: extract('章节标题', '核心概念').substring(0, 15),
    subtitle: extract('章节副标题', '').substring(0, 25),
  };

  // 提取概念页（匹配 LLM 实际输出格式：第1页：XXX）
  const pageABlock = t.match(/(?:第1页[：:]|### 第1页[：:])[^]*?(?=第2页[：:]|### 第2页|$)/i)?.[0] || t;
  // 标题优先从 page block 的第一行提取，如 "第1页：轩阁今昔核心概念"
  const pageATitleMatch = pageABlock.match(/第1页[：:]\s*(.+?)(?=\n|$)/i);
  const pageATitle = pageATitleMatch ? cleanMd(pageATitleMatch[1]) : extractIn(pageABlock, '标题');

  // 辅助：截断到第一个空行，防止dotAll正则跨段落匹配
  const firstParagraph = (s: string): string => s.split(/\n\s*\n/)[0].trim();

  // ─── 多轮提取：概念 ───
  const cards: Array<{ title: string; desc: string }> = [];
  
  // 第1轮：严格格式（概念X + 名称 + 解释）
  const conceptStrict = pageABlock.matchAll(/(?:概念\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:解释|描述|说明)[：:]\s*(.+?)\s*(?=(?:概念\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称|\n\s*本页总结|\n\s*重点分析段落|\n\s*关键句提炼|\n\s*章节)|$)/gi);
  for (const m of conceptStrict) {
    cards.push({ title: cleanMd(m[2]).substring(0, 10), desc: firstParagraph(cleanMd(m[3])).substring(0, 80) });
  }
  
  // 第2轮：数字/列表 + 冒号格式（如 "1. 倾听技巧：描述" 或 "- 倾听技巧：描述"）
  if (cards.length < maxACards) {
    const listMatches = pageABlock.matchAll(/(?:^|\n)\s*(?:\d+[.．、]|[-•])\s*(.+?)[：:]\s*(.+?)(?=\n\s*(?:\d+[.．、]|[-•])|\n\s*\n|$)/gi);
    for (const m of listMatches) {
      if (cards.length >= maxACards) break;
      const title = cleanMd(m[1]).substring(0, 10);
      const desc = firstParagraph(cleanMd(m[2])).substring(0, 80);
      // 去重
      if (!cards.some(c => c.title === title)) {
        cards.push({ title, desc });
      }
    }
  }
  
  // 第3轮：宽松键值对（过滤掉纯标签如"名称""解释"等）
  if (cards.length < maxACards) {
    const kvMatches = pageABlock.matchAll(/(?:^|\n)\s*(.+?)[：:]\s*(.+?)(?=\n\s*\n|$)/gi);
    for (const m of kvMatches) {
      if (cards.length >= maxACards) break;
      const k = cleanMd(m[1]).trim();
      const v = cleanMd(m[2]).trim();
      // 过滤标签和过短/过长的key
      if (k.length >= 2 && k.length <= 12 && v.length > 10 && !/(本页|重点|关键|章节|表格)?(总结|分析|提炼|标题|副标题)|^(概念|案例|详细)?(名称|解释|描述|说明|标题|总结|分析)$/.test(k)) {
        if (!cards.some(c => c.title === k)) {
          cards.push({ title: k.substring(0, 10), desc: firstParagraph(v).substring(0, 80) });
        }
      }
    }
  }

  // 确保有足够的cards（用fallback填充不足的）
  const fallbackCards = [
    { title: '核心概念一', desc: '本知识模块的第一个核心概念及其基本内涵。' },
    { title: '核心概念二', desc: '本知识模块的第二个核心概念及其主要特征。' },
    { title: '核心概念三', desc: '本知识模块的第三个核心概念及其应用场景。' },
    { title: '核心概念四', desc: '本知识模块的第四个核心概念及其延伸拓展。' },
    { title: '核心概念五', desc: '本知识模块的第五个核心概念及其综合运用。' },
    { title: '核心概念六', desc: '本知识模块的第六个核心概念及其深化理解。' },
  ];
  while (cards.length < maxACards) {
    cards.push(fallbackCards[cards.length]);
  }

  // bullet_text 优先使用 LLM 的本页总结（避免与 cards 重复），fallback 到 cards 拼接
  const pageASummary = extractIn(pageABlock, '本页总结').substring(0, 300);
  const bulletText = pageASummary || cards.slice(0, maxACards).map(c => `${c.title}\n${c.desc}`).join('\n\n');

  const cardsList = cards.slice(0, maxACards);

  const contentA = {
    tag: 'CONCEPT',
    title: (pageATitle || '核心概念').substring(0, 15),
    cards: cardsList,
    cards_desc_text: cardsList.map(c => `${c.title}\n${c.desc}`).join('\n\n'),
    bullet_title: extractIn(pageABlock, '本页总结').substring(0, 100) || '核心要点',
    bullet_text: bulletText,
    summary: extractIn(pageABlock, '本页总结').substring(0, 100),
  };

  // 提取案例页（匹配 LLM 实际输出格式：第2页：XXX）
  const pageBBlock = t.match(/(?:第2页[：:]|### 第2页[：:])[^]*?(?=第3页[：:]|### 第3页|$)/i)?.[0] || t;
  // 标题优先从 page block 的第一行提取
  const pageBTitleMatch = pageBBlock.match(/第2页[：:]\s*(.+?)(?=\n|$)/i);
  const pageBTitle = pageBTitleMatch ? cleanMd(pageBTitleMatch[1]) : extractIn(pageBBlock, '标题');

  // ─── 多轮提取：案例 ───
  const bCards: Array<{ title: string; desc: string }> = [];
  
  // 第1轮：严格格式（案例X + 名称 + 详细描述）
  const caseStrict = pageBBlock.matchAll(/(?:案例\s*(\d+)|(?:^|\n)\s*(?:[-•]\s*)?)\s*名称[：:]\s*(.+?)\s*(?:详细)?描述[：:]\s*(.+?)\s*(?=(?:案例\s*\d+|(?:^|\n)\s*(?:[-•]\s*)?\s*名称|\n\s*本页总结|\n\s*重点分析段落|\n\s*关键句提炼|\n\s*章节)|$)/gi);
  for (const m of caseStrict) {
    bCards.push({ title: cleanMd(m[2]).substring(0, 12), desc: firstParagraph(cleanMd(m[3])).substring(0, 100) });
  }
  
  // 第2轮：数字/列表 + 冒号格式
  if (bCards.length < maxBCards) {
    const listMatches = pageBBlock.matchAll(/(?:^|\n)\s*(?:\d+[.．、]|[-•])\s*(.+?)[：:]\s*(.+?)(?=\n\s*(?:\d+[.．、]|[-•])|\n\s*\n|$)/gi);
    for (const m of listMatches) {
      if (bCards.length >= maxBCards) break;
      const title = cleanMd(m[1]).substring(0, 12);
      const desc = firstParagraph(cleanMd(m[2])).substring(0, 100);
      if (!bCards.some(c => c.title === title)) {
        bCards.push({ title, desc });
      }
    }
  }
  
  // 第3轮：宽松键值对（过滤标签）
  if (bCards.length < maxBCards) {
    const kvMatches = pageBBlock.matchAll(/(?:^|\n)\s*(.+?)[：:]\s*(.+?)(?=\n\s*\n|$)/gi);
    for (const m of kvMatches) {
      if (bCards.length >= maxBCards) break;
      const k = cleanMd(m[1]).trim();
      const v = cleanMd(m[2]).trim();
      if (k.length >= 2 && k.length <= 15 && v.length > 10 && !/(本页|重点|关键|章节|表格)?(总结|分析|提炼|标题|副标题)|^(概念|案例|详细)?(名称|解释|描述|说明|标题|总结|分析|提炼)$/.test(k)) {
        if (!bCards.some(c => c.title === k)) {
          bCards.push({ title: k.substring(0, 12), desc: firstParagraph(v).substring(0, 100) });
        }
      }
    }
  }

  // 确保有足够的bcards
  const bFallbackCards = [
    { title: '典型案例一', desc: '本知识模块的第一个典型案例及其详细分析。' },
    { title: '典型案例二', desc: '本知识模块的第二个典型案例及其解题思路。' },
    { title: '典型案例三', desc: '本知识模块的第三个典型案例及其应用场景。' },
    { title: '典型案例四', desc: '本知识模块的第四个典型案例及其综合运用。' },
    { title: '典型案例五', desc: '本知识模块的第五个典型案例及其深化拓展。' },
    { title: '典型案例六', desc: '本知识模块的第六个典型案例及其变式训练。' },
  ];
  while (bCards.length < maxBCards) {
    bCards.push(bFallbackCards[bCards.length]);
  }

  // 构建features多段落文本
  const featuresText = bCards.slice(0, maxBCards).map(c => `${c.title}\n${c.desc}`).join('\n\n');
  const analysisBody = extractIn(pageBBlock, '重点分析段落').substring(0, 200) || '详细分析本节课的核心知识点和应用技巧。';
  const highlightText = extractIn(pageBBlock, '关键句提炼').substring(0, 30) || '理论联系实际';

  const bCardsList = bCards.slice(0, maxBCards);

  // 构建多段落 features_text：无 cards 时（如 cartoon）用 关键句+分析+总结 组合多段
  let combinedText = featuresText;
  if (!combinedText && maxBCards === 0) {
    const summary = extractIn(pageBBlock, '本页总结').substring(0, 80) || '';
    const parts = [highlightText, analysisBody];
    if (summary && !analysisBody.includes(summary)) {
      parts.push(summary);
    }
    combinedText = parts.join('\n\n');
  } else if (!combinedText) {
    combinedText = `${highlightText}\n\n${analysisBody}`;
  }
  // 截断到 200 字，优先保留完整段落（\n\n 分隔处）
  let ft = combinedText;
  if (ft.length > 200) {
    ft = ft.substring(0, 200);
    const lastBreak = ft.lastIndexOf('\n\n');
    if (lastBreak > 120) ft = ft.substring(0, lastBreak);
  }
  // applications_list 同样截断，避免过长导致字体缩放过小
  let appList = analysisBody;
  if (appList.length > 200) {
    appList = appList.substring(0, 200);
    const lastBreak = appList.lastIndexOf('\n\n');
    if (lastBreak > 120) appList = appList.substring(0, lastBreak);
  }

  const contentB = {
    tag: 'EXAMPLE',
    title: (pageBTitle || '典型应用').substring(0, 15),
    cards: bCardsList,
    cards_desc_text: bCardsList.map(c => `${c.title}\n${c.desc}`).join('\n\n'),
    features_text: ft,
    applications_title: (highlightText || '重点分析').substring(0, 10),
    applications_list: appList,
    bullet_text: (() => {
      const s = extractIn(pageBBlock, '本页总结').substring(0, 200);
      return s.length >= 60 ? s : analysisBody.substring(0, 150);
    })(),
    featured: {
      body: analysisBody,
      highlight: highlightText,
    },
    summary: extractIn(pageBBlock, '本页总结').substring(0, 80),
  };

  // 提取表格页（匹配 LLM 实际输出格式：第3页：XXX）
  const pageCBlock = t.match(/(?:第3页[：:]|### 第3页[：:])[^]*?(?=第4页[：:]|### 第4页|## 章节|$)/i)?.[0] || t;
  // 表格标题优先从 page block 第一行提取，否则 fallback 到 "表格标题"
  const pageCTitleMatch = pageCBlock.match(/第3页[：:]\s*(.+?)(?=\n|$)/i);
  const tableTitle = pageCTitleMatch ? cleanMd(pageCTitleMatch[1]) : extractIn(pageCBlock, '表格标题');

  const headers: string[] = [];
  const headerMatch = pageCBlock.match(/表头[：:]\s*(.+?)(?=\n|$)/i);
  if (headerMatch) {
    headers.push(...headerMatch[1].split(/[,，、|]/).map(h => h.trim()).filter(Boolean));
  }

  const rows: string[][] = [];
  const rowMatches = pageCBlock.matchAll(/(?:^|\n)\s*(?:[-•]\s*)?(?:行\s*\d+\s*)?[：:]?\s*(.+?)(?=\n|$)/gi);
  for (const m of rowMatches) {
    const line = m[1].trim();
    // 优先用竖线"|"分隔（避免单元格内逗号被误切）
    let cols: string[];
    if (line.includes('|')) {
      cols = line.split('|').map(c => c.trim()).filter(Boolean);
    } else {
      cols = line.split(/[,，、]/).map(c => c.trim()).filter(Boolean);
    }
    if (cols.length >= 2 && cols.length <= 6 && !cols[0].startsWith('表头') && !cols[0].startsWith('表格总结') && !cols[0].startsWith('章节')) rows.push(cols);
  }

  const tableSummary = extractIn(pageCBlock, '表格总结').substring(0, 80);

  // 使用模板 capacity 动态限制表格行列，避免硬编码 4x4
  const tableCapacity = getTemplatePackById(templateId)?.capacity;
  const maxTableCols = tableCapacity?.tableCols ?? 4;
  const maxTableRows = tableCapacity?.tableRows ?? 4;

  const table = {
    tag: 'DATA',
    title: (tableTitle || '数据对比').substring(0, 15),
    headers: headers.length >= 2 ? headers.slice(0, maxTableCols) : Array.from({ length: maxTableCols }, (_, i) => `参数${i + 1}`),
    rows: rows.length > 0 ? rows.slice(0, maxTableRows).map(r => r.slice(0, maxTableCols)) : Array.from({ length: maxTableRows }, () => Array.from({ length: maxTableCols }, (_, i) => `数据${i + 1}`)),
    source: tableSummary || '数据来源于教材和实验测量',
    summary: tableSummary,
  };

  return { chapter, content_a: contentA, content_b: contentB, table };
}

async function generateContentFromOutline(
  topic: string,
  difficulty: string,
  templateId: string,
  outline: OutlineResult,
  languageModel: LanguageModel,
  modelInfo: ModelInfo | null | undefined,
  previousError?: string,
): Promise<Record<string, unknown>> {
  const { system, user } = buildContentPrompt(topic, difficulty, templateId, outline, previousError);

  const llmResult = await callLLM(
    {
      model: languageModel,
      system,
      prompt: user,
      maxOutputTokens: modelInfo?.outputWindow ?? 12288,
      temperature: 0.7,
      seed: Math.floor(Math.random() * 1000000),
    },
    'sky-slides-content',
    { retries: 1, validate: (text) => text.trim().length > 800 },
  );

  // 调试日志：记录LLM原始输出（异步，不阻塞）
  try {
    const debugPath = path.resolve(process.cwd(), 'logs', `llm-debug-${Date.now()}.txt`);
    fs.mkdir(path.dirname(debugPath), { recursive: true })
      .then(() => fs.writeFile(debugPath, `TOPIC: ${topic}\nTEMPLATE: ${templateId}\nLENGTH: ${llmResult.text.length}\n\n--- RAW OUTPUT ---\n${llmResult.text}\n\n--- END ---`, 'utf-8'))
      .catch(() => { /* ignore */ });
  } catch { /* ignore debug write errors */ }

  // 解析自由文本输出
  try {
    return parseFreeTextOutput(llmResult.text, templateId);
  } catch {
    // 回退到JSON解析
    const jsonText = cleanJsonText(llmResult.text);
    return JSON.parse(jsonText) as Record<string, unknown>;
  }
}

/* ─── 校验层 ─── */

/**
 * 计算主题相关性分数 (0-1)
 * 使用多策略：直接匹配 + 字符组合匹配 + 语义近似
 */
function computeTopicRelevance(allText: string, topic: string): number {
  const text = allText.toLowerCase();
  const keywords = extractTopicKeywords(topic);

  let score = 0;
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();

    // 策略1：完整关键词直接出现（权重最高）
    const fullMatches = (text.match(new RegExp(kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    score += Math.min(fullMatches * 0.15, 0.45);

    // 策略2：单字匹配（中文每个字或英文每个字母）
    const chars = kwLower.split('').filter(c => /[\u4e00-\u9fa5a-z0-9]/.test(c));
    const charMatches = chars.filter(c => text.includes(c)).length;
    score += (charMatches / Math.max(chars.length, 1)) * 0.15;

    // 策略3：2-gram 匹配（仅中文）
    const bigrams: string[] = [];
    for (let i = 0; i < kwLower.length - 1; i++) {
      const bg = kwLower.substring(i, i + 2);
      if (bg.length === 2 && /[\u4e00-\u9fa5]/.test(bg[0])) bigrams.push(bg);
    }
    if (bigrams.length > 0) {
      const bgMatches = bigrams.filter(bg => text.includes(bg)).length;
      score += (bgMatches / bigrams.length) * 0.10;
    }
  }

  return Math.min(score, 1.0);
}

function validateOutline(outline: OutlineResult, topic: string): { valid: boolean; reason?: string } {
  const issues: string[] = [];

  // 1. 检查 toc item 完整性
  if (!outline.toc || !Array.isArray(outline.toc.items)) {
    return { valid: false, reason: '目录结构缺失' };
  }

  for (const item of outline.toc.items) {
    const title = item.title?.trim() ?? '';
    const desc = item.desc?.trim() ?? '';
    if (title.length < 2) issues.push(`目录第${item.num}项标题过短`);
    if (!/[\u4e00-\u9fa5]/.test(title)) issues.push(`目录第${item.num}项标题"${title}"不是中文`);
    if (desc.length < 2 || /^\d+$/.test(desc)) issues.push(`目录第${item.num}项描述无效`);
  }

  if (outline.toc.items.length < 3) {
    issues.push('目录章节数不足3个');
  }

  // 2. 主题相关性（使用新评分）
  const allText = JSON.stringify(outline);
  const relevance = computeTopicRelevance(allText, topic);
  if (relevance < 0.25) {
    issues.push(`主题相关性过低 (${(relevance * 100).toFixed(0)}%)`);
  }

  // 3. 黑名单检查（容忍度：至少2个命中才报错）
  const blacklist = getBlacklist(topic);
  const found: string[] = [];
  for (const term of blacklist) {
    if (allText.includes(term)) found.push(term);
  }
  if (found.length >= 3) {
    issues.push(`包含无关内容: ${found.slice(0, 5).join(', ')}`);
  }

  if (issues.length > 0) {
    return { valid: false, reason: issues.join('; ') };
  }
  return { valid: true };
}

function validateContentRelevance(contentJson: Record<string, unknown>, topic: string): { valid: boolean; reason?: string } {
  const allText = JSON.stringify(contentJson);

  // 使用新的相关性评分
  const relevance = computeTopicRelevance(allText, topic);
  if (relevance < 0.15) {
    return { valid: false, reason: `主题相关性过低 (${(relevance * 100).toFixed(0)}%)` };
  }

  // 黑名单（容忍度：3个命中才报错，避免误判）
  const blacklist = getBlacklist(topic);
  const found: string[] = [];
  for (const term of blacklist) {
    if (allText.includes(term)) found.push(term);
  }
  if (found.length >= 3) {
    return { valid: false, reason: `包含无关内容: ${found.slice(0, 5).join(', ')}` };
  }

  return { valid: true };
}

/**
 * 检查两个标题是否语义相关（宽松匹配）
 */
function titlesAreRelated(tocTitle: string, contentTitle: string): boolean {
  const t = tocTitle.toLowerCase();
  const c = contentTitle.toLowerCase();

  // 直接包含关系
  if (t.includes(c) || c.includes(t)) return true;

  // 共享至少一个2字以上关键词
  const tocWords = t.split(/\s+|，|、|的|与|和/).filter(w => w.length >= 2);
  const contentWords = c.split(/\s+|，|、|的|与|和/).filter(w => w.length >= 2);
  const hasOverlap = tocWords.some(w => c.includes(w)) || contentWords.some(w => t.includes(w));
  if (hasOverlap) return true;

  // 共享至少一个单字（中文）
  const tocChars = t.split('').filter(ch => /[\u4e00-\u9fa5]/.test(ch));
  const contentChars = c.split('').filter(ch => /[\u4e00-\u9fa5]/.test(ch));
  const sharedChars = tocChars.filter(ch => contentChars.includes(ch));
  if (sharedChars.length >= 2) return true;

  // 特殊：如果toc标题很短（2-3字），允许内容标题以这些字开头
  if (t.length <= 3 && (c.startsWith(t) || c.includes(t))) return true;

  return false;
}

function validateTocConsistency(
  outline: OutlineResult,
  contentJson: Record<string, unknown>,
): { valid: boolean; reason?: string } {
  const issues: string[] = [];

  // 过滤掉明显不是中文章节标题的目录项（如残留的字段名）
  const tocTitles = outline.toc.items
    .map(i => i.title?.trim() ?? '')
    .filter(t => t.length >= 2 && /[\u4e00-\u9fa5]/.test(t));
  const contentA = contentJson.content_a as Record<string, unknown> | undefined;
  const contentB = contentJson.content_b as Record<string, unknown> | undefined;
  const table = contentJson.table as Record<string, unknown> | undefined;

  const contentTitles = [
    contentA?.title as string | undefined,
    contentB?.title as string | undefined,
    table?.title as string | undefined,
  ].filter(Boolean) as string[];

  // 目录项不足时放宽检查
  if (tocTitles.length === 0) {
    return { valid: true };
  }

  // 检查内容页标题和目录的对应关系（极宽松匹配）
  for (let i = 0; i < Math.min(tocTitles.length, contentTitles.length); i++) {
    const tocTitle = tocTitles[i];
    const contentTitle = contentTitles[i];
    if (!tocTitle || !contentTitle) continue;

    // 只要共享至少一个中文字符，或contentTitle包含通用教学词汇，就认为是相关的
    const tocChars = tocTitle.split('').filter(c => /[\u4e00-\u9fa5]/.test(c));
    const contentChars = contentTitle.split('').filter(c => /[\u4e00-\u9fa5]/.test(c));
    const sharedChars = tocChars.filter(c => contentChars.includes(c));

    // 通用教学词汇
    const eduWords = ['概念', '定义', '原理', '定律', '公式', '例题', '应用', '分析', '对比', '数据', '计算', '方法'];
    const hasEduWord = eduWords.some(w => contentTitle.includes(w));

    if (sharedChars.length === 0 && !hasEduWord) {
      issues.push(`内容页标题"${contentTitle}"与目录项"${tocTitle}"不对应`);
    }
  }

  // 检查 content_a 和 content_b 标题是否重复（严格检查）
  const titleA = (contentA?.title as string)?.trim();
  const titleB = (contentB?.title as string)?.trim();
  if (titleA && titleB && titleA === titleB) {
    issues.push(`content_a 和 content_b 的标题不能重复 (titleA="${titleA}", titleB="${titleB}")`);
  }

  if (issues.length > 0) {
    return { valid: false, reason: issues.join('; ') };
  }
  return { valid: true };
}

/**
 * 记录验证失败的详细调试信息到日志文件
 */
async function writeValidationDebugLog(
  topic: string,
  templateId: string,
  stage: 'outline' | 'content',
  attempt: number,
  reason: string,
  data: {
    outline?: OutlineResult;
    content?: Record<string, unknown>;
    relevance?: number;
    blacklistHits?: string[];
  },
): Promise<void> {
  try {
    const debugPath = path.resolve(process.cwd(), 'logs', `llm-debug-${Date.now()}-validation-fail.txt`);
    await fs.mkdir(path.dirname(debugPath), { recursive: true });

    const lines: string[] = [
      `=== VALIDATION FAILURE ===`,
      `Topic: ${topic}`,
      `Template: ${templateId}`,
      `Stage: ${stage}`,
      `Attempt: ${attempt}`,
      `Reason: ${reason}`,
      '',
    ];

    if (data.relevance !== undefined) {
      lines.push(`Relevance Score: ${(data.relevance * 100).toFixed(1)}%`);
    }
    if (data.blacklistHits && data.blacklistHits.length > 0) {
      lines.push(`Blacklist Hits: ${data.blacklistHits.join(', ')}`);
    }

    if (data.outline) {
      lines.push('', '--- OUTLINE ---', JSON.stringify(data.outline, null, 2));
    }
    if (data.content) {
      lines.push('', '--- CONTENT ---', JSON.stringify(data.content, null, 2));
    }

    lines.push('', '=== END ===');
    await fs.writeFile(debugPath, lines.join('\n'), 'utf-8');
  } catch {
    // ignore debug write errors
  }
}

/* ─── Python填充引擎 ─── */
function callPythonFiller(templateId: string, contentJson: object, outputPath: string): Promise<{
  success: boolean;
  filledCount?: number;
  totalFields?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const contentStr = JSON.stringify(contentJson);
    const scriptPath = path.resolve(process.cwd(), 'lib/slides/template-filler/cli.py');

    const proc = spawn('python', [
      scriptPath,
      '--template-id', templateId,
      '--content-json', contentStr,
      '--output', outputPath,
      '--number-style', getTemplatePackById(templateId)?.features.numberStyle ?? 'arabic',
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        log.error(`Python filler failed: ${stderr}`);
        resolve({ success: false, error: stderr || 'Python process exited with code ' + code });
        return;
      }

      try {
        const result = JSON.parse(stdout.trim());
        resolve({
          success: result.success,
          filledCount: result.filled,
          totalFields: result.total_fields,
          error: result.error,
        });
      } catch {
        resolve({ success: false, error: 'Invalid JSON from python filler: ' + stdout });
      }
    });

    proc.on('error', (err) => {
      log.error(`Failed to spawn python: ${err.message}`);
      resolve({ success: false, error: err.message });
    });
  });
}

/* ─── 主入口 ─── */
export async function generateWithTemplatePack(
  options: GenerateOptions,
): Promise<GenerateResult> {
  const { topic, difficulty = '初中', templateId, languageModel, modelInfo } = options;

  try {
    // ═══════════════════════════════════════════════════════
    // Step 1: 生成大纲（cover + toc + end）
    // ═══════════════════════════════════════════════════════
    log.info(`Step 1: Generating outline for "${topic}"`);
    let outline: OutlineResult;
    let outlineAttempts = 0;
    const maxOutlineAttempts = 3;

    while (outlineAttempts < maxOutlineAttempts) {
      outlineAttempts++;
      try {
        outline = await generateOutline(topic, difficulty, languageModel, modelInfo);
        const check = validateOutline(outline, topic);
        if (check.valid) {
          log.info(`Outline validation passed on attempt ${outlineAttempts}`);
          break;
        }
        log.warn(`Outline validation failed (attempt ${outlineAttempts}): ${check.reason}`);
        void writeValidationDebugLog(topic, templateId, 'outline', outlineAttempts, check.reason!, {
          outline,
          relevance: computeTopicRelevance(JSON.stringify(outline), topic),
        });
        if (outlineAttempts >= maxOutlineAttempts) {
          log.error('All outline attempts failed, using last result anyway');
        }
      } catch (e) {
        log.warn(`Outline generation failed (attempt ${outlineAttempts}): ${e}`);
        if (outlineAttempts >= maxOutlineAttempts) {
          return { success: false, error: `大纲生成失败: ${e}` };
        }
      }
    }

    // 安全访问（TypeScript需要）
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const finalOutline = outline!;
    log.info(`Outline generated: ${finalOutline.toc.items.map(i => i.title).join(' / ')}`);

    // ═══════════════════════════════════════════════════════
    // Step 2: 根据大纲生成正文（chapter + content_a + content_b + table）
    // ═══════════════════════════════════════════════════════
    log.info(`Step 2: Generating content from outline`);
    let contentJson: Record<string, unknown>;
    let contentAttempts = 0;
    const maxContentAttempts = 3;

    let lastError: string | undefined;
    while (contentAttempts < maxContentAttempts) {
      contentAttempts++;
      try {
        contentJson = await generateContentFromOutline(
          topic, difficulty, templateId, finalOutline, languageModel, modelInfo,
          lastError,
        );

        // 校验正文质量
        const relevanceCheck = validateContentRelevance(contentJson, topic);
        const consistencyCheck = validateTocConsistency(finalOutline, contentJson);

        if (relevanceCheck.valid && consistencyCheck.valid) {
          log.info(`Content validation passed on attempt ${contentAttempts}`);
          break;
        }

        const reasons = [
          relevanceCheck.valid ? null : relevanceCheck.reason,
          consistencyCheck.valid ? null : consistencyCheck.reason,
        ].filter(Boolean).join('; ');
        lastError = reasons;
        log.warn(`Content validation failed (attempt ${contentAttempts}): ${reasons}`);

        const blacklist = getBlacklist(topic);
        const blacklistHits = blacklist.filter(term => JSON.stringify(contentJson).includes(term));
        void writeValidationDebugLog(topic, templateId, 'content', contentAttempts, reasons, {
          outline: finalOutline,
          content: contentJson,
          relevance: computeTopicRelevance(JSON.stringify(contentJson), topic),
          blacklistHits,
        });

        if (contentAttempts >= maxContentAttempts) {
          log.error('All content attempts failed');
          return { success: false, error: `正文生成失败: ${reasons}` };
        }
      } catch (e) {
        lastError = String(e);
        log.warn(`Content generation failed (attempt ${contentAttempts}): ${e}`);
        if (contentAttempts >= maxContentAttempts) {
          return { success: false, error: `正文生成失败: ${e}` };
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const finalContent = contentJson!;

    // 模板特定后处理：modern-geometric 需要 section_header 字段
    if (templateId === 'modern-geometric' && finalContent.content_a) {
      const ca = finalContent.content_a as Record<string, string>;
      if (!ca.section_header_1) ca.section_header_1 = '核心要点';
      if (!ca.section_header_2) ca.section_header_2 = '深入理解';
    }

    // ═══════════════════════════════════════════════════════
    // Step 3: 合并JSON
    // ═══════════════════════════════════════════════════════
    const fullJson = {
      ...finalOutline,
      ...finalContent,
    };

    // ═══════════════════════════════════════════════════════
    // Step 4: 调用Python填充引擎
    // ═══════════════════════════════════════════════════════
    const timestamp = Date.now();
    const safeTopic = topic.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_').substring(0, 20);
    const fileName = `${safeTopic}_${templateId}_${timestamp}.pptx`;
    const outputDir = path.resolve(process.cwd(), 'public/temp/pptx');
    const outputPath = path.join(outputDir, fileName);

    await fs.mkdir(outputDir, { recursive: true });

    const fillerResult = await callPythonFiller(templateId, fullJson, outputPath);

    if (!fillerResult.success) {
      return { success: false, error: fillerResult.error || 'PPT填充失败' };
    }

    const pptxUrl = `/temp/pptx/${fileName}`;

    return {
      success: true,
      pptxUrl,
      fileName,
      filledCount: fillerResult.filledCount,
      totalFields: fillerResult.totalFields,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Template pack generation failed: ${msg}`);
    return { success: false, error: msg };
  }
}
